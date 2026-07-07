/**
 * Server-side image pipeline (sharp):
 * - re-encodes EVERY image to JPEG → neutralizes malformed-file attacks AND
 *   strips all EXIF/GPS metadata (mandatory privacy measure)
 * - applies EXIF orientation before stripping (rotate())
 * - HEIC/HEIF converted via heic-convert first (sharp prebuilts lack HEIF)
 * - produces a 600px WebP thumbnail
 * - computes dHash (perceptual) + a sharpness score for AI culling
 */
import sharp from "sharp";
import { dhashFromGray9x8 } from "@/lib/phash";

export interface ProcessedImage {
  original: Buffer; // re-encoded JPEG, EXIF-free
  thumb: Buffer; // webp
  width: number;
  height: number;
  phash: string;
  sharpness: number;
}

const MAX_DIMENSION = 2400;
const THUMB_WIDTH = 600;

export async function maybeConvertHeic(buffer: Buffer, mime: string): Promise<Buffer> {
  if (mime !== "image/heic" && mime !== "image/heif") return buffer;
  const { default: convert } = await import("heic-convert");
  const out = await convert({
    buffer: new Uint8Array(buffer) as unknown as ArrayBufferLike,
    format: "JPEG",
    quality: 0.9,
  });
  return Buffer.from(out);
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  // rotate() applies EXIF orientation; the jpeg() re-encode then writes a
  // clean file with NO metadata (sharp strips it unless withMetadata is set).
  const base = sharp(input, { failOn: "error", limitInputPixels: 80_000_000 }).rotate();

  const original = await base
    .clone()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const meta = await sharp(original).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const thumb = await sharp(original)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 74 })
    .toBuffer();

  // dHash from 9x8 grayscale
  const gray = await sharp(original)
    .grayscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer();
  const phash = dhashFromGray9x8(new Uint8Array(gray));

  const sharpness = await computeSharpness(original);

  return { original, thumb, width, height, phash, sharpness };
}

/**
 * Sharpness proxy: variance of a 3x3 Laplacian over a 256px grayscale
 * version. Higher = sharper. Used to auto-pick the best shot per
 * duplicate group.
 */
export async function computeSharpness(image: Buffer): Promise<number> {
  const size = 256;
  const { data, info } = await sharp(image)
    .grayscale()
    .resize(size, size, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - w] - data[i + w];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return Math.round(sumSq / n - mean * mean);
}

/** Rasterize an SVG string to JPEG (used by the demo seed script). */
export async function svgToJpeg(svg: string, width = 1600): Promise<Buffer> {
  return sharp(Buffer.from(svg)).resize({ width }).jpeg({ quality: 85 }).toBuffer();
}
