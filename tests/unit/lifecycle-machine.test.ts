import { describe, expect, it } from "vitest";
import { runLifecycleJobs } from "@/lib/lifecycle";
import { getData } from "@/lib/data";

const DAY_MS = 24 * 60 * 60 * 1000;
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
}

describe("Event Lifecycle State Machine and Retention Jobs", () => {
  it("sends post-event stats email exactly 1 day after event date and dedupes", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-life-1", email: "host1@lifecycle.test" });
    await data.createEvent({
      hostId: host.id,
      slug: `life-post-event-${Date.now()}`,
      title: "Post Event Recap Test",
      eventType: "wedding",
      eventDate: isoDaysAgo(1), // 1 day ago
      coverPath: null,
      tier: "standard",
      brandColor: null,
      welcomeMessage: null,
      uploadLimit: 500,
      isActive: true,
      requireApproval: false,
      visibility: "gallery",
      slideshowPinHash: null,
      hideUploaderNames: false,
      retentionMonths: 12,
      isDemo: false,
      archivedAt: null,
      purgedAt: null,
    });

    const res1 = await runLifecycleJobs();
    expect(res1.postEventEmailsSent).toBeGreaterThanOrEqual(1);

    // Second run must dedupe and not send duplicate email
    const res2 = await runLifecycleJobs();
    expect(res2.postEventEmailsSent).toBe(0);
  });

  it("fulfills guest album-ready subscriber emails", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-life-sub", email: "host-sub@lifecycle.test" });
    const event = await data.createEvent({
      hostId: host.id,
      slug: `life-sub-${Date.now()}`,
      title: "Album Subscriber Test",
      eventType: "birthday",
      eventDate: isoDaysAgo(2), // 2 days ago
      coverPath: null,
      tier: "free",
      brandColor: null,
      welcomeMessage: null,
      uploadLimit: 20,
      isActive: true,
      requireApproval: false,
      visibility: "gallery",
      slideshowPinHash: null,
      hideUploaderNames: false,
      retentionMonths: 3,
      isDemo: false,
      archivedAt: null,
      purgedAt: null,
    });

    await data.addSubscriber(event.id, "guest1@test.com");
    await data.addSubscriber(event.id, "guest2@test.com");

    const res = await runLifecycleJobs();
    expect(res.albumRequestEmailsSent).toBeGreaterThanOrEqual(2);
  });

  it("sends archive warning at day 75 for free events (15 days before 90-day archive)", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-life-warn", email: "host-warn@lifecycle.test" });
    await data.createEvent({
      hostId: host.id,
      slug: `life-warn-${Date.now()}`,
      title: "Archive Warning Test",
      eventType: "corporate",
      eventDate: isoDaysAgo(75), // day 75
      coverPath: null,
      tier: "free",
      brandColor: null,
      welcomeMessage: null,
      uploadLimit: 20,
      isActive: true,
      requireApproval: false,
      visibility: "gallery",
      slideshowPinHash: null,
      hideUploaderNames: false,
      retentionMonths: 3,
      isDemo: false,
      archivedAt: null,
      purgedAt: null,
    });

    const res = await runLifecycleJobs();
    expect(res.archiveWarningsSent).toBeGreaterThanOrEqual(1);
  });

  it("soft-archives free events past 90 days retention window", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-life-arch", email: "host-arch@lifecycle.test" });
    const event = await data.createEvent({
      hostId: host.id,
      slug: `life-arch-${Date.now()}`,
      title: "Soft Archive Test",
      eventType: "wedding",
      eventDate: isoDaysAgo(91), // past 90 days
      coverPath: null,
      tier: "free",
      brandColor: null,
      welcomeMessage: null,
      uploadLimit: 20,
      isActive: true,
      requireApproval: false,
      visibility: "gallery",
      slideshowPinHash: null,
      hideUploaderNames: false,
      retentionMonths: 3,
      isDemo: false,
      archivedAt: null,
      purgedAt: null,
    });

    const res = await runLifecycleJobs();
    expect(res.eventsArchived).toBeGreaterThanOrEqual(1);

    const updated = await data.getEvent(event.id);
    expect(updated?.archivedAt).not.toBeNull();
    expect(updated?.isActive).toBe(false);
  });

  it("hard-purges media after 30-day grace period post-archive", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-life-purge", email: "host-purge@lifecycle.test" });
    const archivedDateIso = new Date(Date.now() - 32 * DAY_MS).toISOString();
    const event = await data.createEvent({
      hostId: host.id,
      slug: `life-purge-${Date.now()}`,
      title: "Hard Purge Test",
      eventType: "wedding",
      eventDate: isoDaysAgo(130),
      coverPath: null,
      tier: "free",
      brandColor: null,
      welcomeMessage: null,
      uploadLimit: 20,
      isActive: false,
      requireApproval: false,
      visibility: "gallery",
      slideshowPinHash: null,
      hideUploaderNames: false,
      retentionMonths: 3,
      isDemo: false,
      archivedAt: archivedDateIso, // archived 32 days ago
      purgedAt: null,
    });

    const media = await data.insertMedia({
      eventId: event.id,
      storagePath: `events/purge/photo1.jpg`,
      thumbPath: null,
      type: "photo",
      uploaderName: "Test",
      uploaderKey: "k",
      phash: null,
      sharpness: null,
      isHidden: false,
      isFavorite: false,
      needsReview: false,
      flagReason: null,
      reportCount: 0,
      isGuestbook: false,
      width: 10,
      height: 10,
      durationSec: null,
      sizeBytes: 10,
    });

    const res = await runLifecycleJobs();
    expect(res.eventsPurged).toBeGreaterThanOrEqual(1);

    const updatedEvent = await data.getEvent(event.id);
    expect(updatedEvent?.purgedAt).not.toBeNull();

    // Media row has been purged
    expect(await data.getMedia(media.id)).toBeNull();
  });

  it("skips demo events during lifecycle processing", async () => {
    const data = getData();
    const event = await data.createEvent({
      hostId: "demo-host",
      slug: `demo-event-${Date.now()}`,
      title: "Demo Event",
      eventType: "wedding",
      eventDate: isoDaysAgo(100),
      coverPath: null,
      tier: "free",
      brandColor: null,
      welcomeMessage: null,
      uploadLimit: 20,
      isActive: true,
      requireApproval: false,
      visibility: "gallery",
      slideshowPinHash: null,
      hideUploaderNames: false,
      retentionMonths: 3,
      isDemo: true, // Demo
      archivedAt: null,
      purgedAt: null,
    });

    await runLifecycleJobs();
    const updated = await data.getEvent(event.id);
    expect(updated?.archivedAt).toBeNull(); // not archived because it's a demo
  });
});
