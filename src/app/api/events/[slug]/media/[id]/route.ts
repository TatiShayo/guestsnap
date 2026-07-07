/**
 * Host moderation on a single media item: hide/show, favorite/unfavorite,
 * approve (clear needsReview), delete. Every action re-validates the caller
 * owns the event (object-level authorization) AND that the media row belongs
 * to that event — never trust the id alone.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getData, getBlobs, type EventRecord, type MediaRecord } from "@/lib/data";
import { ApiError, parseBody, withErrorHandling, requireEventOwner } from "@/lib/api";
import { serverTrack } from "@/lib/analytics-server";

const patchSchema = z.object({
  action: z.enum(["hide", "show", "favorite", "unfavorite", "approve"]),
});

async function loadOwnedMedia(
  slug: string,
  mediaId: string
): Promise<{ event: EventRecord; media: MediaRecord }> {
  const data = getData();
  const found = await data.getEventBySlug(slug);
  if (!found) throw new ApiError(404, "event_not_found");
  const { event } = await requireEventOwner(found.id);
  const media = await data.getMedia(mediaId);
  if (!media || media.eventId !== event.id) throw new ApiError(404, "media_not_found");
  return { event, media };
}

export const PATCH = withErrorHandling(
  "events.media.patch",
  async (req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) => {
    const { slug, id } = await params;
    const { event, media } = await loadOwnedMedia(slug, id);
    const { action } = await parseBody(req, patchSchema);

    const patch: Partial<{ isHidden: boolean; isFavorite: boolean; needsReview: boolean }> = {};
    if (action === "hide") patch.isHidden = true;
    if (action === "show") patch.isHidden = false;
    if (action === "favorite") patch.isFavorite = true;
    if (action === "unfavorite") patch.isFavorite = false;
    if (action === "approve") patch.needsReview = false;

    await getData().updateMedia(media.id, patch);
    await serverTrack(event.hostId, "media_moderated", { event_id: event.id, action });
    return NextResponse.json({ ok: true });
  }
);

export const DELETE = withErrorHandling(
  "events.media.delete",
  async (_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) => {
    const { slug, id } = await params;
    const { event, media } = await loadOwnedMedia(slug, id);

    const blobs = getBlobs();
    await blobs.delete(media.storagePath).catch(() => {});
    if (media.thumbPath) await blobs.delete(media.thumbPath).catch(() => {});
    await getData().deleteMedia(media.id);

    await serverTrack(event.hostId, "media_moderated", { event_id: event.id, action: "delete" });
    return NextResponse.json({ ok: true });
  }
);
