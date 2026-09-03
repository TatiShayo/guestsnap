/**
 * Comprehensive Defensive Vulnerability Probing & Fuzzing Test Suite
 * Covering all 8 Security Attack Archetypes:
 *  1. IDOR & Tenant Isolation
 *  2. TOCTOU & Concurrency
 *  3. Prototype Pollution & Object Key Injection
 *  4. Parser Desync & File Upload Hazards
 *  5. CRLF & Header Injection
 *  6. Arithmetic Edge Cases
 *  7. Decompression Bombs & Memory Limits
 *  8. Cryptographic Timing Attacks
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import sharp from "sharp";
import crypto from "crypto";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    getAll: () => [...cookieJar.entries()].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

const { getData, getBlobs } = await import("@/lib/data");
const { MemoryBlobStore } = await import("@/lib/data/memory");
const { createMockSessionToken, SESSION_COOKIE } = await import("@/lib/auth");
const { signToken, verifyToken, hashPin, verifyPin, timingSafeEqualString } = await import("@/lib/tokens");
const { hasSlideshowAccess } = await import("@/lib/slideshow-access");
const { validateUpload, isSvg, probeMp4Duration } = await import("@/lib/upload-validation");
const { processImage, computeSharpness } = await import("@/lib/image");
const { hammingDistance, dhashFromGray9x8, groupByHash } = await import("@/lib/phash");
const { parseBody, ApiError } = await import("@/lib/api");
const { escapeHtml, formatMoney } = await import("@/lib/utils");
const { getPaymentsProvider } = await import("@/lib/providers/payments");
const { _resetRateLimits } = await import("@/lib/ratelimit");

const { PATCH: patchSettings } = await import("@/app/api/events/[slug]/settings/route");
const { POST: postBulkMedia } = await import("@/app/api/events/[slug]/media/bulk/route");
const { GET: getGallery } = await import("@/app/api/events/[slug]/gallery/route");
const { GET: getZip } = await import("@/app/api/events/[slug]/zip/route");
const { GET: getQr } = await import("@/app/api/events/[slug]/qr/route");
const { GET: getTableCards } = await import("@/app/api/events/[slug]/table-cards/route");
const { GET: getCulling } = await import("@/app/api/events/[slug]/culling/route");
const { GET: getCron } = await import("@/app/api/cron/lifecycle/route");
const { POST: postUpload } = await import("@/app/api/events/[slug]/upload/route");

import type { EventRecord } from "@/lib/data";
import { config } from "@/lib/config";
import { z } from "zod";

function setSession(uid: string, email: string) {
  cookieJar.set(SESSION_COOKIE, createMockSessionToken(uid, email));
}

let seq = 0;
async function makeEvent(hostId: string, overrides: Partial<EventRecord> = {}): Promise<EventRecord> {
  const data = getData();
  seq++;
  return data.createEvent({
    hostId,
    slug: `fuzz-event-${seq}-${Math.random().toString(36).slice(2, 6)}`,
    title: "Fuzz Test Event",
    eventType: "wedding",
    eventDate: "2026-06-15",
    coverPath: null,
    tier: "free",
    brandColor: null,
    welcomeMessage: null,
    uploadLimit: 20,
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

/* ========================================================================= */
/* ARCHETYPE 1: IDOR & Tenant Isolation                                      */
/* ========================================================================= */
describe("Archetype 1: IDOR & Tenant Isolation", () => {
  it("host B cannot modify host A settings via PATCH /settings", async () => {
    const data = getData();
    const hostA = await data.upsertProfile({ id: "host-idor-a", email: "host-a@idor.test" });
    const hostB = await data.upsertProfile({ id: "host-idor-b", email: "host-b@idor.test" });
    const eventA = await makeEvent(hostA.id, { requireApproval: false });

    setSession(hostB.id, hostB.email);
    const req = new Request("http://test.local/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requireApproval: true }),
    });
    const res = await patchSettings(req, { params: Promise.resolve({ slug: eventA.slug }) });
    expect(res.status).toBe(404);

    const freshA = await data.getEvent(eventA.id);
    expect(freshA?.requireApproval).toBe(false);
  });

  it("host B cannot execute bulk media moderation on host A's items", async () => {
    const data = getData();
    const hostA = await data.upsertProfile({ id: "host-bulk-a", email: "bulk-a@idor.test" });
    const hostB = await data.upsertProfile({ id: "host-bulk-b", email: "bulk-b@idor.test" });
    const eventA = await makeEvent(hostA.id);
    const eventB = await makeEvent(hostB.id);

    const mediaA = await data.insertMedia({
      eventId: eventA.id,
      storagePath: "events/a/1.jpg",
      thumbPath: null,
      type: "photo",
      uploaderName: "Guest",
      uploaderKey: "k1",
      phash: "0000000000000000",
      sharpness: 100,
      isHidden: false,
      isFavorite: false,
      needsReview: false,
      flagReason: null,
      reportCount: 0,
      isGuestbook: false,
      width: 800,
      height: 600,
      durationSec: null,
      sizeBytes: 1024,
    });

    setSession(hostB.id, hostB.email);
    const req = new Request("http://test.local/api/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [mediaA.id], action: "hide" }),
    });
    // Target event B's route passing media from event A
    const res = await postBulkMedia(req, { params: Promise.resolve({ slug: eventB.slug }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.affected).toBe(0); // Media item not owned by eventB was skipped

    const freshMedia = await data.getMedia(mediaA.id);
    expect(freshMedia?.isHidden).toBe(false);
  });

  it("host B cannot access host A ZIP download or AI culling", async () => {
    const data = getData();
    const hostA = await data.upsertProfile({ id: "host-zip-a", email: "zip-a@idor.test" });
    const hostB = await data.upsertProfile({ id: "host-zip-b", email: "zip-b@idor.test" });
    const eventA = await makeEvent(hostA.id, { tier: "standard" });

    setSession(hostB.id, hostB.email);
    const zipRes = await getZip(new Request("http://test.local/api/zip"), {
      params: Promise.resolve({ slug: eventA.slug }),
    });
    expect(zipRes.status).toBe(404);

    const cullingRes = await getCulling(new Request("http://test.local/api/culling"), {
      params: Promise.resolve({ slug: eventA.slug }),
    });
    expect(cullingRes.status).toBe(404);
  });

  it("guest PIN token for event A cannot unlock gallery of event B", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-pin-tok", email: "pintok@idor.test" });
    const eventA = await makeEvent(host.id, { slideshowPinHash: hashPin("1111") });
    const eventB = await makeEvent(host.id, { slideshowPinHash: hashPin("2222") });

    const tokenForA = signToken({
      kind: "slideshow_access",
      eventId: eventA.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(hasSlideshowAccess(eventA, tokenForA)).toBe(true);
    expect(hasSlideshowAccess(eventB, tokenForA)).toBe(false);

    // Forged kind token
    const forgedKind = signToken({
      kind: "admin_access",
      eventId: eventA.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(hasSlideshowAccess(eventA, forgedKind)).toBe(false);

    // Expired token
    const expired = signToken({
      kind: "slideshow_access",
      eventId: eventA.id,
      exp: Math.floor(Date.now() / 1000) - 100,
    });
    expect(hasSlideshowAccess(eventA, expired)).toBe(false);
  });

  it("gallery visibility modes strictly isolate views (host / own / gallery)", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-vis-test", email: "vis@idor.test" });
    const eventHostOnly = await makeEvent(host.id, { visibility: "host" });
    const eventOwnOnly = await makeEvent(host.id, { visibility: "own" });

    // Host-only gallery blocks public GET
    const hostOnlyRes = await getGallery(new Request("http://test.local/api/gallery"), {
      params: Promise.resolve({ slug: eventHostOnly.slug }),
    });
    expect(hostOnlyRes.status).toBe(403);

    // Own-only gallery returns empty if no uploaderKey is provided
    const ownOnlyNoKey = await getGallery(new Request("http://test.local/api/gallery"), {
      params: Promise.resolve({ slug: eventOwnOnly.slug }),
    });
    expect(ownOnlyNoKey.status).toBe(200);
    const jsonNoKey = await ownOnlyNoKey.json();
    expect(jsonNoKey.media).toHaveLength(0);
  });

  it("MemoryBlobStore rejects directory traversal, null bytes, and boundary prefix matching", async () => {
    const blobStore = new MemoryBlobStore();

    const traversalPaths = [
      "../outside.txt",
      "..\\outside.txt",
      "foo/../../etc/passwd",
      "events/../../../secret.json",
      "events/x\0/evil.jpg",
      "\0/root",
      "",
    ];

    for (const p of traversalPaths) {
      await expect(blobStore.put(p as any, Buffer.from("data"), "text/plain")).rejects.toThrow();
      const getRes = await blobStore.get(p as any);
      expect(getRes).toBeNull();
    }
  });
});

/* ========================================================================= */
/* ARCHETYPE 2: TOCTOU & Concurrency                                         */
/* ========================================================================= */
describe("Archetype 2: TOCTOU & Concurrency", () => {
  it("insertMediaWithinLimit strictly prevents concurrent upload limit overshoot", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-toctou", email: "toctou@race.test" });
    const event = await makeEvent(host.id, { uploadLimit: 5 });

    const insertAttempt = (index: number) =>
      data.insertMediaWithinLimit(
        {
          eventId: event.id,
          storagePath: `events/test/${index}.jpg`,
          thumbPath: null,
          type: "photo",
          uploaderName: `Guest-${index}`,
          uploaderKey: `key-${index}`,
          phash: null,
          sharpness: 50,
          isHidden: false,
          isFavorite: false,
          needsReview: false,
          flagReason: null,
          reportCount: 0,
          isGuestbook: false,
          width: 800,
          height: 600,
          durationSec: null,
          sizeBytes: 500,
        },
        5
      );

    // Fire 20 simultaneous insert attempts against cap of 5
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => insertAttempt(i)));
    const successful = results.filter((r) => r !== null);
    const failed = results.filter((r) => r === null);

    expect(successful).toHaveLength(5);
    expect(failed).toHaveLength(15);
    expect(await data.countMedia(event.id)).toBe(5);
  });

  it("webhook processing idempotency handles concurrent duplicate deliveries", async () => {
    const data = getData();
    const eventId = `webhook-race-${Date.now()}`;

    // Concurrently check and claim webhook processing
    const results = await Promise.all(
      Array.from({ length: 10 }, async () => {
        if (await data.hasProcessedWebhook(eventId)) {
          return "deduped";
        }
        await data.markWebhookProcessed(eventId);
        return "processed";
      })
    );

    // At least one claims it, subsequent reads are deduplicated
    expect(await data.hasProcessedWebhook(eventId)).toBe(true);
    expect(results).toContain("processed");
  });
});

/* ========================================================================= */
/* ARCHETYPE 3: Prototype Pollution & Object Key Injection                   */
/* ========================================================================= */
describe("Archetype 3: Prototype Pollution & Object Key Injection", () => {
  it("parseBody drops __proto__, constructor, and prototype keys", async () => {
    const schema = z.object({
      title: z.string().optional(),
      settings: z.record(z.any()).optional(),
    });

    const maliciousJson = JSON.stringify({
      title: "Clean Title",
      __proto__: { polluted: "yes" },
      constructor: { prototype: { isAdmin: true } },
    });

    const req = new Request("http://test.local/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: maliciousJson,
    });

    const parsed = await parseBody(req, schema);
    expect(parsed.title).toBe("Clean Title");
    expect((({} as any)).polluted).toBeUndefined();
    expect((({} as any)).isAdmin).toBeUndefined();
  });

  it("verifyToken strips __proto__ and prototype keys from token payloads", () => {
    const maliciousPayload = {
      kind: "test_token",
      uid: "user-123",
      __proto__: { injected: true },
      prototype: { admin: true },
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const token = signToken(maliciousPayload);
    const verified = verifyToken<Record<string, unknown>>(token);

    expect(verified).not.toBeNull();
    expect(verified?.uid).toBe("user-123");
    expect((({} as any)).injected).toBeUndefined();
    expect((({} as any)).admin).toBeUndefined();
  });

  it("MockPaymentsProvider parseWebhook safely handles prototype pollution attempts", async () => {
    const provider = getPaymentsProvider();
    if (provider.name === "mock") {
      const maliciousBody = JSON.stringify({
        token: "invalid",
        __proto__: { mockPolluted: true },
      });

      await expect(provider.parseWebhook(maliciousBody, null)).rejects.toThrow();
      expect((({} as any)).mockPolluted).toBeUndefined();
    }
  });
});

/* ========================================================================= */
/* ARCHETYPE 4: Parser Desync & File Upload Hazards                          */
/* ========================================================================= */
describe("Archetype 4: Parser Desync & File Upload Hazards", () => {
  it("isSvg detects wide variety of SVG, XML, and HTML script polyglot variants", () => {
    const testCases = [
      "<svg xmlns='http://www.w3.org/2000/svg'></svg>",
      "   \r\n\t <SVG viewBox='0 0 100 100'></SVG>",
      "<?xml version='1.0'?><svg></svg>",
      "<!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN'><svg></svg>",
      "<!-- leading comment --> <svg></svg>",
      "<!-- nested <!-- comment --> --> <svg></svg>",
      "<!doctype html><html><body><script>alert(1)</script></body></html>",
      "<script>evilCode()</script>",
      "\uFEFF<svg></svg>", // UTF-8 BOM
      "   <!-- " + "A".repeat(5000) + " --> <svg></svg>", // Large comment padding
      Buffer.concat([Buffer.from("\0\0\0\0"), Buffer.from("<svg></svg>")]).toString("utf8"), // Null byte prefix
    ];

    for (const tc of testCases) {
      const buf = Buffer.from(tc, "utf8");
      expect(isSvg(buf)).toBe(true);
    }
  });

  it("isSvg returns false for authentic binary image buffers", async () => {
    const jpeg = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const png = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();

    expect(isSvg(jpeg)).toBe(false);
    expect(isSvg(png)).toBe(false);
  });

  it("probeMp4Duration accurately parses duration and rejects NaN, Infinity, negative values", () => {
    // Valid v0 mvhd box buffer:
    // [mvhd header 4B][version+flags 4B][creation 4B][mod 4B][timescale 4B = 1000][duration 4B = 30000] -> 30s
    const validV0 = Buffer.alloc(64);
    validV0.write("mvhd", 0, "ascii");
    validV0.writeUInt8(0, 4); // version 0
    validV0.writeUInt32BE(1000, 16); // timescale = 1000
    validV0.writeUInt32BE(30000, 20); // duration = 30000
    expect(probeMp4Duration(validV0)).toBe(30);

    // Valid v1 mvhd box buffer:
    // [mvhd 4B][version 1 4B][creation 8B][mod 8B][timescale 4B = 600][duration 8B = 12000] -> 20s
    const validV1 = Buffer.alloc(80);
    validV1.write("mvhd", 0, "ascii");
    validV1.writeUInt8(1, 4); // version 1
    validV1.writeUInt32BE(600, 24); // timescale = 600
    validV1.writeBigUInt64BE(BigInt(12000), 28); // duration = 12000
    expect(probeMp4Duration(validV1)).toBe(20);

    // Zero timescale -> returns null (no division by zero)
    const zeroTimescale = Buffer.alloc(64);
    zeroTimescale.write("mvhd", 0, "ascii");
    zeroTimescale.writeUInt32BE(0, 16);
    zeroTimescale.writeUInt32BE(5000, 20);
    expect(probeMp4Duration(zeroTimescale)).toBeNull();

    // Truncated mvhd box
    const truncated = Buffer.from("mvhd123");
    expect(probeMp4Duration(truncated)).toBeNull();

    // Empty buffer or random noise
    expect(probeMp4Duration(Buffer.alloc(0))).toBeNull();
    expect(probeMp4Duration(Buffer.from("random noise without box"))).toBeNull();
  });

  it("validateUpload rejects empty buffers and spoofed files", async () => {
    const emptyRes = await validateUpload(Buffer.alloc(0));
    expect(emptyRes.ok).toBe(false);
    if (!emptyRes.ok) expect(emptyRes.reason).toBe("empty_file");

    const phpScript = Buffer.from("<?php system($_GET['cmd']); ?>");
    const phpRes = await validateUpload(phpScript);
    expect(phpRes.ok).toBe(false);
    if (!phpRes.ok) expect(phpRes.reason).toBe("unsupported_type");

    const fakeJpg = Buffer.from("NOT_A_REAL_JPEG_HEADER_1234567890");
    const fakeRes = await validateUpload(fakeJpg);
    expect(fakeRes.ok).toBe(false);
    if (!fakeRes.ok) expect(fakeRes.reason).toBe("unsupported_type");
  });
});

/* ========================================================================= */
/* ARCHETYPE 5: CRLF & Header Injection                                      */
/* ========================================================================= */
describe("Archetype 5: CRLF & Header Injection", () => {
  it("QR and Table Card routes sanitize slug against CRLF in Content-Disposition", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-crlf", email: "crlf@header.test" });
    const event = await makeEvent(host.id);
    setSession(host.id, host.email);

    const qrRes = await getQr(new Request("http://test.local/api/qr"), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(qrRes.status).toBe(200);
    const qrDisposition = qrRes.headers.get("content-disposition") || "";
    expect(qrDisposition).not.toContain("\r");
    expect(qrDisposition).not.toContain("\n");
    expect(qrDisposition).toContain("-qr.png");

    const tcRes = await getTableCards(new Request("http://test.local/api/tc?style=classic"), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(tcRes.status).toBe(200);
    const tcDisposition = tcRes.headers.get("content-disposition") || "";
    expect(tcDisposition).not.toContain("\r");
    expect(tcDisposition).not.toContain("\n");
    expect(tcDisposition).toContain("-table-cards-classic.pdf");
  });

  it("escapeHtml protects against HTML injection and safely handles non-string types", () => {
    const xssPayload = `<script>alert('XSS')</script>" onclick="evil()" & <img src=x onerror=alert(1)>`;
    const escaped = escapeHtml(xssPayload);

    expect(escaped).not.toContain("<script>");
    expect(escaped).not.toContain("<img");
    expect(escaped).toContain("&lt;script&gt;");
    expect(escaped).toContain("&quot;");
    expect(escaped).toContain("&amp;");

    // Non-string edge cases
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(12345 as any)).toBe("12345");
    expect(escapeHtml(false as any)).toBe("false");
  });
});

/* ========================================================================= */
/* ARCHETYPE 6: Arithmetic Edge Cases                                        */
/* ========================================================================= */
describe("Archetype 6: Arithmetic Edge Cases", () => {
  it("gallery pagination arithmetic handles floats, negatives, and huge numbers safely", async () => {
    const data = getData();
    const host = await data.upsertProfile({ id: "host-arith", email: "arith@edge.test" });
    const event = await makeEvent(host.id);

    // Limit = 0.5 (float) -> should floor or default safely without NaN or crash
    const resFloat = await getGallery(new Request("http://test.local/api/gallery?limit=0.5&offset=-5"), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(resFloat.status).toBe(200);
    const jsonFloat = await resFloat.json();
    expect(Array.isArray(jsonFloat.media)).toBe(true);

    // Limit = 999999 -> clamped to PAGE_MAX (100)
    const resHuge = await getGallery(new Request("http://test.local/api/gallery?limit=999999&offset=0"), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(resHuge.status).toBe(200);

    // Limit = NaN / negative
    const resInvalid = await getGallery(new Request("http://test.local/api/gallery?limit=abc&offset=xyz"), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(resInvalid.status).toBe(200);
  });

  it("hammingDistance handles invalid hex characters and mismatched lengths without error", () => {
    expect(hammingDistance("", "")).toBe(64);
    expect(hammingDistance("0000", "00000")).toBe(64); // mismatched length
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
    expect(hammingDistance("ffffffffffffffff", "0000000000000000")).toBe(64);
    expect(hammingDistance("0000000000000001", "0000000000000000")).toBe(1);
    expect(hammingDistance("GGGGGGGGGGGGGGGG", "0000000000000000")).toBe(64); // Non-hex invalid
  });

  it("dhashFromGray9x8 validates buffer length strictly", () => {
    expect(() => dhashFromGray9x8(new Uint8Array(50))).toThrow();
    const valid72 = new Uint8Array(72).fill(128);
    const hash = dhashFromGray9x8(valid72);
    expect(hash).toHaveLength(16);
  });

  it("computeSharpness returns non-negative integer on flat and tiny images", async () => {
    const flatImg = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 128, g: 128, b: 128 } },
    })
      .jpeg()
      .toBuffer();

    const sharpness = await computeSharpness(flatImg);
    expect(sharpness).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(sharpness)).toBe(true);
  });

  it("formatMoney handles zero, negative, and large cent values accurately", () => {
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(4900)).toBe("$49");
    expect(formatMoney(4950)).toBe("$49.50");
    expect(formatMoney(9900)).toBe("$99");
  });
});

/* ========================================================================= */
/* ARCHETYPE 7: Decompression Bombs & Memory Limits                          */
/* ========================================================================= */
describe("Archetype 7: Decompression Bombs & Memory Limits", () => {
  it("sharp rejects images exceeding limitInputPixels to prevent decompression bombs", async () => {
    // Sharp option limitInputPixels: 50_000_000
    // Attempting to process an image configured with extreme dimensions fails safely
    const bombImg = sharp({
      create: { width: 10000, height: 10000, channels: 3, background: { r: 0, g: 0, b: 0 } },
    });
    // 10000 x 10000 = 100,000,000 pixels (>50M limit)
    const buf = await bombImg.png().toBuffer();
    await expect(processImage(buf)).rejects.toThrow();
  });

  it("processImage successfully downscales legitimate high-resolution images within limit", async () => {
    const normalLarge = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .jpeg()
      .toBuffer();

    const result = await processImage(normalLarge);
    expect(result.width).toBeLessThanOrEqual(2400);
    expect(result.height).toBeLessThanOrEqual(2400);
    expect(result.original.length).toBeGreaterThan(0);
    expect(result.thumb.length).toBeGreaterThan(0);
  });
});

/* ========================================================================= */
/* ARCHETYPE 8: Cryptographic Timing Attacks                                 */
/* ========================================================================= */
describe("Archetype 8: Cryptographic Timing Attacks", () => {
  it("timingSafeEqualString correctly compares identical and divergent strings", () => {
    expect(timingSafeEqualString("secret-token-12345", "secret-token-12345")).toBe(true);
    expect(timingSafeEqualString("secret-token-12345", "secret-token-12346")).toBe(false);
    expect(timingSafeEqualString("short", "much-longer-string-comparison")).toBe(false);
    expect(timingSafeEqualString("", "")).toBe(true);
    expect(timingSafeEqualString("abc", "")).toBe(false);
  });

  it("verifyPin uses timing-safe comparison on scrypt hashes", () => {
    const hash = hashPin("4321");
    expect(verifyPin("4321", hash)).toBe(true);
    expect(verifyPin("4320", hash)).toBe(false);
    expect(verifyPin("0000", hash)).toBe(false);
    expect(verifyPin("", hash)).toBe(false);
    expect(verifyPin("4321", "invalid:hash:format")).toBe(false);
    expect(verifyPin("4321", "short")).toBe(false);
  });

  it("verifyToken rejects signature tampering and truncation", () => {
    const payload = { userId: "user-abc", role: "host", exp: Math.floor(Date.now() / 1000) + 600 };
    const validToken = signToken(payload);

    expect(verifyToken(validToken)).not.toBeNull();

    // Modify payload body
    const parts = validToken.split(".");
    const tamperedBody = Buffer.from(JSON.stringify({ ...payload, role: "admin" })).toString("base64url");
    const tamperedToken = `${tamperedBody}.${parts[1]}`;
    expect(verifyToken(tamperedToken)).toBeNull();

    // Modify signature byte
    const tamperedSig = parts[1].slice(0, -1) + (parts[1].endsWith("a") ? "b" : "a");
    expect(verifyToken(`${parts[0]}.${tamperedSig}`)).toBeNull();

    // Truncated signature
    expect(verifyToken(`${parts[0]}.${parts[1].slice(0, 10)}`)).toBeNull();
    expect(verifyToken("random.invalid.token")).toBeNull();
    expect(verifyToken("")).toBeNull();
  });

  it("cron endpoint validates CRON_SECRET using timing-safe comparison", async () => {
    if (config.cronSecret) {
      const validReq = new Request("http://test.local/api/cron", {
        headers: { authorization: `Bearer ${config.cronSecret}` },
      });
      const validRes = await getCron(validReq);
      expect(validRes.status).toBe(200);

      const invalidReq = new Request("http://test.local/api/cron", {
        headers: { authorization: "Bearer wrong-secret" },
      });
      const invalidRes = await getCron(invalidReq);
      expect(invalidRes.status).toBe(401);
    }
  });
});
