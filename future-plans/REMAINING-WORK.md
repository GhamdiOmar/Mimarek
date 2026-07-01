# Mimarek — Outstanding Work Report

> **Updated 2026-06-19, post-v4.33.6.** The post-v4.32.0 tracked tails are now **all closed**: v4.33.0
> closed Sections B+C; v4.33.1 the `contracts.ts` return-shape debt; v4.33.2 **H9** (seller-convert E2E,
> a test-only root cause); and **v4.33.3–v4.33.6 drove the entire `eslint-suppressions.json` backlog
> from 160 → 0 and DELETED the file** — every ESLint rule now gates the whole app with no backstop. See
> `CHANGELOG.md` for per-item detail. This file now tracks the three indefinitely-deferred programs
> (Section A); **F1-tail** (Section B — promoted to a deferred dedicated sweep on 2026-06-19, scoped in
> `future-plans/f1-tail-i18n-sweep.md`); and two **known pre-existing P3 display bugs** (Section B.1).

---

## ✅ Closed in v4.33.0 (for reference — not outstanding)
- **C: I2** payment reversal UI · **I1** payment-correctness-test imports the real ledger helpers · **H8** per-tenant blind index (HKDF v2 + dual-read + live backfill applied & verified) · **eslint-gap** `no-non-async-export-in-use-server` now flags re-exports.
- **B: H7** lint genuinely gates now (removed `only-warn`; rules→error; backlog snapshotted into the committed `apps/web/eslint-suppressions.json`) · **C3-tail** exhaustive-deps folded into H7's gate · **A4-runbook** Step 5 recorded · **B2-proof** CustomerDrawer mobile bottom-sheet interaction screenshot captured · **F1-tail** the two reversed `t(en,ar)` facades fixed/documented.

## ✅ Closed in v4.33.1 / v4.33.2 (for reference — not outstanding)
- **v4.33.1** — `contracts.ts` `updateContractStatus` return-shape lie fixed in both tx branches (`include:{customer:true}` + dropped the `as typeof contract` cast); dead `eslint-plugin-only-warn` devDependency removed; doc-accuracy fixes.
- **v4.33.2 — H9 RESOLVED.** The seller-convert E2E (`e2e/marketplace.cross-org.spec.ts`) now runs + passes (un-`fixme`'d, proven GREEN locally + CI). Root cause was **test-only**, not a product bug: (1) an English-only button matcher vs the Arabic-rendered page (UI language is cookie-driven, so `setLangTheme("en")` didn't flip it — the grid, OPEN row, and convert button were all present, just in Arabic) → bilingual matchers; (2) a convert collision because the settlement-refusal test attached a reservation keyed to the same inquiry (unique `marketplaceInquiryId`) → strip that scaffolding before convert. Also added `.env.local` loading to `playwright.config.ts` so the marketplace spec is runnable locally.

## ✅ Closed in v4.33.3 – v4.33.6 — the lint-suppressions sweep to ZERO (for reference — not outstanding)
- The entire `eslint-suppressions.json` backlog (**160**) eliminated across 4 PRs, then the file **DELETED**: **v4.33.3** Tier-1 money/PII/auth `no-explicit-any` (54, Prisma-derived types); **v4.33.4** Tier-2 server-side `no-explicit-any` (45); **v4.33.5** UI/handler `no-explicit-any` (14, + a §3.9 4-theme preview walk); **v4.33.6** the tail (16 test-stub `any` → documented inline-disables, 20 `no-unused-vars`, 7 `exhaustive-deps` → comment-only disables, 4 misc). No behavior change; each PR through `/mimaric-qa` GO + CI green. `eslint . --pass-on-unpruned-suppressions` now passes clean with no file — the native suppressions ratchet retired itself.

---

## A. Indefinitely deferred (Omar's call — do NOT build without an explicit go)
| Item | Why / scope |
|---|---|
| **DB region migration & release / DB-evolution governance** | The "going-public" infra program: adopt Prisma-Migrate-of-record (retire prod `db push`) via a PII-sanitized-clone-rehearsed baseline; Vercel+Supabase deploy pipeline w/ atomic rollback + PR previews; observability (Sentry + `/api/health` + uptime); PDPL/NDMO release gates; per-change T0–T3 playbook; and the **Sydney→Bahrain `me-south-1` region move** (the ~223ms-RTT latency lever). Full runbook in git history (`FUTURE_PLANS.md`). |
| **ZATCA Phase-2 e-invoicing — production cutover** | All codeable scope (R1–R5) shipped v5.1.0→v5.6.0, live-CLEARED against the ZATCA sandbox. What remains is **external-only**: real `PLATFORM_SELLER` CR/address, a production CSID, tax-advisor signoff, and a deployed scheduler. Full procedure in `future-plans/zatca-production-cutover-runbook.md`. |
| **Ejar auto-registration + national e-sign (Nafath/IAM) SSO** | External-integration roadmap (G1). Each needs the external API + credentials. Greenfield. |

---

## B. Deferred tails
| ID | Gap | Status | Effort |
|---|---|---|---|
| **F1-tail** | ~649 inline `lang==="ar"?` display-copy ternaries remain (across ~67 files) — the harder tail the v4.32.0 F1 codemod skipped (control-values `dir`/`locale`/`className`, non-literal branches, no-facade files, and the reversed `t(en,ar)` marketplace facade). | **Promoted to a dedicated sweep (Omar, 2026-06-19) but deferred to a future session.** Full scope + the per-file facade-order swap-safety in **`future-plans/f1-tail-i18n-sweep.md`**. | L (multi-PR) |

## B.1 Known pre-existing display bugs (P3)
Both prior P3 display bugs are **CLOSED in v5.30.0**:
- **billing-discount** — `invoices/page.tsx` now reads the real `discountAmount` (was the nonexistent `discount`), so a discounted invoice renders its discount line in both the desktop detail and the mobile/print summary.
- **reports-costPerSqm** — the maintenance-cost "by building" rows dropped the broken `costPerSqm` segment (the report action never returned it), so the generated report no longer prints literal `undefined ر.س/م²`.

No open P3 display bugs remain in this section.

---

*Last updated 2026-07-01 (v5.30.0 closed the two B.1 display bugs). The detailed pre-closure A–I backlog is preserved in git history (`git show HEAD~:future-plans/REMAINING-WORK.md`).*
