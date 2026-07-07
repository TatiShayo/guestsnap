/**
 * Perceptual hash (dHash, 64-bit) + hamming distance for near-duplicate
 * grouping. Pure functions — image decoding happens in lib/image.ts.
 */

/** Compute dHash bits from a 9x8 grayscale buffer (72 bytes, row-major). */
export function dhashFromGray9x8(gray: Uint8Array): string {
  if (gray.length !== 72) throw new Error("dhash expects 9x8=72 grayscale bytes");
  let bits = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = gray[row * 9 + col];
      const right = gray[row * 9 + col + 1];
      bits += left > right ? "1" : "0";
    }
  }
  // 64 bits -> 16 hex chars
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

export function hammingDistance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

/** Union-find grouping of ids whose hashes are within `threshold`. */
export function groupByHash(
  items: { id: string; phash: string | null }[],
  threshold = 10
): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  const hashed = items.filter((i) => i.phash);
  for (const i of hashed) parent.set(i.id, i.id);
  for (let i = 0; i < hashed.length; i++) {
    for (let j = i + 1; j < hashed.length; j++) {
      if (hammingDistance(hashed[i].phash!, hashed[j].phash!) <= threshold) {
        union(hashed[i].id, hashed[j].id);
      }
    }
  }
  const groups = new Map<string, string[]>();
  for (const i of hashed) {
    const root = find(i.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i.id);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
