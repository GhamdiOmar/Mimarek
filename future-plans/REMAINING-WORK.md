# Mimaric — Outstanding Work Report

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
| **ZATCA Phase-2 e-invoicing** | Large compliance integration blocked on the external clearance pipeline. Schema ready (`ZatcaStatus` enum, default `NOT_APPLICABLE`). `billing.ts`. |
| **Ejar auto-registration + national e-sign (Nafath/IAM) SSO** | External-integration roadmap (G1). Each needs the external API + credentials. Greenfield. |

---

## B. Deferred tails
| ID | Gap | Status | Effort |
|---|---|---|---|
| **F1-tail** | ~649 inline `lang==="ar"?` display-copy ternaries remain (across ~67 files) — the harder tail the v4.32.0 F1 codemod skipped (control-values `dir`/`locale`/`className`, non-literal branches, no-facade files, and the reversed `t(en,ar)` marketplace facade). | **Promoted to a dedicated sweep (Omar, 2026-06-19) but deferred to a future session.** Full scope + the per-file facade-order swap-safety in **`future-plans/f1-tail-i18n-sweep.md`**. | L (multi-PR) |

## B.1 Known pre-existing display bugs (P3 — fix on touch; both surfaced by the v4.33 lint sweep, deliberately not fixed there)
| ID | Bug | Fix |
|---|---|---|
| **billing-discount** | `app/dashboard/billing/invoices/page.tsx` reads `viewInvoice.discount` (~lines 596/602/752) to render the discount line, but the Prisma `Invoice` model has no `discount` field — it's `discountAmount` (`Decimal(14,2)`), and `billing.ts` (`getInvoiceById`/`getInvoices`) returns `discountAmount`. So `discount` is always `undefined` → `undefined > 0` is false → the discount line **never renders** even for a genuinely-discounted invoice. | Change the JSX to read `discountAmount`; update the `InvoiceRow` interface `discount: number` → `discountAmount: string \| number`. Verify with a seeded non-zero-discount invoice (desktop detail + mobile/print summary); §3.9 (light/dark × AR/EN) on `/dashboard/billing/invoices`, 0 console errors. |
| **reports-costPerSqm** | `app/dashboard/reports/ReportsView.tsx` (~lines 337-342) renders the maintenance-cost "by building" rows using a `costPerSqm` field that `getMaintenanceCostReport` (`app/actions/reports.ts`) never returns (its `byBuilding` rows are `{ name, estimated, actual, count }`). Users see a literal **"undefined ر.س/م²"** in the maintenance cost report. | Either compute `costPerSqm` (`actual / building-area`) in the action + add it to the `byBuilding` return type, OR drop the "(… ر.س/م²)" segment from the rendered string. Add the field to the action's return type so it's type-checked; §3.9 verify (AR/EN × light/dark). |

---

*Last updated 2026-06-19 post-v4.33.6. The detailed pre-closure A–I backlog is preserved in git history (`git show HEAD~:future-plans/REMAINING-WORK.md`).*
