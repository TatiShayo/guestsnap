import type { Tier } from "@/lib/tiers";

/** Retention (PLAYBOOK 2.7): media kept per event tier (3mo free / 12–24mo
 * paid), soft-deleted with 30-day grace, then hard-purged by the daily cron.
 * Profiles/events kept while the account exists; self-serve delete cascades. */

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  referralCode: string;
  eventCredits: number; // Pro Pack credits (each = one Standard event)
  createdAt: string;
}

export type EventType = "wedding" | "birthday" | "funeral" | "corporate" | "other";
export type EventVisibility = "gallery" | "own" | "host";

export interface EventRecord {
  id: string;
  hostId: string;
  slug: string;
  title: string;
  eventType: EventType;
  eventDate: string; // ISO date
  coverPath: string | null;
  tier: Tier;
  brandColor: string | null;
  welcomeMessage: string | null;
  uploadLimit: number;
  isActive: boolean;
  requireApproval: boolean;
  visibility: EventVisibility;
  slideshowPinHash: string | null;
  hideUploaderNames: boolean;
  retentionMonths: number;
  isDemo: boolean;
  archivedAt: string | null; // soft delete of media (30-day grace)
  purgedAt: string | null;
  createdAt: string;
}

export type MediaType = "photo" | "video";

export interface MediaRecord {
  id: string;
  eventId: string;
  storagePath: string;
  thumbPath: string | null;
  type: MediaType;
  uploaderName: string | null;
  uploaderKey: string | null; // anonymous per-device key, for "own uploads" visibility
  phash: string | null;
  sharpness: number | null; // variance of Laplacian proxy — higher is sharper
  isHidden: boolean;
  isFavorite: boolean;
  needsReview: boolean; // flagged by moderation or reports, awaiting host
  flagReason: string | null;
  reportCount: number;
  isGuestbook: boolean;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  sizeBytes: number;
  createdAt: string;
}

export type PaymentStatus = "pending" | "paid" | "refunded";

export interface PaymentRecord {
  id: string;
  eventId: string | null; // null for pro_pack
  userId: string;
  provider: "stripe" | "mock";
  sessionId: string;
  amountCents: number;
  sku: string;
  addOns: string[];
  status: PaymentStatus;
  createdAt: string;
}

export interface AlbumSubscriber {
  id: string;
  eventId: string;
  email: string;
  createdAt: string;
}

export interface EmailSend {
  id: string;
  kind: string; // e.g. post_event_stats, archive_warning
  recipient: string;
  eventId: string | null;
  sentAt: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
}

export interface MediaFilter {
  includeHidden?: boolean;
  onlyGuestbook?: boolean;
  onlyNeedsReview?: boolean;
  uploaderKey?: string;
  uploaderName?: string;
  /** Pagination — cap rows returned (newest first) and skip `offset` rows. */
  limit?: number;
  offset?: number;
}

export interface AdminStats {
  revenueCents: number;
  refundedCents: number;
  totalEvents: number;
  paidEvents: number;
  eventsPerDay: { date: string; count: number }[];
  freeToPaidRate: number;
  storageBytes: number;
  totalMedia: number;
}

/** Typed data access layer — implemented by SupabaseStore and MemoryStore. */
export interface DataStore {
  // profiles
  upsertProfile(p: { id: string; email: string; name?: string | null }): Promise<Profile>;
  getProfile(id: string): Promise<Profile | null>;
  getProfileByEmail(email: string): Promise<Profile | null>;
  updateProfile(id: string, patch: Partial<Pick<Profile, "name" | "eventCredits">>): Promise<void>;
  /**
   * Atomically spend one Pro Pack event-credit. Returns true if a credit was
   * available and consumed, false if the balance was already zero. Closes the
   * check-then-act double-spend race in the credit-redemption path (a plain
   * getProfile()+updateProfile() lets two concurrent redeems both read the
   * same balance and each upgrade a different event for one credit).
   */
  redeemCredit(id: string): Promise<boolean>;
  deleteProfile(id: string): Promise<void>;

  // events
  createEvent(e: Omit<EventRecord, "id" | "createdAt">): Promise<EventRecord>;
  getEvent(id: string): Promise<EventRecord | null>;
  getEventBySlug(slug: string): Promise<EventRecord | null>;
  listEventsByHost(hostId: string): Promise<EventRecord[]>;
  updateEvent(id: string, patch: Partial<EventRecord>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  listAllEvents(): Promise<EventRecord[]>;
  countEventsByHostSince(hostId: string, sinceIso: string): Promise<number>;

  // media
  insertMedia(m: Omit<MediaRecord, "id" | "createdAt">): Promise<MediaRecord>;
  /**
   * Atomically enforce the per-event upload cap: insert only if the current
   * count is below `limit`, otherwise return null. Closes the check-then-act
   * (TOCTOU) race that a plain countMedia()+insertMedia() leaves open under
   * concurrent guest uploads.
   */
  insertMediaWithinLimit(
    m: Omit<MediaRecord, "id" | "createdAt">,
    limit: number
  ): Promise<MediaRecord | null>;
  getMedia(id: string): Promise<MediaRecord | null>;
  listMedia(eventId: string, filter?: MediaFilter): Promise<MediaRecord[]>;
  countMedia(eventId: string): Promise<number>;
  updateMedia(id: string, patch: Partial<MediaRecord>): Promise<void>;
  deleteMedia(id: string): Promise<void>;

  // payments
  insertPayment(p: Omit<PaymentRecord, "id" | "createdAt">): Promise<PaymentRecord>;
  getPaymentBySession(sessionId: string): Promise<PaymentRecord | null>;
  updatePayment(id: string, patch: Partial<PaymentRecord>): Promise<void>;
  listPayments(): Promise<PaymentRecord[]>;

  // webhook idempotency
  hasProcessedWebhook(eventId: string): Promise<boolean>;
  markWebhookProcessed(eventId: string): Promise<void>;
  /** Release an idempotency claim so a Stripe retry can re-attempt fulfillment
   * after a transient failure (see webhook route). */
  unmarkWebhookProcessed(eventId: string): Promise<void>;

  // album subscribers (guest growth loop)
  addSubscriber(eventId: string, email: string): Promise<void>;
  listSubscribers(eventId: string): Promise<AlbumSubscriber[]>;

  // lifecycle email dedupe
  hasSentEmail(kind: string, recipient: string, eventId: string | null): Promise<boolean>;
  recordEmailSent(kind: string, recipient: string, eventId: string | null): Promise<void>;

  // audit log (admin actions)
  addAudit(actor: string, action: string, target: string): Promise<void>;
  listAudit(limit?: number): Promise<AuditEntry[]>;

  // admin
  adminStats(): Promise<AdminStats>;
}

/** Blob storage — Supabase Storage or local .data/blobs. Private by default;
 * reads only via short-lived signed URLs issued after an access check. */
export interface BlobStore {
  put(path: string, data: Buffer, contentType: string): Promise<void>;
  get(path: string): Promise<{ data: Buffer; contentType: string } | null>;
  delete(path: string): Promise<void>;
  /** Short-lived signed URL (default 15 min). */
  getSignedUrl(path: string, expiresSec?: number): Promise<string>;
}
