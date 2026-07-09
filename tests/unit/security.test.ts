/**
 * Security tests (PLAYBOOK Part 2 + BUILD_PROMPT project threat model):
 *  1. RLS-style deny: host A cannot read/write host B's events/media through
 *     the object-owner-checked API routes (memory data layer stands in for
 *     Supabase RLS in dev/test — same ownership check either way).
 *  2. Rate limit on the public upload route.
 *  3. EXIF/GPS strip on the image pipeline every upload goes through.
 *  4. Slideshow PIN lockout — the 6th attempt within a minute is rejected
 *     regardless of whether the PIN is correct.
 *
 * next/headers is mocked with a controllable cookie jar so route handlers
 * that call requireUser()/getCurrentUser() can be exercised directly,
 * without a running Next.js server.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import sharp from "sharp";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    getAll: () => [...cookieJar.entries()].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
  }),
}));

const { getData } = await import("@/lib/data");
const { createMockSessionToken, SESSION_COOKIE } = await import("@/lib/auth");
const { hashPin } = await import("@/lib/tokens");
const { processImage } = await import("@/lib/image");
const { _resetRateLimits } = await import("@/lib/ratelimit");
const { PATCH, DELETE } = await import("@/app/api/events/[slug]/media/[id]/route");
const { POST: uploadPost } = await import("@/app/api/events/[slug]/upload/route");
const { POST: slideshowAuthPost } = await import("@/app/api/events/[slug]/slideshow-auth/route");
import type { EventRecord } from "@/lib/data";

function setSession(uid: string, email: string) {
  cookieJar.set(SESSION_COOKIE, createMockSessionToken(uid, email));
}

let seq = 0;
async function makeEvent(hostId: string, overrides: Partial<EventRecord> = {}): Promise<EventRecord> {
  const data = getData();
  seq++;
  return data.createEvent({
    hostId,
    slug: `sec-test-event-${seq}`,
    title: "Security test event",
    eventType: "other",
    eventDate: "2026-01-01",
    coverPath: null,
    tier: "free",
    brandColor: null,
    welcomeMessage: null,
    uploadLimit: 1000,
    isActive: true,
    requireApproval: false,
    visibility: "gallery",
    slideshowPinHash: null,
    hideUploaderNames: false,
    retentionMonths: 3,
    isDemo: false,
    archivedAt: null,
    purgedAt: null,
    ...overrides,
  });
}

beforeEach(() => {
  cookieJar.clear();
  _resetRateLimits();
});

describe("RLS-style deny: cross-host isolation via API routes", () => {
  it("host B cannot hide or delete host A's media; host A can", async () => {
    const data = getData();
    const hostA = await data.upsertProfile({ id: "host-a-sec", email: "host-a@sec.test" });
    const hostB = await data.upsertProfile({ id: "host-b-sec", email: "host-b@sec.test" });
    const eventA = await makeEvent(hostA.id);
    const media = await data.insertMedia({
      eventId: eventA.id,
      storagePath: "events/x/a.jpg",
      thumbPath: null,
      type: "photo",
      uploaderName: null,
      uploaderKey: null,
      phash: null,
      sharpness: null,
      isHidden: false,
      isFavorite: false,
      needsReview: false,
      flagReason: null,
      reportCount: 0,
      isGuestbook: false,
      width: 100,
      height: 100,
      durationSec: null,
      sizeBytes: 10,
    });

    // Host B (attacker) tries to hide host A's media through the API route.
    setSession(hostB.id, hostB.email);
    const patchReq = () =>
      new Request("http://test.local/api", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "hide" }),
      });
    const denied = await PATCH(patchReq(), { params: Promise.resolve({ slug: eventA.slug, id: media.id }) });
    expect(denied.status).toBe(404); // object-owner check fails closed, not a 403 leak
    expect((await data.getMedia(media.id))?.isHidden).toBe(false);

    const deniedDelete = await DELETE(new Request("http://test.local/api", { method: "DELETE" }), {
      params: Promise.resolve({ slug: eventA.slug, id: media.id }),
    });
    expect(deniedDelete.status).toBe(404);
    expect(await data.getMedia(media.id)).not.toBeNull();

    // Host A (owner) can perform the same action.
    setSession(hostA.id, hostA.email);
    const allowed = await PATCH(patchReq(), { params: Promise.resolve({ slug: eventA.slug, id: media.id }) });
    expect(allowed.status).toBe(200);
    expect((await data.getMedia(media.id))?.isHidden).toBe(true);
  });

  it("an unauthenticated caller is rejected the same as a mismatched host", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-c-sec", email: "host-c@sec.test" });
    const event = await makeEvent(host.id);
    const media = await data.insertMedia({
      eventId: event.id,
      storagePath: "events/x/b.jpg",
      thumbPath: null,
      type: "photo",
      uploaderName: null,
      uploaderKey: null,
      phash: null,
      sharpness: null,
      isHidden: false,
      isFavorite: false,
      needsReview: false,
      flagReason: null,
      reportCount: 0,
      isGuestbook: false,
      width: 100,
      height: 100,
      durationSec: null,
      sizeBytes: 10,
    });
    // No session cookie set at all.
    const res = await PATCH(
      new Request("http://test.local/api", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "hide" }),
      }),
      { params: Promise.resolve({ slug: event.slug, id: media.id }) }
    );
    expect(res.status).toBe(401);
  });
});

describe("Rate limit on the public upload route", () => {
  it("blocks the 61st upload request from the same IP within the window", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-rl-sec", email: "host-rl@sec.test" });
    const event = await makeEvent(host.id);
    const ip = "203.0.113.42";

    const send = () =>
      uploadPost(
        new Request("http://test.local/api/upload", {
          method: "POST",
          headers: { "x-forwarded-for": ip },
          body: new FormData(), // no file — fine, we only care whether the rate limiter fires
        }),
        { params: Promise.resolve({ slug: event.slug }) }
      );

    for (let i = 0; i < 60; i++) {
      const res = await send();
      expect(res.status).not.toBe(429);
    }
    const blocked = await send();
    expect(blocked.status).toBe(429);
  });
});

describe("EXIF/GPS strip on the image pipeline", () => {
  it("removes EXIF (including GPS) metadata from every re-encoded upload", async () => {
    // sharp's TS types only declare IFD0-IFD3, but libvips accepts an
    // arbitrary EXIF namespace (GPS) at runtime — hence the Record typing.
    const exifData: Record<string, Record<string, string>> = {
      IFD0: { Copyright: "should not survive" },
      GPS: {
        GPSLatitudeRef: "N",
        GPSLatitude: "40/1 26/1 46/1",
        GPSLongitudeRef: "W",
        GPSLongitude: "79/1 58/1 56/1",
      },
    };
    const withGps = await sharp({
      create: { width: 200, height: 150, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .jpeg()
      .withExif(exifData)
      .toBuffer();

    const before = await sharp(withGps).metadata();
    expect(before.exif).toBeDefined(); // sanity: the fixture really has EXIF/GPS

    const processed = await processImage(withGps);
    const after = await sharp(processed.original).metadata();
    expect(after.exif).toBeUndefined();
  });
});

describe("Slideshow PIN lockout", () => {
  it("rejects the 6th attempt within a minute regardless of correctness", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-pin-sec", email: "host-pin@sec.test" });
    const event = await makeEvent(host.id, { slideshowPinHash: hashPin("1234") });
    const ip = "198.51.100.9";

    const attempt = (pin: string) =>
      slideshowAuthPost(
        new Request("http://test.local/api/pin", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": ip },
          body: JSON.stringify({ pin }),
        }),
        { params: Promise.resolve({ slug: event.slug }) }
      );

    for (let i = 0; i < 5; i++) {
      const res = await attempt("0000"); // wrong PIN, within the 5/min allowance
      expect(res.status).toBe(403);
    }
    // 6th attempt in the same minute — locked out even with the CORRECT pin.
    const sixth = await attempt("1234");
    expect(sixth.status).toBe(429);
  });
});
