/**
 * Central runtime configuration. Every third-party integration is optional:
 * a missing key switches that provider to its mock implementation so the
 * app always builds and runs. Real keys are read server-side only, except
 * NEXT_PUBLIC_* values which are genuinely public.
 */

function has(v: string | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export const config = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  appSecret: process.env.APP_SECRET || "dev-only-change-me",

  supabase: {
    enabled:
      has(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      has(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
      has(process.env.SUPABASE_SERVICE_ROLE_KEY),
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },

  stripe: {
    enabled: has(process.env.STRIPE_SECRET_KEY),
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
  },

  resend: {
    enabled: has(process.env.RESEND_API_KEY),
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.EMAIL_FROM || "GuestSnap <hello@guestsnap.app>",
  },

  posthog: {
    enabled: has(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY || "",
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
  },

  sentry: {
    enabled: has(process.env.SENTRY_DSN) || has(process.env.NEXT_PUBLIC_SENTRY_DSN),
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "",
  },

  sightengine: {
    enabled: has(process.env.SIGHTENGINE_USER) && has(process.env.SIGHTENGINE_SECRET),
    user: process.env.SIGHTENGINE_USER || "",
    secret: process.env.SIGHTENGINE_SECRET || "",
  },

  turnstile: {
    enabled: has(process.env.TURNSTILE_SECRET_KEY),
    siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
    secretKey: process.env.TURNSTILE_SECRET_KEY || "",
  },

  cronSecret: process.env.CRON_SECRET || "",
  adminEmails: (process.env.ADMIN_EMAILS || "admin@example.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
} as const;

/** 'supabase' when fully configured, otherwise 'memory' (local .data store). */
export const dataMode: "supabase" | "memory" = config.supabase.enabled ? "supabase" : "memory";
