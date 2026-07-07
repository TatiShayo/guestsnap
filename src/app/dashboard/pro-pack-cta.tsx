"use client";

/** Pro Pack cross-sell for planners/photographers (2+ events = a whale
 *  signal, PLAYBOOK 3.4). Also shows remaining credits once purchased. */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SKUS } from "@/lib/tiers";
import { formatMoney } from "@/lib/utils";

export function ProPackCta({ eventCredits }: { eventCredits: number }) {
  const [loading, setLoading] = useState(false);

  async function buy() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/pro-pack", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && data.url) window.location.href = data.url;
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-border bg-card/50 px-5 py-4">
      <div>
        <p className="text-sm font-medium">
          {eventCredits > 0
            ? `${eventCredits} Standard event credit${eventCredits === 1 ? "" : "s"} available`
            : "Planning more than one event?"}
        </p>
        <p className="text-sm text-muted-foreground">
          Pro Pack — 3 Standard events for {formatMoney(SKUS.pro_pack.amountCents)}.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void buy()} disabled={loading}>
        {loading ? "Redirecting…" : "Get Pro Pack"}
      </Button>
    </div>
  );
}
