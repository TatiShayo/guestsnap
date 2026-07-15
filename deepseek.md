# guestsnap — DeepSeek Audit

**Date:** 2026-07-13
**Path:** `C:\Users\TATI\Desktop\DEV\guestsnap\`
**Stack:** TypeScript / Next.js 15 + Supabase + Stripe
**Tier:** 2 — High
**Dependencies:** None installed

---

## 🔴 Security Vulnerabilities

| Severity | File | Line(s) | Vulnerability | Exact Fix |
|----------|------|---------|---------------|-----------|
| 🟠 HIGH | `.env.example` | — | **`ADMIN_EMAILS=tatibaraka@gmail.com`** — real personal email exposed in repo. Template files should use placeholder emails. | Change to `ADMIN_EMAILS=admin@example.com` or `ADMIN_EMAILS=your-email@example.com`. |
| 🟡 MEDIUM | `src/lib/tokens.ts` | 30 | `JSON.parse(fromB64url(body).toString("utf8"))` — token body parsed without try-catch. If token is tampered with, crashes with 500. | Wrap in try-catch: if parse fails, return `verifyToken(...)` as null. |
| 🟡 MEDIUM | `src/lib/providers/payments.ts` | 156 | `JSON.parse(rawBody)` — mock Stripe body parsed without try-catch. | Wrap in try-catch. |
| 🟡 MEDIUM | `playwright.config.ts` | 49 | `APP_SECRET: "e2e-test-secret-do-not-use-in-prod"` — test secret. Fine. | — |
| 🟡 MEDIUM | `tests/setup.ts` | 12 | Same test secret fallback. Fine. | — |
| ✅ | `src/lib/auth.ts` | — | HMAC-signed session tokens, `scryptSync` for PIN hashing. Timing-safe comparison. Good. | — |
| ✅ | `src/app/api/events/[slug]/slideshow-auth/route.ts` | — | PIN verification with scrypt, rate-limited per IP. Good. | — |
| ✅ | `src/app/api/events/[slug]/upload/route.ts` | — | Per-IP + per-event rate limits + Turnstile CAPTCHA. Upload validation (MIME, SVG detection, EXIF stripping). Good. | — |
| ✅ | `src/app/auth/callback/route.ts` | — | OAuth callback sets signed session cookie with secure flags. Good. | — |

---

## 🟠 Performance Issues

| Severity | File | Line(s) | Issue | Exact Fix |
|----------|------|---------|-------|-----------|
| 🟠 HIGH | `src/lib/phash.ts` | 56-64 | **O(n²) pairwise Hamming distance comparison.** For 200 photos = 19,900 comparisons blocking the event loop. | Use Locality-Sensitive Hashing (LSH) buckets or multi-index hashing. Alternatively, offload to a Web Worker or background job. At minimum, chunk processing with `setTimeout(0)` between batches to yield to event loop. |
| 🟡 MEDIUM | `src/app/api/events/[slug]/culling/route.ts` | 40-45 | `toMediaViews` called twice with two `.map().filter()` chains iterating same arrays. | Combine into one pass. |
| 🟡 MEDIUM | `src/app/dashboard/[slug]/gallery-grid.tsx` | 71 | `filtered` recomputed on every render but depends on stable state. | Wrap in `useMemo`. |
| ✅ | `src/app/dashboard/[slug]/gallery-grid.tsx` | — | Already uses `useMemo` for uploaders and filtered views. Good. | — |

---

## 🟡 UI/UX Improvements

| Severity | File | Line(s) | Issue | Exact Fix |
|----------|------|---------|-------|-----------|
| 🟡 MEDIUM | `src/app/e/[slug]/page.tsx` | 40 | Empty `alt=""` on cover image — should be descriptive. | Add `alt="Event cover photo for {eventName}"`. |
| 🟡 MEDIUM | `src/app/e/[slug]/guest-uploader.tsx` | 233 | Empty `alt=""` on guest upload preview. | Add `alt="Photo upload preview"`. |
| 🟡 MEDIUM | `src/app/dashboard/[slug]/gallery-grid.tsx` | 261 | Empty `alt=""` on gallery images — should be descriptive or have generated alt text. | Generate alt from upload metadata: `alt="Photo uploaded by {uploader}"`. |
| 🟡 MEDIUM | `src/app/dashboard/[slug]/culling-panel.tsx` | 112 | Empty `alt=""` on culling panel thumbnails. | Add descriptive alt text. |
| 🟡 MEDIUM | Missing | — | No `loading.tsx` for dashboard sub-routes. | Add loading skeletons. |
| 🟡 MEDIUM | `src/lib/pdf/table-card.tsx` | 24-26 | Hardcoded colors in PDF table card. | Tokenize. |
| ✅ | `src/app/globals.css` | 54-56 | Focus ring, `:focus-visible` styles. Good. | — |
| ✅ | Components | — | ARIA labels on interactive elements (`role="switch"`, `aria-checked`, `aria-label`, `aria-modal`, `role="dialog"`). Good. | — |
| ✅ | `src/app/dashboard/[slug]/gallery-grid.tsx` | — | `useMemo` for filtered views and uploaders. Good. | — |

---

## 🔧 Session: 2026-07-14 — Multi-Agent Deep Audit Sweep (Round 1)

### Audit findings (no code changes needed)

| Severity | Finding | Status |
|----------|---------|--------|
| 🟡 MEDIUM | `appSecret` fallback `"dev-only-change-me"` in `src/lib/config.ts` — should throw in production | Deferred |
| ✅ | Stripe/Supabase/Resend keys — all use empty string fallback → mock providers. Correct pattern. | Clean |
| ✅ | Full security headers via middleware (CSP, HSTS, X-Frame-Options, Permissions-Policy) | Clean |
| ✅ | No `error.message` leaks — `withErrorHandling()` wrapper returns generic messages | Clean |
| ✅ | Playwright e2e tests, vitest, comprehensive tooling | Clean |
| 🟡 | Missing mock-kill guard in production webhook (VisaShot pattern) | Deferred |

| Category | Package | Issue | Fix |
|----------|---------|-------|-----|
| 🟡 MEDIUM | `next ^15.3.0` | Loose caret. | Pin. |
| 🟡 MEDIUM | `stripe ^17.7.0` | Loose caret. | Pin. |
| 🟡 MEDIUM | `heic-convert ^2.1.0` | Wraps native binaries — platform-specific issues in CI/Docker. | Consider pure-JS HEIC decoder or ensure Docker image has required system libs. |
| 🟡 MEDIUM | `archiver ^7.0.1` | ~300KB for ZIP downloads. | Evaluate if lighter alternative works or if this is justified by ZIP features needed. |
| 🟡 MEDIUM | `tailwindcss ^3.4.17` | Mix of Tailwind 3 and 4 across projects — inconsistent. | Consider upgrading to Tailwind 4 for consistency with other projects. |
| ✅ | Dev deps | Playwright, vitest, comprehensive scripts. Good. | — |

---

## 📋 Priority Fix Queue

1. **[HIGH — Personal Email]** `.env.example` — Change `ADMIN_EMAILS=tatibaraka@gmail.com` to placeholder `your-email@example.com`.
2. **[HIGH — O(n²) Phash]** `src/lib/phash.ts:56-64` — Implement LSH or chunked processing with event loop yielding.
3. **[MEDIUM — JSON.parse]** `src/lib/tokens.ts:30` — Wrap token body JSON.parse in try-catch.
4. **[MEDIUM — JSON.parse]** `src/lib/providers/payments.ts:156` — Wrap mock payment JSON.parse in try-catch.
5. **[MEDIUM — Empty Alt Text]** `src/app/e/[slug]/page.tsx:40`, `guest-uploader.tsx:233`, `gallery-grid.tsx:261`, `culling-panel.tsx:112` — Add descriptive alt text.
6. **[MEDIUM — Loading States]** Add `loading.tsx` to dashboard sub-routes.
7. **[MEDIUM — Dependencies]** Evaluate `heic-convert` native dep risks in CI. Consider Tailwind 4 upgrade.
