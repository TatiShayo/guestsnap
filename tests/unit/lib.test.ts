import { describe, expect, it } from "vitest";
import { generateEventSlug, slugify } from "@/lib/slug";
import { signToken, verifyToken, hashPin, verifyPin } from "@/lib/tokens";
import { dhashFromGray9x8, hammingDistance, groupByHash } from "@/lib/phash";
import { rateLimit, _resetRateLimits } from "@/lib/ratelimit";
import { probeMp4Duration, validateUpload } from "@/lib/upload-validation";
import { SKUS, TIERS } from "@/lib/tiers";

describe("slug", () => {
  it("slugifies with & and accents", () => {
    expect(slugify("Emma & Jake's Wedding")).toBe("emma-and-jake-s-wedding");
    expect(slugify("Café Année")).toBe("cafe-annee");
  });
  it("appends a 4-char anti-enumeration suffix", () => {
    const slug = generateEventSlug("Emma & Jake");
    expect(slug).toMatch(/^emma-and-jake-[a-z2-9]{4}$/);
  });
  it("falls back for empty titles", () => {
    expect(generateEventSlug("!!!")).toMatch(/^event-[a-z2-9]{4}$/);
  });
});

describe("tokens", () => {
  it("round-trips payloads", () => {
    const t = signToken({ uid: "u1", exp: Math.floor(Date.now() / 1000) + 60 });
    expect(verifyToken<{ uid: string }>(t)?.uid).toBe("u1");
  });
  it("rejects tampered tokens", () => {
    const t = signToken({ uid: "u1" });
    expect(verifyToken(t.slice(0, -2) + "xx")).toBeNull();
    expect(verifyToken("not-a-token")).toBeNull();
  });
  it("rejects expired tokens", () => {
    const t = signToken({ uid: "u1", exp: Math.floor(Date.now() / 1000) - 10 });
    expect(verifyToken(t)).toBeNull();
  });
  it("hashes and verifies PINs with per-hash salt", () => {
    const h1 = hashPin("1234");
    const h2 = hashPin("1234");
    expect(h1).not.toBe(h2);
    expect(verifyPin("1234", h1)).toBe(true);
    expect(verifyPin("0000", h1)).toBe(false);
    expect(verifyPin("1234", "garbage")).toBe(false);
  });
});

describe("phash", () => {
  it("computes a 16-hex dHash", () => {
    const gray = new Uint8Array(72).map((_, i) => (i % 9) * 30);
    expect(dhashFromGray9x8(gray)).toMatch(/^[0-9a-f]{16}$/);
  });
  it("hamming distance is 0 for identical, 64 for mismatched length", () => {
    expect(hammingDistance("ff00ff00ff00ff00", "ff00ff00ff00ff00")).toBe(0);
    expect(hammingDistance("ff", "ff00")).toBe(64);
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
  });
  it("groups near-duplicates within threshold", () => {
    const groups = groupByHash(
      [
        { id: "a", phash: "0000000000000000" },
        { id: "b", phash: "0000000000000001" }, // distance 1 from a
        { id: "c", phash: "ffffffffffffffff" },
        { id: "d", phash: null },
      ],
      10
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].sort()).toEqual(["a", "b"]);
  });
});

describe("rateLimit", () => {
  it("blocks after the limit and reports retry-after", () => {
    _resetRateLimits();
    expect(rateLimit("k", 2, 60_000).ok).toBe(true);
    expect(rateLimit("k", 2, 60_000).ok).toBe(true);
    const third = rateLimit("k", 2, 60_000);
    expect(third.ok).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThan(0);
  });
  it("isolates keys", () => {
    _resetRateLimits();
    expect(rateLimit("a", 1, 60_000).ok).toBe(true);
    expect(rateLimit("b", 1, 60_000).ok).toBe(true);
  });
});

describe("upload validation", () => {
  it("rejects empty files", async () => {
    const res = await validateUpload(Buffer.alloc(0));
    expect(res).toEqual({ ok: false, reason: "empty_file" });
  });
  it("rejects SVG (XSS vector)", async () => {
    const res = await validateUpload(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`));
    expect(res).toEqual({ ok: false, reason: "svg_rejected" });
    const res2 = await validateUpload(Buffer.from(`<?xml version="1.0"?><svg></svg>`));
    expect(res2).toEqual({ ok: false, reason: "svg_rejected" });
  });
  it("rejects unknown types", async () => {
    const res = await validateUpload(Buffer.from("plain text, definitely not an image"));
    expect(res.ok).toBe(false);
  });
  it("accepts a real PNG by magic bytes", async () => {
    // 1x1 transparent PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64"
    );
    const res = await validateUpload(png);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.kind).toBe("photo");
  });
  it("probes mvhd duration (version 0)", () => {
    // synthetic mvhd: 4-byte marker + version/flags + 8 bytes + timescale=1000, duration=50000 (50s)
    const buf = Buffer.alloc(40);
    buf.write("mvhd", 0);
    buf.writeUInt8(0, 4); // version 0
    buf.writeUInt32BE(1000, 16); // timescale
    buf.writeUInt32BE(50_000, 20); // duration
    expect(probeMp4Duration(buf)).toBe(50);
  });
});

describe("tiers (server-side pricing source of truth)", () => {
  it("prices match the spec", () => {
    expect(TIERS.free.priceCents).toBe(0);
    expect(TIERS.standard.priceCents).toBe(4900);
    expect(TIERS.premium.priceCents).toBe(9900);
    expect(SKUS.premium_upgrade.amountCents).toBe(5000);
    expect(SKUS.pro_pack.proPackCredits).toBe(3);
  });
  it("free tier is capped and watermarked", () => {
    expect(TIERS.free.uploadLimit).toBe(20);
    expect(TIERS.free.watermark).toBe(true);
    expect(TIERS.premium.uploadLimit).toBe(Number.MAX_SAFE_INTEGER);
  });
});
