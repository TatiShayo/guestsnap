import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { generateEventSlug, slugify, randomSuffix } from "@/lib/slug";
import { TableCardPdf, type CardStyle } from "@/lib/pdf/table-card";
import { renderToBuffer } from "@react-pdf/renderer";

describe("Slug and URL Generation", () => {
  it("strips special characters and trims properly", () => {
    expect(slugify("  Sarah & Mike's 50th Birthday Party!! ")).toBe("sarah-and-mike-s-50th-birthday-party");
    expect(slugify("---leading-and-trailing---")).toBe("leading-and-trailing");
  });

  it("handles non-English accents via NFKD normalization", () => {
    expect(slugify("Fête d'été à Paris")).toBe("fete-d-ete-a-paris");
    expect(slugify("München Über")).toBe("munchen-uber");
  });

  it("generates anti-enumeration random suffixes of requested length", () => {
    const s1 = randomSuffix(4);
    const s2 = randomSuffix(4);
    expect(s1).toHaveLength(4);
    expect(s2).toHaveLength(4);
    expect(s1).not.toBe(s2);
  });

  it("generateEventSlug combines normalized title with random suffix", () => {
    const slug = generateEventSlug("Our Wedding");
    expect(slug).toMatch(/^our-wedding-[a-z2-9]{4}$/);
  });
});

describe("QR Code Generation and PDF Table Cards", () => {
  it("generates valid PNG buffer from QR code library", async () => {
    const testUrl = "https://guestsnap.app/e/emma-and-jake-9k2f";
    const png = await QRCode.toBuffer(testUrl, {
      type: "png",
      width: 300,
      margin: 2,
    });
    expect(png).toBeInstanceOf(Buffer);
    expect(png.length).toBeGreaterThan(100);
    // Check PNG signature bytes [137, 80, 78, 71]
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
  });

  it("generates valid base64 data URL for table card embedding", async () => {
    const testUrl = "https://guestsnap.app/e/test-event";
    const dataUrl = await QRCode.toDataURL(testUrl);
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("renders 4-up TableCardPdf for each card style variant without throwing", async () => {
    const styles: CardStyle[] = ["classic", "minimal", "playful"];
    const qrDataUrl = await QRCode.toDataURL("https://guestsnap.app/e/demo");

    for (const style of styles) {
      const element = TableCardPdf({
        eventTitle: "Wedding of Emma & Jake",
        qrDataUrl,
        style,
        welcomeMessage: "Please share your memories with us!",
      });
      const pdfBuffer = await renderToBuffer(element);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(500);
      // Check PDF magic bytes "%PDF-"
      expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    }
  });
});
