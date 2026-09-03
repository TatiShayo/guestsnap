import { describe, expect, it } from "vitest";
import { dhashFromGray9x8, hammingDistance, groupByHash } from "@/lib/phash";

describe("Perceptual Hash (dHash) and Hamming Distance", () => {
  it("generates exact 16-hex character dHash from 72-byte buffer", () => {
    const bytes = new Uint8Array(72);
    // Gradient buffer
    for (let i = 0; i < 72; i++) bytes[i] = i * 3;
    const hash = dhashFromGray9x8(bytes);
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("throws error if input buffer is not exactly 72 bytes (9x8)", () => {
    expect(() => dhashFromGray9x8(new Uint8Array(50))).toThrowError("dhash expects 9x8=72 grayscale bytes");
    expect(() => dhashFromGray9x8(new Uint8Array(100))).toThrowError("dhash expects 9x8=72 grayscale bytes");
  });

  it("calculates exact hamming distance between two hex hashes", () => {
    // Identical
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
    expect(hammingDistance("ffffffffffffffff", "ffffffffffffffff")).toBe(0);

    // 1 bit difference: 0 vs 1 (0000 vs 0001)
    expect(hammingDistance("0000000000000000", "0000000000000001")).toBe(1);

    // 4 bits difference: 0 vs f (0000 vs 1111)
    expect(hammingDistance("0000000000000000", "000000000000000f")).toBe(4);

    // Completely inverted: 64 bits
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);

    // Mismatched lengths return max distance 64 safely
    expect(hammingDistance("00", "0000")).toBe(64);
    expect(hammingDistance("", "1234")).toBe(64);
  });
});

describe("Union-Find Near-Duplicate Grouping (groupByHash)", () => {
  it("groups items within threshold <= 10", () => {
    const items = [
      { id: "photo-1", phash: "0000000000000000" },
      { id: "photo-2", phash: "0000000000000001" }, // dist 1 from photo-1
      { id: "photo-3", phash: "0000000000000003" }, // dist 2 from photo-1
      { id: "photo-distinct", phash: "ffffffffffffffff" }, // dist 64
    ];

    const groups = groupByHash(items, 10);
    expect(groups).toHaveLength(1);
    expect(groups[0].sort()).toEqual(["photo-1", "photo-2", "photo-3"]);
  });

  it("forms multiple distinct duplicate groups", () => {
    const items = [
      // Group A (near 0000...)
      { id: "a1", phash: "0000000000000000" },
      { id: "a2", phash: "0000000000000002" },

      // Group B (near aaaa...)
      { id: "b1", phash: "aaaaaaaaaaaaaaaa" },
      { id: "b2", phash: "aaaaaaaaaaaaaaab" },

      // Standalone photo
      { id: "c1", phash: "5555555555555555" },
    ];

    const groups = groupByHash(items, 10);
    expect(groups).toHaveLength(2);
    const sorted = groups.map((g) => g.sort()).sort((x, y) => x[0].localeCompare(y[0]));
    expect(sorted[0]).toEqual(["a1", "a2"]);
    expect(sorted[1]).toEqual(["b1", "b2"]);
  });

  it("filters out singletons and null hashes", () => {
    const items = [
      { id: "single-1", phash: "1111111111111111" },
      { id: "single-2", phash: "8888888888888888" },
      { id: "no-hash", phash: null },
    ];
    const groups = groupByHash(items, 10);
    expect(groups).toHaveLength(0);
  });
});
