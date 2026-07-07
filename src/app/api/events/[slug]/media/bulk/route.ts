/**
 * Bulk moderation actions from the host gallery's multi-select toolbar.
 * Re-checks event ownership once, then re-validates EVERY id belongs to that
 * event before mutating (never trust a batch of client-supplied ids blindly).
 * Capped batch size to keep the request cheap.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getData, getBlobs } from "@/lib/data";
import { ApiError, parseBody, withErrorHandling, requireEventOwner } from "@/lib/api";
import { serverTrack } from "@/lib/analytics-server";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(["hide", "show", "favorite", "unfavorite", "approve", "delete"]),
});

export const POST = withErrorHandling(
  "events.media.bulk",
  async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const data = getData();
    const found = await data.getEventBySlug(slug);
    if (!found) throw new ApiError(404, "event_not_found");
    const { event } = await requireEventOwner(found.id);

    const { ids, action } = await parseBody(req, schema);

    let affected = 0;
    for (const mediaId of ids) {
      const media = await data.getMedia(mediaId);
      if (!media || media.eventId !== event.id) continue; // skip anything not owned
      if (action === "delete") {
        const blobs = getBlobs();
        await blobs.delete(media.storagePath).catch(() => {});
        if (media.thumbPath) await blobs.delete(media.thumbPath).catch(() => {});
        await data.deleteMedia(media.id);
      } else {
        const patch: Partial<{ isHidden: boolean; isFavorite: boolean; needsReview: boolean }> = {};
        if (action === "hide") patch.isHidden = true;
        if (action === "show") patch.isHidden = false;
        if (action === "favorite") patch.isFavorite = true;
        if (action === "unfavorite") patch.isFavorite = false;
        if (action === "approve") patch.needsReview = false;
        await data.updateMedia(media.id, patch);
      }
      affected++;
    }

    await serverTrack(event.hostId, "media_moderated", { event_id: event.id, action: `bulk_${action}` });
    return NextResponse.json({ ok: true, affected });
  }
);
