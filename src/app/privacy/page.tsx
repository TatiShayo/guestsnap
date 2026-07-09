import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How GuestSnap handles event, host, and guest data.",
  alternates: { canonical: "/privacy" },
};

/**
 * Plain-language privacy policy (BUILD_PROMPT cross-cutting requirement).
 * GuestSnap hosts photos of identifiable people, including minors, so this
 * states the controller relationship and deletion process explicitly.
 * NOT a substitute for legal review before a real launch — see
 * PROJECT_STATE "NEEDS HUMAN" for that flag.
 */
export default function PrivacyPage() {
  return (
    <div className="grain min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated 2026-07-10.</p>

        <div className="mt-10 space-y-8 leading-relaxed text-muted-foreground [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-foreground">
          <section>
            <h2>Who controls your data</h2>
            <p>
              Each event on GuestSnap is created and managed by a host — the person or organization
              who set it up. For photos and videos guests upload to an event, the host is the data
              controller: they decide who can see the gallery, whether uploads need approval, and
              when the event is deleted. GuestSnap acts as the processor that stores and serves
              that data on the host&apos;s behalf.
            </p>
          </section>

          <section>
            <h2>What we collect</h2>
            <p>
              Host accounts: email address and, optionally, a display name. Events: title, date,
              type, and settings the host chooses. Guest uploads: the photo or video file, an
              optional name the guest enters, and a short-lived per-device key used only to
              support &quot;show my own uploads&quot; visibility — we do not require guests to
              create an account or provide an email to upload. If a guest chooses to request the
              album by email, we store that email address solely to send the album link.
            </p>
          </section>

          <section>
            <h2>Guest consent</h2>
            <p>
              By uploading a photo or video to an event, a guest agrees to share that file with the
              event host under the visibility settings the host has configured, and acknowledges
              that other guests or attendees may appear in what they upload. Hosts are responsible
              for setting expectations with their guests about how photos will be used and shared.
            </p>
          </section>

          <section>
            <h2>How we protect uploads</h2>
            <p>
              Every photo is re-encoded on our servers before storage, which strips GPS location
              and other EXIF metadata automatically — a guest&apos;s upload never carries their
              location data forward. Media is stored in a private location and served only through
              short-lived signed links after an access check; there is no public directory listing
              of any event&apos;s files. Every upload is automatically screened, and any guest can
              report content they believe is inappropriate.
            </p>
          </section>

          <section>
            <h2>Retention and deletion</h2>
            <p>
              Free-tier events are automatically archived 90 days after the event date (with a
              reminder email in advance) and hard-deleted 30 days after archiving. Paid events keep
              media for 12 months, or 24 months with the retention add-on, on the same schedule
              afterward. Hosts can delete their own events and all associated media at any time
              from their dashboard. If you are a guest and want a specific photo or video removed,
              contact the host directly, or email us and we will process a deletion request within
              30 days.
            </p>
          </section>

          <section>
            <h2>Payments</h2>
            <p>
              Event upgrades are processed by Stripe; we do not store full card numbers on our
              servers. Stripe&apos;s own privacy policy governs payment data they process on our
              behalf.
            </p>
          </section>

          <section>
            <h2>International users</h2>
            <p>
              If you are located in the European Economic Area or United Kingdom, you have rights
              under GDPR to access, correct, or delete your personal data, and to object to certain
              processing. Contact us to exercise these rights; we will respond within 30 days.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Questions about this policy or a deletion request can be sent to the address listed
              in the app footer or your event host directly.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
