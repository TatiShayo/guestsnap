import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { processImage, computeSharpness, maybeConvertHeic, svgToJpeg, SHARP_OPTIONS } from "@/lib/image";

describe("Image processing pipeline - Sanitization, EXIF Stripping, and Thumbnails", () => {
  it("processes a raw image to a sanitized JPEG without metadata", async () => {
    const rawImage = await sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: 150, g: 75, b: 220 } },
    })
      .png()
      .toBuffer();

    const processed = await processImage(rawImage);
    expect(processed.width).toBe(300);
    expect(processed.height).toBe(200);
    expect(processed.original).toBeInstanceOf(Buffer);
    expect(processed.thumb).toBeInstanceOf(Buffer);
    expect(processed.phash).toMatch(/^[0-9a-f]{16}$/);
    expect(typeof processed.sharpness).toBe("number");

    // Verify thumbnail is WebP with max 600px width
    const thumbMeta = await sharp(processed.thumb).metadata();
    expect(thumbMeta.format).toBe("webp");
    expect(thumbMeta.width).toBeLessThanOrEqual(600);

    // Verify original is re-encoded JPEG with no EXIF
    const origMeta = await sharp(processed.original).metadata();
    expect(origMeta.format).toBe("jpeg");
    expect(origMeta.exif).toBeUndefined();
  });

  it("downscales oversized images to max dimension (2400px)", async () => {
    const hugeImage = await sharp({
      create: { width: 3000, height: 1500, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .jpeg()
      .toBuffer();

    const processed = await processImage(hugeImage);
    expect(processed.width).toBe(2400);
    expect(processed.height).toBe(1200);
  });

  it("computes sharpness variance correctly", async () => {
    // Solid color image has zero/minimal edge variance
    const flatImage = await sharp({
      create: { width: 256, height: 256, channels: 3, background: { r: 128, g: 128, b: 128 } },
    })
      .jpeg()
      .toBuffer();

    const flatSharpness = await computeSharpness(flatImage);
    expect(flatSharpness).toBe(0);

    // Image with high-frequency noise / contrast has higher Laplacian variance
    const noisySvg = `
      <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
        <rect width="128" height="256" fill="#000000" />
        <rect x="128" width="128" height="256" fill="#ffffff" />
        <circle cx="128" cy="128" r="64" fill="#ff0000" />
      </svg>
    `;
    const highContrastImage = await sharp(Buffer.from(noisySvg)).jpeg().toBuffer();
    const contrastSharpness = await computeSharpness(highContrastImage);
    expect(contrastSharpness).toBeGreaterThan(100);
  });

  it("rasterizes SVG to clean JPEG via svgToJpeg", async () => {
    const svg = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="200" fill="#c1502e"/><text x="20" y="50" fill="#ffffff" font-size="20">GuestSnap</text></svg>`;
    const jpeg = await svgToJpeg(svg, 800);
    const meta = await sharp(jpeg).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(800);
  });

  it("maybeConvertHeic passes through non-HEIC buffers unmodified", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const out = await maybeConvertHeic(png, "image/png");
    expect(out).toBe(png);
  });

  it("limits pixel input to prevent decompression bombs", () => {
    expect(SHARP_OPTIONS.limitInputPixels).toBeLessThanOrEqual(50_000_000);
    expect(SHARP_OPTIONS.failOn).toBe("error");
  });
});
