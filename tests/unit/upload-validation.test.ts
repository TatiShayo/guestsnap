import { describe, expect, it } from "vitest";
import {
  validateUpload,
  probeMp4Duration,
  isSvg,
  REJECTION_MESSAGES,
} from "@/lib/upload-validation";
import { PHOTO_MAX_BYTES } from "@/lib/tiers";

describe("Upload validation - MIME and Magic Bytes", () => {
  // 1x1 8-bit PNG
  const PNG_FIXTURE = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  );
  // 1x1 JPEG
  const JPEG_FIXTURE = Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64"
  );
  // 1x1 WebP
  const WEBP_FIXTURE = Buffer.from(
    "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
    "base64"
  );
  // 1x1 GIF
  const GIF_FIXTURE = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

  it("rejects zero-length empty files", async () => {
    const res = await validateUpload(Buffer.alloc(0));
    expect(res).toEqual({ ok: false, reason: "empty_file" });
  });

  it("accepts valid PNG image", async () => {
    const res = await validateUpload(PNG_FIXTURE);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.kind).toBe("photo");
      expect(res.value.mime).toBe("image/png");
      expect(res.value.durationSec).toBeNull();
    }
  });

  it("accepts valid JPEG image", async () => {
    const res = await validateUpload(JPEG_FIXTURE);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.kind).toBe("photo");
      expect(res.value.mime).toBe("image/jpeg");
    }
  });

  it("accepts valid WebP image", async () => {
    const res = await validateUpload(WEBP_FIXTURE);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.kind).toBe("photo");
      expect(res.value.mime).toBe("image/webp");
    }
  });

  it("accepts valid GIF image", async () => {
    const res = await validateUpload(GIF_FIXTURE);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.kind).toBe("photo");
      expect(res.value.mime).toBe("image/gif");
    }
  });

  it("rejects non-media binary files (e.g. PDF, executable, plain text)", async () => {
    const pdf = Buffer.from("%PDF-1.4 header and contents");
    const resPdf = await validateUpload(pdf);
    expect(resPdf.ok).toBe(false);
    if (!resPdf.ok) expect(resPdf.reason).toBe("unsupported_type");

    const text = Buffer.from("Hello world, this is a plain text document.");
    const resText = await validateUpload(text);
    expect(resText.ok).toBe(false);
  });
});

describe("Upload validation - SVG detection vectors", () => {
  it("rejects raw <svg> tag", async () => {
    const svg = Buffer.from(`<svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>`);
    const res = await validateUpload(svg);
    expect(res).toEqual({ ok: false, reason: "svg_rejected" });
  });

  it("rejects SVG with <?xml ... ?> prolog", async () => {
    const xmlSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"></svg>`);
    const res = await validateUpload(xmlSvg);
    expect(res).toEqual({ ok: false, reason: "svg_rejected" });
  });

  it("rejects SVG with preceding XML comments", async () => {
    const commented = Buffer.from(`<!-- Malicious disguised SVG --><svg xmlns="http://www.w3.org/2000/svg"></svg>`);
    const res = await validateUpload(commented);
    expect(res).toEqual({ ok: false, reason: "svg_rejected" });
  });

  it("rejects SVG with DOCTYPE declaration", async () => {
    const docType = Buffer.from(`<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg></svg>`);
    const res = await validateUpload(docType);
    expect(res).toEqual({ ok: false, reason: "svg_rejected" });
  });

  it("rejects SVG with UTF-8 BOM and leading whitespace", async () => {
    const bomSvg = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`   \n\t<svg viewBox="0 0 10 10"></svg>`)]);
    const res = await validateUpload(bomSvg);
    expect(res).toEqual({ ok: false, reason: "svg_rejected" });
  });

  it("isSvg helper returns false on empty buffer", () => {
    expect(isSvg(Buffer.alloc(0))).toBe(false);
  });
});

describe("Upload validation - Size and Duration Limits", () => {
  it("rejects photo exceeding 25MB cap", async () => {
    // Fake buffer that starts with PNG magic bytes but is PHOTO_MAX_BYTES + 1
    const largePng = Buffer.alloc(PHOTO_MAX_BYTES + 1);
    // Write PNG header
    largePng.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const res = await validateUpload(largePng);
    expect(res).toEqual({ ok: false, reason: "photo_too_large" });
  });

  it("has rejection message defined for all rejection reasons", () => {
    const reasons = [
      "empty_file",
      "unsupported_type",
      "svg_rejected",
      "photo_too_large",
      "video_too_large",
      "video_too_long",
    ] as const;
    for (const r of reasons) {
      expect(REJECTION_MESSAGES[r]).toBeDefined();
      expect(typeof REJECTION_MESSAGES[r]).toBe("string");
      expect(REJECTION_MESSAGES[r].length).toBeGreaterThan(5);
    }
  });
});

describe("MP4 mvhd duration probing", () => {
  it("parses mvhd version 0 duration correctly", () => {
    const buf = Buffer.alloc(48);
    buf.write("mvhd", 0);
    buf.writeUInt8(0, 4); // version 0
    buf.writeUInt32BE(1000, 16); // timescale: 1000 units/sec
    buf.writeUInt32BE(30000, 20); // duration: 30000 units -> 30 sec
    expect(probeMp4Duration(buf)).toBe(30);
  });

  it("parses mvhd version 1 (64-bit duration) correctly", () => {
    const buf = Buffer.alloc(64);
    buf.write("mvhd", 0);
    buf.writeUInt8(1, 4); // version 1
    buf.writeUInt32BE(1000, 24); // timescale at offset 24
    buf.writeBigUInt64BE(BigInt(40000), 28); // 64-bit duration at offset 28 -> 40 sec
    expect(probeMp4Duration(buf)).toBe(40);
  });

  it("returns null when mvhd box is not present", () => {
    const buf = Buffer.alloc(64);
    buf.write("ftyp", 0);
    expect(probeMp4Duration(buf)).toBeNull();
  });

  it("returns null for truncated buffer safely without throwing RangeError", () => {
    const buf = Buffer.alloc(10);
    buf.write("mvhd", 0);
    buf.writeUInt8(1, 4); // claims version 1 but length is only 10 bytes
    expect(probeMp4Duration(buf)).toBeNull();
  });

  it("returns null if timescale is 0 to prevent divide-by-zero NaN", () => {
    const buf = Buffer.alloc(48);
    buf.write("mvhd", 0);
    buf.writeUInt8(0, 4);
    buf.writeUInt32BE(0, 16); // timescale = 0
    buf.writeUInt32BE(1000, 20);
    expect(probeMp4Duration(buf)).toBeNull();
  });
});
