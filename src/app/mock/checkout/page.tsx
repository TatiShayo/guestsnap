import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/tokens";
import { SKUS, RETENTION_BUMP, type Sku } from "@/lib/tiers";
import { formatMoney } from "@/lib/utils";
import { PayButton } from "./pay-button";

interface MockCheckoutPayload {
  kind: string;
  sessionId: string;
  sku: Sku;
  eventId: string | null;
  userId: string;
  amountCents: number;
  withRetentionBump: boolean;
  successUrl: string;
  cancelUrl: string;
}

export default async function MockCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const payload = token ? verifyToken<MockCheckoutPayload>(token) : null;
  if (!payload || payload.kind !== "mock_checkout") redirect("/dashboard");

  const spec = SKUS[payload.sku];

  return (
    <main className="grain flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-7 shadow-soft">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Test-mode checkout
        </p>
        <h1 className="mt-3 text-center font-display text-2xl">GuestSnap</h1>

        <div className="mt-6 space-y-2 border-y border-border py-4">
          <div className="flex justify-between text-sm">
            <span>{spec.label}</span>
            <span className="tabular-nums">{formatMoney(spec.amountCents)}</span>
          </div>
          {payload.withRetentionBump ? (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{RETENTION_BUMP.label}</span>
              <span className="tabular-nums">{formatMoney(RETENTION_BUMP.amountCents)}</span>
            </div>
          ) : null}
          <div className="flex justify-between pt-2 font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(payload.amountCents)}</span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          No Stripe key is configured, so this simulates a real Checkout
          session. No card is charged.
        </p>

        <PayButton token={token!} cancelUrl={payload.cancelUrl} />
      </div>
    </main>
  );
}
