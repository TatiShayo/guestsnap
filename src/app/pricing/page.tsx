import Link from "next/link";
import { TIERS } from "@/lib/tiers";

export const metadata = {
  title: "Pricing — GuestSnap",
  description: "Simple, transparent event photo sharing pricing. Pay per event, zero subscription traps.",
};

export default function PricingPage() {
  const tiers = [TIERS.free, TIERS.standard, TIERS.premium];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Simple, Event-Based Pricing
        </h1>
        <p className="mt-4 text-lg text-neutral-400">
          No monthly subscriptions. Pay once per event, keep your memories forever.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.tier}
              className={`rounded-2xl border p-8 flex flex-col justify-between ${
                t.tier === "premium"
                  ? "border-amber-500 bg-neutral-900/80 shadow-lg shadow-amber-500/10"
                  : "border-neutral-800 bg-neutral-900/40"
              }`}
            >
              <div>
                <h3 className="text-xl font-bold">{t.name}</h3>
                <p className="mt-4 text-3xl font-extrabold">
                  ${(t.priceCents / 100).toFixed(0)}
                  <span className="text-sm font-normal text-neutral-400"> / event</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm text-neutral-300 text-left">
                  <li>📸 {t.uploadLimit === Number.MAX_SAFE_INTEGER ? "Unlimited" : t.uploadLimit} photos</li>
                  <li>🗓️ {t.retentionMonths} months gallery access</li>
                  <li>📦 {t.zipDownload ? "One-click ZIP download" : "Manual individual download"}</li>
                  <li>✨ {t.watermark ? "GuestSnap watermark" : "Zero watermarks"}</li>
                  {t.aiCulling && <li>🤖 Smart AI blur & duplicate culling</li>}
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  href="/events/create"
                  className={`block w-full py-3 px-4 rounded-xl font-semibold text-center ${
                    t.tier === "premium"
                      ? "bg-amber-500 text-neutral-950 hover:bg-amber-400"
                      : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                  }`}
                >
                  Get Started
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
