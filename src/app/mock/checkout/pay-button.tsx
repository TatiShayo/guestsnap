"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Simulates Stripe redirecting back after payment: posts the mock token to
 *  our webhook route (same fulfillment path a real signed webhook takes),
 *  then follows the success/cancel URL exactly like real Checkout would. */
export function PayButton({ token, cancelUrl }: { token: string; cancelUrl: string }) {
  const [status, setStatus] = useState<"idle" | "paying" | "error">("idle");

  async function pay() {
    setStatus("paying");
    try {
      const res = await fetch("/api/webhooks/stripe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const payload = verifyLocal(token);
      window.location.href = payload?.successUrl.replace("{CHECKOUT_SESSION_ID}", payload.sessionId) ?? "/dashboard";
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-6 space-y-2">
      <Button type="button" className="w-full" size="lg" onClick={() => void pay()} disabled={status === "paying"}>
        {status === "paying" ? "Processing…" : "Pay (test mode)"}
      </Button>
      <a
        href={cancelUrl}
        className="block text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        Cancel
      </a>
      {status === "error" ? (
        <p className="text-center text-sm text-destructive">Something went wrong. Try again.</p>
      ) : null}
    </div>
  );
}

/** The success/session-id fields are already in the (HMAC-signed, tamper-
 *  proof) token — decode client-side just to build the redirect URL. This is
 *  display/navigation only; the server route is what actually fulfills. */
function verifyLocal(token: string): { successUrl: string; sessionId: string } | null {
  try {
    const body = token.slice(0, token.lastIndexOf("."));
    const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes)) as {
      successUrl: string;
      sessionId: string;
    };
    return json;
  } catch {
    return null;
  }
}
