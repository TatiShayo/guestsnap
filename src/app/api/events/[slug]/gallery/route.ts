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

    const data = getData();
    const filter = event.visibility === "own" && uploaderKey ? { uploaderKey } : {};
    let media = await data.listMedia(event.id, filter);
    media = media.filter((m) => !m.isGuestbook); // guestbook has its own tab, not the slideshow feed
    if (since) media = media.filter((m) => m.createdAt > since);

    const views = await toMediaViews(media, { hideUploader: event.hideUploaderNames });
    return NextResponse.json({
      media: views,
      serverTime: new Date().toISOString(),
    });
  }
);
