# Mimaric — Outstanding Work Report

> **Updated 2026-06-19, post-v4.33.2.** The prior Sections B + C (the tracked tails after v4.32.0)
> are now **closed** by v4.33.0; v4.33.1 closed the `contracts.ts` return-shape debt; v4.33.2 closed
> **H9** (the seller-convert E2E now passes — root cause was a test-only language-matcher + reservation
> collision, not a product bug). See `CHANGELOG.md` for per-item detail. This file now tracks only the
> three indefinitely-deferred programs (Section A) and two small, explicitly-tracked tails (Section B).

---

## ✅ Closed in v4.33.0 (for reference — not outstanding)
- **C: I2** payment reversal UI · **I1** payment-correctness-test imports the real ledger helpers · **H8** per-tenant blind index (HKDF v2 + dual-read + live backfill applied & verified) · **eslint-gap** `no-non-async-export-in-use-server` now flags re-exports.
- **B: H7** lint genuinely gates now (removed `only-warn`; rules→error; backlog snapshotted into the committed `apps/web/eslint-suppressions.json`) · **C3-tail** exhaustive-deps folded into H7's gate · **A4-runbook** Step 5 recorded · **B2-proof** CustomerDrawer mobile bottom-sheet interaction screenshot captured · **F1-tail** the two reversed `t(en,ar)` facades fixed/documented.

## ✅ Closed in v4.33.1 / v4.33.2 (for reference — not outstanding)
- **v4.33.1** — `contracts.ts` `updateContractStatus` return-shape lie fixed in both tx branches (`include:{customer:true}` + dropped the `as typeof contract` cast); dead `eslint-plugin-only-warn` devDependency removed; doc-accuracy fixes.
- **v4.33.2 — H9 RESOLVED.** The seller-convert E2E (`e2e/marketplace.cross-org.spec.ts`) now runs + passes (un-`fixme`'d, proven GREEN locally + CI). Root cause was **test-only**, not a product bug: (1) an English-only button matcher vs the Arabic-rendered page (UI language is cookie-driven, so `setLangTheme("en")` didn't flip it — the grid, OPEN row, and convert button were all present, just in Arabic) → bilingual matchers; (2) a convert collision because the settlement-refusal test attached a reservation keyed to the same inquiry (unique `marketplaceInquiryId`) → strip that scaffolding before convert. Also added `.env.local` loading to `playwright.config.ts` so the marketplace spec is runnable locally.

---

## A. Indefinitely deferred (Omar's call — do NOT build without an explicit go)
| Item | Why / scope |
|---|---|
| **DB region migration & release / DB-evolution governance** | The "going-public" infra program: adopt Prisma-Migrate-of-record (retire prod `db push`) via a PII-sanitized-clone-rehearsed baseline; Vercel+Supabase deploy pipeline w/ atomic rollback + PR previews; observability (Sentry + `/api/health` + uptime); PDPL/NDMO release gates; per-change T0–T3 playbook; and the **Sydney→Bahrain `me-south-1` region move** (the ~223ms-RTT latency lever). Full runbook in git history (`FUTURE_PLANS.md`). |
| **ZATCA Phase-2 e-invoicing** | Large compliance integration blocked on the external clearance pipeline. Schema ready (`ZatcaStatus` enum, default `NOT_APPLICABLE`). `billing.ts`. |
| **Ejar auto-registration + national e-sign (Nafath/IAM) SSO** | External-integration roadmap (G1). Each needs the external API + credentials. Greenfield. |

---

## B. Tracked tails (cosmetic / low-value — left explicitly, not dropped)
| ID | Gap | Why deferred | Effort |
|---|---|---|---|
| **lint-backlog** | 160 suppressed lint findings in `apps/web/eslint-suppressions.json` — 129 `@typescript-eslint/no-explicit-any` + 20 `no-unused-vars` + 7 `react-hooks/exhaustive-deps` + 4 misc (`no-empty` / `no-irregular-whitespace` / `react/no-unescaped-entities`). The gate (ESLint native suppressions: `--pass-on-unpruned-suppressions` + `lint:prune`) BLOCKS new violations; the backlog is paid down incrementally. | Highest-churn / lowest-value; proper per-call-site typing (not blanket `unknown`). Fix on touch, then `npm run lint:prune`. The file deletes itself when empty. | M (multi-PR) |
| **F1-tail** | ~650 inline `lang==="ar"?` ternaries remain — correctly NOT converted by the F1 codemod (plumbing / control-values `dir`/`locale`/`className`, non-literal branches, files with no `t` facade incl. the deliberately-documented English-first `admin/marketplace` facade). | P3 cosmetic; convert only true string-literal copy pairs on touch. | L (multi-PR) |

---

*Last updated 2026-06-18 post-v4.33.0. The detailed pre-closure A–I backlog is preserved in git history (`git show HEAD~:future-plans/REMAINING-WORK.md`).*
