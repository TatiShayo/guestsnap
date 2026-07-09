import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { DEMO_SLUG } from "@/lib/demo";

/**
 * Shared shell for the programmatic SEO pages (BUILD_PROMPT #11). Keeps
 * header/footer/CTA/FAQ markup consistent while every page supplies its own
 * unique, benefit-led prose as children — nothing here is templated copy.
 */
export function ArticleShell({
  kicker,
  h1,
  subhead,
  children,
  faqItems,
  ctaLabel = "Create your event — free",
}: {
  kicker: string;
  h1: string;
  subhead: string;
  children: ReactNode;
  faqItems: FaqItem[];
  ctaLabel?: string;
}) {
  return (
    <div className="grain min-h-screen">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-16 sm:pt-20">
          <p className="mb-4 text-sm uppercase tracking-[0.2em] text-muted-foreground">{kicker}</p>
          <h1 className="text-balance font-display text-4xl leading-[1.1] sm:text-5xl">{h1}</h1>
          <p className="mt-5 text-lg text-muted-foreground">{subhead}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              {ctaLabel}
            </Link>
            <Link href={`/e/${DEMO_SLUG}`} className={buttonVariants({ size: "lg", variant: "outline" })}>
              See a live demo
            </Link>
          </div>
        </section>

        <article className="mx-auto max-w-3xl px-6 py-12 [&>h2]:mt-12 [&>h2]:font-display [&>h2]:text-2xl [&>h2]:sm:text-3xl [&>p]:mt-4 [&>p]:leading-relaxed [&>p]:text-muted-foreground [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:text-muted-foreground">
          {children}
        </article>

        <section className="mx-auto max-w-3xl px-6 py-8">
          <h2 className="font-display text-2xl sm:text-3xl">Questions</h2>
          <Faq items={faqItems} />
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-24">
          <div className="grain flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-soft">
            <h2 className="max-w-md text-balance font-display text-2xl sm:text-3xl">
              Ready to collect every guest&apos;s photos in one place?
            </h2>
            <Link href="/login" className={buttonVariants({ size: "lg", className: "mt-7" })}>
              {ctaLabel}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
