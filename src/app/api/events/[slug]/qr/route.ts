/**
 * Host-only QR PNG for the event's guest-upload link. Re-validates
 * ownership; the QR encodes the public /e/[slug] URL (which is itself
 * anti-enumeration via the random slug suffix — no additional secret here).
 */
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getData } from "@/lib/data";
import { ApiError, withErrorHandling, requireEventOwner } from "@/lib/api";
import { config } from "@/lib/config";
import { serverTrack } from "@/lib/analytics-server";

export const GET = withErrorHandling(
  "events.qr",
  async (_req: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const found = await getData().getEventBySlug(slug);
    if (!found) throw new ApiError(404, "event_not_found");
    const { user, event } = await requireEventOwner(found.id);

    const url = `${config.appUrl}/e/${event.slug}`;
    const png = await QRCode.toBuffer(url, {
      type: "png",
      width: 900,
      margin: 2,
      color: { dark: "#1C1917", light: "#FAF8F5" },
    });

    await serverTrack(user.id, "qr_downloaded", { event_id: event.id, format: "png" });

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "content-disposition": `inline; filename="${event.slug}-qr.png"`,
        "cache-control": "private, max-age=3600",
      },
    });
  }
);
