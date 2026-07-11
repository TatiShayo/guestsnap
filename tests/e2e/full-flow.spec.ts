import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { test, expect, devices } from "@playwright/test";

/**
 * End-to-end happy path (PROJECT_STATE punch list step 6 / BUILD_PROMPT
 * Definition of Done): a stranger can sign up, create an event, have a
 * guest upload photos from a phone, see them as host, upgrade (test mode),
 * and download the ZIP.
 *
 * Guest photos are generated on the fly with sharp (small solid-color
 * JPEGs) rather than checked-in fixture binaries.
 */

let photoPaths: string[];

test.beforeAll(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guestsnap-e2e-photos-"));
  photoPaths = [];
  for (let i = 0; i < 2; i++) {
    const buf = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 90 + i * 50, g: 110, b: 150 } },
    })
      .jpeg()
      .toBuffer();
    const p = path.join(dir, `guest-photo-${i}.jpg`);
    fs.writeFileSync(p, buf);
    photoPaths.push(p);
  }
});

test("signup -> create event -> guest upload -> gallery -> upgrade -> ZIP download", async ({ browser, baseURL }) => {
  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();

  // 1. Signup via memory-mode magic link (dev-link shortcut).
  const email = `host-${Date.now()}@e2e.test`;
  await hostPage.goto("/login");
  await hostPage.getByLabel("Email address").fill(email);
  await hostPage.getByRole("button", { name: /send me a sign-in link/i }).click();
  const devLink = hostPage.getByRole("link", { name: /dev mode: open sign-in link/i });
  await expect(devLink).toBeVisible();
  await devLink.click();
  await hostPage.waitForURL(/\/dashboard/);

  // 2. Create an event.
  await hostPage.goto("/events/new");
  await hostPage.getByLabel("Event name").fill("E2E Test Wedding");
  await hostPage.getByRole("button", { name: /^create event$/i }).click();
  await hostPage.waitForURL(/\/dashboard\/[^/]+$/);
  const slug = new URL(hostPage.url()).pathname.split("/").filter(Boolean).pop()!;
  expect(slug.length).toBeGreaterThan(0);

  // 3. Guest uploads 2 photos from an iPhone viewport.
  const guestContext = await browser.newContext({ ...devices["iPhone 13"] });
  const guestPage = await guestContext.newPage();
  await guestPage.goto(`/e/${slug}`);
  const fileInput = guestPage.locator('input[type="file"][accept="image/*"]').first();
  await fileInput.setInputFiles(photoPaths);
  await expect(guestPage.getByText(/2 photos added\./i)).toBeVisible({ timeout: 30_000 });
  await guestContext.close();

  // 4. Host sees them in the gallery.
  await hostPage.goto(`/dashboard/${slug}`);
  await expect(hostPage.getByText(/2 photo or videos/i)).toBeVisible();

  // 5. Upgrade via mock checkout (no Stripe key configured -> mock flow).
  await hostPage.getByRole("button", { name: /choose standard/i }).click();
  await hostPage.waitForURL(/\/mock\/checkout/);
  await hostPage.getByRole("button", { name: /pay \(test mode\)/i }).click();
  await hostPage.waitForURL(/\/dashboard\/[^/]+\/success/);

  // 6. Back on the dashboard, the ZIP download link now exists and responds 200.
  await hostPage.goto(`/dashboard/${slug}`);
  const zipLink = hostPage.getByRole("link", { name: /download all/i });
  await expect(zipLink).toBeVisible();
  const href = await zipLink.getAttribute("href");
  expect(href).toBeTruthy();
  const zipUrl = new URL(href!, baseURL).toString();
  const res = await hostPage.request.get(zipUrl);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("zip");

  await hostContext.close();
});
