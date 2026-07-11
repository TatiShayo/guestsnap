import fs from "fs";
import os from "os";
import path from "path";
import { defineConfig, devices } from "@playwright/test";

/**
 * QA e2e (BUILD_PROMPT agent #8 / PROJECT_STATE punch list step 6):
 * signup -> create event -> guest uploads on a phone viewport -> host sees
 * them -> upgrade via mock checkout -> ZIP download. Runs against `next dev`
 * (not `next start`) specifically so NODE_ENV stays "development" — the
 * memory-mode magic-link dev-link shortcut only appears outside production.
 * Points the memory data/blob store at a throwaway temp dir so e2e runs
 * never touch the real project .data/ (dev sessions, the seeded demo event).
 */
const PORT = 3971; // uncommon port to avoid collisions with other local dev servers
const BASE_URL = `http://localhost:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "guestsnap-e2e-data-"));

export default defineConfig({
  testDir: "./tests/e2e",
  // Generous timeouts: this suite runs against `next dev`, where each route
  // is compiled on first hit (cold-compile can take 10s+ under memory
  // pressure) rather than pre-built like production.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      GUESTSNAP_DATA_DIR: dataDir,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      APP_SECRET: "e2e-test-secret-do-not-use-in-prod",
      NODE_ENV: "development",
    },
  },
});
