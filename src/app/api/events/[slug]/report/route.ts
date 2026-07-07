/**
 * Public "report" button on gallery/slideshow items (PLAYBOOK content-safety
 * requirement). No auth — rate-limited per IP. >=1 report auto-hides pending
 * host review; this is a blunt, fast safety net, not a moderation verdict.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getData } from "@/lib/data";
import { clientIp, rateLimit, LIMITS } from "@/lib/ratelimit";
import { parseBody, jsonError, withErrorHandling } from "@/lib/api";
import { serverTrack } from "@/lib/analytics-server";

const schema = z.object({ mediaId: z.string().min(1) });

export const POST = withErrorHandling(
  "events.report",
  async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const rl = rateLimit(`report:${clientIp(req)}`, LIMITS.reportPerIp.limit, LIMITS.reportPerIp.windowMs);
    if (!rl.ok) return jsonError(429, "too_many_requests", { retryAfterSec: rl.retryAfterSec });

    const { slug } = await params;
    const data = getData();
    const event = await data.getEventBySlug(slug);
    if (!event) return jsonError(404, "event_not_found");

    const { mediaId } = await parseBody(req, schema);
    const media = await data.getMedia(mediaId);
    if (!media || media.eventId !== event.id) return jsonError(404, "media_not_found");

    await data.updateMedia(media.id, {
      reportCount: media.reportCount + 1,
      needsReview: true, // any report pulls it from public view pending host review
    });

    await serverTrack("guest", "media_reported", { event_id: event.id });
    return NextResponse.json({ ok: true });
  }
);
