/**
 * Host "upgrade this event" checkout. Re-validates ownership server-side;
 * price/SKU math is resolved entirely from lib/tiers.ts — the client only
 * ever sends intent (which SKU + whether the retention bump is checked),
 * never an amount. Supports the standard/premium SKUs and the post-purchase
 * "premium_upgrade" delta SKU used by the one-click success-page upsell.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getData } from "@/lib/data";
import { getPaymentsProvider } from "@/lib/providers/payments";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { ApiError, parseBody, jsonError, withErrorHandling, requireEventOwner } from "@/lib/api";
import { serverTrack } from "@/lib/analytics-server";
import { config } from "@/lib/config";

const schema = z.object({
  sku: z.enum(["standard", "premium", "premium_upgrade"]),
  withRetentionBump: z.boolean().default(false),
});

export const POST = withErrorHandling(
  "events.checkout",
  async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const data = getData();
    const found = await data.getEventBySlug(slug);
    if (!found) throw new ApiError(404, "event_not_found");
    const { user, event } = await requireEventOwner(found.id);

    const rl = rateLimit(`checkout:${user.id}`, LIMITS.checkoutPerUser.limit, LIMITS.checkoutPerUser.windowMs);
    if (!rl.ok) return jsonError(429, "too_many_requests", { retryAfterSec: rl.retryAfterSec });

    const { sku, withRetentionBump } = await parseBody(req, schema);

    // premium_upgrade is only valid from an already-standard event (the
    // post-purchase upsell); otherwise reject rather than silently reprice.
    if (sku === "premium_upgrade" && event.tier !== "standard") {
      return jsonError(400, "not_eligible");
    }
    if (sku !== "premium_upgrade" && event.tier !== "free") {
      return jsonError(400, "already_upgraded");
    }

    const session = await getPaymentsProvider().createCheckout({
      sku,
      eventId: event.id,
      userId: user.id,
      userEmail: user.email,
      withRetentionBump,
      successUrl: `${config.appUrl}/dashboard/${event.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${config.appUrl}/dashboard/${event.slug}`,
    });

    await serverTrack(user.id, "checkout_started", {
      event_id: event.id,
      sku,
      with_bump: withRetentionBump,
    });

    return NextResponse.json({ url: session.url });
  }
);
