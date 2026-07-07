/**
 * Daily lifecycle cron (Vercel Cron -> this route). Auth: `Authorization:
 * Bearer <CRON_SECRET>` — Vercel Cron sends this automatically when
 * CRON_SECRET is set; without it (local/dev, no key configured) the route
 * still runs so lifecycle jobs are testable with zero keys, matching the
 * "never stall on missing keys" rule. Runs post-event stats/referral email,
 * guest album-request fulfillment, archive warnings, soft-archive, and
 * hard-purge after the 30-day grace window.
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { runLifecycleJobs } from "@/lib/lifecycle";
import { captureError } from "@/lib/monitoring";
import { serverTrack } from "@/lib/analytics-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (config.cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${config.cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
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
