/**
 * Server-only helpers to turn stored MediaRecords into short-lived signed
 * display URLs. All media is private; URLs are minted after the caller has
 * already passed the relevant access check (host ownership or event visibility).
 * Server-only: imports the blob store (Node fs / Supabase service role).
 */
import { getBlobs, type MediaRecord } from "@/lib/data";

export interface MediaView {
  id: string;
  type: "photo" | "video";
  url: string; // original (or video source)
  thumbUrl: string; // thumbnail for grids/slideshow
  uploaderName: string | null;
  isFavorite: boolean;
  isHidden: boolean;
  needsReview: boolean;
  reportCount: number;
  isGuestbook: boolean;
  width: number | null;
  height: number | null;
  createdAt: string;
}

const SIGNED_TTL = 60 * 60; // 1h — long enough for a gallery session

export async function toMediaView(m: MediaRecord, opts?: { hideUploader?: boolean }): Promise<MediaView> {
  const blobs = getBlobs();
  const url = await blobs.getSignedUrl(m.storagePath, SIGNED_TTL);
  const thumbUrl = m.thumbPath ? await blobs.getSignedUrl(m.thumbPath, SIGNED_TTL) : url;
  return {
    id: m.id,
    type: m.type,
    url,
    thumbUrl,
    uploaderName: opts?.hideUploader ? null : m.uploaderName,
    isFavorite: m.isFavorite,
    isHidden: m.isHidden,
    needsReview: m.needsReview,
    reportCount: m.reportCount,
    isGuestbook: m.isGuestbook,
    width: m.width,
    height: m.height,
    createdAt: m.createdAt,
  };
}

export async function toMediaViews(list: MediaRecord[], opts?: { hideUploader?: boolean }): Promise<MediaView[]> {
  return Promise.all(list.map((m) => toMediaView(m, opts)));
}
