"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useAnalytics } from "@/components/analytics-provider";
import { cn } from "@/lib/utils";

/** Guest album email capture — the growth loop. On success we thank them; the
 *  post-event email (lifecycle) turns guests into future hosts. */
export function AlbumCapture({
  slug,
  eventId,
  className,
}: {
  slug: string;
  eventId: string;
  className?: string;
}) {
  const analytics = useAnalytics();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch(`/api/events/${slug}/album`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      analytics.track("album_email_captured", { event_id: eventId });
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        We&apos;ll email you the album when the host publishes it.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={cn("flex gap-2", className)} noValidate>
      <Input
        type="email"
        required
        placeholder="you@example.com"
        aria-label="Email for the album"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-10"
      />
      <Button type="submit" size="sm" disabled={state === "sending"}>
        {state === "sending" ? "…" : "Email me"}
      </Button>
    </form>
  );
}
