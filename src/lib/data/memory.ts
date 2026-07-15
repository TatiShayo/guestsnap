/**
 * In-memory data + blob store, persisted to .data/ so local dev survives
 * restarts. This is the zero-keys mock for Supabase: same typed interface,
 * real behavior. NOT for production — see README NEEDS HUMAN.
 */
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { config } from "@/lib/config";
import { signToken } from "@/lib/tokens";
import type {
  AdminStats, AlbumSubscriber, AuditEntry, BlobStore, DataStore, EmailSend,
  EventRecord, MediaFilter, MediaRecord, PaymentRecord, Profile,
} from "./types";

// Overridable so tests never touch the real dev/demo .data/ directory on
// disk — the vitest setup file points this at a throwaway temp dir.
const DATA_DIR = process.env.GUESTSNAP_DATA_DIR
  ? path.resolve(process.env.GUESTSNAP_DATA_DIR)
  : path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const BLOB_DIR = path.join(DATA_DIR, "blobs");

interface Db {
  profiles: Profile[];
  events: EventRecord[];
  media: MediaRecord[];
  payments: PaymentRecord[];
  processedWebhooks: string[];
  subscribers: AlbumSubscriber[];
  emailSends: EmailSend[];
  audit: AuditEntry[];
}

const emptyDb = (): Db => ({
  profiles: [], events: [], media: [], payments: [],
  processedWebhooks: [], subscribers: [], emailSends: [], audit: [],
});

let dbCache: Db | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function loadDb(): Promise<Db> {
  if (dbCache) return dbCache;
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    dbCache = { ...emptyDb(), ...JSON.parse(raw) };
  } catch {
    dbCache = emptyDb();
  }
  return dbCache!;
}

function persist(db: Db) {
  // Serialize writes; last-write-wins is fine for a dev store.
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 1), "utf8");
  }).catch((e) => console.error("[memory-store] persist failed", e));
}

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export class MemoryStore implements DataStore {
  async upsertProfile(p: { id: string; email: string; name?: string | null }): Promise<Profile> {
    const db = await loadDb();
    let existing = db.profiles.find((x) => x.id === p.id);
    if (!existing) {
      existing = {
        id: p.id, email: p.email.toLowerCase(), name: p.name ?? null,
        referralCode: "GS-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
        eventCredits: 0, createdAt: now(),
      };
      db.profiles.push(existing);
    } else if (p.name && !existing.name) {
      existing.name = p.name;
    }
    persist(db);
    return existing;
  }
  async getProfile(pid: string) {
    const db = await loadDb();
    return db.profiles.find((x) => x.id === pid) ?? null;
  }
  async getProfileByEmail(email: string) {
    const db = await loadDb();
    return db.profiles.find((x) => x.email === email.toLowerCase()) ?? null;
  }
  async updateProfile(pid: string, patch: Partial<Pick<Profile, "name" | "eventCredits">>) {
    const db = await loadDb();
    const p = db.profiles.find((x) => x.id === pid);
    if (p) Object.assign(p, patch);
    persist(db);
  }
  async redeemCredit(pid: string): Promise<boolean> {
    // Atomic in the single-threaded event loop: the read, check and decrement
    // run with no `await` between them, so two concurrent redeems can't both
    // observe the same positive balance and each spend it.
    const db = await loadDb();
    const p = db.profiles.find((x) => x.id === pid);
    if (!p || p.eventCredits <= 0) return false;
    p.eventCredits -= 1;
    persist(db);
    return true;
  }
  async deleteProfile(pid: string) {
    const db = await loadDb();
    const events = db.events.filter((e) => e.hostId === pid);
    for (const e of events) await this.deleteEvent(e.id);
    db.profiles = db.profiles.filter((x) => x.id !== pid);
    persist(db);
  }

  async createEvent(e: Omit<EventRecord, "id" | "createdAt">): Promise<EventRecord> {
    const db = await loadDb();
    if (db.events.some((x) => x.slug === e.slug)) throw new Error("slug_taken");
    const rec: EventRecord = { ...e, id: id(), createdAt: now() };
    db.events.push(rec);
    persist(db);
    return rec;
  }
  async getEvent(eid: string) {
    const db = await loadDb();
    return db.events.find((x) => x.id === eid) ?? null;
  }
  async getEventBySlug(slug: string) {
    const db = await loadDb();
    return db.events.find((x) => x.slug === slug) ?? null;
  }
  async listEventsByHost(hostId: string) {
    const db = await loadDb();
    return db.events.filter((x) => x.hostId === hostId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async updateEvent(eid: string, patch: Partial<EventRecord>) {
    const db = await loadDb();
    const e = db.events.find((x) => x.id === eid);
    if (e) Object.assign(e, patch);
    persist(db);
  }
  async deleteEvent(eid: string) {
    const db = await loadDb();
    db.media = db.media.filter((m) => m.eventId !== eid);
    db.subscribers = db.subscribers.filter((s) => s.eventId !== eid);
    db.events = db.events.filter((x) => x.id !== eid);
    persist(db);
  }
  async listAllEvents() {
    const db = await loadDb();
    return [...db.events];
  }
  async countEventsByHostSince(hostId: string, sinceIso: string) {
    const db = await loadDb();
    return db.events.filter((x) => x.hostId === hostId && x.createdAt >= sinceIso).length;
  }

  async insertMedia(m: Omit<MediaRecord, "id" | "createdAt">): Promise<MediaRecord> {
    const db = await loadDb();
    const rec: MediaRecord = { ...m, id: id(), createdAt: now() };
    db.media.push(rec);
    persist(db);
    return rec;
  }
  async insertMediaWithinLimit(
    m: Omit<MediaRecord, "id" | "createdAt">,
    limit: number
  ): Promise<MediaRecord | null> {
    // Atomic in the single-threaded JS event loop: the count and the push
    // happen with no `await` between them, so two concurrent uploads can't
    // both observe count < limit and then both insert.
    const db = await loadDb();
    const count = db.media.reduce((n, x) => (x.eventId === m.eventId ? n + 1 : n), 0);
    if (count >= limit) return null;
    const rec: MediaRecord = { ...m, id: id(), createdAt: now() };
    db.media.push(rec);
    persist(db);
    return rec;
  }
  async getMedia(mid: string) {
    const db = await loadDb();
    return db.media.find((x) => x.id === mid) ?? null;
  }
  async listMedia(eventId: string, filter: MediaFilter = {}) {
    const db = await loadDb();
    const rows = db.media
      .filter((m) => m.eventId === eventId)
      .filter((m) => (filter.includeHidden ? true : !m.isHidden && !m.needsReview))
      .filter((m) => (filter.onlyGuestbook === undefined ? true : m.isGuestbook === filter.onlyGuestbook))
      .filter((m) => (filter.onlyNeedsReview ? m.needsReview : true))
      .filter((m) => (filter.uploaderKey ? m.uploaderKey === filter.uploaderKey : true))
      .filter((m) => (filter.uploaderName ? m.uploaderName === filter.uploaderName : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const offset = filter.offset ?? 0;
    if (offset || filter.limit !== undefined) {
      return rows.slice(offset, filter.limit !== undefined ? offset + filter.limit : undefined);
    }
    return rows;
  }
  async countMedia(eventId: string) {
    const db = await loadDb();
    return db.media.filter((m) => m.eventId === eventId).length;
  }
  async updateMedia(mid: string, patch: Partial<MediaRecord>) {
    const db = await loadDb();
    const m = db.media.find((x) => x.id === mid);
    if (m) Object.assign(m, patch);
    persist(db);
  }
  async deleteMedia(mid: string) {
    const db = await loadDb();
    db.media = db.media.filter((x) => x.id !== mid);
    persist(db);
  }

  async insertPayment(p: Omit<PaymentRecord, "id" | "createdAt">): Promise<PaymentRecord> {
    const db = await loadDb();
    const rec: PaymentRecord = { ...p, id: id(), createdAt: now() };
    db.payments.push(rec);
    persist(db);
    return rec;
  }
  async getPaymentBySession(sessionId: string) {
    const db = await loadDb();
    return db.payments.find((x) => x.sessionId === sessionId) ?? null;
  }
  async updatePayment(pid: string, patch: Partial<PaymentRecord>) {
    const db = await loadDb();
    const p = db.payments.find((x) => x.id === pid);
    if (p) Object.assign(p, patch);
    persist(db);
  }
  async listPayments() {
    const db = await loadDb();
    return [...db.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async hasProcessedWebhook(eventId: string) {
    const db = await loadDb();
    return db.processedWebhooks.includes(eventId);
  }
  async markWebhookProcessed(eventId: string) {
    const db = await loadDb();
    if (!db.processedWebhooks.includes(eventId)) db.processedWebhooks.push(eventId);
    persist(db);
  }
  async unmarkWebhookProcessed(eventId: string) {
    const db = await loadDb();
    db.processedWebhooks = db.processedWebhooks.filter((x) => x !== eventId);
    persist(db);
  }

  async addSubscriber(eventId: string, email: string) {
    const db = await loadDb();
    const norm = email.toLowerCase();
    if (!db.subscribers.some((s) => s.eventId === eventId && s.email === norm)) {
      db.subscribers.push({ id: id(), eventId, email: norm, createdAt: now() });
    }
    persist(db);
  }
  async listSubscribers(eventId: string) {
    const db = await loadDb();
    return db.subscribers.filter((s) => s.eventId === eventId);
  }

  async hasSentEmail(kind: string, recipient: string, eventId: string | null) {
    const db = await loadDb();
    return db.emailSends.some((e) => e.kind === kind && e.recipient === recipient.toLowerCase() && e.eventId === eventId);
  }
  async recordEmailSent(kind: string, recipient: string, eventId: string | null) {
    const db = await loadDb();
    db.emailSends.push({ id: id(), kind, recipient: recipient.toLowerCase(), eventId, sentAt: now() });
    persist(db);
  }

  async addAudit(actor: string, action: string, target: string) {
    const db = await loadDb();
    db.audit.push({ id: id(), actor, action, target, createdAt: now() });
    persist(db);
  }
  async listAudit(limit = 100) {
    const db = await loadDb();
    return [...db.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  async adminStats(): Promise<AdminStats> {
    const db = await loadDb();
    const paid = db.payments.filter((p) => p.status === "paid");
    const refunded = db.payments.filter((p) => p.status === "refunded");
    const byDay = new Map<string, number>();
    for (const e of db.events) {
      const d = e.createdAt.slice(0, 10);
      byDay.set(d, (byDay.get(d) || 0) + 1);
    }
    const paidEvents = db.events.filter((e) => e.tier !== "free" && !e.isDemo).length;
    const realEvents = db.events.filter((e) => !e.isDemo).length;
    return {
      revenueCents: paid.reduce((s, p) => s + p.amountCents, 0),
      refundedCents: refunded.reduce((s, p) => s + p.amountCents, 0),
      totalEvents: realEvents,
      paidEvents,
      eventsPerDay: [...byDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
      freeToPaidRate: realEvents ? paidEvents / realEvents : 0,
      storageBytes: db.media.reduce((s, m) => s + m.sizeBytes, 0),
      totalMedia: db.media.length,
    };
  }
}

export class MemoryBlobStore implements BlobStore {
  private fullPath(p: string) {
    // prevent path traversal out of the blob dir
    const resolved = path.resolve(BLOB_DIR, p.replace(/^\/+/, ""));
    if (!resolved.startsWith(path.resolve(BLOB_DIR))) throw new Error("invalid path");
    return resolved;
  }
  async put(p: string, data: Buffer, contentType: string) {
    const fp = this.fullPath(p);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, data);
    await fs.writeFile(fp + ".meta", contentType, "utf8");
  }
  async get(p: string) {
    try {
      const fp = this.fullPath(p);
      const data = await fs.readFile(fp);
      const contentType = await fs.readFile(fp + ".meta", "utf8").catch(() => "application/octet-stream");
      return { data, contentType };
    } catch {
      return null;
    }
  }
  async delete(p: string) {
    const fp = this.fullPath(p);
    await fs.rm(fp, { force: true });
    await fs.rm(fp + ".meta", { force: true });
  }
  async getSignedUrl(p: string, expiresSec = 900) {
    const exp = Math.floor(Date.now() / 1000) + expiresSec;
    const token = signToken({ p, exp });
    return `${config.appUrl}/api/blob?token=${encodeURIComponent(token)}`;
  }
}
