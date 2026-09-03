import { describe, expect, it } from "vitest";
import { getPaymentsProvider } from "@/lib/providers/payments";
import { getData } from "@/lib/data";
import { POST as stripeWebhookPost } from "@/app/api/webhooks/stripe/route";
import { TIERS } from "@/lib/tiers";

describe("Payments Provider and Stripe Webhook Processing", () => {
  it("creates mock checkout session with signed token", async () => {
    const provider = getPaymentsProvider();
    const session = await provider.createCheckout({
      sku: "standard",
      eventId: "event-123",
      userId: "user-123",
      userEmail: "host@example.com",
      withRetentionBump: true,
      successUrl: "http://localhost:3000/success",
      cancelUrl: "http://localhost:3000/cancel",
    });

    expect(session.url).toBeDefined();
    expect(session.sessionId).toMatch(/^mock_/);
    expect(session.url.includes("/mock/checkout?token=")).toBe(true);
  });

  it("fulfills Standard event upgrade on completed checkout webhook", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-pay-std", email: "host-std@pay.test" });
    const event = await data.createEvent({
      hostId: host.id,
      slug: `pay-std-${Date.now()}`,
      title: "Standard Upgrade Event",
      eventType: "wedding",
      eventDate: "2026-09-01",
      coverPath: null,
      tier: "free",
      brandColor: null,
      welcomeMessage: null,
      uploadLimit: 20,
      isActive: true,
      requireApproval: false,
      visibility: "gallery",
      slideshowPinHash: null,
      hideUploaderNames: false,
      retentionMonths: 3,
      isDemo: false,
      archivedAt: null,
      purgedAt: null,
    });

    const session = await getPaymentsProvider().createCheckout({
      sku: "standard",
      eventId: event.id,
      userId: host.id,
      userEmail: host.email,
      withRetentionBump: false,
      successUrl: "http://test.local/success",
      cancelUrl: "http://test.local/cancel",
    });

    const token = new URL(session.url).searchParams.get("token")!;
    const req = new Request("http://test.local/api/webhooks/stripe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(200);

    const updatedEvent = await data.getEvent(event.id);
    expect(updatedEvent?.tier).toBe("standard");
    expect(updatedEvent?.uploadLimit).toBe(TIERS.standard.uploadLimit);
    expect(updatedEvent?.retentionMonths).toBe(TIERS.standard.retentionMonths);
  });

  it("fulfills Premium upgrade with retention order bump (24 months)", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-pay-prem", email: "host-prem@pay.test" });
    const event = await data.createEvent({
      hostId: host.id,
      slug: `pay-prem-${Date.now()}`,
      title: "Premium Bump Event",
      eventType: "wedding",
      eventDate: "2026-09-01",
      coverPath: null,
      tier: "free",
      brandColor: null,
      welcomeMessage: null,
      uploadLimit: 20,
      isActive: true,
      requireApproval: false,
      visibility: "gallery",
      slideshowPinHash: null,
      hideUploaderNames: false,
      retentionMonths: 3,
      isDemo: false,
      archivedAt: null,
      purgedAt: null,
    });

    const session = await getPaymentsProvider().createCheckout({
      sku: "premium",
      eventId: event.id,
      userId: host.id,
      userEmail: host.email,
      withRetentionBump: true, // +24mo bump
      successUrl: "http://test.local/success",
      cancelUrl: "http://test.local/cancel",
    });

    const token = new URL(session.url).searchParams.get("token")!;
    const req = new Request("http://test.local/api/webhooks/stripe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(200);

    const updatedEvent = await data.getEvent(event.id);
    expect(updatedEvent?.tier).toBe("premium");
    expect(updatedEvent?.retentionMonths).toBe(24);
  });

  it("fulfills Pro Pack checkout by adding 3 event credits to host profile", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-pro-pack", email: "pro@planner.test" });
    expect(host.eventCredits).toBe(0);

    const session = await getPaymentsProvider().createCheckout({
      sku: "pro_pack",
      eventId: null,
      userId: host.id,
      userEmail: host.email,
      withRetentionBump: false,
      successUrl: "http://test.local/success",
      cancelUrl: "http://test.local/cancel",
    });

    const token = new URL(session.url).searchParams.get("token")!;
    const req = new Request("http://test.local/api/webhooks/stripe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const res = await stripeWebhookPost(req);
    expect(res.status).toBe(200);

    const updatedProfile = await data.getProfile(host.id);
    expect(updatedProfile?.eventCredits).toBe(3);
  });

  it("deduplicates retried webhook deliveries idempotently", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-dedupe", email: "dedupe@pay.test" });
    const session = await getPaymentsProvider().createCheckout({
      sku: "pro_pack",
      eventId: null,
      userId: host.id,
      userEmail: host.email,
      withRetentionBump: false,
      successUrl: "http://test.local/success",
      cancelUrl: "http://test.local/cancel",
    });

    const token = new URL(session.url).searchParams.get("token")!;
    const sendWebhook = () =>
      stripeWebhookPost(
        new Request("http://test.local/api/webhooks/stripe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        })
      );

    // 1st delivery
    const res1 = await sendWebhook();
    expect(res1.status).toBe(200);
    const json1 = (await res1.json()) as { ok: boolean; deduped?: boolean };
    expect(json1.ok).toBe(true);
    expect(json1.deduped).toBeUndefined();

    // 2nd delivery (retry)
    const res2 = await sendWebhook();
    expect(res2.status).toBe(200);
    const json2 = (await res2.json()) as { ok: boolean; deduped?: boolean };
    expect(json2.ok).toBe(true);
    expect(json2.deduped).toBe(true);

    // Credits incremented exactly once (3, not 6)
    const profile = await data.getProfile(host.id);
    expect(profile?.eventCredits).toBe(3);
  });
});
