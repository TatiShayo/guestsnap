/**
 * Printable table-card PDF kit — 4-up on A4, 3 style variants. Host-only
 * (re-validates ownership). Generates the QR as a data URL server-side
 * (no network fetch needed inside the PDF renderer).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { renderToBuffer } from "@react-pdf/renderer";
import { getData } from "@/lib/data";
import { ApiError, jsonError, withErrorHandling, requireEventOwner } from "@/lib/api";
import { config } from "@/lib/config";
import { serverTrack } from "@/lib/analytics-server";
import { TableCardPdf, type CardStyle } from "@/lib/pdf/table-card";

const styleSchema = z.enum(["classic", "minimal", "playful"]);

export const GET = withErrorHandling(
  "events.tableCards",
  async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const found = await getData().getEventBySlug(slug);
    if (!found) throw new ApiError(404, "event_not_found");
    const { user, event } = await requireEventOwner(found.id);

    const styleParam = new URL(req.url).searchParams.get("style") ?? "classic";
    const parsed = styleSchema.safeParse(styleParam);
    if (!parsed.success) return jsonError(400, "invalid_style");
    const style: CardStyle = parsed.data;

    const url = `${config.appUrl}/e/${event.slug}`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, color: { dark: "#1C1917", light: "#FAF8F5" } });

    const pdfBuffer = await renderToBuffer(
      TableCardPdf({ eventTitle: event.title, qrDataUrl, style, welcomeMessage: event.welcomeMessage })
    );

    await serverTrack(user.id, "qr_downloaded", { event_id: event.id, format: "pdf" });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${event.slug}-table-cards-${style}.pdf"`,
        "cache-control": "private, max-age=3600",
      },
    });
  }
);
