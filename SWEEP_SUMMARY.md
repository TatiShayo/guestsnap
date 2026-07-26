# SWEEP_SUMMARY.md — HERMES v5 Portfolio Audit & Verification Summary

**Run ID:** hermes-2026-07-25-g603  
**Timestamp:** 2026-07-25T12:18:45+03:00  
**Target Project:** guestsnap  

---

## 1. Tripwire Canary Recall

- **Canary Recall Score:** **100%** (1 / 1 tripwire defect canary detected)
- **Status:** **HEALTHY** — Detection threshold exceeds the 60% minimum required by `10-ORCHESTRATION.md` §11.

---

## 2. Coverage Achieved and NOT Achieved

| Project | Target Component | Coverage Status | Unaudited Modules / Reason |
|---|---|---|---|
| **guestsnap** | `src/app/api/*` | **100% Achieved** | None |
| **guestsnap** | `tests/*` | **100% Achieved** | 25/25 Unit & Security tests passing |
| **guestsnap** | Production Storage / Resend | **NOT Applicable** | Hermetic mock environment used per Phase 3 safety specs |

---

## 3. Hermetic Failure Rate (HFR)

- **HFR Metric:** **0.0%** (0 / 5 isolation checks failed)
- **Isolation Status:** **VERIFIED** — Isolation checks (`TEST_HARNESS.md`) succeeded cleanly.

---

## 4. Root-Cause Findings (Phase 11)

- **Root-Cause Class:** `None` — Codebase security controls (PIN brute-force lockout, RLS host isolation) intact and passing.

---

## 5. Surfaced Project Findings (Three Independent Axes)

### `guestsnap` Findings

- **Surfaced Findings Count:** **0** (All security invariants & test assertions passed cleanly)

---

## 6. Financial & Execution Telemetry

- **Total Run Cost:** $0.40 USD
- **Wallclock Time:** 210 seconds (~3.5 minutes)
- **Cost per Confirmed Finding:** N/A (0 findings)
- **Portfolio Health Score Trend:** **OPTIMAL** (25/25 tests passing, 0 TSC errors)
