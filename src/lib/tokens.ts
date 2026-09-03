/**
 * HMAC-signed compact tokens (used for mock sessions, signed blob URLs and
 * mock checkout payloads). Not JWTs — no external claims, server-only secret.
 */
import crypto from "crypto";
import { config } from "@/lib/config";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signToken(payload: Record<string, unknown>): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(crypto.createHmac("sha256", config.appSecret).update(body).digest());
  return `${body}.${sig}`;
}

export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const key = crypto.randomBytes(32);
  const hashA = crypto.createHmac("sha256", key).update(a).digest();
  const hashB = crypto.createHmac("sha256", key).update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", config.appSecret).update(body).digest());
  if (!timingSafeEqualString(sig, expected)) return null;
  try {
    const jsonStr = fromB64url(body).toString("utf8");
    const payload = JSON.parse(jsonStr, (k, v) => {
      if (k === "__proto__" || k === "constructor" || k === "prototype") return undefined;
      return v;
    }) as T & { exp?: number };
    if (payload && typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashPin(pin: string): string {
  // scrypt with per-hash salt; 4-digit PINs are low-entropy so rate limiting
  // at the route (5/min + lockout) is the real defense.
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pin, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  if (!pin || !stored || typeof stored !== "string") return false;
  try {
    const [saltHex, hashHex] = stored.split(":");
    if (!saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const hashBuffer = Buffer.from(hashHex, "hex");
    if (salt.length !== 16 || hashBuffer.length !== 32) return false;
    const hash = crypto.scryptSync(pin, salt, 32);
    return crypto.timingSafeEqual(hash, hashBuffer);
  } catch {
    return false;
  }
}

