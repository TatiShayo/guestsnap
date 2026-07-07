/**
 * Auth abstraction. Supabase mode: magic link + Google OAuth via
 * @supabase/ssr cookies. Memory mode (no keys): HMAC-signed session cookie
 * with a dev magic-link flow that "sends" via the mock email provider.
 * Server routes ALWAYS re-validate the session — client-supplied user ids
 * are never trusted.
 */
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { config, dataMode } from "@/lib/config";
import { signToken, verifyToken } from "@/lib/tokens";
import { getData } from "@/lib/data";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export const SESSION_COOKIE = "gs_session";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — safe to ignore; middleware/route
          // handlers refresh the session.
        }
      },
    },
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (dataMode === "supabase") {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user?.email) return null;
    const profile = await getData().upsertProfile({
      id: data.user.id,
      email: data.user.email,
      name: (data.user.user_metadata?.full_name as string) ?? null,
    });
    return { id: profile.id, email: profile.email, name: profile.name };
  }
  // memory mode: verify signed cookie
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const payload = verifyToken<{ uid: string; email: string; exp: number }>(raw);
  if (!payload) return null;
  const profile = await getData().getProfile(payload.uid);
  if (!profile) return null;
  return { id: profile.id, email: profile.email, name: profile.name };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  return user;
}

export class AuthError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "AuthError";
  }
}

/** Memory-mode session cookie value (30 days). */
export function createMockSessionToken(uid: string, email: string): string {
  return signToken({ uid, email, exp: Math.floor(Date.now() / 1000) + 30 * 86400 });
}

/** Memory-mode one-time magic-link token (15 min). */
export function createMockLoginToken(email: string): string {
  return signToken({ kind: "login", email: email.toLowerCase(), exp: Math.floor(Date.now() / 1000) + 900 });
}

export function verifyMockLoginToken(token: string): string | null {
  const payload = verifyToken<{ kind: string; email: string }>(token);
  if (!payload || payload.kind !== "login") return null;
  return payload.email;
}

export function isAdmin(user: SessionUser | null): boolean {
  return !!user && config.adminEmails.includes(user.email.toLowerCase());
}
