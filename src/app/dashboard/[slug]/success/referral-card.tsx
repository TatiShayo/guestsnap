"use client";

/** Referral code shown at the peak-happiness moment right after purchase
 *  (PLAYBOOK 3.4 / 4.3). $10 off next event per referred host. */
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useAnalytics } from "@/components/analytics-provider";

export function ReferralCard({ code }: { code: string }) {
  const analytics = useAnalytics();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      analytics.track("referral_code_copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the code is still visible to copy by hand
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-dashed border-border p-6">
      <h3 className="font-display text-lg">Know someone planning an event?</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Share your code — they get to try GuestSnap, and you get $10 off your next event.
      </p>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 font-mono text-sm tracking-wide transition-colors hover:bg-accent"
      >
        {code}
        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
