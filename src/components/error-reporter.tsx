"use client";

/**
 * Client-side error reporting: window errors and unhandled rejections are
 * POSTed to /api/monitoring (rate-limited server route → Sentry/console).
 * No PII beyond the error message and path.
 */
import { useEffect } from "react";

function report(message: string, stack?: string) {
  try {
    void fetch("/api/monitoring", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: message.slice(0, 500), stack: stack?.slice(0, 2000), path: location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never break the page over monitoring */
  }
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => report(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
