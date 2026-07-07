/**
 * Email provider interface. Resend when RESEND_API_KEY is set; otherwise a
 * mock that writes the email to .data/emails/ and the console so every
 * lifecycle flow is testable with zero keys.
 */
import { promises as fs } from "fs";
import path from "path";
import { config } from "@/lib/config";
import { captureError } from "@/lib/monitoring";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<{ ok: boolean; id?: string; error?: string }>;
}

class ResendProvider implements EmailProvider {
  readonly name = "resend";
  async send(msg: EmailMessage) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(config.resend.apiKey);
      const { data, error } = await resend.emails.send({
        from: config.resend.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: data?.id };
    } catch (e) {
      captureError(e, { where: "email.resend" });
      return { ok: false, error: "send_failed" };
    }
  }
}

class MockEmailProvider implements EmailProvider {
  readonly name = "mock";
  async send(msg: EmailMessage) {
    const dir = path.join(process.cwd(), ".data", "emails");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${msg.subject.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.html`);
    await fs.writeFile(file, `<!-- to: ${msg.to} -->\n${msg.html}`, "utf8");
    console.log(`[mock-email] to=${msg.to} subject="${msg.subject}" saved=${path.basename(file)}`);
    return { ok: true, id: path.basename(file) };
  }
}

let provider: EmailProvider | null = null;
export function getEmailProvider(): EmailProvider {
  if (!provider) provider = config.resend.enabled ? new ResendProvider() : new MockEmailProvider();
  return provider;
}
