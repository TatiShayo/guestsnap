import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Public-facing nav for the landing + SEO pages. Distinct from AppHeader
 *  (which is host-only, post-login). */
export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-display text-lg tracking-tight">
          GuestSnap
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground sm:flex">
          <Link href="/#pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link href="/#faq" className="transition-colors hover:text-foreground">
            FAQ
          </Link>
          <Link href="/wedding-photo-sharing-app" className="transition-colors hover:text-foreground">
            For weddings
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
            Sign in
          </Link>
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Create your event
          </Link>
        </div>
      </div>
    </header>
  );
}
