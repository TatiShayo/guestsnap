/**
 * Spend one Pro Pack event-credit to upgrade a free event to Standard,
 * without a new checkout. Re-validates ownership + credit balance
 * server-side (never trusts a client-supplied credit count).
 */
import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { TIERS } from "@/lib/tiers";
import { ApiError, jsonError, withErrorHandling, requireEventOwner } from "@/lib/api";
import { serverTrack } from "@/lib/analytics-server";

export const POST = withErrorHandling(
  "events.redeemCredit",
  async (_req: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const data = getData();
    const found = await data.getEventBySlug(slug);
    if (!found) throw new ApiError(404, "event_not_found");
    const { user, event } = await requireEventOwner(found.id);

    if (event.tier !== "free") return jsonError(400, "already_upgraded");

    // Atomically spend the credit BEFORE upgrading. A plain read-then-write let
    // two concurrent redeems each read the same balance and upgrade a different
    // event for one credit (double-spend). redeemCredit() closes that race.
    const spent = await data.redeemCredit(user.id);
    if (!spent) return jsonError(400, "no_credits");

    const spec = TIERS.standard;
    await data.updateEvent(event.id, { tier: "standard", uploadLimit: spec.uploadLimit, retentionMonths: spec.retentionMonths });

    await serverTrack(user.id, "upgrade_paid", { event_id: event.id, sku: "pro_pack_credit", amount_cents: 0 });
    return NextResponse.json({ ok: true });
  }
);
