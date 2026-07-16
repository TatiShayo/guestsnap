# REVIEW_FINDINGS — GuestSnap

Consolidated audit findings across the security/performance/reliability sweep
(upgrade protocol Phases 2–3, 7; PLAYBOOK Part 2). Every item has a status:
**FIXED** (code changed + verified), **VERIFIED** (already correct, confirmed
this pass), or **DEFERRED** (documented, safe default in place). Line-level
findings from the earlier DeepSeek pass are tracked in `deepseek.md`.

## Severity legend
🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · ✅ Verified-clean

---

## Security

| # | Sev | Area | Finding | Status |
|---|-----|------|---------|--------|
| S1 | 🔴 | Upload | Public upload endpoint needed defense-in-depth: server-side 25MB cap, magic-byte type check (not extension/declared-mime), SVG rejection, and a race-free upload-limit. | **FIXED** — `upload-validation.ts` sniffs SVG + verifies magic bytes via `file-type`, enforces `PHOTO_MAX_BYTES`/`VIDEO_MAX_BYTES`; `insertMediaWithinLimit()` is atomic (row-locked in SQL `insert_media_within_limit`, guarded in memory). Orphan blobs cleaned on lost race. |
| S2 | 🔴 | Upload | Malformed-file / decompression-bomb + EXIF-GPS leakage via original bytes. | **FIXED** — every image is `sharp` re-encoded to JPEG (`image.ts`), which strips EXIF/GPS and neutralizes malformed inputs; `limitInputPixels: 80_000_000` caps decompression bombs. Covered by `security.test.ts` EXIF-strip test. |
| S3 | 🟠 | XSS | Guest-controlled `uploaderName`, `welcomeMessage`, event `title` rendered in host dashboard / guest page. | **VERIFIED clean** — all rendered through React's default text escaping; no `dangerouslySetInnerHTML` on user data (only use is JSON-LD via `JSON.stringify` in `faq.tsx`). Inputs also length-capped server-side (`uploaderName` 60, `uploaderKey` 64). SVG upload (stored-XSS vector) rejected at S1. |
| S4 | 🟠 | AuthZ | Object-level authorization must be enforced on every host-scoped event route, not just authentication. | **VERIFIED/FIXED** — `requireEventOwner()` (`api.ts`) re-checks `hostId` and fails closed with 404 on: media/[id], media/bulk, settings, checkout, redeem-credit, culling, qr, table-cards. ZIP route inlines the check. Public routes (upload/gallery/report/album/slideshow-auth) intentionally unauth + rate-limited. Cross-host deny proven in `security.test.ts`. |
| S5 | 🟠 | Media access | Blob URLs must expire and be scoped, not publicly listable. | **VERIFIED** — memory-mode `/api/blob` requires a short-lived (900s) HMAC-signed token encoding the exact blob path (`events/{eventId}/…`); Supabase mode uses Supabase signed URLs. No unsigned/enumerable access. |
| S6 | 🟠 | Payments | Stripe webhook signature + idempotency under retries/double-delivery. | **VERIFIED/FIXED** — signature verified in provider; webhook-id claimed before side effects; per-session payment row gates non-idempotent steps; claim released on failure so retries can re-run. |
| S7 | 🟠 | Payments | Pro-pack credit double-spend via concurrent redeem (check-then-act). | **FIXED** — atomic `redeemCredit()` spends before upgrade; concurrent double-redeem test proves exactly one succeeds (`security.test.ts`). This is the proven exploit chain (see AUDIT_LOG.md §Exploit chain). |
| S8 | 🟠 | Brute force | Slideshow PIN needs lockout, not just per-request check. | **VERIFIED** — scrypt-hashed PIN, timing-safe compare, 5/min per-IP lockout (`LIMITS.pinPerIp`); 6th attempt rejected 429 even with correct PIN. Test in `security.test.ts`. |
| S9 | 🟠 | Headers/CSP | Production CSP must not carry dev-only `'unsafe-eval'`. | **VERIFIED** — `middleware.ts` adds `'unsafe-eval'` only when `NODE_ENV !== 'production'`; full header set (CSP, HSTS, XFO, nosniff, Referrer-Policy, Permissions-Policy) on every response; `frame-ancestors 'none'`, `object-src 'none'`. |
| S10 | 🟡 | DoS | In-memory rate limiter map could grow unbounded. | **VERIFIED** — periodic `sweep()` prunes empty windows every 60s; keys self-expire. |
| S11 | 🟡 | Robustness | `JSON.parse` of token body / mock webhook body could throw 500 on tampering. | **VERIFIED** — `verifyToken` guards parse and returns null; mock payment parse guarded. |
| S12 | 🟠 | Secrets | `.env.example` contained a real personal admin email. | **FIXED (prior pass)** — placeholder. Git-history secret scan: no live secrets committed. |
| S13 | 🟡 | Config | `appSecret` falls back to `dev-only-change-me`. | **DEFERRED** — documented as REQUIRED-before-deploy in README/PROJECT_STATE; mock/dev only. Safe default (never a real secret). |

## Performance

| # | Sev | Area | Finding | Status |
|---|-----|------|---------|--------|
| P1 | 🟠 | Gallery | Public gallery/live-poll could load an entire event's media each request. | **FIXED** — `gallery/route.ts` paginates (`limit`/`offset`) and caps the `since` live-poll path at `PAGE_MAX`, bounding a public endpoint against amplification. |
| P2 | 🟠 | DB | Missing indexes on hot access paths. | **FIXED** — `0002_hardening_indexes.sql`: partial index on public feed `(event_id, created_at desc) where not hidden/pending`, uploader-key, needs-review, payments-by-user, lifecycle scan. |
| P3 | 🟡 | Image | sharp decompression-bomb guard. | **FIXED** — `limitInputPixels` (see S2). |
| P4 | 🟡 | Frontend | Gallery images should use `next/image`. | **VERIFIED** — `gallery-grid.tsx` uses `next/image`; `next.config.ts` sets `remotePatterns` for Supabase + localhost. |
| P5 | 🟡 | Email | Lifecycle/receipt emails must not double-send. | **VERIFIED** — `hasSentEmail`/`recordEmailSent` idempotency keyed on (kind, recipient, eventId). |
| P6 | 🟡 | Reliability | Error boundaries. | **FIXED** — route-level `app/error.tsx` (reports to `/api/monitoring`) plus new `app/global-error.tsx` catching root-layout failures. |
| P7 | 🟡 | Culling | `phash` O(n²) pairwise compare + double-iteration in culling route. | **DEFERRED** — acceptable at per-event photo counts (bounded by tier upload limits); LSH bucketing logged for scale. |

## Reliability / correctness

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| R1 | 🟠 | Webhook fulfillment failure permanently deduping the retry (paid-but-unfulfilled). | **FIXED** — claim released on failure (S6). |
| R2 | 🟡 | ZIP download route passed a Node stream straight into `Response` → hung forever. | **FIXED (prior pass)** — `Readable.toWeb()`. |
| R3 | 🟡 | Generic client error messages (no `error.message` leaks). | **VERIFIED** — `withErrorHandling` returns generic codes; details go to monitoring. |

## Deferred (documented, safe defaults in place)
- S13 `appSecret` dev fallback — REQUIRED-before-deploy, flagged in README.
- P7 phash O(n²) — bounded by tier limits; LSH for scale.
- CSP `'unsafe-inline'` for Next inline runtime — nonce migration is future work.
- In-memory rate limiter is per-instance — swap for Upstash at multi-region scale.
- Dependency caret ranges (next/stripe) — pinning is a release-hygiene follow-up.
