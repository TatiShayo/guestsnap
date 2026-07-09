import type { Metadata } from "next";
import { ArticleShell } from "@/components/marketing/article-shell";

export const metadata: Metadata = {
  title: "QR Code for Wedding Photos — Printable Table Cards + Instant Upload",
  description:
    "Put a QR code for wedding photos on every table. Guests scan with their camera, no app needed, and their photos land straight in your shared album and live slideshow.",
  alternates: { canonical: "/qr-code-wedding-photos" },
};

const FAQ = [
  {
    question: "Do guests need a QR scanner app?",
    answer:
      "No — every phone made in the last several years scans QR codes directly from the built-in camera app. Guests point their camera at the code, a link pops up, and tapping it opens the upload page. There's nothing to install.",
  },
  {
    question: "What do the printed table cards look like?",
    answer:
      "GuestSnap generates a print-ready PDF with four cards per A4 sheet, in your choice of three styles — classic serif, modern minimal, or playful — designed to look like real wedding stationery rather than a tech product. Many hosts photograph them for Instagram before the event even starts.",
  },
  {
    question: "Can we use the same QR code at the ceremony and the reception?",
    answer:
      "Yes, it's one link and one code for the whole event — print it once and use it on programs, table cards, a welcome sign, or a projector slide. Every guest who scans it throughout the day contributes to the same shared album.",
  },
  {
    question: "Does the QR code expose our photos to strangers?",
    answer:
      "No. The code links to a private event page, not a public gallery. Event slugs include a random suffix against guessing, media is served through short-lived signed URLs rather than a public folder, and you control gallery visibility — full album, guests-only-their-own-uploads, or host-only.",
  },
  {
    question: "What if a guest loses the QR code or can't scan it?",
    answer:
      "The QR code is just a shortcut to a normal web link. You can text or share the same link directly, and it works identically — scan or tap, either way lands on the same upload page.",
  },
];

export default function Page() {
  return (
    <ArticleShell
      kicker="QR code wedding photos"
      h1="One QR code, every guest's camera roll in one album"
      subhead="Print it on table cards, your program, or a welcome sign. Guests scan with the camera they already have open — no app, no typing a URL, no excuses."
      faqItems={FAQ}
    >
      <h2>Why a QR code beats a hashtag or a shared drive link</h2>
      <p>
        Asking guests to remember a hashtag depends on them posting publicly and you finding every
        post afterward. Texting a shared-drive link depends on guests having your number and
        remembering to open it later. A QR code sidesteps both problems: it&apos;s physically in
        front of the guest at the exact moment they&apos;re holding their phone and taking photos,
        and scanning it is a single, familiar motion — point the camera, tap the banner that
        appears. There&apos;s no typing, no app search, and no login screen standing between a
        guest and uploading the photo they just took.
      </p>

      <h2>Table cards designed to be photographed themselves</h2>
      <p>
        GuestSnap&apos;s QR kit isn&apos;t a generic black-and-white square slapped on a printout.
        It&apos;s a printable PDF, four cards per A4 sheet, available in three stationery styles —
        classic serif, modern minimal, and playful — built to sit naturally next to place cards
        and centerpieces. Because they&apos;re designed like real wedding stationery rather than a
        tech insert, guests end up photographing the cards themselves and posting them, which
        becomes free promotion for the exact code that&apos;s collecting their photos.
      </p>

      <h2>Where to put it so people actually scan it</h2>
      <ul>
        <li>One card per table at the reception, propped against the centerpiece at eye level.</li>
        <li>A larger printed version near the guest book or welcome table at the ceremony entrance.</li>
        <li>On the wedding program itself, so guests see it before the first dance even starts.</li>
        <li>Projected on a screen or the same TV running the live slideshow, as a standing reminder.</li>
      </ul>

      <h2>What happens after the scan</h2>
      <p>
        Scanning the code opens a mobile-first upload page in the guest&apos;s own browser — no
        redirect to an app store, no forced signup. They can optionally add their name, pick
        photos and short videos from their camera roll or shoot new ones on the spot, and watch
        each one &quot;develop&quot; onto a photo stack with a soft polaroid tilt as it uploads.
        Every file is compressed client-side for a fast upload on venue wifi, then re-encoded
        server-side, which strips GPS and other metadata automatically before it&apos;s stored —
        guests never have to think about their location data leaking through a photo.
      </p>

      <h2>The same code powers your live slideshow</h2>
      <p>
        Because every scan feeds the same event, you can point a second screen at the live
        slideshow view and watch new uploads crossfade in within seconds — turning a static QR
        code on a table into a visible, real-time part of the reception. Guests keep scanning
        throughout the night because they can see their photos actually show up, which is the
        single best way to keep the uploads coming past the first hour.
      </p>

      <h2>Pricing</h2>
      <p>
        The QR kit and free tier cover the first 20 photos at no cost — enough to test the flow
        at an engagement party or shower. Standard ($49) and Premium ($99) unlock higher upload
        limits, the live slideshow, and full ZIP export, billed once per event rather than as a
        recurring subscription.
      </p>
    </ArticleShell>
  );
}
