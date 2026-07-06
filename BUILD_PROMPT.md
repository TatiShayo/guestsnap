# BUILD: GuestSnap — QR Photo Collection for Weddings & Events (Web App)

## Your role
You are the lead engineer-orchestrator building a production web app from scratch to deployed completion. Do not stop to ask questions — every decision you need is in this document. Where a detail is unspecified, pick the simplest option that ships.

**BINDING COMPANION DOCUMENT**: a universal `PLAYBOOK.md` is supplied alongside this prompt (premium design standards, full security checklist, retention systems, monetization doctrine). Copy it into the repo root and comply with ALL of it — its Definition-of-Done addendum applies to this project.

## Product overview & business model
GuestSnap lets event hosts (weddings, birthdays, funerals, corporate) collect photos/videos from all guests via a QR code — guests upload from their phone browser, NO app download, NO account. Host pays PER EVENT (one-time payment, not subscription). Churn is the business model; revenue comes from a constant stream of new events.
- Free tier: 1 event, 20 photos, GuestSnap watermark on gallery
- Standard $49/event: 500 uploads, live slideshow, ZIP download
- Premium $99/event: unlimited uploads, video guestbook (30s clips), custom branding, AI best-shot culling
Revenue target: first paying customer within 14 days of deploy.

## Tech stack (fixed — do not deviate)
- Next.js 15, App Router, TypeScript, Tailwind CSS, shadcn/ui components
- Supabase: Postgres, Auth (email magic link + Google), Storage (media), Realtime (live slideshow)
- Stripe Checkout (one-time payments) + webhooks
- Resend for transactional email; `qrcode` npm for QR; `sharp` for thumbnails/HEIC→JPEG; `blockhash-core` or perceptual hash for duplicate detection; `archiver` for ZIP streaming
- Deploy: Vercel. Repo: single Next.js app, no monorepo.

## Data model (Supabase, with RLS)
- `profiles` (id=auth.uid, email, name, created_at)
- `events` (id, host_id FK, slug UNIQUE, title, event_date, cover_url, tier enum[free,standard,premium], brand_color, welcome_message, upload_limit int, is_active bool, created_at)
- `media` (id, event_id FK, storage_path, thumb_path, type enum[photo,video], uploader_name text nullable, phash text, is_hidden bool, is_favorite bool, width, height, created_at)
- `payments` (id, event_id, stripe_session_id, amount, tier, status, created_at)
RLS: hosts read/write own events+media; guest upload goes through a server route using service role (validate event is_active + under upload_limit); public read of media only via the event's gallery route.

## Features & implementation
1. **Host onboarding**: magic-link signup → "Create your event" form (title, date, type dropdown: wedding/birthday/funeral/corporate/other, cover image upload). Auto-generate slug (`emma-and-jake-2026`). Free tier active immediately.
2. **QR + share kit**: event dashboard shows QR (PNG + printable PDF table-card template, 4 per A4 page, generated with `@react-pdf/renderer`), short link `guestsnap.app/e/[slug]`.
3. **Guest upload page** (`/e/[slug]`, mobile-first, no auth): welcome message + host cover, "Add your photos" → multi-file input (accept image/video), client-side compression (browser-image-compression), HEIC handled server-side via sharp, optional "your name" field, upload progress bars, uploads go to server route → Supabase Storage → insert media row. Enforce limits by tier; when limit hit show "Ask the host to upgrade" (growth loop).
4. **Live slideshow** (`/e/[slug]/live`): fullscreen, auto-advancing, Ken Burns effect, subscribes to Supabase Realtime inserts so new photos appear within seconds. Designed to be cast to a TV at the event. Watermark on free tier.
5. **Host gallery/moderation**: grid with lazy loading, hide/delete/favorite, filter by uploader, bulk select.
6. **ZIP download**: server route streams all originals via archiver (Standard+).
7. **Video guestbook** (Premium): guest records ≤30s clip via MediaRecorder API, dedicated "Guestbook" tab in gallery.
8. **AI culling** (Premium): compute perceptual hash on upload; group near-duplicates (hamming distance ≤10); within a group auto-pick sharpest (variance of Laplacian via sharp stats) as "best shot"; UI shows groups with best-shot pre-selected for export.
9. **Payments**: "Upgrade event" → Stripe Checkout (one-time). Webhook `checkout.session.completed` → update event tier + upload_limit. Send receipt + confirmation via Resend.
10. **Post-event email**: cron (Vercel cron) day after event_date → email host stats + download link + "Create another event" CTA + 20% referral code.
11. **Marketing site + programmatic SEO**: landing page (hero with live demo event, pricing table, FAQ, testimonials placeholder) + SEO pages generated from a JSON list: `/wedding-photo-sharing-app`, `/qr-code-wedding-photos`, `/funeral-photo-sharing`, `/birthday-party-photo-collection`, `/corporate-event-photo-sharing`, each 600+ words unique copy, FAQ schema markup, CTA. Write the copy yourself, benefit-led, not keyword-stuffed.

12. **Content safety & moderation (required — guests upload publicly visible media)**: server-side NSFW screening on every upload behind a typed provider interface (Sightengine API, or nsfwjs server-side as free fallback); flagged media auto-hidden pending host review. Host setting: "Approve uploads before they appear" toggle. Report button on every gallery/slideshow item; ≥1 report auto-hides pending host review.
13. **Privacy controls**: per-event visibility setting — (a) guests see full gallery, (b) guests see only their own uploads, (c) host-only; optional 4-digit PIN on the live slideshow URL; "hide uploader names" toggle.
14. **Guest album loop (growth engine)**: after uploading, guest sees "Want the full album? We'll email it when the host publishes" → email capture → post-event email with gallery link + "Host your own event free" CTA. This turns every event's guests into future hosts.
15. **Event lifecycle & storage cost control**: free events auto-archive 90 days after event_date (warning email at day 75 with download reminder); paid events keep media 12 months. Vercel cron job handles purge; deletion is soft (30-day grace) then hard.
16. **Seeded demo event**: landing page links to a real, read-only demo event pre-populated with AI-generated sample photos so visitors experience the guest flow before paying. Seed script included in repo.

## Premium UI & motion direction (follow PLAYBOOK Part 1 + this art direction)
**Concept: "modern heirloom"** — feels like beautiful wedding stationery brought to life, not a SaaS tool.
- Palette: ivory canvas #FAF8F5, ink #1C1917, terracotta accent #C1502E, muted sage secondary; 3% paper-grain texture on large surfaces. Type: Fraunces (display, tight tracking, big) + Inter (body). Photography is the hero — chrome recedes.
- **Signature interaction — the live slideshow**: cinematic crossfades with slow Ken Burns drift, uploader name set in italic Fraunces as a caption, new arrivals enter with a gentle scale-settle. This screen will be on a TV at real weddings — it must look like a rented $500 service.
- Upload moment: guest photos "drop onto a stack" with spring physics and slight polaroid tilt; progress shown as the photo developing (opacity/contrast ramp), not a bar. Success = soft haptic-feel bounce + warm serif toast ("Emma will love these.").
- Host dashboard is reactive: live photo-count odometer, "3 guests uploading now" presence indicator (Supabase presence), gallery tiles lift on hover with deepening soft shadow; lightbox with momentum swipe.
- QR table cards (the printable PDF) are designed like letterpress stationery — 3 style variants (classic serif, modern minimal, playful). Hosts will photograph these for Instagram; they're marketing.
- Empty states: fine line-art (envelope, picture frame) + one action. Guest page loads <2s on 4G, fully one-handed. No purple gradients, no glassmorphism, no emoji UI.

## Security (project-specific threat model — PLAYBOOK Part 2 applies in full)
- The guest upload endpoint is PUBLIC and the #1 attack surface: per-IP + per-event rate limits, 25MB cap enforced server-side, magic-byte type verification, re-encode every image via sharp (**strips guests' EXIF/GPS — mandatory privacy measure**), reject SVGs, cap video duration (45s) and size, invisible Turnstile on the upload route.
- Media privacy: private storage buckets only; all media served via short-lived signed URLs issued after an event-access check; no bucket listing; event slugs get a random 4-char suffix (`emma-jake-x7k2`) against enumeration.
- Slideshow PIN: hashed, attempt-rate-limited (5/min), lockout with friendly copy.
- ZIP export authorizes the host session server-side and streams — no temp files in public paths.
- Stripe: signature-verified idempotent webhooks; tier/price mapping server-side only.
- Moderation/admin surfaces allowlist-gated and audit-logged.

## Retention & repurchase engine (churn-by-design — PLAYBOOK 3.4)
- Email capture at both value moments: guests ("send me the album") and hosts (account). Tag by event type.
- Host sequence: post-event thank-you + stats → NPS → "planning another event?" at 3 months → event-anniversary email at 11 months ("One year! Throw a party?") with a returning-host discount.
- Guest→host conversion: album email footer "Host your own event free"; every public gallery and slideshow carries tasteful "Powered by GuestSnap" attribution (free tier) — outputs are the marketing.
- Photographer/planner detection: 2+ events in 90 days triggers an email about the Pro pack (see revenue) — these are the whales.

## Revenue maximization (PLAYBOOK Part 4 applies)
- Checkout order bump: "+$19 — keep photos 24 months instead of 12" (near-zero cost, one checkbox).
- Post-purchase one-click upsell: Standard buyers offered Premium delta ($50) on the success page.
- **Pro Pack SKU: 3 events for $99** (targets planners/photographers — recurring buyers, the real LTV).
- Referral: hosts get $10 off next event per referred host; shown on the post-event stats email (peak happiness).
- Stripe Tax on; guarantee ("not thrilled? full refund") on the pricing page; one-click refund in admin.

## Cross-cutting requirements (non-negotiable)
- **Analytics**: PostHog from day one. Instrument the full funnel — signup, event created, QR downloaded, first guest upload, upgrade viewed, upgrade paid, ZIP downloaded. Add an internal `/admin` page (email-allowlist gated) showing revenue, events created/day, free→paid conversion rate, storage used.
- **Error monitoring**: Sentry on client and server; payment-path and upload-path errors must alert.
- **Payments hygiene**: Stripe webhooks idempotent (persist processed event ids); enable Stripe Tax; receipt emails on every charge.
- **Legal & privacy**: real Privacy Policy + Terms pages in plain language. GuestSnap hosts photos of identifiable people, including minors — state clearly: host is data controller, guests consent by uploading, deletion requests honored within 30 days (self-serve delete for hosts, documented email process for guests), EU-friendly wording.
- **Build continuity**: maintain `PROJECT_STATE.md` at repo root — update after every milestone with what's done / what's next / what needs the human (keys, accounts, DNS). Assume the build may resume in a fresh session with zero memory.
- **Never stall on missing keys**: every third-party integration sits behind a typed provider interface with a mock implementation; if a key is missing, run the mock, log it under "NEEDS HUMAN" in PROJECT_STATE.md, and keep building.
- **Placeholder honesty**: testimonials/social proof must be clearly marked placeholder in code — never ship invented customer quotes as real.
- Extra env vars: NEXT_PUBLIC_POSTHOG_KEY, SENTRY_DSN, SIGHTENGINE_USER/SECRET (optional, mock fallback).

## Agent orchestration
Run this as an orchestrated build with a task list. Spawn/execute in this order:
1. **Scaffold agent**: Next.js + Tailwind + shadcn init, Supabase schema migration files, env wiring, PostHog + Sentry wiring, PROJECT_STATE.md, CI (typecheck+lint+build on push).
2. **Core flow agent**: host auth → create event → guest upload → gallery (the critical path, end-to-end, deployed to preview before anything else).
3. **Payments agent**: Stripe checkout + webhook + tier gating. Test with Stripe CLI.
4. **Experience agents (parallel)**: slideshow+realtime; QR/PDF kit; culling; video guestbook; emails; moderation + privacy controls; event lifecycle cron; demo-event seed script.
5. **Marketing agent**: landing + SEO pages + OG images.
6. **Polish agent**: full-app motion/micro-interaction pass, slideshow signature-interaction tuning, empty/error states, then run the PLAYBOOK screenshot test on every screen and redo failures.
7. **Security agent**: execute PLAYBOOK Part 2 + the project threat model above as a checklist; write the RLS deny-test, rate-limit script test, EXIF-strip verification.
8. **QA agent**: Playwright e2e — signup→create event→guest uploads 3 photos→upgrade (test mode)→ZIP download; mobile viewport tests on the guest page; fix all failures.
9. **Deploy agent**: Vercel production deploy, env vars documented in README, Stripe webhook registered, smoke test on prod URL.
After each agent completes, verify build passes before proceeding. Commit at every milestone with clear messages.

## Env vars required (document in README, use placeholders)
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, RESEND_API_KEY, NEXT_PUBLIC_APP_URL

## Definition of done
- Deployed on Vercel, all e2e tests green
- A stranger can: create event → print QR → 5 guests upload from phones → live slideshow updates in realtime → host pays (test mode) → downloads ZIP
- Lighthouse mobile ≥85 on guest page; SEO pages indexed-ready (sitemap.xml, robots.txt, metadata)
- README with setup, env vars, Stripe/Supabase config steps, and a launch checklist

## Out of scope v1 (do NOT build)
Native apps, guest accounts, photo editing, prints/physical products, multi-language, team seats.

