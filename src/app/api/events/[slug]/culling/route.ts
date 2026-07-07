/**
 * AI culling (Premium): groups near-duplicate photos by perceptual hash
 * (hamming distance <=10) and pre-selects the sharpest shot per group
 * (variance-of-Laplacian, computed at upload time in lib/image.ts). Host-only,
 * re-validates ownership + tier. Read-only — the "keep" selection only takes
 * effect when the host acts on it via the existing hide/favorite endpoints.
 */
import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { ApiError, withErrorHandling, requireEventOwner } from "@/lib/api";
import { toMediaViews } from "@/lib/media";
import { groupByHash } from "@/lib/phash";
import { TIERS } from "@/lib/tiers";

export const GET = withErrorHandling(
  "events.culling",
  async (_req: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const found = await getData().getEventBySlug(slug);
    if (!found) throw new ApiError(404, "event_not_found");
    const { event } = await requireEventOwner(found.id);

    if (!TIERS[event.tier].aiCulling) throw new ApiError(403, "ai_culling_not_available");

    const data = getData();
    const media = await data.listMedia(event.id, { includeHidden: false });
    const photos = media.filter((m) => m.type === "photo" && m.phash);

    const groups = groupByHash(
      photos.map((m) => ({ id: m.id, phash: m.phash })),
      10
    );

    const byId = new Map(photos.map((m) => [m.id, m]));
    const views = await toMediaViews(photos, { hideUploader: event.hideUploaderNames });
    const viewById = new Map(views.map((v) => [v.id, v]));

    const groupViews = groups
      .map((ids) => {
        const members = ids.map((gid) => byId.get(gid)!).filter(Boolean);
        if (members.length === 0) return null;
        const best = members.reduce((a, b) => ((b.sharpness ?? 0) > (a.sharpness ?? 0) ? b : a));
        return {
          bestId: best.id,
          items: ids.map((gid) => viewById.get(gid)).filter((v): v is NonNullable<typeof v> => !!v),
        };
      })
      .filter((g): g is NonNullable<typeof g> => !!g && g.items.length > 1);

    return NextResponse.json({
      groups: groupViews,
      totalPhotos: photos.length,
      duplicatesFound: groupViews.reduce((n, g) => n + g.items.length, 0),
    });
  }
);
