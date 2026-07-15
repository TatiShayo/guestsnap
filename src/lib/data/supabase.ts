/**
 * Supabase-backed DataStore/BlobStore. Uses the service-role client, which
 * is ONLY ever reached from server routes that have already validated the
 * caller's session/authorization (RLS still protects direct client access).
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import type {
  AdminStats, AlbumSubscriber, AuditEntry, BlobStore, DataStore,
  EventRecord, MediaFilter, MediaRecord, PaymentRecord, Profile,
} from "./types";

const BUCKET = "media";

let serviceClient: SupabaseClient | null = null;
export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return serviceClient;
}

/* row mappers: snake_case DB <-> camelCase app */
const profileFromRow = (r: Record<string, unknown>): Profile => ({
  id: r.id as string, email: r.email as string, name: (r.name as string) ?? null,
  referralCode: r.referral_code as string, eventCredits: (r.event_credits as number) ?? 0,
  createdAt: r.created_at as string,
});

const eventFromRow = (r: Record<string, unknown>): EventRecord => ({
  id: r.id as string, hostId: r.host_id as string, slug: r.slug as string,
  title: r.title as string, eventType: r.event_type as EventRecord["eventType"],
  eventDate: r.event_date as string, coverPath: (r.cover_url as string) ?? null,
  tier: r.tier as EventRecord["tier"], brandColor: (r.brand_color as string) ?? null,
  welcomeMessage: (r.welcome_message as string) ?? null,
  uploadLimit: r.upload_limit as number, isActive: r.is_active as boolean,
  requireApproval: r.require_approval as boolean,
  visibility: r.visibility as EventRecord["visibility"],
  slideshowPinHash: (r.slideshow_pin_hash as string) ?? null,
  hideUploaderNames: r.hide_uploader_names as boolean,
  retentionMonths: r.retention_months as number, isDemo: r.is_demo as boolean,
  archivedAt: (r.archived_at as string) ?? null, purgedAt: (r.purged_at as string) ?? null,
  createdAt: r.created_at as string,
});

const eventToRow = (e: Partial<EventRecord>) => {
  const row: Record<string, unknown> = {};
  if (e.hostId !== undefined) row.host_id = e.hostId;
  if (e.slug !== undefined) row.slug = e.slug;
  if (e.title !== undefined) row.title = e.title;
  if (e.eventType !== undefined) row.event_type = e.eventType;
  if (e.eventDate !== undefined) row.event_date = e.eventDate;
  if (e.coverPath !== undefined) row.cover_url = e.coverPath;
  if (e.tier !== undefined) row.tier = e.tier;
  if (e.brandColor !== undefined) row.brand_color = e.brandColor;
  if (e.welcomeMessage !== undefined) row.welcome_message = e.welcomeMessage;
  if (e.uploadLimit !== undefined) row.upload_limit = e.uploadLimit;
  if (e.isActive !== undefined) row.is_active = e.isActive;
  if (e.requireApproval !== undefined) row.require_approval = e.requireApproval;
  if (e.visibility !== undefined) row.visibility = e.visibility;
  if (e.slideshowPinHash !== undefined) row.slideshow_pin_hash = e.slideshowPinHash;
  if (e.hideUploaderNames !== undefined) row.hide_uploader_names = e.hideUploaderNames;
  if (e.retentionMonths !== undefined) row.retention_months = e.retentionMonths;
  if (e.isDemo !== undefined) row.is_demo = e.isDemo;
  if (e.archivedAt !== undefined) row.archived_at = e.archivedAt;
  if (e.purgedAt !== undefined) row.purged_at = e.purgedAt;
  return row;
};

const mediaFromRow = (r: Record<string, unknown>): MediaRecord => ({
  id: r.id as string, eventId: r.event_id as string,
  storagePath: r.storage_path as string, thumbPath: (r.thumb_path as string) ?? null,
  type: r.type as MediaRecord["type"], uploaderName: (r.uploader_name as string) ?? null,
  uploaderKey: (r.uploader_key as string) ?? null, phash: (r.phash as string) ?? null,
  sharpness: (r.sharpness as number) ?? null, isHidden: r.is_hidden as boolean,
  isFavorite: r.is_favorite as boolean, needsReview: r.needs_review as boolean,
  flagReason: (r.flag_reason as string) ?? null, reportCount: (r.report_count as number) ?? 0,
  isGuestbook: r.is_guestbook as boolean, width: (r.width as number) ?? null,
  height: (r.height as number) ?? null, durationSec: (r.duration_sec as number) ?? null,
  sizeBytes: (r.size_bytes as number) ?? 0, createdAt: r.created_at as string,
});

const mediaToRow = (m: Partial<MediaRecord>) => {
  const row: Record<string, unknown> = {};
  if (m.eventId !== undefined) row.event_id = m.eventId;
  if (m.storagePath !== undefined) row.storage_path = m.storagePath;
  if (m.thumbPath !== undefined) row.thumb_path = m.thumbPath;
  if (m.type !== undefined) row.type = m.type;
  if (m.uploaderName !== undefined) row.uploader_name = m.uploaderName;
  if (m.uploaderKey !== undefined) row.uploader_key = m.uploaderKey;
  if (m.phash !== undefined) row.phash = m.phash;
  if (m.sharpness !== undefined) row.sharpness = m.sharpness;
  if (m.isHidden !== undefined) row.is_hidden = m.isHidden;
  if (m.isFavorite !== undefined) row.is_favorite = m.isFavorite;
  if (m.needsReview !== undefined) row.needs_review = m.needsReview;
  if (m.flagReason !== undefined) row.flag_reason = m.flagReason;
  if (m.reportCount !== undefined) row.report_count = m.reportCount;
  if (m.isGuestbook !== undefined) row.is_guestbook = m.isGuestbook;
  if (m.width !== undefined) row.width = m.width;
  if (m.height !== undefined) row.height = m.height;
  if (m.durationSec !== undefined) row.duration_sec = m.durationSec;
  if (m.sizeBytes !== undefined) row.size_bytes = m.sizeBytes;
  return row;
};

const paymentFromRow = (r: Record<string, unknown>): PaymentRecord => ({
  id: r.id as string, eventId: (r.event_id as string) ?? null, userId: r.user_id as string,
  provider: r.provider as PaymentRecord["provider"], sessionId: r.stripe_session_id as string,
  amountCents: r.amount as number, sku: r.sku as string,
  addOns: (r.add_ons as string[]) ?? [], status: r.status as PaymentRecord["status"],
  createdAt: r.created_at as string,
});

function fail(op: string, error: { message: string } | null): never {
  throw new Error(`[supabase:${op}] ${error?.message || "unknown error"}`);
}

export class SupabaseStore implements DataStore {
  private get db() { return getServiceClient(); }

  async upsertProfile(p: { id: string; email: string; name?: string | null }): Promise<Profile> {
    const existing = await this.getProfile(p.id);
    if (existing) return existing;
    const { data, error } = await this.db.from("profiles").insert({
      id: p.id, email: p.email.toLowerCase(), name: p.name ?? null,
      referral_code: "GS-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    }).select().single();
    if (error) fail("upsertProfile", error);
    return profileFromRow(data);
  }
  async getProfile(id: string) {
    const { data } = await this.db.from("profiles").select().eq("id", id).maybeSingle();
    return data ? profileFromRow(data) : null;
  }
  async getProfileByEmail(email: string) {
    const { data } = await this.db.from("profiles").select().eq("email", email.toLowerCase()).maybeSingle();
    return data ? profileFromRow(data) : null;
  }
  async updateProfile(id: string, patch: Partial<Pick<Profile, "name" | "eventCredits">>) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.eventCredits !== undefined) row.event_credits = patch.eventCredits;
    const { error } = await this.db.from("profiles").update(row).eq("id", id);
    if (error) fail("updateProfile", error);
  }
  async deleteProfile(id: string) {
    const events = await this.listEventsByHost(id);
    for (const e of events) await this.deleteEvent(e.id);
    await this.db.from("profiles").delete().eq("id", id);
    await this.db.auth.admin.deleteUser(id).catch(() => {});
  }

  async createEvent(e: Omit<EventRecord, "id" | "createdAt">): Promise<EventRecord> {
    const { data, error } = await this.db.from("events").insert(eventToRow(e)).select().single();
    if (error) fail("createEvent", error);
    return eventFromRow(data);
  }
  async getEvent(id: string) {
    const { data } = await this.db.from("events").select().eq("id", id).maybeSingle();
    return data ? eventFromRow(data) : null;
  }
  async getEventBySlug(slug: string) {
    const { data } = await this.db.from("events").select().eq("slug", slug).maybeSingle();
    return data ? eventFromRow(data) : null;
  }
  async listEventsByHost(hostId: string) {
    const { data, error } = await this.db.from("events").select().eq("host_id", hostId).order("created_at", { ascending: false });
    if (error) fail("listEventsByHost", error);
    return (data ?? []).map(eventFromRow);
  }
  async updateEvent(id: string, patch: Partial<EventRecord>) {
    const { error } = await this.db.from("events").update(eventToRow(patch)).eq("id", id);
    if (error) fail("updateEvent", error);
  }
  async deleteEvent(id: string) {
    const media = await this.listMedia(id, { includeHidden: true });
    const blob = new SupabaseBlobStore();
    for (const m of media) {
      await blob.delete(m.storagePath).catch(() => {});
      if (m.thumbPath) await blob.delete(m.thumbPath).catch(() => {});
    }
    await this.db.from("media").delete().eq("event_id", id);
    await this.db.from("album_subscribers").delete().eq("event_id", id);
    await this.db.from("events").delete().eq("id", id);
  }
  async listAllEvents() {
    const { data, error } = await this.db.from("events").select();
    if (error) fail("listAllEvents", error);
    return (data ?? []).map(eventFromRow);
  }
  async countEventsByHostSince(hostId: string, sinceIso: string) {
    const { count } = await this.db.from("events").select("id", { count: "exact", head: true })
      .eq("host_id", hostId).gte("created_at", sinceIso);
    return count ?? 0;
  }

  async insertMedia(m: Omit<MediaRecord, "id" | "createdAt">): Promise<MediaRecord> {
    const { data, error } = await this.db.from("media").insert(mediaToRow(m)).select().single();
    if (error) fail("insertMedia", error);
    return mediaFromRow(data);
  }
  async insertMediaWithinLimit(
    m: Omit<MediaRecord, "id" | "createdAt">,
    limit: number
  ): Promise<MediaRecord | null> {
    // Insert then verify: if the post-insert count exceeds the cap we lost a
    // race, so delete our own row and report the limit as reached. This makes
    // the cap eventually-consistent under concurrency without a DB round-trip
    // per pre-check. The fully race-free form is the SQL function in
    // migration 0002 (insert_media_within_limit) — swap this call for an
    // `.rpc()` there if guest-upload concurrency ever gets high enough to
    // matter. `limit` past MAX_SAFE_INTEGER (unlimited tiers) skips the check.
    const rec = await this.insertMedia(m);
    if (limit >= Number.MAX_SAFE_INTEGER) return rec;
    const total = await this.countMedia(m.eventId);
    if (total > limit) {
      await this.deleteMedia(rec.id);
      return null;
    }
    return rec;
  }
  async getMedia(id: string) {
    const { data } = await this.db.from("media").select().eq("id", id).maybeSingle();
    return data ? mediaFromRow(data) : null;
  }
  async listMedia(eventId: string, filter: MediaFilter = {}) {
    let q = this.db.from("media").select().eq("event_id", eventId).order("created_at", { ascending: false });
    if (!filter.includeHidden) q = q.eq("is_hidden", false).eq("needs_review", false);
    if (filter.onlyGuestbook !== undefined) q = q.eq("is_guestbook", filter.onlyGuestbook);
    if (filter.onlyNeedsReview) q = q.eq("needs_review", true);
    if (filter.uploaderKey) q = q.eq("uploader_key", filter.uploaderKey);
    if (filter.uploaderName) q = q.eq("uploader_name", filter.uploaderName);
    if (filter.limit !== undefined) {
      const offset = filter.offset ?? 0;
      q = q.range(offset, offset + filter.limit - 1);
    } else if (filter.offset) {
      q = q.range(filter.offset, filter.offset + 999);
    }
    const { data, error } = await q;
    if (error) fail("listMedia", error);
    return (data ?? []).map(mediaFromRow);
  }
  async countMedia(eventId: string) {
    const { count } = await this.db.from("media").select("id", { count: "exact", head: true }).eq("event_id", eventId);
    return count ?? 0;
  }
  async updateMedia(id: string, patch: Partial<MediaRecord>) {
    const { error } = await this.db.from("media").update(mediaToRow(patch)).eq("id", id);
    if (error) fail("updateMedia", error);
  }
  async deleteMedia(id: string) {
    await this.db.from("media").delete().eq("id", id);
  }

  async insertPayment(p: Omit<PaymentRecord, "id" | "createdAt">): Promise<PaymentRecord> {
    const { data, error } = await this.db.from("payments").insert({
      event_id: p.eventId, user_id: p.userId, provider: p.provider,
      stripe_session_id: p.sessionId, amount: p.amountCents, sku: p.sku,
      add_ons: p.addOns, status: p.status,
    }).select().single();
    if (error) fail("insertPayment", error);
    return paymentFromRow(data);
  }
  async getPaymentBySession(sessionId: string) {
    const { data } = await this.db.from("payments").select().eq("stripe_session_id", sessionId).maybeSingle();
    return data ? paymentFromRow(data) : null;
  }
  async updatePayment(id: string, patch: Partial<PaymentRecord>) {
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    const { error } = await this.db.from("payments").update(row).eq("id", id);
    if (error) fail("updatePayment", error);
  }
  async listPayments() {
    const { data, error } = await this.db.from("payments").select().order("created_at", { ascending: false });
    if (error) fail("listPayments", error);
    return (data ?? []).map(paymentFromRow);
  }

  async hasProcessedWebhook(eventId: string) {
    const { data } = await this.db.from("processed_webhooks").select("id").eq("id", eventId).maybeSingle();
    return !!data;
  }
  async markWebhookProcessed(eventId: string) {
    await this.db.from("processed_webhooks").upsert({ id: eventId });
  }
  async unmarkWebhookProcessed(eventId: string) {
    await this.db.from("processed_webhooks").delete().eq("id", eventId);
  }

  async addSubscriber(eventId: string, email: string) {
    await this.db.from("album_subscribers").upsert(
      { event_id: eventId, email: email.toLowerCase() },
      { onConflict: "event_id,email" }
    );
  }
  async listSubscribers(eventId: string): Promise<AlbumSubscriber[]> {
    const { data } = await this.db.from("album_subscribers").select().eq("event_id", eventId);
    return (data ?? []).map((r) => ({
      id: r.id as string, eventId: r.event_id as string,
      email: r.email as string, createdAt: r.created_at as string,
    }));
  }

  async hasSentEmail(kind: string, recipient: string, eventId: string | null) {
    let q = this.db.from("email_sends").select("id").eq("kind", kind).eq("recipient", recipient.toLowerCase());
    q = eventId === null ? q.is("event_id", null) : q.eq("event_id", eventId);
    const { data } = await q.maybeSingle();
    return !!data;
  }
  async recordEmailSent(kind: string, recipient: string, eventId: string | null) {
    await this.db.from("email_sends").insert({ kind, recipient: recipient.toLowerCase(), event_id: eventId });
  }

  async addAudit(actor: string, action: string, target: string) {
    await this.db.from("audit_log").insert({ actor, action, target });
  }
  async listAudit(limit = 100): Promise<AuditEntry[]> {
    const { data } = await this.db.from("audit_log").select().order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map((r) => ({
      id: r.id as string, actor: r.actor as string, action: r.action as string,
      target: r.target as string, createdAt: r.created_at as string,
    }));
  }

  async adminStats(): Promise<AdminStats> {
    const [payments, events, mediaRes] = await Promise.all([
      this.listPayments(),
      this.listAllEvents(),
      this.db.from("media").select("size_bytes"),
    ]);
    const paid = payments.filter((p) => p.status === "paid");
    const refunded = payments.filter((p) => p.status === "refunded");
    const byDay = new Map<string, number>();
    for (const e of events) {
      const d = e.createdAt.slice(0, 10);
      byDay.set(d, (byDay.get(d) || 0) + 1);
    }
    const real = events.filter((e) => !e.isDemo);
    const paidEvents = real.filter((e) => e.tier !== "free").length;
    const mediaRows = (mediaRes.data ?? []) as { size_bytes: number }[];
    return {
      revenueCents: paid.reduce((s, p) => s + p.amountCents, 0),
      refundedCents: refunded.reduce((s, p) => s + p.amountCents, 0),
      totalEvents: real.length,
      paidEvents,
      eventsPerDay: [...byDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
      freeToPaidRate: real.length ? paidEvents / real.length : 0,
      storageBytes: mediaRows.reduce((s, m) => s + (m.size_bytes || 0), 0),
      totalMedia: mediaRows.length,
    };
  }
}

export class SupabaseBlobStore implements BlobStore {
  private get db() { return getServiceClient(); }
  async put(path: string, data: Buffer, contentType: string) {
    const { error } = await this.db.storage.from(BUCKET).upload(path, data, { contentType, upsert: true });
    if (error) fail("blob.put", error);
  }
  async get(path: string) {
    const { data, error } = await this.db.storage.from(BUCKET).download(path);
    if (error || !data) return null;
    return { data: Buffer.from(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" };
  }
  async delete(path: string) {
    await this.db.storage.from(BUCKET).remove([path]);
  }
  async getSignedUrl(path: string, expiresSec = 900) {
    const { data, error } = await this.db.storage.from(BUCKET).createSignedUrl(path, expiresSec);
    if (error || !data) fail("blob.sign", error);
    return data.signedUrl;
  }
}
