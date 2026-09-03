import { describe, expect, it } from "vitest";
import { SKUS, RETENTION_BUMP, tierSpec } from "@/lib/tiers";
import { getData } from "@/lib/data";

describe("Tiers, SKUs, and Pricing Specifications", () => {
  it("free tier limits match exact specification", () => {
    const free = tierSpec("free");
    expect(free.tier).toBe("free");
    expect(free.priceCents).toBe(0);
    expect(free.uploadLimit).toBe(20);
    expect(free.watermark).toBe(true);
    expect(free.zipDownload).toBe(false);
    expect(free.videoGuestbook).toBe(false);
    expect(free.customBranding).toBe(false);
    expect(free.aiCulling).toBe(false);
    expect(free.retentionMonths).toBe(3);
  });

  it("standard tier limits match exact specification", () => {
    const standard = tierSpec("standard");
    expect(standard.tier).toBe("standard");
    expect(standard.priceCents).toBe(4900);
    expect(standard.uploadLimit).toBe(500);
    expect(standard.watermark).toBe(false);
    expect(standard.zipDownload).toBe(true);
    expect(standard.videoGuestbook).toBe(false);
    expect(standard.customBranding).toBe(false);
    expect(standard.aiCulling).toBe(false);
    expect(standard.retentionMonths).toBe(12);
  });

  it("premium tier limits match exact specification", () => {
    const premium = tierSpec("premium");
    expect(premium.tier).toBe("premium");
    expect(premium.priceCents).toBe(9900);
    expect(premium.uploadLimit).toBe(Number.MAX_SAFE_INTEGER);
    expect(premium.watermark).toBe(false);
    expect(premium.zipDownload).toBe(true);
    expect(premium.videoGuestbook).toBe(true);
    expect(premium.customBranding).toBe(true);
    expect(premium.aiCulling).toBe(true);
    expect(premium.retentionMonths).toBe(12);
  });

  it("SKUs define valid target tiers and amounts", () => {
    expect(SKUS.standard.amountCents).toBe(4900);
    expect(SKUS.standard.targetTier).toBe("standard");

    expect(SKUS.premium.amountCents).toBe(9900);
    expect(SKUS.premium.targetTier).toBe("premium");

    expect(SKUS.premium_upgrade.amountCents).toBe(5000);
    expect(SKUS.premium_upgrade.targetTier).toBe("premium");

    expect(SKUS.pro_pack.amountCents).toBe(9900);
    expect(SKUS.pro_pack.targetTier).toBeNull();
    expect(SKUS.pro_pack.proPackCredits).toBe(3);
  });

  it("retention bump config provides 24 months retention for $19", () => {
    expect(RETENTION_BUMP.amountCents).toBe(1900);
    expect(RETENTION_BUMP.retentionMonths).toBe(24);
  });
});

describe("Atomic Upload Quotas and Limit Enforcement", () => {
  it("insertMediaWithinLimit strictly caps insertions at limit", async () => {
    const data = getData();
    const event = await data.createEvent({
      hostId: "host-quota",
      slug: `quota-test-${Date.now()}`,
      title: "Quota Test",
      eventType: "birthday",
      eventDate: "2026-07-04",
      coverPath: null,
      tier: "free",
      brandColor: null,
      welcomeMessage: null,
      uploadLimit: 3,
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

    const makeMedia = (idx: number) => ({
      eventId: event.id,
      storagePath: `events/quota/${idx}.jpg`,
      thumbPath: null,
      type: "photo" as const,
      uploaderName: `Guest ${idx}`,
      uploaderKey: `key-${idx}`,
      phash: null,
      sharpness: null,
      isHidden: false,
      isFavorite: false,
      needsReview: false,
      flagReason: null,
      reportCount: 0,
      isGuestbook: false,
      width: 100,
      height: 100,
      durationSec: null,
      sizeBytes: 50,
    });

    // Insert 1st, 2nd, 3rd within limit 3
    const m1 = await data.insertMediaWithinLimit(makeMedia(1), 3);
    const m2 = await data.insertMediaWithinLimit(makeMedia(2), 3);
    const m3 = await data.insertMediaWithinLimit(makeMedia(3), 3);

    expect(m1).not.toBeNull();
    expect(m2).not.toBeNull();
    expect(m3).not.toBeNull();

    // 4th insert exceeds limit 3 and must return null
    const m4 = await data.insertMediaWithinLimit(makeMedia(4), 3);
    expect(m4).toBeNull();

    // Total count remains 3
    expect(await data.countMedia(event.id)).toBe(3);
  });
});
