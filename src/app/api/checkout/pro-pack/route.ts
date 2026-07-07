/**
 * Pro Pack checkout — 3 Standard-event credits for planners/photographers
 * (not tied to a single event). Fulfillment credits the buyer's profile;
 * each future free event can then be "spent up" to Standard using a credit
 * (see events.upgrade-with-credit route, dashboard UI).
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPaymentsProvider } from "@/lib/providers/payments";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { jsonError, withErrorHandling } from "@/lib/api";
import { serverTrack } from "@/lib/analytics-server";
import { config } from "@/lib/config";

export const POST = withErrorHandling("checkout.propack", async () => {
  const user = await requireUser();

  const rl = rateLimit(`checkout:${user.id}`, LIMITS.checkoutPerUser.limit, LIMITS.checkoutPerUser.windowMs);
  if (!rl.ok) return jsonError(429, "too_many_requests", { retryAfterSec: rl.retryAfterSec });

  const session = await getPaymentsProvider().createCheckout({
    sku: "pro_pack",
    eventId: null,
    userId: user.id,
    userEmail: user.email,
    withRetentionBump: false,
    successUrl: `${config.appUrl}/dashboard?pro_pack=1&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${config.appUrl}/dashboard`,
  });

  await serverTrack(user.id, "checkout_started", { event_id: null, sku: "pro_pack", with_bump: false });
  return NextResponse.json({ url: session.url });
});
