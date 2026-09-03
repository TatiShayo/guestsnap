import { describe, expect, it } from "vitest";
import { signToken, verifyToken, hashPin, verifyPin } from "@/lib/tokens";
import { createMockSessionToken, createMockLoginToken, verifyMockLoginToken, isAdmin } from "@/lib/auth";

describe("Tokens - Signing, Verification, and Tamper Resistance", () => {
  it("signs and verifies complex JSON payloads", () => {
    const payload = {
      uid: "user-123",
      email: "test@example.com",
      roles: ["host", "admin"],
      nested: { a: 1, b: [true, false] },
    };
    const token = signToken(payload);
    expect(typeof token).toBe("string");
    expect(token.includes(".")).toBe(true);

    const verified = verifyToken<typeof payload>(token);
    expect(verified).toEqual(payload);
  });

  it("fails verification on tampered body", () => {
    const token = signToken({ uid: "user-123", role: "guest" });
    const [_body, sig] = token.split(".");
    // Tamper with body
    const tamperedBody = Buffer.from(JSON.stringify({ uid: "user-123", role: "admin" }))
      .toString("base64")
      .replace(/=/g, "");
    const tamperedToken = `${tamperedBody}.${sig}`;
    expect(verifyToken(tamperedToken)).toBeNull();
  });

  it("fails verification on tampered signature", () => {
    const token = signToken({ uid: "user-123" });
    const [_body, sig] = token.split(".");
    const tamperedSig = sig.slice(0, -4) + "AAAA";
    expect(verifyToken(`${_body}.${tamperedSig}`)).toBeNull();
  });

  it("handles malformed, non-token strings gracefully without crashing", () => {
    expect(verifyToken("")).toBeNull();
    // @ts-expect-error test invalid type
    expect(verifyToken(null)).toBeNull();
    // @ts-expect-error test invalid type
    expect(verifyToken(12345)).toBeNull();
    expect(verifyToken("nodothere")).toBeNull();
    expect(verifyToken(".onlysignature")).toBeNull();
    expect(verifyToken("invalidbase64!@#$.invalidsig!@#$")).toBeNull();
  });

  it("enforces expiration timestamp strictly", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const validToken = signToken({ uid: "u1", exp: nowSec + 3600 });
    expect(verifyToken<{ uid: string }>(validToken)?.uid).toBe("u1");

    const expiredToken = signToken({ uid: "u1", exp: nowSec - 1 });
    expect(verifyToken(expiredToken)).toBeNull();
  });
});

describe("PIN Hashing and Verification", () => {
  it("generates unique salt per hash invocation", () => {
    const pin = "4829";
    const h1 = hashPin(pin);
    const h2 = hashPin(pin);
    expect(h1).not.toBe(h2);
    expect(verifyPin(pin, h1)).toBe(true);
    expect(verifyPin(pin, h2)).toBe(true);
  });

  it("rejects incorrect PINs", () => {
    const stored = hashPin("9999");
    expect(verifyPin("0000", stored)).toBe(false);
    expect(verifyPin("9998", stored)).toBe(false);
  });

  it("safely handles malformed stored hash strings without RangeError", () => {
    expect(verifyPin("1234", "")).toBe(false);
    expect(verifyPin("1234", "nosaltorhash")).toBe(false);
    expect(verifyPin("1234", "shortsalt:shorthash")).toBe(false);
    expect(verifyPin("1234", "nothex!@#$:nothex!@#$")).toBe(false);
    // @ts-expect-error invalid param
    expect(verifyPin(null, "some:hash")).toBe(false);
  });
});

describe("Auth Tokens and Admin Checks", () => {
  it("creates valid 30-day mock session tokens", () => {
    const token = createMockSessionToken("user-42", "host@test.com");
    const verified = verifyToken<{ uid: string; email: string; exp: number }>(token);
    expect(verified?.uid).toBe("user-42");
    expect(verified?.email).toBe("host@test.com");
    expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000) + 29 * 86400);
  });

  it("creates and verifies mock login magic tokens", () => {
    const token = createMockLoginToken("Guest@Test.com");
    const email = verifyMockLoginToken(token);
    expect(email).toBe("guest@test.com"); // normalized lowercase

    // Invalid token returns null
    expect(verifyMockLoginToken("tampered-token")).toBeNull();

    // Non-login token is rejected by verifyMockLoginToken
    const sessionToken = createMockSessionToken("u1", "guest@test.com");
    expect(verifyMockLoginToken(sessionToken)).toBeNull();
  });

  it("evaluates isAdmin with case-insensitivity against ADMIN_EMAILS", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin({ id: "1", email: "regular@user.com", name: "Bob" })).toBe(false);
    expect(isAdmin({ id: "2", email: "admin@example.com", name: "Admin" })).toBe(true);
    expect(isAdmin({ id: "3", email: "ADMIN@EXAMPLE.COM", name: "Admin Upper" })).toBe(true);
  });
});
