import type { Metadata } from "next";
import { ArticleShell } from "@/components/marketing/article-shell";

export const metadata: Metadata = {
  title: "Funeral & Memorial Photo Sharing — Collect Photos From Every Family Member",
  description:
    "Gather photos and video tributes from everyone who attends a funeral or celebration of life, with a private, respectful QR code album. No app, no accounts, gentle by design.",
  alternates: { canonical: "/funeral-photo-sharing" },
};

const FAQ = [
  {
    question: "Is this appropriate for a funeral, or is it too much like an event app?",
    answer:
      "GuestSnap deliberately avoids anything that feels festive — no confetti, no emoji, no gamified counters. It's a quiet, private album: a QR code on the memorial program, a place for family to add photos and a short spoken memory, and nothing more. Many families use it specifically because it's understated.",
  },
  {
    question: "Can we keep the gallery completely private to family?",
    answer:
      "Yes. Set visibility to host-only and nothing is visible until you choose to share it, or use the shared gallery setting only once you're ready. You can also require approval on every upload, so a family member reviews everything before it's visible to anyone else.",
  },
  {
    question: "Can distant relatives who couldn't attend still contribute?",
    answer:
      "Yes — share the same link by text or email instead of printing the QR code. Anyone with the link can add photos or a video tribute from wherever they are, so relatives who couldn't travel are still part of the collected memory.",
  },
  {
    question: "What is the video guestbook, exactly?",
    answer:
      "It's an optional Premium feature: guests record a short video message, up to 30 seconds, directly from their phone browser — a spoken memory or message to the family, collected the same simple way as photos, gathered into one place you can revisit any time.",
  },
  {
    question: "How long do you keep the photos?",
    answer:
      "Free events are archived 90 days after the date, with a reminder email well before that happens so nothing is lost. Paid events keep the full album for 12 months, extendable to 24, and you can download everything as a ZIP whenever you're ready.",
  },
];

export default function Page() {
  return (
    <ArticleShell
      kicker="Funeral & memorial photo sharing"
      h1="One quiet place for every family member's photos and memories"
      subhead="A private QR code album for a funeral, celebration of life, or memorial — gentle by design, with no app, no accounts, and no noise."
      faqItems={FAQ}
      ctaLabel="Create a memorial album — free"
    >
      <h2>The photos that matter are scattered across everyone&apos;s phone</h2>
      <p>
        After a loss, the photos that mean the most are rarely the formal ones — they&apos;re the
        candid shot a cousin took at a family gathering years ago, the video someone recorded of a
        toast, the picture a grandchild has been meaning to send for months. Those images live on
        dozens of different phones, and without an easy way to gather them, most never make it to
        the family who would treasure them. GuestSnap gives every relative and friend one simple
        place to add what they have, without asking anyone to install anything or navigate a
        complicated process during an already difficult time.
      </p>

      <h2>Designed to be understated, not an &quot;event app&quot;</h2>
      <p>
        We built this specifically so it wouldn&apos;t feel like a party tool repurposed for a
        funeral. There&apos;s no confetti animation, no playful counters, no bright colors — the
        interface uses the same quiet, warm design throughout, and the guest upload page can be
        set up with a simple welcome message from the family instead of anything celebratory. A
        printed card with the QR code can sit next to the guest book at the service, worded
        however the family prefers: &quot;Share a photo or memory of [name].&quot;
      </p>

      <h2>Privacy comes first</h2>
      <p>
        Funerals bring together people who may not know each other, and not every photo needs to
        be visible to everyone immediately. GuestSnap lets the family choose exactly how the
        gallery behaves: fully shared once curated, visible only to the person who uploaded it
        until reviewed, or entirely private to the family until they decide to share it further.
        Every upload can also require approval first, so nothing appears without a family member
        seeing it. There is no public gallery listing — the link and QR code are the only way in,
        and event addresses include a random suffix specifically so they can&apos;t be guessed.
      </p>

      <h2>A video guestbook, for the words people don&apos;t always write down</h2>
      <p>
        Alongside photos, guests can record a short video message — a memory, a story, or simply
        &quot;thinking of you&quot; — directly from their phone, no separate recording app needed.
        These become part of the same private collection as the photos, so the family ends up
        with something closer to a full record of who showed up and what they wanted to say, not
        just a folder of pictures.
      </p>

      <h2>Who this is for</h2>
      <ul>
        <li>Families organizing a funeral, celebration of life, or memorial service.</li>
        <li>Funeral homes or celebrants who want to offer this as a thoughtful option to families.</li>
        <li>Anyone planning a memorial gathering where relatives will travel from out of town and want an easy way to contribute.</li>
      </ul>

      <h2>Pricing</h2>
      <p>
        The free tier covers a smaller gathering with up to 20 photos, no card required. For a
        larger service, Standard ($49) raises the limit to 500 uploads and adds a full-quality ZIP
        download of everything collected; Premium ($99) removes the upload limit entirely and adds
        the video guestbook. It&apos;s one payment, not a subscription — there&apos;s nothing to
        remember to cancel afterward.
      </p>
    </ArticleShell>
  );
}
