/**
 * Event lifecycle: post-event host email (stats + referral), guest
 * album-request fulfillment, archive warning, and the archive/purge state
 * machine (PLAYBOOK 2.7 + 3.2/3.4). Pure server-side logic, called by the
 * daily cron route — kept out of the route file so it's independently
 * testable and reusable by the seed script / manual admin triggers.
 *
 * Retention model (PROJECT_STATE): free events archive 90 days after
 * event_date (warning at day 75); paid events keep media for
 * event.retentionMonths (12 by default, 24 with the checkout bump).
 * Archive is soft (media hidden from guests, host still has 30-day grace
 * via archivedAt), then hard-purged (blobs + rows deleted) 30 days later.
 */
import { getData, getBlobs } from "@/lib/data";
import { getEmailProvider } from "@/lib/providers/email";
import { emailShell } from "@/lib/email-templates";
import { config } from "@/lib/config";
import { formatDate, pluralize } from "@/lib/utils";
import { captureError } from "@/lib/monitoring";

const DAY_MS = 24 * 60 * 60 * 1000;
const ARCHIVE_GRACE_DAYS = 30; // soft-delete window before hard purge

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}
function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / DAY_MS);
}

export interface LifecycleRunResult {
  postEventEmailsSent: number;
  archiveWarningsSent: number;
  albumRequestEmailsSent: number;
  eventsArchived: number;
  eventsPurged: number;
  errors: string[];
}

export async function runLifecycleJobs(): Promise<LifecycleRunResult> {
  const result: LifecycleRunResult = {
    postEventEmailsSent: 0,
    archiveWarningsSent: 0,
    albumRequestEmailsSent: 0,
    eventsArchived: 0,
    eventsPurged: 0,
    errors: [],
  };
  const data = getData();
  const events = await data.listAllEvents();

  for (const event of events) {
    if (event.isDemo) continue;
    try {
      // 1. Post-event stats + referral email — day after the event date.
      const sinceEvent = daysSince(event.eventDate);
      if (sinceEvent === 1) {
        const sent = await sendPostEventStats(event.id);
        if (sent) result.postEventEmailsSent++;
      }

      // 2. Guest album-request fulfillment — as soon as an email is captured
      //    for an event whose date has passed (host has had a chance to curate).
      if (sinceEvent >= 1) {
        result.albumRequestEmailsSent += await sendAlbumRequestEmails(event.id);
      }

      // 3. Archive warning at day 75 (free) — paid events don't auto-archive.
      const retentionDays = event.tier === "free" ? 90 : event.retentionMonths * 30;
      const warningDays = retentionDays - 15;
      if (event.tier === "free" && sinceEvent === warningDays && !event.archivedAt) {
        const sent = await sendArchiveWarning(event.id, retentionDays - sinceEvent);
        if (sent) result.archiveWarningsSent++;
      }

      // 4. Soft-archive once retention window elapses.
      if (!event.archivedAt && sinceEvent >= retentionDays) {
        await data.updateEvent(event.id, { archivedAt: new Date().toISOString(), isActive: false });
        result.eventsArchived++;
      }

      // 5. Hard purge after the 30-day grace period post-archive.
      if (event.archivedAt && !event.purgedAt && daysSince(event.archivedAt) >= ARCHIVE_GRACE_DAYS) {
        await purgeEventMedia(event.id);
        await data.updateEvent(event.id, { purgedAt: new Date().toISOString() });
        result.eventsPurged++;
      }
    } catch (e) {
      captureError(e, { where: "lifecycle.run", eventId: event.id });
      result.errors.push(event.id);
    }
  }

  return result;
}

async function sendPostEventStats(eventId: string): Promise<boolean> {
  const data = getData();
  const event = await data.getEvent(eventId);
  if (!event) return false;
  if (await data.hasSentEmail("post_event_stats", "host", eventId)) return false;

  const profile = await data.getProfile(event.hostId);
  if (!profile) return false;

  const media = await data.listMedia(eventId, { includeHidden: true });
  const uploaderCount = new Set(media.map((m) => m.uploaderKey).filter(Boolean)).size;

  const html = emailShell({
    heading: `${event.title} — the numbers are in`,
    bodyHtml: `
      <p>Your event wrapped on ${formatDate(event.eventDate)}. Here's what your guests left behind:</p>
      <ul style="padding-left:20px;">
        <li>${pluralize(media.length, "photo or video")}</li>
        <li>${pluralize(uploaderCount, "guest")} contributed</li>
      </ul>
      <p>Download the full album while it's fresh, and thank you for using GuestSnap.</p>
      <p style="margin-top:20px;">Planning another event? Use code <strong>${profile.referralCode}</strong>
      for $10 off your next one — and so does whoever you send it to.</p>`,
    ctaLabel: "Open your gallery",
    ctaUrl: `${config.appUrl}/dashboard/${event.slug}`,
  });

  const res = await getEmailProvider().send({ to: profile.email, subject: `Your ${event.title} recap`, html });
  if (res.ok) await data.recordEmailSent("post_event_stats", "host", eventId);
  return res.ok;
}

async function sendArchiveWarning(eventId: string, daysLeft: number): Promise<boolean> {
  const data = getData();
  const event = await data.getEvent(eventId);
  if (!event) return false;
  if (await data.hasSentEmail("archive_warning", "host", eventId)) return false;

  const profile = await data.getProfile(event.hostId);
  if (!profile) return false;

  const html = emailShell({
    heading: `${event.title} archives in ${pluralize(Math.max(daysLeft, 1), "day")}`,
    bodyHtml: `
      <p>Free events keep photos for 90 days after the event date. ${event.title} will archive soon —
      download your photos now so you never lose them.</p>
      <p>Upgrading keeps everything for a full year (and unlocks ZIP download, the live slideshow,
      and more) — one click, no subscription.</p>`,
    ctaLabel: "Download or upgrade",
    ctaUrl: `${config.appUrl}/dashboard/${event.slug}`,
  });

  const res = await getEmailProvider().send({ to: profile.email, subject: `${event.title} — archiving soon`, html });
  if (res.ok) await data.recordEmailSent("archive_warning", "host", eventId);
  return res.ok;
}

async function sendAlbumRequestEmails(eventId: string): Promise<number> {
  const data = getData();
  const event = await data.getEvent(eventId);
  if (!event) return 0;

  const subscribers = await data.listSubscribers(eventId);
  let sent = 0;
  for (const sub of subscribers) {
    if (await data.hasSentEmail("guest_album_ready", sub.email, eventId)) continue;
    const html = emailShell({
      heading: `${event.title} — your photos are ready`,
      bodyHtml: `
        <p>You asked us to send the album from ${event.title}. Here it is.</p>
        <p>Hosting your own wedding, party, or gathering? GuestSnap collects everyone's photos with
        just a QR code — no app, no accounts. First event's free.</p>`,
      ctaLabel: "View the gallery",
      ctaUrl: `${config.appUrl}/e/${event.slug}`,
    });
    const res = await getEmailProvider().send({ to: sub.email, subject: `${event.title} — your photos`, html });
    if (res.ok) {
      await data.recordEmailSent("guest_album_ready", sub.email, eventId);
      sent++;
    }
  }
  return sent;
}

async function purgeEventMedia(eventId: string): Promise<void> {
  const data = getData();
  const blobs = getBlobs();
  const media = await data.listMedia(eventId, { includeHidden: true });
  for (const m of media) {
    await blobs.delete(m.storagePath).catch(() => {});
    if (m.thumbPath) await blobs.delete(m.thumbPath).catch(() => {});
    await data.deleteMedia(m.id);
  }
}
