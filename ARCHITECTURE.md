# ARCHITECTURE — GuestSnap

QR photo collection for weddings & events. Guests scan a QR code and upload
photos/videos from their phone browser — no app, no account. Hosts create an
event, moderate a live gallery, run a slideshow, and download a ZIP. Payment is
one-time per event (Stripe), tiered.

## Stack

- **Next.js 15** (App Router, React 19, TypeScript, `nodejs` runtime for media routes)
- **Tailwind 3** — "modern heirloom" theme (ivory/ink/terracotta/sage, Fraunces + Inter)
- **Supabase** — Postgres + Auth (magic link / Google) + private Storage bucket + Realtime
- **Stripe Checkout** + webhook (`checkout.session.completed`)
- **Resend** (email), **PostHog** (analytics), **Sentry**-compatible monitoring, **Sightengine** (NSFW), **Turnstile** (captcha)
- Media pipeline: **sharp** (re-encode/EXIF-strip/thumb/dHash), **heic-convert**, **archiver** (ZIP), **@react-pdf/renderer** (QR table cards)

### Provider abstraction (the load-bearing design decision)

Every external integration sits behind a typed provider interface with a
working **mock**, selected at runtime by presence of the relevant env key
(`src/lib/config.ts`). With zero keys the whole app builds, runs, and is
end-to-end testable:

| Integration | Real | Mock (no key) |
|---|---|---|
| Data/blobs | Supabase Postgres + Storage | `.data/` JSON + local blob dir, HMAC-signed URLs |
| Payments | Stripe Checkout + webhook | `/mock/checkout` page, identical fulfillment path |
| Email | Resend | writes to `.data/emails/` |
| Moderation | Sightengine | flags only filenames containing `unsafe-test` |
| Captcha | Turnstile | passes (rate limits still apply) |
| Analytics/Monitoring | PostHog / Sentry envelope | console/no-op |

`dataMode` (`memory` | `supabase`) auto-switches on Supabase keys. The
`DataStore` + `BlobStore` interfaces in `src/lib/data/types.ts` are identical
across both implementations (`memory.ts`, `supabase.ts`), so route handlers
never know which backend is live.

## Module map

```
src/
  middleware.ts            Security headers (CSP/HSTS/XFO/…) on every response
  lib/
    config.ts              Env → feature/provider selection; dataMode switch
    data/                  DataStore + BlobStore (types, memory, supabase, index singleton)
    providers/             payments, email, moderation, captcha (each real+mock)
    auth.ts                Magic-link + Google (Supabase SSR); memory-mode HMAC session
    tokens.ts              HMAC sign/verify; scrypt PIN hashing (timing-safe)
    api.ts                 withErrorHandling, parseBody(zod), requireEventOwner (AuthZ)
    ratelimit.ts           Sliding-window limiter + presets + periodic sweep (prune)
    upload-validation.ts   Magic-byte type check, size caps, SVG reject, mp4 duration probe
    image.ts               sharp re-encode (EXIF strip), thumb, dHash, sharpness; limitInputPixels
    phash.ts               dHash + Hamming distance for near-duplicate grouping
    tiers.ts               Pricing/limits/SKUs — SERVER-SIDE source of truth
    lifecycle.ts           Post-event archive/purge/retention email logic
  app/
    api/events/[slug]/     upload, gallery, media/[id], media/bulk, report, settings,
                           checkout, redeem-credit, culling, qr, table-cards, zip, album, slideshow-auth
    api/webhooks/stripe/   Signature-verified, idempotent fulfillment
    api/blob/              Memory-mode signed-URL media server
    api/cron/lifecycle/    CRON_SECRET-gated retention engine
    e/[slug]/              Public guest upload + live slideshow (+ PIN gate)
    dashboard/[slug]/      Host gallery/moderation, settings, share kit, upgrade, success
    (marketing/SEO)        Landing, pricing, 5 programmatic SEO pages, sitemap/robots
supabase/migrations/       0001_init (schema + default-deny RLS), 0002_hardening (indexes + atomic insert)
```

## Data flow — guest upload (the #1 attack surface)

`POST /api/events/[slug]/upload` (public, `nodejs` runtime):

1. Per-IP then per-event sliding-window rate limit.
2. Event exists / active / not archived.
3. Invisible captcha (Turnstile/mock).
4. Tier upload-limit pre-check (cheap) — authoritative enforcement is the
   **atomic** `insertMediaWithinLimit()` at persist time (row-locked count in
   Supabase mode; guarded insert in memory mode).
5. Magic-byte validation (`file-type`), size caps (25MB photo / 100MB video),
   **SVG rejected** (sniffed — `file-type` doesn't detect SVG), mp4/mov
   duration probe.
6. **sharp re-encode** of every image → neutralizes malformed files AND strips
   EXIF/GPS (mandatory privacy). `limitInputPixels: 80M` caps decompression bombs.
7. NSFW/gore moderation → `needsReview` (or host "approve first").
8. Persist under the service role; blob stored at `events/{eventId}/…`.

Reads go through `GET /api/events/[slug]/gallery` (paginated, visibility-aware:
`gallery` public / `own` device-scoped / `host` private) or, in memory mode,
`/api/blob?token=…` which requires a short-lived HMAC-signed, path-scoped URL.

## Authorization model

- **Authentication**: HMAC-signed session cookie (memory mode) or Supabase SSR
  session. `requireUser()` in `auth.ts`.
- **Object-level authorization**: every host-scoped route resolves the event
  then calls `requireEventOwner(eventId)` (`api.ts`), which re-checks
  `event.hostId === user.id` and **fails closed with 404** (no existence leak).
  The ZIP route inlines the same check. Bulk/media routes re-validate every
  id server-side — never trust a client-supplied batch.
- **Public routes** (upload, gallery, report, album signup, slideshow-auth) are
  intentionally unauthenticated and defended by rate limits + captcha + the
  per-event visibility rules.
- **Supabase**: default-deny RLS (`0001_init.sql`); the server uses the service
  role only after the above app-layer checks.

## Payments

Pricing/SKUs are the server's source of truth (`tiers.ts`); the client sends
only intent (a `sku` id), never amounts. Webhook is signature-verified and
idempotent: the webhook event id is claimed before any side effect, the
per-session payment row is the durable idempotency anchor for non-idempotent
steps (pro-pack credit increment, receipt email), and the webhook-id claim is
released on failure so Stripe retries can re-run fulfillment. Pro-pack credit
redemption uses an atomic `redeemCredit()` to close a double-spend race.

## Lifecycle / cron

`api/cron/lifecycle` (CRON_SECRET-gated, scheduled in `vercel.json`) archives
events past their retention window, purges blobs after the grace period, and
sends lifecycle emails (idempotent via `hasSentEmail`/`recordEmailSent`).

## Known scale boundaries (documented, not bugs)

- In-process rate limiter is per-instance — swap for Upstash at multi-region scale.
- CSP still uses `'unsafe-inline'` for Next's inline runtime; nonce migration is future work.
- `insert_media_within_limit` SQL function (0002) is the fully-atomic Supabase
  form; the store currently uses an insert-then-verify compensation until adopted.
