/**
 * Bot-protection provider (Cloudflare Turnstile, invisible mode).
 * Mock passes everything when no key is configured — rate limits and
 * server-side validation still apply either way.
 */
import { config } from "@/lib/config";
import { captureError } from "@/lib/monitoring";

export interface CaptchaProvider {
  readonly name: string;
  verify(token: string | null, ip: string): Promise<boolean>;
}

class TurnstileProvider implements CaptchaProvider {
  readonly name = "turnstile";
  async verify(token: string | null, ip: string): Promise<boolean> {
    if (!token) return false;
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: config.turnstile.secretKey, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(10000),
      });
      const json = (await res.json()) as { success: boolean };
      return json.success === true;
    } catch (e) {
      captureError(e, { where: "captcha.turnstile" });
      return false; // fail closed on the public upload path
    }
  }
}

class MockCaptchaProvider implements CaptchaProvider {
  readonly name = "mock";
  async verify(): Promise<boolean> {
    return true;
  }
}

let provider: CaptchaProvider | null = null;
export function getCaptchaProvider(): CaptchaProvider {
  if (!provider) provider = config.turnstile.enabled ? new TurnstileProvider() : new MockCaptchaProvider();
  return provider;
}
