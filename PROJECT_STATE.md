# PROJECT_STATE — GuestSnap — QR Photo Collection for Weddings & Events

> Single source of truth for build continuity. Update after every milestone.
> A fresh session with zero memory must be able to resume from this file alone.

## Status: AUDITED & HARDENED (2026-07-16) — full audit+hardening pass complete; e2e path (guest→host→payment→ZIP) verified. See ARCHITECTURE.md / REVIEW_FINDINGS.md / AUDIT_LOG.md.

### Audit/hardening pass (2026-07-16)
Delivered the upgrade-protocol (Phases 2–3, 7) + PLAYBOOK Part 2 sweep:
- **Docs**: `ARCHITECTURE.md`, `REVIEW_FINDINGS.md` (every finding + status),
  `AUDIT_LOG.md` (found/fixed/added/deferred + proven exploit chain), portfolio README.
- **Security (all verified/fixed)**: upload route (25MB cap + magic-byte +
  server-side SVG reject + atomic upload-limit), EXIF/GPS strip + decompression
  guard, no XSS (React escaping; SVG rejected; inputs capped), object-level AuthZ
  on every host route + expiring signed blob URLs, webhook sig + idempotency +
  retry-safe fulfillment, slideshow PIN lockout, prod CSP (no dev eval), rate-limiter pruning.
- **Perf**: gallery pagination, DB indexes (`0002`), sharp `limitInputPixels`,
  `next/image`, email idempotency, error boundaries (route + new root `global-error.tsx`).
- **Exploit chain proven+fixed**: Pro Pack credit double-spend (atomic `redeemCredit`),
  tested concurrently in `security.test.ts`.
- **Gate**: tsc pass · eslint pass · vitest 25/25 · build compiled successfully · playwright e2e.

---

## Status (prior): e2e-verified (2026-07-11) — full guest→host→payment→ZIP path passes Playwright; see DoD scorecard below

Data mode is **memory** (no keys): a `.data/` JSON + blob store mirrors the
Supabase interface exactly, so the whole app builds and runs with zero keys.
Every third-party integration sits behind a typed provider with a mock.

## Verification gate (last run 2026-07-11, all green)
- `npx tsc --noEmit` — pass, no errors
- `npx eslint .` — pass, no errors
- `npx vitest run` — 24/24 pass (2 files: `lib.test.ts`, `security.test.ts` —
  RLS-style cross-host deny, slideshow PIN lockout, EXIF/GPS strip)
- `npx playwright test` — 1/1 pass: signup (memory-mode dev magic-link) →
  create event → guest uploads 2 photos on iPhone 13 viewport → host sees
  them in gallery → upgrade via mock checkout → ZIP route returns 200
  `content-type: zip`. Runs against `next dev` (not `next start`) per
  `playwright.config.ts` comments — memory-mode dev-link only appears
  outside production, and prod build is ~8min on this box.
- Real bug found + fixed by this run: `src/app/api/events/[slug]/zip/route.ts`
  passed the Node `PassThrough` stream straight into `new Response()` (cast,
  not converted) — Next's Response never pumped it, so every ZIP download
  hung forever. Fixed with `Readable.toWeb(pass)`. Also bumped
  `playwright.config.ts` test timeout 120s→300s: this box's broken
  `@next/swc-win32-x64-msvc` native binary ("not a valid Win32 application")
  forces a slower fallback path, and cold `next dev` compiles across 6+
  distinct routes in one serial test occasionally exceeded 120s even with a
  correct app. The swc binary corruption itself is environmental (Windows
  box), not an app bug — worth a `node_modules` reinstall if it recurs.

## Definition-of-Done status (BUILD_PROMPT "Definition of done", verified 2026-07-11)
- "Deployed on Vercel, all e2e tests green" — **REMAINING**: e2e tests are
  green (see above); Vercel deploy is NOT done — repo has no git remote
  configured at all (`git remote -v` empty) in this workspace, so nothing
  has been pushed anywhere, let alone deployed. Human must create the repo
  remote, Vercel project, and run the deploy.
- "A stranger can: create event → print QR → 5 guests upload from phones →
  live slideshow updates in realtime → host pays (test mode) → downloads
  ZIP" — **DONE for the core path**, verified by the Playwright spec above
  (2 guest uploads, not 5 — the spec is intentionally lighter for CI speed;
  the upload endpoint itself has no hard cap under 5 and this was smoke
  tested manually alongside the fix work). Live slideshow route
  (`/e/[slug]/live`) and QR/table-card routes
  (`/api/events/[slug]/qr`, `.../table-cards`) exist and are exercised by
  the vitest/security suite indirectly, but realtime-update-on-TV and
  actual QR-print behavior were NOT manually verified this session — mark
  **REMAINING** (needs human eyes on the live slideshow with a second
  device, or a dedicated Playwright test).
- "Lighthouse mobile ≥85 on guest page; SEO pages indexed-ready (sitemap.xml,
  robots.txt, metadata)" — **PARTIAL**: `src/app/sitemap.ts` and
  `src/app/robots.ts` exist and the 5 programmatic-SEO pages
  (`/wedding-photo-sharing-app`, `/qr-code-wedding-photos`,
  `/funeral-photo-sharing`, `/birthday-party-photo-collection`,
  `/corporate-event-photo-sharing`) exist with page-level metadata.
  Lighthouse itself was never run (no lighthouse config/CI step found
  anywhere in the repo) — **REMAINING**, needs a human or CI run against a
  deployed URL (Lighthouse against `next dev` is not representative).
- "README with setup, env vars, Stripe/Supabase config steps, and a launch
  checklist" — **DONE**: README documents env vars and a "NEEDS HUMAN"
  section (mirrored below); not independently re-audited line-by-line this
  session.

### Feature checklist vs. BUILD_PROMPT §"Features & implementation" (spot-checked by file presence this session, not fully re-tested)
- Host onboarding, QR+PDF kit, guest upload, gallery/moderation, ZIP —
  **DONE**, e2e-verified end to end (login→event→upload→gallery→ZIP).
- Live slideshow (`src/app/e/[slug]/live/`), video guestbook
  (`src/app/e/[slug]/guestbook-recorder.tsx`, MediaRecorder-based), AI
  culling (`src/app/api/events/[slug]/culling/route.ts`) — code exists,
  **NOT independently re-verified this session** (no dedicated e2e coverage
  for these three; only the vitest unit suite touches adjacent code).
- Payments (Stripe + mock checkout, webhook idempotency), post-event
  lifecycle cron (`src/app/api/cron/lifecycle`), demo seed script
  (`scripts/seed-demo.ts`), admin page (`src/app/admin/page.tsx`) — code
  exists; payments mock path is e2e-verified (upgrade→success→ZIP unlock),
  the rest **NOT independently re-verified this session**.
- Content safety/moderation, privacy controls (visibility modes, slideshow
  PIN, hide-uploader-names), retention engine — **DONE**, directly covered
  by `tests/unit/security.test.ts` (RLS-style deny, PIN lockout, EXIF/GPS
  strip) which passes.

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
- Landed login, `/dashboard`, create-event form, `/e/[slug]` guest upload
  (client compression, "drop onto stack" progress via opacity/contrast
  ramp), upload API route (rate-limited, magic-byte, sharp re-encode/EXIF
  strip, moderation, tier-limit), `/api/blob` signed-URL server, album-email
  capture (growth loop).
- **Core flow milestone DONE**: `/dashboard/[slug]` host gallery/moderation
  grid (lazy-loaded tiles, filter by uploader/needs-review/favorites/hidden/
  guestbook, single + bulk hide/show/favorite/approve/delete, lightbox).
  New API routes: `PATCH`/`DELETE /api/events/[slug]/media/[id]`, `POST
  .../media/bulk` (object-owner-checked, ids re-validated server-side —
  never trusts a client-supplied batch), `POST .../report` (public,
  rate-limited guest report button — PLAYBOOK content-safety requirement).
  End-to-end verified by code path: create event -> guest uploads ->
  host sees/moderates in gallery. (No browser smoke test run this session —
  see NEEDS HUMAN / next-session TODO: manual click-through or Playwright.)

## Next (milestone order per BUILD_PROMPT "Agent orchestration")
1. ~~Core flow~~ — DONE.
2. ~~Payments~~ — DONE: `/api/events/[slug]/checkout`, `/api/checkout/pro-pack`,
   `/api/webhooks/stripe` (idempotent), `/mock/checkout`, upgrade panel +
   success page (one-click upsell + referral card) + Pro Pack CTA +
   credit-redeem route.
3. **Experience** (starting now): slideshow+realtime, QR/PDF kit, culling,
   video guestbook, lifecycle emails, moderation+privacy UI, lifecycle cron,
   demo seed.
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
  documented in README. **No git remote exists in this workspace at all** —
  the repo has never been pushed anywhere; this must happen before any
  deploy step is possible.
- **Lighthouse mobile score on `/e/[slug]`** — never run; requires a real
  deployed URL (running it against `next dev` is not representative of
  production performance). Target ≥85 per BUILD_PROMPT DoD.
- **Live slideshow real-device check** — `/e/[slug]/live` realtime-update
  behavior (new photo appears within seconds when cast to a second
  screen/TV) has code but no e2e or manual verification this session.
- **Video guestbook (MediaRecorder) and AI culling** — code exists
  (`guestbook-recorder.tsx`, `culling/route.ts`) but neither has dedicated
  test coverage; only spot-checked by file presence this session.

## Known follow-ups / tech debt
- CSP still allows `'unsafe-inline'` for Next's inline runtime; migrate to
  nonces later.
- In-memory rate limiter is per-instance; swap for Upstash Redis at scale.
