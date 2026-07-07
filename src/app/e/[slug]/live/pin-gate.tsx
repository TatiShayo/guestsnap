"use client";

/** 4-digit PIN gate for the slideshow URL. Rate-limited server-side (5/min)
 *  with friendly lockout copy — never a raw error string. */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LiveSlideshow } from "./live-slideshow";

const TOKEN_KEY_PREFIX = "gs_slideshow_token_";

export function PinGate({ slug, title }: { slug: string; title: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(
    typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY_PREFIX + slug) : null
  );

  if (token) {
    return <LiveSlideshow slug={slug} title={title} brandColor={null} watermark={false} pinToken={token} />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${slug}/slideshow-auth`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string | null; message?: string };
      if (!res.ok) {
        setError(data.message || "That PIN doesn't match. Try again.");
        setLoading(false);
        return;
      }
      if (data.token) sessionStorage.setItem(TOKEN_KEY_PREFIX + slug, data.token);
      setToken(data.token ?? "");
    } catch {
      setError("Connection dropped. Try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <form onSubmit={submit} className="w-full max-w-xs text-center">
        <p className="font-display text-2xl text-ivory">{title}</p>
        <p className="mt-2 text-sm text-ivory/60">Enter the 4-digit PIN to view the slideshow.</p>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          autoFocus
          maxLength={4}
          className="mt-6 h-14 w-full rounded-lg border border-white/20 bg-white/5 text-center text-3xl tracking-[0.5em] text-ivory tabular-nums outline-none focus-visible:border-primary"
          placeholder="••••"
        />
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={pin.length !== 4 || loading}>
          {loading ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}
