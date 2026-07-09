/**
 * Seed the read-only demo event linked from the landing page.
 *
 * Generates painterly sample "photos" as SVGs (no external assets, no network),
 * runs each through the REAL image pipeline (sharp re-encode → EXIF strip,
 * WebP thumbnail, dHash, sharpness), and inserts them as media so a landing
 * visitor sees a fully populated gallery + live slideshow.
 *
 * Idempotent: re-running clears the demo event's media and re-seeds. Works in
 * memory mode (writes .data/) and, if Supabase env is set, against Supabase.
 *
 * Run: `npm run seed:demo`
 */
import crypto from "crypto";
import { getBlobs, getData } from "@/lib/data";
import { processImage, svgToJpeg } from "@/lib/image";
import { TIERS } from "@/lib/tiers";
import { DEMO_HOST_EMAIL, DEMO_HOST_ID, DEMO_SLUG } from "@/lib/demo";

// Warm, "modern heirloom" palette — no purple/blue.
const PALETTES = [
  ["#C1502E", "#E8B4A0", "#FAF8F5"], // terracotta
  ["#7C8471", "#C9D1BE", "#FAF8F5"], // sage
  ["#B08968", "#E6D5C3", "#FDFCFA"], // sand
  ["#8A5A44", "#D8B79B", "#FBF6EF"], // amber clay
  ["#5A6650", "#B7C4A8", "#F7F5EF"], // olive
];

const UPLOADERS = [
  "Aunt Rosa", "The Bennetts", "Sam", "Priya", "Grandpa Joe",
  "Maya & Leo", "Uncle Ray", "Chloe", "The best man", "Nina",
];

const CAPTIONS = [
  "First dance", "Golden hour", "The toast", "Confetti",
  "Table nine", "Just married", "Cutting the cake", "Sparklers",
  "The vows", "Bouquet toss", "On the dancefloor", "Family",
];

/** A soft, layered gradient "scene" — reads like a warm out-of-focus photo. */
function scene(i: number, variant = 0): string {
  const [a, b, c] = PALETTES[(i + variant) % PALETTES.length];
  const cx = 20 + ((i * 37 + variant * 11) % 60);
  const cy = 25 + ((i * 53) % 50);
  const r = 55 + ((i * 17) % 25);
  const glow = 30 + ((i * 13 + variant * 5) % 40);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067" viewBox="0 0 1600 1067">
    <defs>
      <radialGradient id="g" cx="${cx}%" cy="${cy}%" r="${r}%">
        <stop offset="0%" stop-color="${c}"/>
        <stop offset="55%" stop-color="${b}"/>
        <stop offset="100%" stop-color="${a}"/>
      </radialGradient>
      <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.18"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="1067" fill="url(#g)"/>
    <circle cx="${cx * 16}" cy="${cy * 10}" r="${glow * 3}" fill="#fff" opacity="0.12"/>
    <circle cx="${1600 - cx * 12}" cy="${cy * 8}" r="${glow * 2}" fill="#fff" opacity="0.08"/>
    <rect width="1600" height="1067" fill="url(#v)"/>
  </svg>`;
}

async function main() {
  const data = getData();
  const blobs = getBlobs();

  // 1) Demo host profile (stable id so re-seeds are idempotent).
  await data.upsertProfile({ id: DEMO_HOST_ID, email: DEMO_HOST_EMAIL, name: "GuestSnap Demo" });

  // 2) Demo event — Premium so slideshow/culling/guestbook are all visible.
  const premium = TIERS.premium;
  let event = await data.getEventBySlug(DEMO_SLUG);
  if (!event) {
    event = await data.createEvent({
      hostId: DEMO_HOST_ID,
      slug: DEMO_SLUG,
      title: "Emma & Jake",
      eventType: "wedding",
      eventDate: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      coverPath: null,
      tier: "premium",
      brandColor: "#C1502E",
      welcomeMessage: "Welcome! Share your photos from our day — we'd love to see it through your eyes.",
      uploadLimit: premium.uploadLimit,
      isActive: true,
      requireApproval: false,
      visibility: "gallery",
      slideshowPinHash: null,
      hideUploaderNames: false,
      retentionMonths: premium.retentionMonths,
      isDemo: true,
      archivedAt: null,
      purgedAt: null,
    });
    console.log(`Created demo event ${DEMO_SLUG}`);
  } else {
    // Clear prior demo media for a clean re-seed.
    const existing = await data.listMedia(event.id, { includeHidden: true });
    for (const m of existing) {
      await blobs.delete(m.storagePath).catch(() => {});
      if (m.thumbPath) await blobs.delete(m.thumbPath).catch(() => {});
      await data.deleteMedia(m.id);
    }
    console.log(`Re-seeding demo event ${DEMO_SLUG} (${existing.length} old items cleared)`);
  }

  // 3) Cover image.
  const cover = await svgToJpeg(scene(99), 1600);
  const coverPath = `events/${DEMO_SLUG}/cover.jpg`;
  await blobs.put(coverPath, cover, "image/jpeg");
  await data.updateEvent(event.id, { coverPath });

  // 4) Photos — 12 scenes, plus one near-duplicate of #2 to exercise culling.
  const plan: { i: number; variant: number; dup?: boolean }[] = [];
  for (let i = 0; i < 12; i++) plan.push({ i, variant: 0 });
  plan.splice(3, 0, { i: 2, variant: 0, dup: true }); // near-dup right after the original

  let seq = 0;
  for (const p of plan) {
    const svg = scene(p.i, p.dup ? 0 : p.variant);
    const jpeg = await svgToJpeg(svg, 1600);
    const processed = await processImage(jpeg);
    const base = `events/${DEMO_SLUG}/media/${crypto.randomUUID()}`;
    const storagePath = `${base}.jpg`;
    const thumbPath = `${base}.webp`;
    await blobs.put(storagePath, processed.original, "image/jpeg");
    await blobs.put(thumbPath, processed.thumb, "image/webp");

    await data.insertMedia({
      eventId: event.id,
      storagePath,
      thumbPath,
      type: "photo",
      uploaderName: UPLOADERS[seq % UPLOADERS.length],
      uploaderKey: `demo-guest-${seq % UPLOADERS.length}`,
      phash: processed.phash,
      sharpness: processed.sharpness,
      isHidden: false,
      isFavorite: seq === 5 || seq === 9,
      needsReview: false,
      flagReason: null,
      reportCount: 0,
      isGuestbook: false,
      width: processed.width,
      height: processed.height,
      durationSec: null,
      sizeBytes: processed.original.length,
    });
    seq++;
  }

  // 5) A couple of album subscribers so the growth loop shows real usage.
  await data.addSubscriber(event.id, "guest1@example.com").catch(() => {});
  await data.addSubscriber(event.id, "guest2@example.com").catch(() => {});

  const total = (await data.listMedia(event.id, { includeHidden: true })).length;
  console.log(`Seeded ${total} demo photos.`);
  console.log(`Visit /e/${DEMO_SLUG} (guest), /e/${DEMO_SLUG}/live (slideshow).`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("seed failed:", e);
    process.exit(1);
  }
);
