/**
 * Auth callback. Supabase mode: exchanges the OAuth/magic-link code for a
 * session (cookies set by @supabase/ssr). Memory mode: verifies the one-time
 * mock token and sets the signed session cookie.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { dataMode, config } from "@/lib/config";
import {
  createMockSessionToken, getSupabaseServerClient, verifyMockLoginToken, SESSION_COOKIE,
} from "@/lib/auth";
import { getData } from "@/lib/data";
import { serverTrack } from "@/lib/analytics-server";
import { captureError } from "@/lib/monitoring";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (path: string) => NextResponse.redirect(new URL(path, config.appUrl));

  try {
    if (dataMode === "supabase") {
      const code = url.searchParams.get("code");
      if (!code) return to("/login?error=missing_code");
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.user?.email) return to("/login?error=link_expired");
      const existing = await getData().getProfile(data.user.id);
      await getData().upsertProfile({
        id: data.user.id,
        email: data.user.email,
        name: (data.user.user_metadata?.full_name as string) ?? null,
      });
      if (!existing) await serverTrack(data.user.id, "signup_completed", { user_id: data.user.id });
      return to("/dashboard");
    }

    // memory mode
    const token = url.searchParams.get("mock_token");
    const email = token ? verifyMockLoginToken(token) : null;
    if (!email) return to("/login?error=link_expired");
    let profile = await getData().getProfileByEmail(email);
    const isNew = !profile;
    if (!profile) {
      profile = await getData().upsertProfile({ id: crypto.randomUUID(), email });
    }
    if (isNew) await serverTrack(profile.id, "signup_completed", { user_id: profile.id });
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, createMockSessionToken(profile.id, profile.email), {
      httpOnly: true,
      secure: config.appUrl.startsWith("https"),
      sameSite: "lax",
      maxAge: 30 * 86400,
      path: "/",
    });
    return to("/dashboard");
  } catch (e) {
    captureError(e, { where: "auth.callback" });
    return to("/login?error=something_went_wrong");
  }
}
