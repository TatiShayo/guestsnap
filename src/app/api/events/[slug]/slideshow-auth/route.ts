/**
 * Slideshow PIN verification. Rate-limited (5/min) with a friendly lockout
 * message rather than a raw 429. On success, issues a short-lived signed
 * token the client stores and replays as `?pin_token=` on the gallery feed
 * and live-page requests — the PIN itself is never stored client-side.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getData } from "@/lib/data";
import { verifyPin, signToken } from "@/lib/tokens";
import { clientIp, rateLimit, LIMITS } from "@/lib/ratelimit";
import { parseBody, jsonError, withErrorHandling } from "@/lib/api";

const schema = z.object({ pin: z.string().min(4).max(4) });

export const POST = withErrorHandling(
  "events.slideshowAuth",
  async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const ip = clientIp(req);
    const rl = rateLimit(`pin:${ip}:${slug}`, LIMITS.pinPerIp.limit, LIMITS.pinPerIp.windowMs);
    if (!rl.ok) {
      return jsonError(429, "too_many_attempts", {
        message: "Too many tries — wait a minute and try again.",
        retryAfterSec: rl.retryAfterSec,
      });
    }

    const event = await getData().getEventBySlug(slug);
    if (!event) return jsonError(404, "event_not_found");
    if (!event.slideshowPinHash) return NextResponse.json({ ok: true, token: null }); // no PIN set

    const { pin } = await parseBody(req, schema);
    if (!verifyPin(pin, event.slideshowPinHash)) {
      return jsonError(403, "wrong_pin", { message: "That PIN doesn't match. Try again." });
    }

    const token = signToken({
      kind: "slideshow_access",
      eventId: event.id,
      exp: Math.floor(Date.now() / 1000) + 12 * 3600, // 12h — long enough for one event day
    });
    return NextResponse.json({ ok: true, token });
  }
);
