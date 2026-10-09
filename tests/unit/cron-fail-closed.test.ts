import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * SECURITY REGRESSION: the lifecycle cron soft-archives events and HARD-PURGES
 * guest media past the grace window. It used to run unauthenticated whenever
 * CRON_SECRET was unset ("still runs so lifecycle jobs are testable"), which
 * exposed a destructive purge to anyone who found the URL. It must fail closed.
 */
const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

afterEach(() => {
  vi.resetModules();
  if (ORIGINAL_CRON_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

async function loadCronRoute() {
  return (await import("@/app/api/cron/lifecycle/route")).GET;
}

describe("GET /api/cron/lifecycle — fail-closed auth", () => {
  it("refuses to run (404) when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const GET = await loadCronRoute();

    const res = await GET(new Request("http://test.local/api/cron/lifecycle"));
    expect(res.status).toBe(404);
  });

  it("rejects a wrong bearer token with 401 when CRON_SECRET is set", async () => {
    process.env.CRON_SECRET = "unit-test-cron-secret";
    const GET = await loadCronRoute();

    const res = await GET(
      new Request("http://test.local/api/cron/lifecycle", {
        headers: { authorization: "Bearer wrong-secret" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("runs the lifecycle jobs with the correct bearer token", async () => {
    process.env.CRON_SECRET = "unit-test-cron-secret";
    const GET = await loadCronRoute();

    const res = await GET(
      new Request("http://test.local/api/cron/lifecycle", {
        headers: { authorization: "Bearer unit-test-cron-secret" },
      })
    );
    expect(res.status).toBe(200);
  });
});
