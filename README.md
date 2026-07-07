# GuestSnap

QR photo collection for weddings & events. Guests upload photos/videos from
their phone browser — no app, no account. Hosts pay per event (one-time).

## Stack

Next.js 15 (App Router, TypeScript, Tailwind) · Supabase (Postgres/Auth/Storage/Realtime) · Stripe Checkout · Resend · PostHog · Sentry · Vercel.

**Every integration runs behind a typed provider interface with a working
mock** — the app builds and runs end-to-end with ZERO keys configured:

| Integration | With key | Without key (mock) |
|---|---|---|
| Supabase | Postgres + Storage + Auth | `.data/` file store + HMAC session cookies |
| Stripe | real Checkout + webhook | local `/mock/checkout` page, same fulfillment path |
| Resend | real email | emails written to `.data/emails/` + console |
| PostHog | real analytics | console log in dev, no-op in prod |
| Sentry | envelope API reporting | console only |
| Sightengine | NSFW screening | flags nothing (except filenames containing `unsafe-test`) |
| Turnstile | invisible captcha | check skipped (rate limits still apply) |

## Local development

```bash
npm install
cp .env.example .env.local   # optional — runs fully mocked without it
npm run dev
```

Quality gates: `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`.

## Env vars

See `.env.example` — every variable is documented inline. `NEXT_PUBLIC_*`
values are genuinely public; everything else is server-only. Rotation: rotate
at the provider dashboard, update Vercel env, redeploy.

## NEEDS HUMAN — launch checklist

The build never blocks on these; each step flips a mock to the real provider.

1. **Supabase**: create a project → run `supabase/migrations/0001_init.sql`
   (SQL editor or `supabase db push`) → enable Email (magic link) + Google
   providers under Auth → set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Set the Auth
   redirect URL to `https://<domain>/auth/callback`.
2. **Stripe**: create account → set `STRIPE_SECRET_KEY`,
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → register webhook endpoint
   `https://<domain>/api/webhooks/stripe` for `checkout.session.completed` →
   set `STRIPE_WEBHOOK_SECRET`. Enable **Stripe Tax** and Radar defaults in
   the dashboard. Test locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
3. **Resend**: verify the sending domain → set `RESEND_API_KEY`, `EMAIL_FROM`.
4. **PostHog**: create project → set `NEXT_PUBLIC_POSTHOG_KEY`. Build the
   three funnels listed in `analytics.md`.
5. **Sentry**: create project → set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`.
   Add alert rules for `where: payments.*` and `where: upload.*` tags.
6. **Turnstile**: create a widget (invisible mode) → set
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.
7. **Sightengine** (optional): set `SIGHTENGINE_USER`/`SIGHTENGINE_SECRET`.
8. **Vercel**: import repo → set all env vars (incl. `APP_SECRET` — generate
   with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` —
   and `CRON_SECRET`) → deploy. Vercel cron jobs are defined in `vercel.json`.
9. **Rate limiting at scale**: the in-process limiter is fine for launch on a
   single region; swap `src/lib/ratelimit.ts` for Upstash Ratelimit when
   traffic grows (drop-in interface).
10. Set `ADMIN_EMAILS` to the operator's email(s) for `/admin`.

## Operating cadence (PLAYBOOK 4.5)

Weekly 30 min: review funnel (visits → activation → paid) in `/admin` +
PostHog; pick ONE experiment, ONE retention fix, ONE distribution push.
Kill/scale rule: <$500 revenue after 30 days of real distribution → pivot.

## Repo map

- `src/lib/` — config, typed providers (payments/email/moderation/captcha),
  data layer (`data/` — Supabase + in-memory mock), image pipeline (EXIF
  stripping), rate limits, tokens, tiers/pricing (server-side source of truth)
- `src/app/` — App Router pages & API routes
- `supabase/migrations/` — schema + RLS (default-deny)
- `tests/` — vitest unit tests (`tests/unit`), Playwright e2e (`tests/e2e`)
- `analytics.md` — every PostHog event, documented
- `PROJECT_STATE.md` — build continuity (done / next / needs-human)
