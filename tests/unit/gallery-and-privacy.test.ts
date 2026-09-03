import { describe, expect, it } from "vitest";
import { getData } from "@/lib/data";
import { hashPin, signToken } from "@/lib/tokens";
import { toMediaViews } from "@/lib/media";
import { hasSlideshowAccess } from "@/lib/slideshow-access";
import { GET as galleryGet } from "@/app/api/events/[slug]/gallery/route";
import type { EventRecord } from "@/lib/data";

let seq = 0;
async function createTestEvent(overrides: Partial<EventRecord> = {}): Promise<EventRecord> {
  seq++;
  const data = getData();
  return data.createEvent({
    hostId: `host-${seq}`,
    slug: `gallery-test-${seq}`,
    title: `Gallery Test Event ${seq}`,
    eventType: "wedding",
    eventDate: "2026-06-15",
    coverPath: null,
    tier: "standard",
    brandColor: null,
    welcomeMessage: "Welcome!",
    uploadLimit: 500,
    isActive: true,
    requireApproval: false,
    visibility: "gallery",
    slideshowPinHash: null,
    hideUploaderNames: false,
    retentionMonths: 12,
    isDemo: false,
    archivedAt: null,
    purgedAt: null,
    ...overrides,
  });
}

describe("Gallery Privacy Controls and IDOR Protection", () => {
  it("visibility 'host' blocks all public reads (403 host_only)", async () => {
    const event = await createTestEvent({ visibility: "host" });
    const req = new Request(`http://test.local/api/events/${event.slug}/gallery`);
    const res = await galleryGet(req, { params: Promise.resolve({ slug: event.slug }) });
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("host_only");
  });

  it("visibility 'own' without uploaderKey returns empty media list (no data leak)", async () => {
    const event = await createTestEvent({ visibility: "own" });
    const data = getData();
    // Add media from user A
    await data.insertMedia({
      eventId: event.id,
      storagePath: "events/1/a.jpg",
      thumbPath: null,
      type: "photo",
      uploaderName: "Alice",
      uploaderKey: "device-key-alice",
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
      sizeBytes: 1000,
    });

    // Request without uploaderKey
    const req = new Request(`http://test.local/api/events/${event.slug}/gallery`);
    const res = await galleryGet(req, { params: Promise.resolve({ slug: event.slug }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { media: unknown[] };
    expect(json.media).toHaveLength(0);
  });

  it("visibility 'own' with matching uploaderKey returns only that uploader's media", async () => {
    const event = await createTestEvent({ visibility: "own" });
    const data = getData();
    await data.insertMedia({
      eventId: event.id,
      storagePath: "events/1/alice.jpg",
      thumbPath: null,
      type: "photo",
      uploaderName: "Alice",
      uploaderKey: "device-alice",
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
      sizeBytes: 1000,
    });
    await data.insertMedia({
      eventId: event.id,
      storagePath: "events/1/bob.jpg",
      thumbPath: null,
      type: "photo",
      uploaderName: "Bob",
      uploaderKey: "device-bob",
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
      sizeBytes: 1000,
    });

    const req = new Request(`http://test.local/api/events/${event.slug}/gallery?uploaderKey=device-alice`);
    const res = await galleryGet(req, { params: Promise.resolve({ slug: event.slug }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { media: { uploaderName: string }[] };
    expect(json.media).toHaveLength(1);
    expect(json.media[0].uploaderName).toBe("Alice");
  });

  it("requires PIN token when event has slideshow PIN configured", async () => {
    const event = await createTestEvent({ slideshowPinHash: hashPin("5555") });

    // Request with no token
    const reqNoToken = new Request(`http://test.local/api/events/${event.slug}/gallery`);
    const resNoToken = await galleryGet(reqNoToken, { params: Promise.resolve({ slug: event.slug }) });
    expect(resNoToken.status).toBe(403);

    // Request with invalid token
    const reqBadToken = new Request(`http://test.local/api/events/${event.slug}/gallery?pin_token=invalid.token`);
    const resBadToken = await galleryGet(reqBadToken, { params: Promise.resolve({ slug: event.slug }) });
    expect(resBadToken.status).toBe(403);

    // Request with token scoped to a different event
    const otherEventToken = signToken({ kind: "slideshow_access", eventId: "different-event-id" });
    const reqWrongEvent = new Request(`http://test.local/api/events/${event.slug}/gallery?pin_token=${otherEventToken}`);
    const resWrongEvent = await galleryGet(reqWrongEvent, { params: Promise.resolve({ slug: event.slug }) });
    expect(resWrongEvent.status).toBe(403);

    // Request with valid token for THIS event
    const validToken = signToken({ kind: "slideshow_access", eventId: event.id });
    const reqValid = new Request(`http://test.local/api/events/${event.slug}/gallery?pin_token=${validToken}`);
    const resValid = await galleryGet(reqValid, { params: Promise.resolve({ slug: event.slug }) });
    expect(resValid.status).toBe(200);
  });

  it("hasSlideshowAccess returns true if event has no PIN", () => {
    const eventWithoutPin = { id: "e1", slideshowPinHash: null } as EventRecord;
    expect(hasSlideshowAccess(eventWithoutPin, null)).toBe(true);
  });

  it("toMediaViews respects hideUploaderNames setting", async () => {
    const data = getData();
    const event = await createTestEvent({ hideUploaderNames: true });
    const media = await data.insertMedia({
      eventId: event.id,
      storagePath: "events/1/m1.jpg",
      thumbPath: null,
      type: "photo",
      uploaderName: "Charlie",
      uploaderKey: "k1",
      phash: null,
      sharpness: null,
      isHidden: false,
      isFavorite: false,
      needsReview: false,
      flagReason: null,
      reportCount: 0,
      isGuestbook: false,
      width: 200,
      height: 200,
      durationSec: null,
      sizeBytes: 500,
    });

    const views = await toMediaViews([media], { hideUploader: true });
    expect(views[0].uploaderName).toBeNull();

    const viewsWithNames = await toMediaViews([media], { hideUploader: false });
    expect(viewsWithNames[0].uploaderName).toBe("Charlie");
  });
});
