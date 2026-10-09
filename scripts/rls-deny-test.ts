/**
 * RLS deny check: with a real Supabase configured, the ANON key (no session)
 * must not be able to read or write other hosts' rows. RLS is the last line
 * of defence behind the server-side service-role paths, so it is worth
 * asserting directly against the live project.
 *
 * Without NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY the script
 * SKIPS (exit 0) — the same "never stall on missing keys" contract the app
 * itself follows.
 *
 * Run: npm run test:rls
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function main(): Promise<void> {
  if (!url || !anonKey) {
    console.log(
      "rls-deny-test: SKIPPED — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run against a live project."
    );
    return;
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  let failures = 0;

  const check = (name: string, condition: boolean, detail?: string) => {
    if (condition) {
      console.log(`  ok   ${name}`);
    } else {
      failures += 1;
      console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    }
  };

  console.log("rls-deny-test: anon key must be denied by RLS");

  // 1. Anonymous reads of host-owned tables return nothing.
  const { data: events, error: eventsError } = await anon.from("events").select("id").limit(10);
  check(
    "anon cannot read events",
    !eventsError && (events ?? []).length === 0,
    eventsError?.message ?? `rows=${(events ?? []).length}`
  );

  const { data: media, error: mediaError } = await anon.from("media").select("id").limit(10);
  check(
    "anon cannot read media",
    !mediaError && (media ?? []).length === 0,
    mediaError?.message ?? `rows=${(media ?? []).length}`
  );

  const { data: payments, error: paymentsError } = await anon.from("payments").select("id").limit(10);
  check(
    "anon cannot read payments",
    !paymentsError && (payments ?? []).length === 0,
    paymentsError?.message ?? `rows=${(payments ?? []).length}`
  );

  // 2. Anonymous writes are rejected by the policies' WITH CHECK.
  const { error: insertError } = await anon.from("events").insert({
    host_id: "00000000-0000-0000-0000-000000000000",
    slug: `rls-probe-${Date.now()}`,
    title: "RLS probe",
    event_type: "wedding",
    event_date: "2026-01-01",
  });
  check("anon cannot insert events", Boolean(insertError), insertError ? undefined : "insert unexpectedly succeeded");

  if (failures > 0) {
    console.error(`\nrls-deny-test: ${failures} check(s) FAILED — RLS is not denying the anon key`);
    process.exit(1);
  }
  console.log("\nrls-deny-test: anon key correctly denied by RLS");
}

main().catch((err) => {
  console.error("rls-deny-test crashed:", err);
  process.exit(1);
});
