/**
 * NSFW / content-safety provider. Sightengine when keys are present;
 * mock otherwise. The mock flags nothing except files whose declared name
 * contains "unsafe-test" — that hook keeps the flag→review pipeline testable.
 */
import { config } from "@/lib/config";
import { captureError } from "@/lib/monitoring";

export interface ModerationResult {
  flagged: boolean;
  reason: string | null;
  score: number; // 0..1
}

export interface ModerationProvider {
  readonly name: string;
  checkImage(image: Buffer, filename: string): Promise<ModerationResult>;
}

class SightengineProvider implements ModerationProvider {
  readonly name = "sightengine";
  async checkImage(image: Buffer, filename: string): Promise<ModerationResult> {
    try {
      const form = new FormData();
      form.append("media", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), filename || "upload.jpg");
      form.append("models", "nudity-2.1,gore-2.0");
      form.append("api_user", config.sightengine.user);
      form.append("api_secret", config.sightengine.secret);
      const res = await fetch("https://api.sightengine.com/1.0/check.json", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`sightengine ${res.status}`);
      const json = (await res.json()) as {
        nudity?: { sexual_activity?: number; sexual_display?: number; erotica?: number };
        gore?: { prob?: number };
      };
      const nudity = Math.max(
        json.nudity?.sexual_activity ?? 0,
        json.nudity?.sexual_display ?? 0,
        json.nudity?.erotica ?? 0
      );
      const gore = json.gore?.prob ?? 0;
      const score = Math.max(nudity, gore);
      if (score >= 0.5) {
        return { flagged: true, reason: nudity >= gore ? "nudity" : "graphic content", score };
      }
      return { flagged: false, reason: null, score };
    } catch (e) {
      captureError(e, { where: "moderation.sightengine" });
      // Fail SAFE for a family product: if screening errors, hold for review.
      return { flagged: true, reason: "screening unavailable — held for host review", score: 0 };
    }
  }
}

class MockModerationProvider implements ModerationProvider {
  readonly name = "mock";
  async checkImage(_image: Buffer, filename: string): Promise<ModerationResult> {
    if (filename.toLowerCase().includes("unsafe-test")) {
      return { flagged: true, reason: "test flag (mock moderator)", score: 0.99 };
    }
    return { flagged: false, reason: null, score: 0 };
  }
}

let provider: ModerationProvider | null = null;
export function getModerationProvider(): ModerationProvider {
  if (!provider) provider = config.sightengine.enabled ? new SightengineProvider() : new MockModerationProvider();
  return provider;
}
