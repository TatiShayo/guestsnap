import { describe, expect, it, beforeEach } from "vitest";
import { rateLimit, clientIp, LIMITS, _resetRateLimits } from "@/lib/ratelimit";

describe("Sliding Window Rate Limiter", () => {
  beforeEach(() => {
    _resetRateLimits();
  });

  it("permits requests within capacity and tracks remaining tokens", () => {
    const res1 = rateLimit("test-key", 5, 60_000);
    expect(res1.ok).toBe(true);
    expect(res1.remaining).toBe(4);
    expect(res1.retryAfterSec).toBe(0);

    const res2 = rateLimit("test-key", 5, 60_000);
    expect(res2.ok).toBe(true);
    expect(res2.remaining).toBe(3);
  });

  it("blocks requests once limit is reached and provides positive retryAfterSec", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("limited-key", 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit("limited-key", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("isolates different keys independently", () => {
    rateLimit("ip:1.1.1.1", 1, 60_000);
    expect(rateLimit("ip:1.1.1.1", 1, 60_000).ok).toBe(false);
    // Different IP must not be blocked
    expect(rateLimit("ip:2.2.2.2", 1, 60_000).ok).toBe(true);
  });

  it("extracts client IP from x-forwarded-for (first proxy)", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178" },
    });
    expect(clientIp(req)).toBe("203.0.113.195");
  });

  it("extracts client IP from x-real-ip if forwarded is missing", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "198.51.100.22" },
    });
    expect(clientIp(req)).toBe("198.51.100.22");
  });

  it("falls back to 'unknown' when no IP headers are present", () => {
    const req = new Request("http://localhost");
    expect(clientIp(req)).toBe("unknown");
  });

  it("defines standard limit presets", () => {
    expect(LIMITS.uploadPerIp.limit).toBe(60);
    expect(LIMITS.uploadPerEvent.limit).toBe(400);
    expect(LIMITS.authPerIp.limit).toBe(5);
    expect(LIMITS.pinPerIp.limit).toBe(5);
    expect(LIMITS.reportPerIp.limit).toBe(10);
    expect(LIMITS.albumSignupPerIp.limit).toBe(10);
    expect(LIMITS.checkoutPerUser.limit).toBe(10);
  });
});
