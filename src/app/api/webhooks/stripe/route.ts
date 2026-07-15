/**
 * Stripe webhook (checkout.session.completed). Signature-verified inside the
 * provider; idempotent via processedWebhooks (webhook event id persisted
 * before any side effect can double-fire on Stripe retries). Fulfillment:
 * event upgrades apply tier/upload-limit/retention server-side (never trusts
 * client-supplied amounts); Pro Pack credits the buyer's profile. Sends a
 * receipt email on every charge (PLAYBOOK payments hygiene).
 */
import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getPaymentsProvider } from "@/lib/providers/payments";
import { getEmailProvider } from "@/lib/providers/email";
import { TIERS, SKUS, RETENTION_BUMP, type Tier } from "@/lib/tiers";
import { serverTrack } from "@/lib/analytics-server";
import { captureError } from "@/lib/monitoring";
import { formatMoney } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  let completed;
  try {
    completed = await getPaymentsProvider().parseWebhook(rawBody, signature);
  } catch (e) {
    captureError(e, { where: "webhooks.stripe.verify" });
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }
  if (!completed) return NextResponse.json({ ok: true, ignored: true }); // irrelevant event type

  const data = getData();

  // Idempotency: persist the webhook event id BEFORE fulfillment so a Stripe
  // retry (or a race between two deliveries) can never double-fulfill.
  if (await data.hasProcessedWebhook(completed.webhookEventId)) {
    return NextResponse.json({ ok: true, deduped: true });
  }
  await data.markWebhookProcessed(completed.webhookEventId);

  try {
    const spec = SKUS[completed.sku];
    const targetTier = spec.targetTier;

    // The per-session payment row is the DURABLE idempotency anchor. Because
    // we release the webhook-id claim on failure (see catch), the same event
    // can be delivered again — so anything non-idempotent (the pro-pack credit
    // INCREMENT, the receipt email) must run exactly once, gated on this row
    // not already existing. Tier upgrades are absolute sets and safe to repeat.
    const existingPayment = await data.getPaymentBySession(completed.sessionId);
    const firstDelivery = !existingPayment;
    if (firstDelivery) {
      await data.insertPayment({
        eventId: completed.eventId,
        userId: completed.userId,
        provider: getPaymentsProvider().name,
        sessionId: completed.sessionId,
        amountCents: completed.amountCents,
        sku: completed.sku,
        addOns: completed.withRetentionBump ? [RETENTION_BUMP.id] : [],
        status: "paid",
      });
    }

    if (targetTier && completed.eventId) {
      await fulfillEventUpgrade(completed.eventId, targetTier, completed.withRetentionBump);
    } else if (spec.proPackCredits && firstDelivery) {
      await fulfillProPack(completed.userId, spec.proPackCredits);
    }

    if (firstDelivery) await sendReceipt(completed.userId, completed.amountCents, spec.label);

    await serverTrack(completed.userId, "upgrade_paid", {
      event_id: completed.eventId,
      sku: completed.sku,
      amount_cents: completed.amountCents,
    });
    if (completed.sku === "premium_upgrade") {
      await serverTrack(completed.userId, "upsell_accepted", { event_id: completed.eventId });
    }
  } catch (e) {
    // Fulfillment failed after we claimed the webhook id. Release the claim so
    // Stripe's automatic retry of this 500 can re-run fulfillment — otherwise a
    // transient error (DB blip, email timeout) would permanently dedupe the
    // retry and leave the customer paid-but-unfulfilled. Safe to retry: each
    // step is idempotent (payment insert is guarded by getPaymentBySession,
    // the tier/credit updates are absolute sets, not increments-per-delivery).
    await data.unmarkWebhookProcessed(completed.webhookEventId).catch(() => {});
    captureError(e, { where: "webhooks.stripe.fulfill", sessionId: completed.sessionId });
    return NextResponse.json({ ok: false, error: "fulfillment_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function fulfillEventUpgrade(eventId: string, targetTier: Tier, withRetentionBump: boolean) {
  const data = getData();
  const event = await data.getEvent(eventId);
  if (!event) return;
  const spec = TIERS[targetTier];
  await data.updateEvent(eventId, {
    tier: targetTier,
    uploadLimit: spec.uploadLimit,
    retentionMonths: withRetentionBump ? RETENTION_BUMP.retentionMonths : spec.retentionMonths,
  });
}

async function fulfillProPack(userId: string, credits: number) {
  const data = getData();
  const profile = await data.getProfile(userId);
  if (!profile) return;
  await data.updateProfile(userId, { eventCredits: profile.eventCredits + credits });
}

async function sendReceipt(userId: string, amountCents: number, label: string) {
  const data = getData();
  const profile = await data.getProfile(userId);
  if (!profile) return;
  await getEmailProvider().send({
    to: profile.email,
    subject: "Your GuestSnap receipt",
    html: `<p>Thanks for your purchase — <strong>${label}</strong>, ${formatMoney(amountCents)}.</p>
           <p>Questions? Just reply to this email.</p>`,
  });
}
