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

    const existingPayment = await data.getPaymentBySession(completed.sessionId);
    if (!existingPayment) {
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
    } else if (spec.proPackCredits) {
      await fulfillProPack(completed.userId, spec.proPackCredits);
    }

    await sendReceipt(completed.userId, completed.amountCents, spec.label);

    await serverTrack(completed.userId, "upgrade_paid", {
      event_id: completed.eventId,
      sku: completed.sku,
      amount_cents: completed.amountCents,
    });
    if (completed.sku === "premium_upgrade") {
      await serverTrack(completed.userId, "upsell_accepted", { event_id: completed.eventId });
    }
  } catch (e) {
    // Fulfillment failed after we recorded the webhook id — log loudly so a
    // human can reconcile; we do NOT unmark processed (avoids double-charge
    // side effects on Stripe's automatic retry of a 500).
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
