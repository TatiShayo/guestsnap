import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getData } from "@/lib/data";
import { formatMoney, pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin — GuestSnap" };
export const dynamic = "force-dynamic";

/**
 * Internal ops dashboard (PLAYBOOK / BUILD_PROMPT #79): email-allowlist
 * gated via ADMIN_EMAILS. Read-only — reads straight from the data layer's
 * adminStats() aggregate, no separate warehouse. Not linked from any public
 * nav; reached only by URL, and still hard-gated server-side so a guessed
 * URL is a no-op for non-admins.
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/dashboard");

  const data = getData();
  const stats = await data.adminStats();
  const payments = await data.listPayments();
  const recentAudit = await data.listAudit(25);

  const storageGb = stats.storageBytes / 1024 ** 3;
  const conversionPct = (stats.freeToPaidRate * 100).toFixed(1);
  const maxDayCount = Math.max(1, ...stats.eventsPerDay.map((d) => d.count));

  return (
    <div className="grain min-h-screen">
      <header className="border-b border-border bg-card/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            GuestSnap — Internal
          </span>
          <span className="text-sm text-muted-foreground">{user.email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-4xl">Admin</h1>
        <p className="mt-2 text-muted-foreground">
          Revenue, growth, and storage — read-only, refreshed on load.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Net revenue" value={formatMoney(stats.revenueCents - stats.refundedCents)} />
          <StatCard label="Total events" value={stats.totalEvents.toLocaleString()} />
          <StatCard
            label="Free → paid"
            value={`${conversionPct}%`}
            sub={`${pluralize(stats.paidEvents, "paid event")}`}
          />
          <StatCard label="Storage used" value={`${storageGb.toFixed(2)} GB`} sub={pluralize(stats.totalMedia, "file")} />
        </div>

        <section className="mt-10">
          <h2 className="font-display text-2xl">Events created / day (last 30)</h2>
          <div className="mt-4 flex h-40 items-end gap-1 rounded-xl border border-border bg-card p-4 shadow-soft">
            {stats.eventsPerDay.length === 0 ? (
              <p className="self-center text-sm text-muted-foreground">No events yet.</p>
            ) : (
              stats.eventsPerDay.map((d) => (
                <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end">
                  <div
                    className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
                    style={{ height: `${Math.max(4, (d.count / maxDayCount) * 100)}%` }}
                  />
                  <span className="pointer-events-none absolute -top-6 hidden text-xs text-muted-foreground group-hover:block">
                    {d.date}: {d.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl">Recent payments</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">SKU</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Provider</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No payments yet.
                    </td>
                  </tr>
                ) : (
                  payments
                    .slice()
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .slice(0, 50)
                    .map((p) => (
                      <tr key={p.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2 tabular-nums">{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-2">{p.sku}</td>
                        <td className="px-4 py-2 tabular-nums">{formatMoney(p.amountCents)}</td>
                        <td className="px-4 py-2 capitalize">{p.status}</td>
                        <td className="px-4 py-2 capitalize">{p.provider}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl">Audit log</h2>
          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-soft">
            {recentAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admin actions recorded.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {recentAudit.map((a) => (
                  <li key={a.id} className="flex justify-between gap-4 text-muted-foreground">
                    <span>
                      <span className="text-foreground">{a.actor}</span> {a.action} {a.target}
                    </span>
                    <span className="tabular-nums">{new Date(a.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
