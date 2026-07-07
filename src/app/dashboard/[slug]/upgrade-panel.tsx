"use client";

/**
 * Host-facing upgrade card on the gallery page. Free events see Standard/
 * Premium pricing with the retention order-bump checkbox; Standard events
 * see the Premium-delta one-click upsell inline too. Client sends intent
 * only (sku + bump checkbox) — amounts are resolved server-side.
 */
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/components/analytics-provider";
import { SKUS, RETENTION_BUMP, TIERS, type Tier } from "@/lib/tiers";
import { cn, formatMoney } from "@/lib/utils";

export function UpgradePanel({
  slug,
  eventId,
  tier,
  eventCredits = 0,
}: {
  slug: string;
  eventId: string;
  tier: Tier;
  eventCredits?: number;
}) {
  const analytics = useAnalytics();
  const [bump, setBump] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function upgrade(sku: "standard" | "premium" | "premium_upgrade") {
    setLoading(sku);
    analytics.track("upgrade_viewed", { event_id: eventId, source: "dashboard" });
    try {
      const res = await fetch(`/api/events/${slug}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku, withRetentionBump: bump }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setLoading(null);
      }
    } catch {
      setLoading(null);
    }
  }

  async function redeemCredit() {
    setLoading("credit");
    try {
      const res = await fetch(`/api/events/${slug}/redeem-credit`, { method: "POST" });
      if (res.ok) window.location.reload();
      else setLoading(null);
    } catch {
      setLoading(null);
    }
  }

  if (tier === "premium") return null; // already at the top

  return (
    <div className="mt-10 rounded-xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-2xl">
        {tier === "free" ? "Upgrade this event" : "Upgrade to Premium"}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        One-time payment. No subscription, no surprise renewals.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {tier === "free" ? (
          <>
            <PlanCard
              name={TIERS.standard.name}
              price={SKUS.standard.amountCents}
              features={["500 uploads", "Live slideshow", "ZIP download"]}
              onSelect={() => void upgrade("standard")}
              loading={loading === "standard"}
            />
            <PlanCard
              name={TIERS.premium.name}
              price={SKUS.premium.amountCents}
              features={["Unlimited uploads", "Video guestbook", "Custom branding", "AI best-shot culling"]}
              highlight
              onSelect={() => void upgrade("premium")}
              loading={loading === "premium"}
            />
          </>
        ) : (
          <PlanCard
            name="Premium"
            price={SKUS.premium_upgrade.amountCents}
            features={["Unlimited uploads", "Video guestbook", "Custom branding", "AI best-shot culling"]}
            highlight
            onSelect={() => void upgrade("premium_upgrade")}
            loading={loading === "premium_upgrade"}
            deltaNote="You already paid for Standard — this is just the difference."
          />
        )}
      </div>

      {tier === "free" ? (
        <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-lg border border-dashed border-border p-3 text-sm">
          <input
            type="checkbox"
            checked={bump}
            onChange={(e) => setBump(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            <span className="font-medium">{RETENTION_BUMP.label}</span>
            <span className="ml-1.5 text-muted-foreground tabular-nums">
              +{formatMoney(RETENTION_BUMP.amountCents)}
            </span>
          </span>
        </label>
      ) : null}

      {tier === "free" && eventCredits > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/50 px-4 py-3 text-sm">
          <span>
            You have <span className="font-medium tabular-nums">{eventCredits}</span> Pro Pack credit
            {eventCredits === 1 ? "" : "s"} — use one to upgrade this event to Standard for free.
          </span>
          <Button type="button" size="sm" variant="secondary" onClick={() => void redeemCredit()} disabled={loading === "credit"}>
            {loading === "credit" ? "Applying…" : "Use a credit"}
          </Button>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">
        Not thrilled? Full refund, no questions asked — just reply to your receipt email.
      </p>
    </div>
  );
}

function PlanCard({
  name,
  price,
  features,
  highlight,
  onSelect,
  loading,
  deltaNote,
}: {
  name: string;
  price: number;
  features: string[];
  highlight?: boolean;
  onSelect: () => void;
  loading: boolean;
  deltaNote?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border p-5",
        highlight ? "border-primary bg-primary/5" : "border-border"
      )}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg">{name}</h3>
        <span className="font-display text-2xl tabular-nums">{formatMoney(price)}</span>
      </div>
      {deltaNote ? <p className="mt-1 text-xs text-muted-foreground">{deltaNote}</p> : null}
      <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {f}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant={highlight ? "default" : "outline"}
        className="mt-5 w-full"
        onClick={onSelect}
        disabled={loading}
      >
        {loading ? "Redirecting…" : `Choose ${name}`}
      </Button>
    </div>
  );
}
