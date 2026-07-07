/**
 * Serves media in MEMORY mode only. Blobs live in a private local dir; the
 * memory BlobStore hands out short-lived HMAC-signed URLs pointing here, so
 * access is gated exactly like Supabase signed URLs (no public listing, no
 * unsigned access). In supabase mode media is served by Supabase Storage
 * directly and this route is never called.
 */
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";
import { getBlobs } from "@/lib/data";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return new NextResponse("missing token", { status: 400 });

  const payload = verifyToken<{ p: string; exp: number }>(token);
  if (!payload?.p) return new NextResponse("invalid or expired", { status: 403 });

  const blob = await getBlobs().get(payload.p);
  if (!blob) return new NextResponse("not found", { status: 404 });

  return new NextResponse(new Uint8Array(blob.data), {
    status: 200,
    headers: {
      "content-type": blob.contentType,
      // Signed-URL lifetime; cacheable but private to the URL bearer.
      "cache-control": "private, max-age=600",
      "content-disposition": "inline",
    },
  });
}
