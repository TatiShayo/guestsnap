"use client";

/** QR PNG preview + downloads, printable table-card PDF (3 style variants),
 *  and copy-link. Downloads fire through the host-owner-checked API routes,
 *  which also stamp the qr_downloaded analytics event server-side. */
import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STYLES = [
  { id: "classic", label: "Classic serif" },
  { id: "minimal", label: "Modern minimal" },
  { id: "playful", label: "Playful" },
] as const;

export function ShareKit({ slug, guestUrl }: { slug: string; guestUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [style, setStyle] = useState<(typeof STYLES)[number]["id"]>("classic");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(guestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the link is still visible to select by hand
    }
  }

  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-xl">QR code</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/events/${slug}/qr`}
          alt={`QR code linking to ${guestUrl}`}
          className="mx-auto mt-4 h-48 w-48 rounded-lg border border-border"
        />
        <a
          href={`/api/events/${slug}/qr`}
          download={`${slug}-qr.png`}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-input bg-transparent px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Download className="h-4 w-4" /> Download PNG
        </a>

        <div className="mt-5 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
          <code className="flex-1 truncate text-xs text-muted-foreground">{guestUrl}</code>
          <button
            type="button"
            onClick={() => void copyLink()}
            aria-label="Copy link"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-xl">Printable table cards</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          4 per A4 sheet — cut and place on tables. Guests photograph these for their own feeds too.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                style === s.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <a
          href={`/api/events/${slug}/table-cards?style=${style}`}
          target="_blank"
          rel="noreferrer"
          className="mt-5 block"
        >
          <Button type="button" className="w-full">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </a>
      </div>
    </div>
  );
}
