/**
 * Error monitoring behind a provider interface. When SENTRY_DSN is set we
 * report via Sentry's envelope HTTP API directly (no SDK — keeps the bundle
 * lean and works in any runtime); console fallback otherwise. Never include
 * PII or request bodies in the context object.
 */
import { config } from "@/lib/config";

interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!u.username || !projectId) return null;
    return { publicKey: u.username, host: u.host, projectId };
  } catch {
    return null;
  }
}

const dsn = config.sentry.enabled ? parseDsn(config.sentry.dsn) : null;

function sendToSentry(error: unknown, context?: Record<string, unknown>) {
  if (!dsn) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const eventId = globalThis.crypto.randomUUID().replace(/-/g, "");
  const timestamp = new Date().toISOString();
  const event = {
    event_id: eventId,
    timestamp,
    platform: "javascript",
    level: "error",
    environment: process.env.NODE_ENV || "development",
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: err.stack
            ? { frames: err.stack.split("\n").slice(1, 20).map((line) => ({ function: line.trim() })) }
            : undefined,
        },
      ],
    },
    extra: context ?? {},
  };
  const envelope =
    JSON.stringify({ event_id: eventId, sent_at: timestamp, dsn: config.sentry.dsn }) +
    "\n" +
    JSON.stringify({ type: "event" }) +
    "\n" +
    JSON.stringify(event);
  // fire-and-forget; never let monitoring break the request path
  void fetch(`https://${dsn.host}/api/${dsn.projectId}/envelope/`, {
    method: "POST",
    headers: { "content-type": "application/x-sentry-envelope" },
    body: envelope,
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  sendToSentry(error, context);
  console.error("[error]", context?.where ?? "", error instanceof Error ? error.message : error);
}
