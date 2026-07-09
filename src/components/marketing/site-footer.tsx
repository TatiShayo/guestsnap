import Link from "next/link";
import { DEMO_SLUG } from "@/lib/demo";

const SEO_LINKS = [
  { href: "/wedding-photo-sharing-app", label: "Wedding photo sharing" },
  { href: "/qr-code-wedding-photos", label: "QR code wedding photos" },
  { href: "/funeral-photo-sharing", label: "Funeral photo sharing" },
  { href: "/birthday-party-photo-collection", label: "Birthday photo collection" },
  { href: "/corporate-event-photo-sharing", label: "Corporate event photos" },
];

export function SiteFooter() {
  return (
    <footer className="grain border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <p className="font-display text-lg">GuestSnap</p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Every guest&apos;s photos, one QR code. No app, no accounts, no missed moments.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Use cases</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {SEO_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">Legal</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacy" className="transition-colors hover:text-foreground">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-foreground">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href={`/e/${DEMO_SLUG}`} className="transition-colors hover:text-foreground">
                  Live demo
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} GuestSnap. All photos on this page are illustrative placeholders.
        </p>
      </div>
    </footer>
  );
}
