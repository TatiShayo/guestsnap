/**
 * Daily lifecycle cron (Vercel Cron -> this route). Auth: `Authorization:
 * Bearer <CRON_SECRET>` — Vercel Cron sends this automatically when
 * CRON_SECRET is set.
 *
 * FAIL CLOSED: this route soft-archives events and HARD-PURGES guest media
 * after the 30-day grace window, so an unauthenticated run is catastrophic.
 * When CRON_SECRET is not configured the route refuses to run entirely (404,
 * indistinguishable from a missing route) — the "never stall on missing keys"
 * rule applies to providers, never to authorization on destructive routes.
 * Runs post-event stats/referral email, guest album-request fulfillment,
 * archive warnings, soft-archive, and hard-purge after the 30-day grace
 * window.
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { timingSafeEqualString } from "@/lib/tokens";
import { runLifecycleJobs } from "@/lib/lifecycle";
import { captureError } from "@/lib/monitoring";
import { serverTrack } from "@/lib/analytics-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  // No configured secret -> refuse to run at all (fail closed, not open).
  if (!config.cronSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${config.cronSecret}`;
  if (!timingSafeEqualString(auth, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runLifecycleJobs();
    await serverTrack("system", "lifecycle_cron_ran", { ...result, errors: result.errors.length });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    captureError(e, { where: "cron.lifecycle" });
    return NextResponse.json({ ok: false, error: "lifecycle_run_failed" }, { status: 500 });
  }
}
