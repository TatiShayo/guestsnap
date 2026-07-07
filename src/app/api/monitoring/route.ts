import { NextResponse } from "next/server";
import { z } from "zod";
import { captureError } from "@/lib/monitoring";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const bodySchema = z.object({
  message: z.string().max(500),
  stack: z.string().max(2000).optional(),
  path: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const rl = rateLimit(`monitoring:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
    const { message, stack, path } = parsed.data;
    const err = new Error(`[client] ${message}`);
    if (stack) err.stack = stack;
    captureError(err, { where: "client", path });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
