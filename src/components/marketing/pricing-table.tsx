import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { TIERS } from "@/lib/tiers";
import { cn, formatMoney } from "@/lib/utils";

const FEATURES: Record<keyof typeof TIERS, string[]> = {
  free: ["1 event", "20 photos", "Live gallery link", "GuestSnap watermark"],
  standard: ["500 uploads", "Live TV slideshow", "ZIP download of originals", "No watermark"],
  premium: [
    "Unlimited uploads",
    "30s video guestbook",
    "AI best-shot culling",
    "Custom brand color",
    "Everything in Standard",
  ],
};

/** Pricing table — amounts and limits read from tiers.ts (server source of
 * truth), never hardcoded, so marketing copy can't drift from checkout. */
export function PricingTable() {
  const order: (keyof typeof TIERS)[] = ["free", "standard", "premium"];
  return (
    <div id="pricing" className="grid gap-6 sm:grid-cols-3">
      {order.map((key) => {
        const spec = TIERS[key];
        const featured = key === "standard";
        return (
          <div
            key={key}
            className={cn(
              "flex flex-col rounded-xl border border-border bg-card p-6 shadow-soft",
              featured && "border-primary/40 ring-1 ring-primary/20"
            )}
          >
            {featured ? (
              <span className="mb-3 inline-block w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Most popular
              </span>
            ) : null}
            <h3 className="font-display text-2xl">{spec.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {key === "free" ? "Try it for real" : "One event, one payment"}
            </p>
            <p className="mt-4 font-display text-4xl">
              {spec.priceCents === 0 ? "Free" : formatMoney(spec.priceCents)}
            </p>
            <p className="text-xs text-muted-foreground">{spec.priceCents === 0 ? "no card required" : "per event, not a subscription"}</p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {FEATURES[key].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className={buttonVariants({
                variant: featured ? "default" : "outline",
                className: "mt-8",
              })}
            >
              {key === "free" ? "Start free" : `Get ${spec.name}`}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
