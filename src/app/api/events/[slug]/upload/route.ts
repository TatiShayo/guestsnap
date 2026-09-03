/**
 * PUBLIC guest upload endpoint — the app's #1 attack surface. Layers, in order:
 *  1. Per-IP + per-event sliding-window rate limits.
 *  2. Invisible captcha (Turnstile / mock) verification.
 *  3. Event exists, is active, not archived.
 *  4. Tier upload-limit enforcement (server-side count, no client trust).
 *  5. Magic-byte type validation, size caps, SVG rejection, video duration cap.
 *  6. sharp re-encode of every image -> neutralizes malformed files AND strips
 *     EXIF/GPS metadata (mandatory privacy measure). Videos stored as-is.
 *  7. NSFW/gore moderation; flagged (or host "approve first") -> needsReview.
 * Uses the service role (memory/Supabase store) after these checks — never the
 * caller's session. Errors to the client are generic; details go to monitoring.
 */
import { NextResponse } from "next/server";
import { getData, getBlobs } from "@/lib/data";
import { clientIp, rateLimit, LIMITS } from "@/lib/ratelimit";
import { getCaptchaProvider } from "@/lib/providers/captcha";
import { getModerationProvider } from "@/lib/providers/moderation";
import { validateUpload, REJECTION_MESSAGES } from "@/lib/upload-validation";
import { processImage } from "@/lib/image";
import { TIERS, GUESTBOOK_MAX_SECONDS } from "@/lib/tiers";
import { serverTrack } from "@/lib/analytics-server";
import { captureError } from "@/lib/monitoring";
import { jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ip = clientIp(req);

  // 1. Rate limits (per IP, then per event).
  const ipLimit = rateLimit(`upload:ip:${ip}`, LIMITS.uploadPerIp.limit, LIMITS.uploadPerIp.windowMs);
  if (!ipLimit.ok) return jsonError(429, "too_many_requests", { retryAfterSec: ipLimit.retryAfterSec });

  const data = getData();
  const event = await data.getEventBySlug(slug);
  if (!event) return jsonError(404, "event_not_found");

  const evtLimit = rateLimit(`upload:evt:${event.id}`, LIMITS.uploadPerEvent.limit, LIMITS.uploadPerEvent.windowMs);
  if (!evtLimit.ok) return jsonError(429, "too_many_requests", { retryAfterSec: evtLimit.retryAfterSec });

  // 3. Event must be open for uploads.
  if (!event.isActive || event.archivedAt) return jsonError(403, "event_closed");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "invalid_request");
  }

  // 2. Captcha (invisible). Mock passes; rate limits still applied above.
  const captchaToken = (form.get("captchaToken") as string) || null;
  const captchaOk = await getCaptchaProvider().verify(captchaToken, ip);
  if (!captchaOk) return jsonError(403, "captcha_failed");

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return jsonError(400, "empty_file");

  const uploaderNameRaw = ((form.get("uploaderName") as string) || "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .slice(0, 60);
  const uploaderName = uploaderNameRaw || null;
  const uploaderKey = ((form.get("uploaderKey") as string) || "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .slice(0, 64) || null;
  const wantsGuestbook = form.get("guestbook") === "1";

  // 4. Tier upload limit — server-side count is the source of truth. A cheap
  // pre-check rejects early; the authoritative, race-free enforcement is the
  // atomic insertMediaWithinLimit() at persist time (below).
  const spec = TIERS[event.tier];
  const used = await data.countMedia(event.id);
  if (used >= spec.uploadLimit) {
    await serverTrack("guest", "upload_limit_hit", { event_id: event.id, tier: event.tier });
    return jsonError(403, "upload_limit_reached", { tier: event.tier });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // 5. Validate by magic bytes / size / SVG / video duration.
  const check = await validateUpload(buffer);
  if (!check.ok) {
    await serverTrack("guest", "guest_upload_rejected", { event_id: event.id, reason: check.reason });
    return jsonError(400, check.reason, { message: REJECTION_MESSAGES[check.reason] });
  }

  const meta = { uploaderName, uploaderKey, wantsGuestbook, filename: file.name };
  try {
    if (check.value.kind === "photo") {
      return await handlePhoto(event, buffer, meta, check.value.mime);
    }
    return await handleVideo(event, buffer, check.value, meta);
  } catch (e) {
    captureError(e, { where: "upload.process", eventId: event.id });
    return jsonError(500, "processing_failed");
  }
}

interface UploadMeta {
  uploaderName: string | null;
  uploaderKey: string | null;
  wantsGuestbook: boolean;
  filename: string;
}

async function handlePhoto(
  event: NonNullable<Awaited<ReturnType<ReturnType<typeof getData>["getEventBySlug"]>>>,
  buffer: Buffer,
  meta: UploadMeta,
  mime?: string
): Promise<Response> {
  const data = getData();
  // 6. Re-encode -> strips EXIF/GPS, neutralizes malformed files, handles HEIC.
  const processed = await processImage(buffer, mime);

  // 7. Moderation on the re-encoded image.
  const mod = await getModerationProvider().checkImage(processed.original, meta.filename);
  const needsReview = mod.flagged || event.requireApproval;

  const base = `events/${event.id}/${Date.now()}-${rand()}`;
  const storagePath = `${base}.jpg`;
  const thumbPath = `${base}.thumb.webp`;
  const blobs = getBlobs();
  await blobs.put(storagePath, processed.original, "image/jpeg");
  await blobs.put(thumbPath, processed.thumb, "image/webp");

  const media = await data.insertMediaWithinLimit({
    eventId: event.id,
    storagePath,
    thumbPath,
    type: "photo",
    uploaderName: meta.uploaderName,
    uploaderKey: meta.uploaderKey,
    phash: processed.phash,
    sharpness: processed.sharpness,
    isHidden: false,
    isFavorite: false,
    needsReview,
    flagReason: mod.flagged ? mod.reason : null,
    reportCount: 0,
    isGuestbook: false,
    width: processed.width,
    height: processed.height,
    durationSec: null,
    sizeBytes: processed.original.length,
  }, TIERS[event.tier].uploadLimit);

  if (!media) {
    // Lost the atomic limit race — don't leave orphan blobs behind.
    await blobs.delete(storagePath).catch(() => {});
    await blobs.delete(thumbPath).catch(() => {});
    await serverTrack("guest", "upload_limit_hit", { event_id: event.id, tier: event.tier });
    return jsonError(403, "upload_limit_reached", { tier: event.tier });
  }

  await serverTrack("guest", "guest_upload_completed", { event_id: event.id, media_id: media.id, type: "photo" });
  return NextResponse.json({ ok: true, id: media.id, needsReview });
}

async function handleVideo(
  event: NonNullable<Awaited<ReturnType<ReturnType<typeof getData>["getEventBySlug"]>>>,
  buffer: Buffer,
  validated: { mime: string; durationSec: number | null },
  meta: UploadMeta
): Promise<Response> {
  const data = getData();
  const isGuestbook = meta.wantsGuestbook;
  // Video guestbook is a Premium feature.
  if (isGuestbook && !TIERS[event.tier].videoGuestbook) {
    return jsonError(403, "guestbook_not_available", { tier: event.tier });
  }
  const dur = validated.durationSec;
  if (isGuestbook && dur !== null && dur > GUESTBOOK_MAX_SECONDS + 2) {
    return jsonError(400, "video_too_long", { message: REJECTION_MESSAGES.video_too_long });
  }

  // Videos aren't re-encoded here (no ffmpeg); stored as validated bytes.
  // Host review is the safety net for video since NSFW screening is images-only.
  const ext = validated.mime === "video/quicktime" ? "mov" : validated.mime === "video/webm" ? "webm" : "mp4";
  const storagePath = `events/${event.id}/${Date.now()}-${rand()}.${ext}`;
  await getBlobs().put(storagePath, buffer, validated.mime);

  const media = await data.insertMediaWithinLimit({
    eventId: event.id,
    storagePath,
    thumbPath: null,
    type: "video",
    uploaderName: meta.uploaderName,
    uploaderKey: meta.uploaderKey,
    phash: null,
    sharpness: null,
    isHidden: false,
    isFavorite: false,
    needsReview: event.requireApproval, // held if host approves-first
    flagReason: null,
    reportCount: 0,
    isGuestbook,
    width: null,
    height: null,
    durationSec: dur,
    sizeBytes: buffer.length,
  }, TIERS[event.tier].uploadLimit);

  if (!media) {
    await getBlobs().delete(storagePath).catch(() => {});
    await serverTrack("guest", "upload_limit_hit", { event_id: event.id, tier: event.tier });
    return jsonError(403, "upload_limit_reached", { tier: event.tier });
  }

  await serverTrack("guest", "guest_upload_completed", { event_id: event.id, media_id: media.id, type: "video" });
  return NextResponse.json({ ok: true, id: media.id, needsReview: media.needsReview });
}

function rand(): string {
  return Math.random().toString(36).slice(2, 10);
}
