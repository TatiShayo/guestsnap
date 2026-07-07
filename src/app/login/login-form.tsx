"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { useAnalytics } from "@/components/analytics-provider";

/**
 * Magic-link request form. In memory mode the API returns a `devLink` so local
 * dev can sign in without an inbox — we surface it as a clickable link.
 */
export function LoginForm() {
  const analytics = useAnalytics();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [devLink, setDevLink] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    analytics.track("signup_started");
    try {
      const res = await fetch("/api/auth/magic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { devLink?: string };
      if (!res.ok) {
        setState("error");
        return;
      }
      setDevLink(data.devLink ?? null);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="mt-8 rounded-lg border border-border bg-card p-6 text-center shadow-soft">
        <p className="font-display text-xl">Check your email</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>.
        </p>
        {devLink ? (
          <a
            href={devLink}
            className="mt-4 inline-block rounded-md bg-secondary px-4 py-2 text-sm font-medium underline-offset-2 hover:underline"
          >
            Dev mode: open sign-in link
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
      <div>
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {state === "error" ? (
        <p className="text-sm text-destructive">Couldn&apos;t send the link. Check the address and try again.</p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send me a sign-in link"}
      </Button>
    </form>
  );
}
