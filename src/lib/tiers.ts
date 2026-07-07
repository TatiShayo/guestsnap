/**
 * Pricing, limits and SKU math. SERVER-SIDE SOURCE OF TRUTH — the client
 * only ever sends intent ("upgrade to premium"), never amounts.
 */

export type Tier = "free" | "standard" | "premium";

export interface TierSpec {
  tier: Tier;
  name: string;
  priceCents: number;
  uploadLimit: number; // Number.MAX_SAFE_INTEGER means unlimited
  watermark: boolean;
  zipDownload: boolean;
  videoGuestbook: boolean;
  customBranding: boolean;
  aiCulling: boolean;
  retentionMonths: number;
}

export const TIERS: Record<Tier, TierSpec> = {
  free: {
    tier: "free",
    name: "Free",
    priceCents: 0,
    uploadLimit: 20,
    watermark: true,
    zipDownload: false,
    videoGuestbook: false,
    customBranding: false,
    aiCulling: false,
    retentionMonths: 3, // archives 90 days after event date
  },
  standard: {
    tier: "standard",
    name: "Standard",
    priceCents: 4900,
    uploadLimit: 500,
    watermark: false,
    zipDownload: true,
    videoGuestbook: false,
    customBranding: false,
    aiCulling: false,
    retentionMonths: 12,
  },
  premium: {
    tier: "premium",
    name: "Premium",
    priceCents: 9900,
    uploadLimit: Number.MAX_SAFE_INTEGER,
    watermark: false,
    zipDownload: true,
    videoGuestbook: true,
    customBranding: true,
    aiCulling: true,
    retentionMonths: 12,
  },
};

/** Purchasable SKUs. Client sends a sku id; all pricing resolved here. */
export type Sku = "standard" | "premium" | "premium_upgrade" | "pro_pack";

export interface SkuSpec {
  sku: Sku;
  label: string;
  amountCents: number;
  targetTier: Tier | null; // null = not an event upgrade (pro pack credit)
  proPackCredits?: number;
}

export const SKUS: Record<Sku, SkuSpec> = {
  standard: { sku: "standard", label: "GuestSnap Standard — one event", amountCents: 4900, targetTier: "standard" },
  premium: { sku: "premium", label: "GuestSnap Premium — one event", amountCents: 9900, targetTier: "premium" },
  // Post-purchase one-click upsell: Standard buyers pay only the delta.
  premium_upgrade: { sku: "premium_upgrade", label: "Upgrade to Premium (difference)", amountCents: 5000, targetTier: "premium" },
  // Pro pack: 3 event credits for planners/photographers.
  pro_pack: { sku: "pro_pack", label: "Pro Pack — 3 Standard events", amountCents: 9900, targetTier: null, proPackCredits: 3 },
};

/** Checkout order bump: extend retention 12 → 24 months. */
export const RETENTION_BUMP = { id: "retention_24", label: "Keep photos 24 months instead of 12", amountCents: 1900, retentionMonths: 24 };

export const VIDEO_MAX_SECONDS = 45; // hard server cap; guestbook records ≤30s
export const GUESTBOOK_MAX_SECONDS = 30;
export const PHOTO_MAX_BYTES = 25 * 1024 * 1024; // 25MB
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100MB

export function tierSpec(tier: Tier): TierSpec {
  return TIERS[tier];
}
