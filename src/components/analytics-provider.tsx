"use client";

/**
 * PostHog client wiring. No-op (console log in dev) when the key is missing
 * so the whole funnel is instrumentable with zero keys. Every event name is
 * documented in analytics.md — no orphan events. No PII in properties.
 */
import { createContext, useContext, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";

interface Analytics {
  track: (event: string, properties?: Record<string, unknown>) => void;
  identify: (distinctId: string) => void;
}

const AnalyticsContext = createContext<Analytics>({ track: () => {}, identify: () => {} });

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

type PostHogClient = {
  init: (key: string, opts: Record<string, unknown>) => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (id: string) => void;
};

let posthog: PostHogClient | null = null;
let initStarted = false;

async function ensurePosthog(): Promise<PostHogClient | null> {
  if (!KEY) return null;
  if (posthog) return posthog;
  if (initStarted) return posthog;
  initStarted = true;
  const mod = await import("posthog-js");
  mod.default.init(KEY, {
    api_host: HOST,
    capture_pageview: false, // we capture route changes ourselves
    session_recording: { maskAllInputs: true }, // PII-masked replay (PLAYBOOK 5)
    persistence: "localStorage+cookie",
  });
  posthog = mod.default as unknown as PostHogClient;
  return posthog;
}

export function useAnalytics(): Analytics {
  return useContext(AnalyticsContext);
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const api = useMemo<Analytics>(
    () => ({
      track: (event, properties) => {
        void ensurePosthog().then((ph) => {
          if (ph) ph.capture(event, properties);
          else if (process.env.NODE_ENV !== "production") console.log(`[analytics] ${event}`, properties ?? {});
        });
      },
      identify: (distinctId) => {
        void ensurePosthog().then((ph) => ph?.identify(distinctId));
      },
    }),
    []
  );

  useEffect(() => {
    api.track("$pageview", { path: pathname });
  }, [pathname, api]);

  return <AnalyticsContext.Provider value={api}>{children}</AnalyticsContext.Provider>;
}
