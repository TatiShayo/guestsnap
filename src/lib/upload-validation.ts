/**
 * Upload hygiene: magic-byte type verification (never trust extension or
 * declared mime), size caps, SVG rejection, and a minimal MP4/MOV duration
 * probe (mvhd box) so 45s video caps are enforced without ffmpeg.
 */
import { fileTypeFromBuffer } from "file-type";
import { PHOTO_MAX_BYTES, VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS } from "@/lib/tiers";

export const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif", "image/gif",
]);
export const ALLOWED_VIDEO_MIMES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export interface ValidatedUpload {
  kind: "photo" | "video";
  mime: string;
  durationSec: number | null;
}

export type UploadRejection =
  | "empty_file"
  | "unsupported_type"
  | "svg_rejected"
  | "photo_too_large"
  | "video_too_large"
  | "video_too_long";

export function isSvg(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  // Sniff sample from up to first 65536 bytes, removing BOM, null bytes and trimming
  const sampleLen = Math.min(buffer.length, 65536);
  const sample = buffer.subarray(0, sampleLen).toString("utf8").replace(/^\uFEFF/, "").replace(/\0/g, "").trimStart().toLowerCase();
  const stripped = sample.replace(/<!--[\s\S]*?-->/g, "").trimStart();
  return (
    stripped.startsWith("<svg") ||
    stripped.startsWith("<?xml") ||
    stripped.startsWith("<!doctype svg") ||
    stripped.startsWith("<!doctype html") ||
    stripped.startsWith("<html") ||
    stripped.includes("<svg") ||
    stripped.includes("<script") ||
    stripped.includes('xmlns="http://www.w3.org/2000/svg"') ||
    stripped.includes("xmlns='http://www.w3.org/2000/svg'")
  );
}

export async function validateUpload(buffer: Buffer): Promise<
  { ok: true; value: ValidatedUpload } | { ok: false; reason: UploadRejection }
> {
  if (buffer.length === 0) return { ok: false, reason: "empty_file" };

  // Reject SVG early (XSS vector) — file-type doesn't detect SVG, so sniff.
  if (isSvg(buffer)) {
    return { ok: false, reason: "svg_rejected" };
  }

  const detected = await fileTypeFromBuffer(buffer.subarray(0, 8192));
  if (!detected) return { ok: false, reason: "unsupported_type" };

  if (ALLOWED_IMAGE_MIMES.has(detected.mime)) {
    if (buffer.length > PHOTO_MAX_BYTES) return { ok: false, reason: "photo_too_large" };
    return { ok: true, value: { kind: "photo", mime: detected.mime, durationSec: null } };
  }

  if (ALLOWED_VIDEO_MIMES.has(detected.mime)) {
    if (buffer.length > VIDEO_MAX_BYTES) return { ok: false, reason: "video_too_large" };
    const durationSec = probeMp4Duration(buffer);
    if (durationSec !== null && durationSec > VIDEO_MAX_SECONDS) {
      return { ok: false, reason: "video_too_long" };
    }
    return { ok: true, value: { kind: "video", mime: detected.mime, durationSec } };
  }

  return { ok: false, reason: "unsupported_type" };
}

/**
 * Parse the mvhd box of an MP4/MOV for duration. Returns null for formats
 * we can't probe (e.g. WebM) — those fall back to the size cap.
 */
export function probeMp4Duration(buffer: Buffer): number | null {
  const idx = buffer.indexOf("mvhd");
  if (idx < 0 || idx + 8 > buffer.length) return null;
  const version = buffer.readUInt8(idx + 4);
  try {
    let timescale = 0;
    let duration = 0;
    if (version === 1) {
      if (idx + 36 > buffer.length) return null;
      timescale = buffer.readUInt32BE(idx + 24);
      const rawDur = buffer.readBigUInt64BE(idx + 28);
      duration = Number(rawDur);
    } else {
      if (idx + 24 > buffer.length) return null;
      timescale = buffer.readUInt32BE(idx + 16);
      duration = buffer.readUInt32BE(idx + 20);
    }
    if (!timescale || timescale <= 0) return null;
    const durSec = duration / timescale;
    if (!Number.isFinite(durSec) || isNaN(durSec) || durSec < 0) return null;
    return durSec;
  } catch {
    return null;
  }
}

export const REJECTION_MESSAGES: Record<UploadRejection, string> = {
  empty_file: "That file looks empty. Try picking it again.",
  unsupported_type: "We can accept photos (JPG, PNG, HEIC, WebP) and short videos (MP4, MOV, WebM).",
  svg_rejected: "SVG files can't be uploaded here.",
  photo_too_large: "Photos can be up to 25MB. Your camera roll original should be fine — try again.",
  video_too_large: "Videos can be up to 100MB. Try a shorter clip.",
  video_too_long: "Videos can be up to 45 seconds long.",
};
