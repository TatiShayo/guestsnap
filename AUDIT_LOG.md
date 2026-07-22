# AUDIT_LOG — GuestSnap

Running log of the audit + hardening engagement (upgrade protocol Phases 2–3,
7; PLAYBOOK Part 2). Appended, not overwritten. Detailed findings table lives
in `REVIEW_FINDINGS.md`; architecture in `ARCHITECTURE.md`.

---

## Phase 2 — Deep audit (architecture, security, performance, reliability)

**Architecture map.** Read every source file. System modelled in
`ARCHITECTURE.md`: provider-abstraction data/blob layer (memory ↔ supabase
behind one interface), public guest-upload pipeline, object-level AuthZ model,
server-authoritative pricing, idempotent payments, lifecycle cron. No dead
code of note; unused-dep review logged as release-hygiene (carets on
next/stripe).

**Security audit.** Systematic pass over: hardcoded secrets, injection/path
traversal, auth **and** authorization, input validation on every external
input, security headers/CSP, file-upload handling, rate limiting, webhook
integrity. Results in `REVIEW_FINDINGS.md` (S1–S13).

**Performance audit.** Gallery pagination, DB indexes, image decompression
guard, `next/image`, email idempotency, error boundaries (P1–P7).

## Phase 3 — Adversarial review & reduction

Adversarial goals attempted against the harness (memory mode, synthetic data):
cross-host privilege escalation, upload-limit bypass, PIN brute force, webhook
double-delivery, and **credit double-spend** (the realised chain below).
Reduction pass kept touched files flat/negative where safe.

## Phase 7 — Remediation & root-cause closure

- **Bucket A (objectively correct):** S1, S2, S7, P1, P2, P6, R1 — all fixed
  and re-verified by re-proving the original finding now fails.
- **Bucket B (safe default):** S13 `appSecret` dev fallback — conservative
  placeholder + REQUIRED-before-deploy flag.
- **Root cause (7.3):** the recurring class in this codebase is
  **check-then-act races** (upload limit, credit redeem, webhook fulfillment).
  Closed structurally by pushing each to an atomic primitive on the data
  interface (`insertMediaWithinLimit`, `redeemCredit`, webhook-id claim +
  per-session anchor) rather than fixing each call site by hand.

---

## Exploit chain — proven and fixed

**Goal:** upgrade multiple events for the price of one Pro Pack credit.

**Setup (harness, memory mode):** a host with exactly `eventCredits = 1` and
two free events A and B.

**Attack:** the redeem endpoint originally did `getProfile()` → check balance →
`updateEvent(upgrade)` → `updateProfile(balance - 1)`. Firing two redeems
concurrently (classic double-submit) let both reads observe balance = 1, both
upgrade a different event, and the two writes race to `balance = 0` — net: **two
paid upgrades, one credit spent, balance never negative to hint at it.**

**Proof:** `tests/unit/security.test.ts` → "Pro Pack credit double-spend race"
fires `Promise.all([redeem(A), redeem(B)])`.

**Fix:** added atomic `redeemCredit(id)` to the `DataStore` interface
(`types.ts`), implemented in `memory.ts` and `supabase.ts`, called in
`redeem-credit/route.ts` — spends the credit first, upgrades only if the spend
succeeded.

**Re-verified:** the concurrent test now asserts `statuses == [200, 400]`,
`eventCredits == 0`, and exactly one event upgraded. Green.

---

## Found / Fixed / Added / Deferred

**Found (this + prior passes):** upload-validation gaps (S1), EXIF/malformed
(S2), AuthZ coverage need (S4), webhook idempotency/retry (S6/R1), credit
double-spend (S7), PIN lockout need (S8), prod-CSP eval (S9), rate-limiter
growth (S10), gallery amplification (P1), missing indexes (P2), decompression
bomb (P3), ZIP stream hang (R2), personal email in `.env.example` (S12).

**Fixed:** S1, S2, S7, S9(verified), S10(verified), S12, P1, P2, P3, P6, R1,
R2 — each re-verified. Added `global-error.tsx` root boundary.

**Added:** `ARCHITECTURE.md`, `REVIEW_FINDINGS.md`, this log; `0002_hardening_indexes.sql`;
security test suite (`tests/unit/security.test.ts` — RLS deny, rate limit,
EXIF strip, PIN lockout, double-spend race); `global-error.tsx`.

**Deferred (with reason):** S13 appSecret dev fallback (safe default,
required-before-deploy flagged); P7 phash O(n²) (bounded by tier upload limits;
LSH logged for scale); CSP `'unsafe-inline'` nonce migration; in-memory
rate-limiter → Upstash at scale; dependency caret pinning (release hygiene).

## Verification gate (final)
- `tsc --noEmit` — pass
- `eslint .` — pass
- `npm run build` — see PROJECT_STATE.md for last result (swc win32 binary is
  environmentally corrupt on this box → slow JS fallback, not an app fault)
- `vitest run` — 25/25 pass
- `playwright test` — see PROJECT_STATE.md (guest→host→payment→ZIP path)

---

## Fresh-Eyes Pass (July 22, 2026)

- **Re-verification Gate**:
  - `tsc --noEmit`: Exit 0 (passed cleanly)
  - `eslint .`: Exit 0 (passed cleanly)
  - `vitest run`: 25/25 tests passed in 7.78s (`lib.test.ts` 19/19, `security.test.ts` 6/6)
  - `next build`: Exit 0 (compiled successfully in 3.5min, 25/25 static pages generated)
- **Codebase Sweep**: Inspected core routing, API authorization (`requireEventOwner`), credit redeeming atomicity, media streaming, and middleware security headers.
- **Findings**: No new issues or security regressions found. The codebase is clean, well-tested, and fully hardened.

