"use client";

/** One-click post-purchase upsell: Standard buyers get Premium for just the
 *  delta, shown once, right after checkout (PLAYBOOK 4.2 peak-happiness
 *  upsell placement). */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/components/analytics-provider";
import { SKUS } from "@/lib/tiers";
import { formatMoney } from "@/lib/utils";

export function UpsellPanel({ slug, eventId }: { slug: string; eventId: string }) {
  const analytics = useAnalytics();
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    analytics.track("upgrade_viewed", { event_id: eventId, source: "post_purchase_upsell" });
  }, [analytics, eventId]);

  if (dismissed) return null;

  async function accept() {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${slug}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku: "premium_upgrade", withRetentionBump: false }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && data.url) window.location.href = data.url;
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="mt-10 rounded-xl border border-primary/30 bg-primary/5 p-6 text-left">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">One-time offer</p>
      <h2 className="mt-1.5 font-display text-xl">
        Add video guestbook + unlimited uploads for {formatMoney(SKUS.premium_upgrade.amountCents)}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Upgrade to Premium now — you only pay the difference, never shown again after today.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" onClick={() => void accept()} disabled={loading}>
          {loading ? "Redirecting…" : "Upgrade to Premium"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setDismissed(true)} disabled={loading}>
          No thanks
        </Button>
      </div>
    </div>
  );
}
