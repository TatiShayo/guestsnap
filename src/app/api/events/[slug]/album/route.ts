/**
 * Guest album email capture (growth loop). Public + rate-limited. Stores the
 * email against the event; the post-event lifecycle job emails the gallery
 * link + "host your own event" CTA. Only what the feature needs is collected.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getData } from "@/lib/data";
import { clientIp, rateLimit, LIMITS } from "@/lib/ratelimit";
import { parseBody, jsonError, withErrorHandling } from "@/lib/api";
import { serverTrack } from "@/lib/analytics-server";

const schema = z.object({ email: z.string().email().max(254) });

export const POST = withErrorHandling(
  "events.album",
  async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const rl = rateLimit(`album:${clientIp(req)}`, LIMITS.albumSignupPerIp.limit, LIMITS.albumSignupPerIp.windowMs);
    if (!rl.ok) return jsonError(429, "too_many_requests", { retryAfterSec: rl.retryAfterSec });

    const { slug } = await params;
    const event = await getData().getEventBySlug(slug);
    if (!event) return jsonError(404, "event_not_found");

    const { email } = await parseBody(req, schema);
    await getData().addSubscriber(event.id, email);
    await serverTrack("guest", "album_email_captured", { event_id: event.id });
    return NextResponse.json({ ok: true });
  }
);
