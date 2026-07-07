"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/monitoring", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: error.message?.slice(0, 500) || "app error", path: location.pathname }),
    }).catch(() => {});
  }, [error]);

  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-4xl">Something went sideways</h1>
      <p className="mt-3 max-w-sm text-muted-foreground">
        Your photos are safe. Give it another try — if this keeps happening, we&apos;re already looking into it.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-md bg-primary px-6 py-3 text-primary-foreground shadow-soft transition-transform hover:scale-[1.02] active:scale-[0.97]"
      >
        Try again
      </button>
    </main>
  );
}
