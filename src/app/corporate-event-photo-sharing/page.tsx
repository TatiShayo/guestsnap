import type { Metadata } from "next";
import { ArticleShell } from "@/components/marketing/article-shell";

export const metadata: Metadata = {
  title: "Corporate Event Photo Sharing — Attendee Photos in One Branded Album",
  description:
    "Collect attendee photos from conferences, offsites, and company parties with a QR code — no app to install, custom brand color, live slideshow, and instant ZIP export.",
  alternates: { canonical: "/corporate-event-photo-sharing" },
};

const FAQ = [
  {
    question: "Can we add our company's branding to the upload page?",
    answer:
      "Yes — Premium events support a custom brand color applied across the upload page, gallery, and live slideshow, so the experience matches your company's palette instead of looking like a generic third-party tool.",
  },
  {
    question: "Is this suitable for a large conference with hundreds of attendees?",
    answer:
      "Yes. Premium removes the upload cap entirely, so it scales from a 20-person offsite to a multi-day conference with hundreds of attendees contributing throughout every session and social event.",
  },
  {
    question: "Can we run this across multiple days or multiple sessions?",
    answer:
      "Yes — the event stays active for as long as you need it, so attendees can keep contributing across every day of a multi-day conference, and the live slideshow can run continuously at a booth or lounge area the whole time.",
  },
  {
    question: "How do we get attendee photos afterward for our marketing team?",
    answer:
      "One click downloads a ZIP of every original photo and video at full resolution, so your marketing or comms team gets a ready-made asset library without chasing individual attendees for their camera roll.",
  },
  {
    question: "Does this require attendees to install anything on a work phone?",
    answer:
      "No — that's precisely why it fits corporate environments. There's no app install, which many corporate device policies restrict, and no account creation. Attendees just scan the code and use their browser.",
  },
];

export default function Page() {
  return (
    <ArticleShell
      kicker="Corporate event photo sharing"
      h1="Attendee photos from every session, in one branded album"
      subhead="A QR code on your signage or slides collects photos from the whole event automatically — no app to install on a work phone, no account required."
      faqItems={FAQ}
      ctaLabel="Create your event"
    >
      <h2>Your official photographer misses more of the event than they capture</h2>
      <p>
        A hired photographer covers the keynote and a handful of staged shots, but the real texture
        of a conference or offsite — the hallway conversations, the breakout sessions, the team
        dinner, the candid laugh during a panel — happens in dozens of places the photographer
        simply can&apos;t be. Attendees are already taking those photos on their own phones.
        GuestSnap gives them one obvious, frictionless place to contribute them, turning a hundred
        scattered camera rolls into a single, complete record of the event.
      </p>

      <h2>No app installs, no accounts — a real constraint for corporate devices</h2>
      <p>
        Many corporate IT policies restrict installing new apps on work phones, and even on
        personal devices, attendees are unlikely to install something just for a two-day
        conference. GuestSnap works entirely in the browser: attendees scan a QR code on signage,
        a slide, or a lanyard insert, and the upload page opens immediately with no login and no
        install. That single design decision is usually the difference between an event photo tool
        that gets meaningful participation and one that gets ignored after the opening keynote.
      </p>

      <h2>On-brand, not off-the-shelf</h2>
      <p>
        A generic photo-sharing tool with someone else&apos;s colors and logo looks out of place at
        a company event. Premium events let you set a custom brand color that carries across the
        upload page, the shared gallery, and the live slideshow, so the whole experience reads as
        part of your event rather than a bolted-on third-party product — important when the
        gallery link is going out under your company&apos;s name.
      </p>

      <h2>A live wall for the lounge or booth</h2>
      <p>
        Point a screen at the live slideshow in a break area, a booth, or a lounge, and it becomes
        a passive photo wall that updates itself — new attendee photos crossfade in within seconds
        of upload, no one running it manually. It&apos;s a low-effort way to give an event floor
        visible energy without assigning staff to manage a screen throughout the day.
      </p>

      <h2>Built to scale from an offsite to a full conference</h2>
      <ul>
        <li>Premium removes the upload cap entirely — hundreds of attendees, unlimited photos.</li>
        <li>Every upload is automatically screened, appropriate for a public-facing company event.</li>
        <li>Choose visibility settings per event — fully shared, or host-only until your comms team curates it.</li>
        <li>One-click ZIP export hands your marketing team a ready asset library the same day.</li>
      </ul>

      <h2>Pricing for teams running more than one event a year</h2>
      <p>
        Free covers a small internal test with 20 photos. Standard ($49 per event) fits a
        department offsite; Premium ($99 per event) fits a full conference with branding and no
        upload limit. Companies running events regularly — quarterly all-hands, recurring
        conferences, client parties — often use the Pro Pack, three Standard-tier event credits
        bundled together, so procurement only has to approve one purchase instead of one per event.
      </p>
    </ArticleShell>
  );
}
