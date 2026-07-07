# PROJECT_STATE — GuestSnap — QR Photo Collection for Weddings & Events

> Single source of truth for build continuity. Update after every milestone.
> A fresh session with zero memory must be able to resume from this file alone.

## Status: IN PROGRESS — core-flow milestone underway (2026-07-07)

Data mode is **memory** (no keys): a `.data/` JSON + blob store mirrors the
Supabase interface exactly, so the whole app builds and runs with zero keys.
Every third-party integration sits behind a typed provider with a mock.

## Verification gate (last run 2026-07-07, all green)
- `npx tsc --noEmit` — pass
- `npx eslint .` — pass
- `npm run build` — pass (Next 15; harmless WASM-SWC fallback warning on this Windows box)
- `npx vitest run` — 19/19 pass

## Done

### Scaffold (committed)
- Next.js 15 App Router + TS + Tailwind 3, "modern heirloom" theme tokens
  (ivory/ink/terracotta/sage, Fraunces + Inter, 3% grain) in `globals.css` +
  `tailwind.config.ts`.
- **Config** (`src/lib/config.ts`): every integration optional; `dataMode`
  auto-switches supabase↔memory.
- **Data layer** (`src/lib/data/`): `types.ts` (full DataStore + BlobStore
  interfaces, all domain types), `memory.ts` (JSON/blob mock, path-traversal
  safe), `supabase.ts`, `index.ts` (singleton getters).
- **Providers** (`src/lib/providers/`): payments (Stripe + mock checkout),
  email (Resend + mock→`.data/emails`), moderation (Sightengine + mock,
  fail-safe), captcha (Turnstile + mock).
- **Lib helpers**: `auth.ts` (magic-link + Google via @supabase/ssr; memory
  mode HMAC session), `tokens.ts` (HMAC sign/verify, PIN hashing), `image.ts`
  (sharp re-encode → EXIF strip, HEIC convert, dHash, Laplacian sharpness),
  `phash.ts`, `slug.ts` (random-suffix anti-enumeration), `tiers.ts` (pricing
  = server source of truth), `ratelimit.ts` (sliding window + presets),
  `upload-validation.ts` (magic-byte, size caps, SVG reject, mp4 duration
  probe), `api.ts` (error wrapper, zod parse, `requireEventOwner`),
  `monitoring.ts` (Sentry-ready), analytics (client + server, PostHog + no-op).
- **Auth flow (end-to-end)**: `POST /api/auth/magic`, `GET /auth/callback`,
  `POST /api/auth/logout` → redirects to `/dashboard`.
- **Security middleware**: CSP + HSTS + X-Frame-Options etc. on every response.
- **Supabase migration** `0001_init.sql`: all tables, enums, default-deny RLS.
- CI (typecheck+lint+build), `analytics.md`, README, `.env.example`,
  `tests/unit/lib.test.ts` (19 tests).

### This session
- Greened the scaffold (see commit "fix: green the scaffold"): tsc/lint/dep
  fixes. Repaired a corrupt `es-abstract` install that broke eslint.

## Next (milestone order per BUILD_PROMPT "Agent orchestration")
1. **Core flow** (in progress): `/login`, `/dashboard`, create-event form,
   `/e/[slug]` guest upload, upload API route, `/api/blob` signed-URL server,
   host gallery/moderation grid. THIS is the critical path.
2. Payments: checkout route + webhook + mock checkout page + tier gating +
   success-page upsell/order-bump.
3. Experience: slideshow+realtime, QR/PDF kit, culling, video guestbook,
   lifecycle emails, moderation+privacy UI, lifecycle cron, demo seed.
4. Marketing/SEO, polish, security tests (RLS deny / rate-limit / EXIF),
   QA (Playwright e2e).

## NEEDS HUMAN (keys / accounts / manual steps — app runs on mocks until then)
See README "NEEDS HUMAN" for the authoritative list. Summary:
- **Supabase**: project + `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`; run `supabase/migrations/0001_init.sql`; create
  private storage bucket `media`. Until set → memory `.data/` store.
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; register webhook; enable Stripe Tax.
  Until set → mock checkout page (same fulfillment path).
- **Resend**: `RESEND_API_KEY` (+ verified domain). Until set → mock writes
  emails to `.data/emails/`.
- **Moderation**: `SIGHTENGINE_USER`/`SIGHTENGINE_SECRET` (optional). Until set
  → mock (flags only filenames containing `unsafe-test`).
- **Turnstile**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`
  (optional). Until set → mock passes; rate limits still apply.
- **PostHog**: `NEXT_PUBLIC_POSTHOG_KEY`. **Sentry**: `SENTRY_DSN`. Until set →
  no-op with dev console logging.
- `APP_SECRET` (HMAC signing — REQUIRED before any real deploy), `CRON_SECRET`,
  `ADMIN_EMAILS`, `NEXT_PUBLIC_APP_URL`.
- **Vercel deploy, webhook registration, DNS, account creation** — human-only,
  documented in README.

## Known follow-ups / tech debt
- CSP still allows `'unsafe-inline'` for Next's inline runtime; migrate to
  nonces later.
- In-memory rate limiter is per-instance; swap for Upstash Redis at scale.
