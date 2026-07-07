/**
 * Magic-link login. Supabase mode: signInWithOtp (Supabase sends the email).
 * Memory mode: HMAC one-time token "sent" via the email provider (mock writes
 * to .data/emails). In non-production memory mode the link is also returned
 * in the response so local login works without an inbox — never in prod.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { dataMode, config } from "@/lib/config";
import { createMockLoginToken, getSupabaseServerClient } from "@/lib/auth";
import { getEmailProvider } from "@/lib/providers/email";
import { clientIp, rateLimit, LIMITS } from "@/lib/ratelimit";
import { parseBody, jsonError, withErrorHandling } from "@/lib/api";

const schema = z.object({ email: z.string().email().max(254) });

export const POST = withErrorHandling("auth.magic", async (req: Request) => {
  const rl = rateLimit(`auth:${clientIp(req)}`, LIMITS.authPerIp.limit, LIMITS.authPerIp.windowMs);
  if (!rl.ok) return jsonError(429, "too_many_requests", { retryAfterSec: rl.retryAfterSec });

  const { email } = await parseBody(req, schema);

  if (dataMode === "supabase") {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${config.appUrl}/auth/callback` },
    });
    if (error) return jsonError(400, "magic_link_failed");
    return NextResponse.json({ ok: true });
  }

  // memory mode
  const token = createMockLoginToken(email);
  const link = `${config.appUrl}/auth/callback?mock_token=${encodeURIComponent(token)}`;
  await getEmailProvider().send({
    to: email,
    subject: "Your GuestSnap sign-in link",
    html: `<p>Click to sign in to GuestSnap:</p><p><a href="${link}">Sign in</a></p><p>This link expires in 15 minutes.</p>`,
    text: `Sign in to GuestSnap: ${link}`,
  });
  const devLink = process.env.NODE_ENV !== "production" ? link : undefined;
  return NextResponse.json({ ok: true, devLink });
});
