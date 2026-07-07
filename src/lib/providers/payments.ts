/**
 * Payments provider. Stripe Checkout (one-time) when STRIPE_SECRET_KEY is
 * set; otherwise a mock that redirects to a local /mock/checkout page which
 * simulates completion through the exact same fulfillment path as the real
 * webhook. All amounts resolved server-side from lib/tiers.ts.
 */
import { config } from "@/lib/config";
import { signToken, verifyToken } from "@/lib/tokens";
import { SKUS, RETENTION_BUMP, type Sku } from "@/lib/tiers";

export interface CheckoutRequest {
  sku: Sku;
  eventId: string | null; // null for pro_pack
  userId: string;
  userEmail: string;
  withRetentionBump: boolean;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

/** Normalized "payment completed" event, produced by webhook verification. */
export interface CompletedCheckout {
  sessionId: string;
  webhookEventId: string;
  sku: Sku;
  eventId: string | null;
  userId: string;
  amountCents: number;
  withRetentionBump: boolean;
}

export interface PaymentsProvider {
  readonly name: "stripe" | "mock";
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** Verify webhook signature + parse. Returns null for irrelevant events. */
  parseWebhook(rawBody: string, signature: string | null): Promise<CompletedCheckout | null>;
  refund(sessionId: string): Promise<boolean>;
}

function totalCents(sku: Sku, withBump: boolean): number {
  return SKUS[sku].amountCents + (withBump ? RETENTION_BUMP.amountCents : 0);
}

class StripeProvider implements PaymentsProvider {
  readonly name = "stripe" as const;
  private async stripe() {
    const { default: Stripe } = await import("stripe");
    return new Stripe(config.stripe.secretKey);
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const stripe = await this.stripe();
    const spec = SKUS[req.sku];
    const lineItems = [
      {
        price_data: {
          currency: "usd",
          product_data: { name: spec.label },
          unit_amount: spec.amountCents,
        },
        quantity: 1,
      },
    ];
    if (req.withRetentionBump) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: RETENTION_BUMP.label },
          unit_amount: RETENTION_BUMP.amountCents,
        },
        quantity: 1,
      });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: req.userEmail,
      automatic_tax: { enabled: true }, // Stripe Tax — enable in dashboard too
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      metadata: {
        sku: req.sku,
        event_id: req.eventId ?? "",
        user_id: req.userId,
        retention_bump: req.withRetentionBump ? "1" : "0",
      },
    });
    return { url: session.url!, sessionId: session.id };
  }

  async parseWebhook(rawBody: string, signature: string | null): Promise<CompletedCheckout | null> {
    if (!signature) throw new Error("missing signature");
    const stripe = await this.stripe();
    const event = await stripe.webhooks.constructEventAsync(rawBody, signature, config.stripe.webhookSecret);
    if (event.type !== "checkout.session.completed") return null;
    const session = event.data.object as {
      id: string;
      amount_total: number | null;
      metadata: Record<string, string> | null;
    };
    const md = session.metadata ?? {};
    const sku = (md.sku ?? "") as Sku;
    if (!SKUS[sku]) throw new Error("unknown sku in webhook metadata");
    return {
      sessionId: session.id,
      webhookEventId: event.id,
      sku,
      eventId: md.event_id || null,
      userId: md.user_id,
      amountCents: session.amount_total ?? totalCents(sku, md.retention_bump === "1"),
      withRetentionBump: md.retention_bump === "1",
    };
  }

  async refund(sessionId: string): Promise<boolean> {
    try {
      const stripe = await this.stripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!pi) return false;
      await stripe.refunds.create({ payment_intent: pi });
      return true;
    } catch {
      return false;
    }
  }
}

class MockPaymentsProvider implements PaymentsProvider {
  readonly name = "mock" as const;

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const sessionId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const token = signToken({
      kind: "mock_checkout",
      sessionId,
      sku: req.sku,
      eventId: req.eventId,
      userId: req.userId,
      amountCents: totalCents(req.sku, req.withRetentionBump),
      withRetentionBump: req.withRetentionBump,
      successUrl: req.successUrl,
      cancelUrl: req.cancelUrl,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    return { url: `${config.appUrl}/mock/checkout?token=${encodeURIComponent(token)}`, sessionId };
  }

  /** Mock webhooks arrive as signed tokens from the mock checkout page. */
  async parseWebhook(rawBody: string, _signature: string | null): Promise<CompletedCheckout | null> {
    const { token } = JSON.parse(rawBody) as { token: string };
    const payload = verifyToken<{
      kind: string; sessionId: string; sku: Sku; eventId: string | null;
      userId: string; amountCents: number; withRetentionBump: boolean;
    }>(token);
    if (!payload || payload.kind !== "mock_checkout") throw new Error("invalid mock token");
    return {
      sessionId: payload.sessionId,
      webhookEventId: `evt_${payload.sessionId}`,
      sku: payload.sku,
      eventId: payload.eventId,
      userId: payload.userId,
      amountCents: payload.amountCents,
      withRetentionBump: payload.withRetentionBump,
    };
  }

  async refund(): Promise<boolean> {
    return true;
  }
}

let provider: PaymentsProvider | null = null;
export function getPaymentsProvider(): PaymentsProvider {
  if (!provider) provider = config.stripe.enabled ? new StripeProvider() : new MockPaymentsProvider();
  return provider;
}
