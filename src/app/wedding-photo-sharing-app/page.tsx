import type { Metadata } from "next";
import { ArticleShell } from "@/components/marketing/article-shell";

export const metadata: Metadata = {
  title: "Wedding Photo Sharing App — Every Guest's Photos in One Album",
  description:
    "A wedding photo sharing app your guests actually use: scan a QR code, upload from any phone browser, no app download. Live slideshow, ZIP download, one-time payment.",
  alternates: { canonical: "/wedding-photo-sharing-app" },
};

const FAQ = [
  {
    question: "How is this different from a wedding hashtag on Instagram?",
    answer:
      "A hashtag only captures photos guests choose to post publicly, and you have to hunt them down across accounts. GuestSnap collects everything in one private album automatically, including photos guests would never post — the candid ones, the blurry-but-precious ones, and every angle of the first dance.",
  },
  {
    question: "Will older relatives be able to use it?",
    answer:
      "Yes — that's the whole point. There's no app to download and no account to create. Guests scan the QR code with their phone's normal camera, tap the link that pops up, and a familiar upload screen opens in their browser. If someone can take a photo, they can use GuestSnap.",
  },
  {
    question: "Can we moderate what shows up before it's public?",
    answer:
      "Turn on 'Approve uploads before they appear' and nothing goes live until you or your partner approves it. Every upload is also automatically screened, and guests can report anything with one tap.",
  },
  {
    question: "Do we get the full-resolution photos, not just a slideshow?",
    answer:
      "Yes. Standard and Premium events include a one-click ZIP download of every original photo and video, so you keep full-quality files for printing an album or handing to your photographer later.",
  },
  {
    question: "What about the photos from our actual photographer?",
    answer:
      "GuestSnap is built for guest photos, not to replace your photographer — it fills the gaps your photographer can't be in five places at once for: the getting-ready chaos, table conversations, the after-party. Many couples use both and merge the best of each.",
  },
];

export default function Page() {
  return (
    <ArticleShell
      kicker="Wedding photo sharing app"
      h1="Every guest's wedding photos, collected automatically"
      subhead="Your photographer can't be everywhere at once. GuestSnap puts a shared album in every guest's pocket — no app, no accounts, just a QR code on the table."
      faqItems={FAQ}
    >
      <h2>The best wedding photos aren&apos;t always the photographer&apos;s</h2>
      <p>
        Your photographer captures the moments they can see. But weddings happen in a hundred
        places at once — the cousin cracking everyone up at table nine, the flower girl asleep in
        her chair by 9pm, the getting-ready selfies your bridesmaids take before you&apos;ve even
        put your dress on. Those photos live on your guests&apos; phones, scattered across a dozen
        camera rolls, and most of them will never make it to you unless you ask. GuestSnap is a
        wedding photo sharing app built to solve exactly that: it gives every guest, from your
        maid of honor to your grandfather, one simple place to drop every photo they take, all
        night long.
      </p>

      <h2>No app to download, no account to create</h2>
      <p>
        The single biggest reason guest photo-sharing tools fail is friction. If a guest has to
        download an app, create a password, and remember to open it again the next morning, most
        photos never get shared. GuestSnap removes every one of those steps. A guest scans the QR
        code printed on your table cards or programs with the camera app they already have open,
        lands on a mobile web page in under two seconds, and starts uploading. There&apos;s no
        login, no app store, and nothing to explain twice — which matters when half your guest
        list is over 60 and the other half just wants to get back to the dance floor.
      </p>

      <h2>A live slideshow that becomes part of the reception</h2>
      <p>
        Cast the GuestSnap live slideshow to a TV near the bar or the dance floor and watch it
        fill up in real time. New photos crossfade in with a slow cinematic drift within seconds
        of being uploaded — guests start checking the screen to see if their photo made it up
        there, which turns the upload page into a genuine part of the reception instead of an
        afterthought. It&apos;s designed to look like a $500 rented service, not a slideshow app,
        because it&apos;s going to be on a TV at your actual wedding.
      </p>

      <h2>Everything a couple actually needs, nothing they don&apos;t</h2>
      <ul>
        <li>Printable QR table cards designed like letterpress stationery — guests photograph them for Instagram.</li>
        <li>Photos automatically screened and reportable, so nothing inappropriate lingers unmoderated.</li>
        <li>Choose who sees the gallery: everyone, guests-only-their-own-uploads, or host-only until you publish.</li>
        <li>AI best-shot culling on Premium groups near-duplicate photos and pre-selects the sharpest one.</li>
        <li>One-time payment per wedding — no subscription to remember to cancel afterward.</li>
      </ul>

      <h2>What it costs</h2>
      <p>
        Start free with 20 photos to try the flow with a small gathering or your bridal shower.
        Standard, at $49 for the whole wedding, unlocks 500 uploads, the live TV slideshow, and a
        ZIP download of every original file. Premium, at $99, removes the upload cap entirely and
        adds a 30-second video guestbook, custom brand colors matching your wedding palette, and
        AI culling. Either way, it&apos;s a single payment for the whole event — not a monthly
        subscription you forget you&apos;re paying for.
      </p>
    </ArticleShell>
  );
}
