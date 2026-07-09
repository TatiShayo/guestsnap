import type { Metadata } from "next";
import Link from "next/link";
import { QrCode, Smartphone, Tv, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PricingTable } from "@/components/marketing/pricing-table";
import { Faq } from "@/components/marketing/faq";
import { Testimonials } from "@/components/marketing/testimonials";
import { DEMO_SLUG } from "@/lib/demo";

export const metadata: Metadata = {
  title: "GuestSnap — every guest's photos, one QR code",
  description:
    "Collect every guest's photos and videos at your wedding, birthday, funeral, or corporate event with a single QR code. No app, no accounts, live TV slideshow, one-time payment.",
  alternates: { canonical: "/" },
};

const FAQ_ITEMS = [
  {
    question: "Do guests need to download an app or make an account?",
    answer:
      "No. Guests scan the QR code, land on a web page in their phone's browser, and start uploading. There is nothing to install and no account to create.",
  },
  {
    question: "Is it really a one-time payment?",
    answer:
      "Yes. GuestSnap charges per event, not per month. Pay once when you're ready to upgrade an event — there's no subscription to cancel later.",
  },
  {
    question: "What happens to our photos after the event?",
    answer:
      "Free events keep photos for 90 days (with a reminder email before anything is archived). Paid events keep the full album for 12 months, or 24 months with the retention add-on, and you can download everything as a ZIP at any time.",
  },
  {
    question: "Can we control who sees the photos?",
    answer:
      "Yes. Each event has a visibility setting: the full shared gallery, guests seeing only their own uploads, or host-only until you're ready to publish. You can also require approval before anything goes public and set a PIN on the live slideshow.",
  },
  {
    question: "What if someone uploads something inappropriate?",
    answer:
      "Every upload is automatically screened, and any guest can report a photo with one tap — a report or a flag hides it pending your review. Nothing questionable stays visible by default.",
  },
];

export default function LandingPage() {
  return (
    <div className="grain min-h-screen">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-4 text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Weddings · Birthdays · Funerals · Corporate events
            </p>
            <h1 className="text-balance font-display text-5xl leading-[1.05] sm:text-6xl">
              Every guest&apos;s photos. One QR code.
            </h1>
            <p className="mt-6 text-balance text-lg text-muted-foreground">
              Guests upload straight from their phone browser — no app, no accounts, no missed
              moments. You get a shared album and a live slideshow, ready before the toast is over.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link href="/login" className={buttonVariants({ size: "lg" })}>
                Create your event — free
              </Link>
              <Link
                href={`/e/${DEMO_SLUG}`}
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                See a live demo
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free forever for 20 photos. No credit card to start.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-8 sm:grid-cols-3">
            <Feature
              icon={<QrCode className="h-6 w-6" />}
              title="Print the QR code"
              body="Download a table-card PDF or share a short link. Guests scan it with the camera they already have open."
            />
            <Feature
              icon={<Smartphone className="h-6 w-6" />}
              title="Guests upload in seconds"
              body="No app, no login. Photos and videos land in your shared album straight from the browser."
            />
            <Feature
              icon={<Tv className="h-6 w-6" />}
              title="Watch it fill up live"
              body="Cast the slideshow to a TV — new photos crossfade in within seconds of upload, all night long."
            />
          </div>
        </section>

        {/* Trust strip */}
        <section className="border-y border-border bg-card/50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Private by default — no public bucket listing
            </span>
            <span>EXIF/GPS stripped from every photo automatically</span>
            <span>Every upload screened before it&apos;s visible</span>
          </div>
        </section>

        {/* Pricing */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-display text-3xl sm:text-4xl">Simple, one-time pricing</h2>
            <p className="mt-3 text-muted-foreground">
              Pay per event, not per month. Prices below are exactly what you&apos;ll see at checkout.
            </p>
          </div>
          <div className="mt-10">
            <PricingTable />
          </div>
        </section>

        {/* Use cases */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center font-display text-3xl sm:text-4xl">Built for the day, not just weddings</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: "/wedding-photo-sharing-app", label: "Weddings" },
              { href: "/birthday-party-photo-collection", label: "Birthdays" },
              { href: "/funeral-photo-sharing", label: "Funerals & memorials" },
              { href: "/corporate-event-photo-sharing", label: "Corporate events" },
            ].map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 shadow-soft transition-all hover:-translate-y-0.5"
              >
                <span className="font-display text-lg">{c.label}</span>
                <span className="text-muted-foreground transition-transform group-hover:translate-x-1">→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center font-display text-3xl sm:text-4xl">What hosts say</h2>
          <div className="mt-8">
            <Testimonials />
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-center font-display text-3xl sm:text-4xl">Questions</h2>
          <Faq items={FAQ_ITEMS} />
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grain flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-soft">
            <h2 className="max-w-lg text-balance font-display text-3xl sm:text-4xl">
              Your guests already have a camera. Give them somewhere to put the photos.
            </h2>
            <Link href="/login" className={buttonVariants({ size: "lg", className: "mt-8" })}>
              Create your event — free
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
