import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern using GuestSnap as a host or guest.",
  alternates: { canonical: "/terms" },
};

/** Plain-language terms (BUILD_PROMPT cross-cutting requirement). Not a
 * substitute for legal review before a real launch. */
export default function TermsPage() {
  return (
    <div className="grain min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated 2026-07-10.</p>

        <div className="mt-10 space-y-8 leading-relaxed text-muted-foreground [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-foreground">
          <section>
            <h2>Using GuestSnap</h2>
            <p>
              GuestSnap lets a host create an event and collect photos and videos from guests via a
              shared link or QR code. By creating an event, you agree to these terms. By uploading
              a photo or video to someone else&apos;s event, you agree to the portion of these terms
              that applies to guests.
            </p>
          </section>

          <section>
            <h2>Host responsibilities</h2>
            <p>
              As a host, you are responsible for the event you create: setting appropriate
              visibility and approval settings, moderating content your guests upload, and
              respecting the privacy of anyone who appears in photos shared through your event. You
              may not use GuestSnap to collect or display content that is illegal, harassing, or
              violates another person&apos;s rights.
            </p>
          </section>

          <section>
            <h2>Guest uploads</h2>
            <p>
              Guests may only upload photos and videos they have the right to share, and must not
              upload content that is illegal, sexually explicit involving minors, harassing, or
              otherwise violates applicable law. Every upload is automatically screened and may be
              hidden pending host review; repeated violations may result in a guest being blocked
              from an event.
            </p>
          </section>

          <section>
            <h2>Payments</h2>
            <p>
              Event upgrades are one-time payments processed by Stripe, tied to a specific event —
              not a recurring subscription. Pricing and included limits are shown at checkout
              before you pay. If you are not satisfied with a purchase, contact us; refunds are
              handled case by case.
            </p>
          </section>

          <section>
            <h2>Content ownership</h2>
            <p>
              Guests retain ownership of the photos and videos they upload. By uploading, a guest
              grants the host a license to display, download, and share that content as configured
              by the event&apos;s settings. GuestSnap does not claim ownership of any uploaded
              content and only processes it to operate the service.
            </p>
          </section>

          <section>
            <h2>Availability and limits</h2>
            <p>
              We aim for the service to be reliably available but do not guarantee uninterrupted
              access. Free-tier events are subject to the upload limits and retention schedule
              described in our Privacy Policy; media may be archived or deleted after the stated
              retention period.
            </p>
          </section>

          <section>
            <h2>Changes</h2>
            <p>
              We may update these terms as the product evolves. Continued use of GuestSnap after a
              change constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>Questions about these terms can be sent to the address listed in the app footer.</p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
