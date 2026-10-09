/**
 * Hermetic functional check of the sliding-window rate limiter
 * (src/lib/ratelimit.ts). Exits non-zero on the first failing invariant.
 *
 * Run: npm run test:ratelimit
 */
import { rateLimit, LIMITS, _resetRateLimits } from "../src/lib/ratelimit";

let failures = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main(): Promise<void> {
  console.log("rate-limit-test: sliding-window limiter invariants");

  _resetRateLimits();
  const key = `test:${Math.random().toString(36).slice(2)}`;
  const limit = 5;
  const windowMs = 200;

  // 1. Allows exactly `limit` requests inside the window.
  const results = Array.from({ length: limit + 3 }, () => rateLimit(key, limit, windowMs));
  const allowed = results.filter((r) => r.ok).length;
  check(`allows exactly ${limit} requests in window`, allowed === limit, `allowed=${allowed}`);
  check(
    "blocks beyond the limit",
    results.slice(limit).every((r) => !r.ok && r.remaining === 0)
  );
  check(
    "blocked requests report a retry-after",
    results[limit].retryAfterSec > 0,
    `retryAfterSec=${results[limit].retryAfterSec}`
  );
  check(
    "remaining counts down",
    results[0].remaining === limit - 1 && results[1].remaining === limit - 2,
    `first=${results[0].remaining} second=${results[1].remaining}`
  );

  // 2. Recovers once the window elapses.
  await new Promise((resolve) => setTimeout(resolve, windowMs + 50));
  check("recovers after the window elapses", rateLimit(key, limit, windowMs).ok);

  // 3. Distinct keys are independent.
  _resetRateLimits();
  check(
    "distinct keys are independent",
    rateLimit("independent-a", 1, windowMs).ok && rateLimit("independent-b", 1, windowMs).ok
  );

  // 4. Named presets are configured sanely.
  check(
    "upload presets defined",
    LIMITS.uploadPerIp.limit > 0 && LIMITS.uploadPerEvent.limit > 0 && LIMITS.uploadPerIp.windowMs > 0
  );

  _resetRateLimits();

  if (failures > 0) {
    console.error(`\nrate-limit-test: ${failures} invariant(s) FAILED`);
    process.exit(1);
  }
  console.log("\nrate-limit-test: all invariants passed");
}

main().catch((err) => {
  console.error("rate-limit-test crashed:", err);
  process.exit(1);
});
