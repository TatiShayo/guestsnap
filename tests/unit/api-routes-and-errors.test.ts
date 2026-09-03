import { describe, expect, it, beforeEach, vi } from "vitest";
import { z } from "zod";
import { getData } from "@/lib/data";
import { jsonError, ApiError, parseBody, withErrorHandling } from "@/lib/api";
import { PATCH as settingsPatch } from "@/app/api/events/[slug]/settings/route";
import { POST as bulkPost } from "@/app/api/events/[slug]/media/bulk/route";
import { POST as reportPost } from "@/app/api/events/[slug]/report/route";
import { POST as albumPost } from "@/app/api/events/[slug]/album/route";
import { createMockSessionToken, SESSION_COOKIE } from "@/lib/auth";
import type { EventRecord } from "@/lib/data";

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

function setSession(uid: string, email: string) {
  cookieJar.set(SESSION_COOKIE, createMockSessionToken(uid, email));
}

let seq = 0;
async function makeEvent(hostId: string, overrides: Partial<EventRecord> = {}): Promise<EventRecord> {
  seq++;
  const data = getData();
  return data.createEvent({
    hostId,
    slug: `api-test-${seq}-${Date.now()}`,
    title: "API Test Event",
    eventType: "wedding",
    eventDate: "2026-06-01",
    coverPath: null,
    tier: "standard",
    brandColor: null,
    welcomeMessage: null,
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

describe("API Error Handlers and Parsing Helpers", () => {
  it("jsonError returns valid NextResponse with status and error code", async () => {
    const res = jsonError(400, "bad_request", { extraKey: "extraVal" });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; extraKey: string };
    expect(json.error).toBe("bad_request");
    expect(json.extraKey).toBe("extraVal");
  });

  it("parseBody parses valid JSON conforming to Zod schema", async () => {
    const schema = z.object({ name: z.string(), count: z.number() });
    const req = new Request("http://test.local", {
      method: "POST",
      body: JSON.stringify({ name: "GuestSnap", count: 42 }),
    });
    const parsed = await parseBody(req, schema);
    expect(parsed).toEqual({ name: "GuestSnap", count: 42 });
  });

  it("parseBody throws ApiError(400, 'invalid_json') on corrupted JSON", async () => {
    const schema = z.object({ id: z.string() });
    const req = new Request("http://test.local", {
      method: "POST",
      body: "not-json-content{{{",
    });
    await expect(parseBody(req, schema)).rejects.toThrow(ApiError);
  });

  it("parseBody throws ApiError(400, 'invalid_request') on schema violation", async () => {
    const schema = z.object({ email: z.string().email() });
    const req = new Request("http://test.local", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email" }),
    });
    await expect(parseBody(req, schema)).rejects.toThrow(ApiError);
  });

  it("withErrorHandling wraps handlers and maps unhandled errors to 500", async () => {
    const failingHandler = withErrorHandling("test.fail", async () => {
      throw new Error("unexpected explosion");
    });
    const res = await failingHandler();
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("something_went_wrong");
  });
});

describe("Host Settings API Route", () => {
  beforeEach(() => {
    cookieJar.clear();
  });

  it("updates requireApproval, visibility, hideUploaderNames, and sets/clears PIN", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-settings-1", email: "settings@test.com" });
    const event = await makeEvent(host.id);
    setSession(host.id, host.email);

    // 1. Update settings
    const req1 = new Request("http://test.local/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requireApproval: true,
        visibility: "own",
        hideUploaderNames: true,
        slideshowPin: "8888",
      }),
    });
    const res1 = await settingsPatch(req1, { params: Promise.resolve({ slug: event.slug }) });
    expect(res1.status).toBe(200);
    const json1 = (await res1.json()) as { ok: boolean; hasPinSet: boolean };
    expect(json1.ok).toBe(true);
    expect(json1.hasPinSet).toBe(true);

    const updatedEvent = await data.getEvent(event.id);
    expect(updatedEvent?.requireApproval).toBe(true);
    expect(updatedEvent?.visibility).toBe("own");
    expect(updatedEvent?.hideUploaderNames).toBe(true);
    expect(updatedEvent?.slideshowPinHash).not.toBeNull();

    // 2. Clear PIN by sending empty string ""
    const req2 = new Request("http://test.local/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slideshowPin: "" }),
    });
    const res2 = await settingsPatch(req2, { params: Promise.resolve({ slug: event.slug }) });
    expect(res2.status).toBe(200);
    const json2 = (await res2.json()) as { ok: boolean; hasPinSet: boolean };
    expect(json2.hasPinSet).toBe(false);
  });
});

describe("Bulk Media Moderation API Route", () => {
  beforeEach(() => {
    cookieJar.clear();
  });

  it("performs bulk approve, favorite, hide, and delete across multiple media items", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-bulk-mod", email: "bulk@mod.test" });
    const event = await makeEvent(host.id);
    setSession(host.id, host.email);

    const m1 = await data.insertMedia({
      eventId: event.id,
      storagePath: "events/b/1.jpg",
      thumbPath: null,
      type: "photo",
      uploaderName: "User 1",
      uploaderKey: "k1",
      phash: null,
      sharpness: null,
      isHidden: false,
      isFavorite: false,
      needsReview: true,
      flagReason: null,
      reportCount: 0,
      isGuestbook: false,
      width: 10,
      height: 10,
      durationSec: null,
      sizeBytes: 10,
    });
    const m2 = await data.insertMedia({
      eventId: event.id,
      storagePath: "events/b/2.jpg",
      thumbPath: null,
      type: "photo",
      uploaderName: "User 2",
      uploaderKey: "k2",
      phash: null,
      sharpness: null,
      isHidden: false,
      isFavorite: false,
      needsReview: true,
      flagReason: null,
      reportCount: 0,
      isGuestbook: false,
      width: 10,
      height: 10,
      durationSec: null,
      sizeBytes: 10,
    });

    // Bulk approve
    const bulkApproveReq = new Request("http://test.local/api/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [m1.id, m2.id], action: "approve" }),
    });
    const resApprove = await bulkPost(bulkApproveReq, { params: Promise.resolve({ slug: event.slug }) });
    expect(resApprove.status).toBe(200);
    const jsonApprove = (await resApprove.json()) as { ok: boolean; affected: number };
    expect(jsonApprove.affected).toBe(2);

    expect((await data.getMedia(m1.id))?.needsReview).toBe(false);
    expect((await data.getMedia(m2.id))?.needsReview).toBe(false);

    // Bulk favorite
    const bulkFavReq = new Request("http://test.local/api/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [m1.id, m2.id], action: "favorite" }),
    });
    const resFav = await bulkPost(bulkFavReq, { params: Promise.resolve({ slug: event.slug }) });
    expect(resFav.status).toBe(200);
    expect((await data.getMedia(m1.id))?.isFavorite).toBe(true);

    // Bulk delete
    const bulkDelReq = new Request("http://test.local/api/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [m1.id, m2.id], action: "delete" }),
    });
    const resDel = await bulkPost(bulkDelReq, { params: Promise.resolve({ slug: event.slug }) });
    expect(resDel.status).toBe(200);
    expect(await data.getMedia(m1.id)).toBeNull();
    expect(await data.getMedia(m2.id)).toBeNull();
  });
});

describe("Public Report and Album Signup Routes", () => {
  it("increments report count and sets needsReview on public report", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-report", email: "report@host.test" });
    const event = await makeEvent(host.id);
    const media = await data.insertMedia({
      eventId: event.id,
      storagePath: "events/r/1.jpg",
      thumbPath: null,
      type: "photo",
      uploaderName: "Guest",
      uploaderKey: "k",
      phash: null,
      sharpness: null,
      isHidden: false,
      isFavorite: false,
      needsReview: false,
      flagReason: null,
      reportCount: 0,
      isGuestbook: false,
      width: 10,
      height: 10,
      durationSec: null,
      sizeBytes: 10,
    });

    const req = new Request("http://test.local/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaId: media.id }),
    });
    const res = await reportPost(req, { params: Promise.resolve({ slug: event.slug }) });
    expect(res.status).toBe(200);

    const updatedMedia = await data.getMedia(media.id);
    expect(updatedMedia?.reportCount).toBe(1);
    expect(updatedMedia?.needsReview).toBe(true);
  });

  it("subscribes guest email to album on post to /album", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-album-sub", email: "album@host.test" });
    const event = await makeEvent(host.id);

    const req = new Request("http://test.local/api/album", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "guest-album@test.com" }),
    });
    const res = await albumPost(req, { params: Promise.resolve({ slug: event.slug }) });
    expect(res.status).toBe(200);

    const subs = await data.listSubscribers(event.id);
    expect(subs.some((s) => s.email === "guest-album@test.com")).toBe(true);
  });
});
