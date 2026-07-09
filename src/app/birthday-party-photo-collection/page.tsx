import type { Metadata } from "next";
import { ArticleShell } from "@/components/marketing/article-shell";

export const metadata: Metadata = {
  title: "Birthday Party Photo Collection — Every Guest's Photos, One QR Code",
  description:
    "Collect every guest's birthday party photos automatically with a QR code — kids' parties, milestone birthdays, and everything between. No app, live slideshow, instant download.",
  alternates: { canonical: "/birthday-party-photo-collection" },
};

const FAQ = [
  {
    question: "Is this good for a kid's birthday party with young guests?",
    answer:
      "Yes — for kids' parties, the parents are the ones scanning and uploading, so there's no issue with young kids needing accounts. You can also hide uploader names and require approval before anything is visible, which many parents prefer at kids' parties.",
  },
  {
    question: "Can we run the live slideshow on a TV during the party?",
    answer:
      "Yes, that's the signature feature — cast the slideshow to any TV or screen and it updates in real time as guests upload, with a smooth crossfade between photos. It works well for milestone birthdays, backyard parties, and anywhere there's a screen to plug into.",
  },
  {
    question: "What happens once the upload limit is reached on the free plan?",
    answer:
      "Guests see a friendly message asking them to check back after the host upgrades, and you get a prompt on your dashboard. Upgrading takes one click and immediately raises the limit — no guest ever has to redo an upload.",
  },
  {
    question: "Can guests add photos after the party is over?",
    answer:
      "Yes, as long as the event is still active. Many hosts keep the link open for a day or two afterward so guests can add photos they didn't get to during the party itself, especially phone photos taken during cleanup or the after-party.",
  },
  {
    question: "Do we need to buy anything or print a physical QR code?",
    answer:
      "No — you can share the link directly by text or group chat, though most hosts print the included table-card design because guests enjoy scanning something physical during the party rather than digging up a text thread.",
  },
];

export default function Page() {
  return (
    <ArticleShell
      kicker="Birthday party photo collection"
      h1="Every guest's birthday photos, collected without asking twice"
      subhead="Scan, upload, done. A shared photo album and live slideshow for milestone birthdays, kids' parties, and everything in between — no app required."
      faqItems={FAQ}
    >
      <h2>Everyone takes photos at a birthday party. Almost none of them reach the host.</h2>
      <p>
        Between the cake, the games, and the fifteen conversations happening at once, a birthday
        party generates hundreds of photos scattered across dozens of phones — and the host
        usually ends up with only the handful they personally took. GuestSnap fixes that by giving
        every guest a single, obvious place to add whatever they captured, from the candle-blowing
        moment to the inside joke someone caught mid-laugh. It works the same way whether it&apos;s
        a first birthday, a sweet sixteen, or a milestone 50th — anyone who can take a photo can
        contribute to the album.
      </p>

      <h2>Built for a party, not a corporate meeting</h2>
      <p>
        The upload page is designed to be used one-handed, mid-conversation, without pulling
        anyone away from the party. There&apos;s no signup form standing between a guest and
        adding a photo — they scan the code, tap once, and the photo &quot;develops&quot; onto a
        stack on screen with a satisfying little animation, then they&apos;re back to the party.
        For kids&apos; birthdays specifically, it&apos;s the parents doing the scanning and
        uploading, so there&apos;s never a question of a child needing an account or login of
        their own.
      </p>

      <h2>A live slideshow that becomes the entertainment</h2>
      <p>
        Plug the party into a TV and turn on the live slideshow — new photos crossfade onto the
        screen within seconds of being uploaded, so the party itself becomes part of the display.
        Kids especially love checking whether their photo has shown up yet, which naturally
        encourages more uploads throughout the party rather than a single burst at the start. It
        works well running quietly in the background during the cake-cutting or gift-opening, too.
      </p>

      <h2>Control over who sees what</h2>
      <ul>
        <li>Hide uploader names if you'd rather keep the album anonymous.</li>
        <li>Require approval before anything shows up publicly — useful for parties with young kids.</li>
        <li>Choose between a fully shared gallery, guests-only-their-own-uploads, or host-only visibility.</li>
        <li>Every photo is automatically screened, and any guest can report something with one tap.</li>
      </ul>

      <h2>After the party</h2>
      <p>
        Once the candles are out, download every original photo and video as a single ZIP file —
        no digging through individual guests&apos; camera rolls or waiting for people to
        &quot;send it later.&quot; Free events keep the album available for 90 days with a
        reminder before anything is archived; paid events keep everything for a full year. If
        you&apos;re the type to throw more than one party a year, the Pro Pack bundles three
        Standard events at a discount, which tends to appeal to parents who run birthdays for
        multiple kids or families that host every major holiday.
      </p>

      <h2>Pricing</h2>
      <p>
        Free covers a small gathering with up to 20 photos, no card needed. Standard ($49) raises
        that to 500 uploads, unlocks the live slideshow, and adds ZIP download. Premium ($99)
        removes the cap entirely and adds custom brand colors and AI photo culling — useful for
        bigger milestone parties with a lot of guests. It&apos;s a one-time payment per party, not
        a subscription.
      </p>
    </ArticleShell>
  );
}
