/**
 * Public gallery/slideshow feed. No auth, but gated by the event's own
 * privacy rules: visibility "host" blocks all public reads; "own" scopes to
 * the requesting guest's uploaderKey; "gallery" (default) shows everyone's
 * approved uploads. PIN-protected slideshows require a valid slideshow
 * access token. Supports `since` (ISO timestamp) for the live slideshow's
 * polling loop to fetch only new arrivals.
 */
import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { toMediaViews } from "@/lib/media";
import { hasSlideshowAccess } from "@/lib/slideshow-access";
import { jsonError, withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(
  "events.gallery",
  async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const event = await getData().getEventBySlug(slug);
    if (!event) return jsonError(404, "event_not_found");

    const url = new URL(req.url);
    const pinToken = url.searchParams.get("pin_token");
    const uploaderKey = url.searchParams.get("uploaderKey");
    const since = url.searchParams.get("since");

    if (event.visibility === "host") return jsonError(403, "host_only");
    if (!hasSlideshowAccess(event, pinToken)) return jsonError(403, "pin_required");

    // If visibility is restricted to own uploads, callers without an uploaderKey see nothing.
    if (event.visibility === "own" && !uploaderKey) {
      return NextResponse.json({
        media: [],
        nextOffset: null,
        serverTime: new Date().toISOString(),
      });
    }

    // Pagination: bounded page size so a large event can't force the server to
    // sign a URL for (and serialize) thousands of media in one response. The
    // live slideshow's `since` polling path is exempt — it fetches only the
    // handful of items newer than its cursor.
    const PAGE_MAX = 100;
    const limitParam = Number(url.searchParams.get("limit"));
    const offsetParam = Number(url.searchParams.get("offset"));
    const rawLimit = Number.isFinite(limitParam) ? Math.floor(limitParam) : 60;
    const limit = rawLimit >= 1 ? Math.min(rawLimit, PAGE_MAX) : 60;
    const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? Math.floor(offsetParam) : 0;

    const data = getData();
    const filter = event.visibility === "own" && uploaderKey ? { uploaderKey } : {};
    // Always bound the read — even the `since` live-poll path. Media is returned
    // newest-first, so new arrivals since a recent cursor are always within the
    // newest PAGE_MAX rows; capping stops a public endpoint from being forced to
    // load an entire large event's media on every poll (amplification/DoS).
    let media = await data.listMedia(
      event.id,
      since ? { ...filter, limit: PAGE_MAX } : { ...filter, limit, offset }
    );
    media = media.filter((m) => !m.isGuestbook); // guestbook has its own tab, not the slideshow feed
    if (since) media = media.filter((m) => m.createdAt > since);

    const views = await toMediaViews(media, { hideUploader: event.hideUploaderNames });
    return NextResponse.json({
      media: views,
      nextOffset: !since && media.length === limit ? offset + limit : null,
      serverTime: new Date().toISOString(),
    });
  }
);
