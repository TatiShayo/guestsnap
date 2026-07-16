"use client";

import { useEffect } from "react";

/**
 * Root error boundary. Unlike `error.tsx` (which only catches errors thrown
 * *within* a route segment and still renders inside the root layout), this
 * catches failures in the root layout itself and therefore must render its own
 * <html>/<body>. Inline styles only — the failure may be a broken stylesheet.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/monitoring", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message?.slice(0, 500) || "root layout error",
        digest: error.digest,
        path: typeof location !== "undefined" ? location.pathname : "",
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#faf7f2",
          color: "#1a1a1a",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", margin: 0 }}>Something went sideways</h1>
        <p style={{ maxWidth: "24rem", color: "#555", marginTop: "0.75rem" }}>
          Your photos are safe. Give it another try — if this keeps happening,
          we&apos;re already looking into it.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            border: 0,
            borderRadius: "0.375rem",
            background: "#c4623d",
            color: "#fff",
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
