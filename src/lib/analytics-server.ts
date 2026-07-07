/**
 * Server-side analytics (PostHog). No-op with console logging when the key
 * is missing. NEVER put PII (emails, names) in event properties — use ids.
 * Every event name is documented in analytics.md.
 */
import { config } from "@/lib/config";

interface PostHogLike {
  capture(args: { distinctId: string; event: string; properties?: Record<string, unknown> }): void;
  shutdown(): Promise<void>;
}

let client: PostHogLike | null = null;
let initialized = false;

async function getClient(): Promise<PostHogLike | null> {
  if (initialized) return client;
  initialized = true;
  if (!config.posthog.enabled) return null;
  try {
    const { PostHog } = await import("posthog-node");
    client = new PostHog(config.posthog.key, { host: config.posthog.host, flushAt: 1, flushInterval: 0 });
  } catch {
    client = null;
  }
  return client;
}

export async function serverTrack(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const c = await getClient();
  if (c) {
    c.capture({ distinctId, event, properties });
  } else if (process.env.NODE_ENV !== "production") {
    console.log(`[analytics] ${event}`, properties ?? {});
  }
}
