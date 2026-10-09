import { describe, it, expect } from "vitest";
import { maybeConvertHeic } from "@/lib/image";
import { TIERS, tierForCents, canUploadMore } from "@/lib/tiers";

describe("GuestSnap Privacy & Tier Invariants", () => {
  it("detects HEIC magic bytes in raw buffers without throwing", async () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const out = await maybeConvertHeic(fakeJpeg, "image/jpeg");
    expect(out).toBe(fakeJpeg);
  });

  it("enforces immutable tier pricing invariants", () => {
    expect(TIERS.free.priceCents).toBe(0);
    expect(TIERS.standard.priceCents).toBe(4900);
    expect(TIERS.premium.priceCents).toBe(9900);

    expect(tierForCents(0)).toBe("free");
    expect(tierForCents(4900)).toBe("standard");
    expect(tierForCents(9900)).toBe("premium");
  });

  it("strictly enforces photo upload quotas per tier", () => {
    expect(canUploadMore("free", 19)).toBe(true);
    expect(canUploadMore("free", 20)).toBe(false);
    expect(canUploadMore("free", 21)).toBe(false);

    expect(canUploadMore("standard", 499)).toBe(true);
    expect(canUploadMore("standard", 500)).toBe(false);

    expect(canUploadMore("premium", 10_000)).toBe(true);
  });
});
