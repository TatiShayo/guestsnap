/**
 * Security headers on every response (PLAYBOOK 2.4). CSP allows PostHog and
 * Turnstile only when configured; no other third-party scripts.
 */
import { NextResponse, type NextRequest } from "next/server";

const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const posthogEnabled = !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
const turnstileEnabled = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function buildCsp(): string {
  const scriptSrc = ["'self'", "'unsafe-inline'"]; // Next.js inline runtime; nonce migration tracked in PROJECT_STATE
  const connectSrc = ["'self'"];
  const frameSrc: string[] = [];
  if (posthogEnabled) {
    scriptSrc.push(posthogHost);
    connectSrc.push(posthogHost, posthogHost.replace("us.i.", "us-assets.i."));
  }
  if (turnstileEnabled) {
    scriptSrc.push("https://challenges.cloudflare.com");
    frameSrc.push("https://challenges.cloudflare.com");
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) connectSrc.push(supabaseUrl, supabaseUrl.replace("https://", "wss://"));
  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    frameSrc.length ? `frame-src ${frameSrc.join(" ")}` : "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

const CSP = buildCsp();

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
