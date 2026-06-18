# Mimaric — Outstanding Work Report

> **Updated 2026-06-18, post-v4.33.0.** The prior Sections B + C (the tracked tails after v4.32.0)
> are now **closed** by v4.33.0. See `CHANGELOG.md` for per-item detail. This file now tracks only
> the three indefinitely-deferred programs (Section A) and two small, explicitly-tracked tails (Section B).

---

## ✅ Closed in v4.33.0 (for reference — not outstanding)
- **C: I2** payment reversal UI · **I1** payment-correctness-test imports the real ledger helpers · **H8** per-tenant blind index (HKDF v2 + dual-read + live backfill applied & verified) · **eslint-gap** `no-non-async-export-in-use-server` now flags re-exports.
- **B: H7** lint genuinely gates now (removed `only-warn`; rules→error; backlog snapshotted into the committed `apps/web/eslint-suppressions.json`) · **C3-tail** exhaustive-deps folded into H7's gate · **H9** my-listings inquiries grid (`Promise.allSettled`) fixed + spec un-`fixme`'d · **A4-runbook** Step 5 recorded · **B2-proof** CustomerDrawer mobile bottom-sheet interaction screenshot captured · **F1-tail** the two reversed `t(en,ar)` facades fixed/documented.

---

## A. Indefinitely deferred (Omar's call — do NOT build without an explicit go)
| Item | Why / scope |
|---|---|
| **DB region migration & release / DB-evolution governance** | The "going-public" infra program: adopt Prisma-Migrate-of-record (retire prod `db push`) via a PII-sanitized-clone-rehearsed baseline; Vercel+Supabase deploy pipeline w/ atomic rollback + PR previews; observability (Sentry + `/api/health` + uptime); PDPL/NDMO release gates; per-change T0–T3 playbook; and the **Sydney→Bahrain `me-south-1` region move** (the ~223ms-RTT latency lever). Full runbook in git history (`FUTURE_PLANS.md`). |
| **ZATCA Phase-2 e-invoicing** | Large compliance integration blocked on the external clearance pipeline. Schema ready (`ZatcaStatus` enum, default `NOT_APPLICABLE`). `billing.ts`. |
| **Ejar auto-registration + national e-sign (Nafath/IAM) SSO** | External-integration roadmap (G1). Each needs the external API + credentials. Greenfield. |

---

## B. Tracked tails (low-value / incremental — left explicitly, not dropped)
| ID | Gap | Why deferred | Effort |
|---|---|---|---|
| **lint-backlog** | ~159 suppressed lint findings in `apps/web/eslint-suppressions.json` — dominated by ~129 `@typescript-eslint/no-explicit-any` + ~22 `no-unused-vars` + 7 `exhaustive-deps`. The gate now BLOCKS new violations; the backlog is paid down incrementally. | Highest-churn / lowest-value; proper per-call-site typing (not blanket `unknown`). Fix opportunistically on touch, then `npm run lint:prune`. The file deletes itself when empty. | M (multi-PR) |
| **F1-tail** | ~650 inline `lang==="ar"?` ternaries remain — correctly NOT converted by the F1 codemod (plumbing / control-values `dir`/`locale`/`className`, non-literal branches, files with no `t` facade incl. the deliberately-documented English-first `admin/marketplace` facade). | P3 cosmetic; convert only true string-literal copy pairs on touch. | L (multi-PR) |

### Minor known debt (pre-existing, surfaced by the v4.33.0 QA gate — fix on touch)
- `app/actions/contracts.ts` `updateContractStatus` re-fetches without `include:{customer:true}` then casts `as typeof contract` — a shape lie that is harmless today (the return is discarded by the only caller) but would hand a future caller `customer: undefined`. Pre-existing, not a v4.33.0 regression.

---

*Last updated 2026-06-18 post-v4.33.0. The detailed pre-closure A–I backlog is preserved in git history (`git show HEAD~:future-plans/REMAINING-WORK.md`).*
