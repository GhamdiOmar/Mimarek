# Mimaric — Outstanding Work Report

> **Updated 2026-06-17, post-v4.32.0.** The previous edition (the A–I backlog audited post-v4.30.1)
> has been **closed almost in full** by the two-release backlog-closure program **v4.31.0 + v4.32.0**
> (PR [#40](https://github.com/GhamdiOmar/Mimaric/pull/40), merged to `main`). See `CHANGELOG.md`
> for the per-item detail of what shipped. This file now tracks only what genuinely **remains**.

---

## ✅ Closed in v4.31.0 + v4.32.0 (for reference — not outstanding)
Every non-deferred item from the prior A–I backlog shipped:
- **Security/data:** A1/A2 (`v1:` ciphertext envelope + DB CHECK + plaintext telemetry), A3 (hybrid fail-closed rate limiter), A4 (`organizationId` NOT-NULL + cross-org FK + every create-site sets it).
- **Compliance:** D1 (Data-Retention & Destruction console — advisory-lock + chunked delete + self-purge guard + cron, PDPL windows, ships dark).
- **Features:** E1 (org `PENDING_VERIFICATION` + expire cron + Turnstile graceful-degrade), E2 (`/more`→`/settings#profile`), E4 (viewCount dedup).
- **UX:** B1 (~40 `<select>`→`SelectField`), B2 (CustomerDrawer RTL re-platform), E3 (~13 date inputs→Hijri picker).
- **Architecture:** C1 (126 `revalidatePath`→`ROUTES` + ~93 `serialize()` + ESLint bans), C2 (deleted `apps/portal`), C3 (typed `massUpdateUnits`), C4 (hijri→`@repo/ui`, dedup, capture lib), H5 (hydration guard).
- **Money:** I2/I1 (append-only `RentPayment` ledger + `lib/money.ts`), I3/I4/I5 (marketplace correctness), H8 (document delete + remote-object + audit).
- **i18n:** F1 (1,834 `lang==="ar"` ternaries → `t()` across 40 files).

The live Supabase DB had all owed steps applied this session (A1/A2 envelope backfill+CHECK, A4 org-id backfill+NOT-NULL, D1/E1/I2 `db push`+RLS, I2 ledger backfill). CI green on the merge.

---

## A. Indefinitely deferred (Omar's call — do NOT build without an explicit go)
| Item | Why / scope |
|---|---|
| **DB region migration & release / DB-evolution governance** | The "going-public" infra program: adopt Prisma-Migrate-of-record (retire prod `db push`) via a PII-sanitized-clone-rehearsed baseline; Vercel+Supabase deploy pipeline w/ atomic rollback + PR previews; observability (Sentry + `/api/health` + uptime); PDPL/NDMO release gates; per-change T0–T3 playbook; and the **Sydney→Bahrain `me-south-1` region move** (the ~223ms-RTT latency lever). Full runbook in git history (`FUTURE_PLANS.md`, `git show`). |
| **ZATCA Phase-2 e-invoicing** | Large compliance integration blocked on the external clearance pipeline. Schema ready (`ZatcaStatus` enum, default `NOT_APPLICABLE`). `billing.ts:282`. |
| **Ejar auto-registration + national e-sign (Nafath/IAM) SSO** | External-integration roadmap (G1). Each needs the external API + credentials. Greenfield. |

---

## B. Tracked opportunistic tails (low-value / low-priority — left explicitly, not dropped)
| ID | Gap | Why deferred | Effort |
|---|---|---|---|
| **H7** | Lint-warning ratchet (~527 warnings) → `error` incrementally | Highest-churn / lowest-value; ratcheting any rule-class needs all its violations fixed first (real CI-break risk). Do one rule-class at a time, never big-bang. | M |
| **C3-tail** | The 14 `eslint-disable react-hooks/exhaustive-deps` — fix or justify each | P3 latent stale-closure risk; mis-"fixing" a hook can introduce bugs. Audit on next touch of each file. | M |
| **F1-tail** | ~656 inline `lang==="ar"?` ternaries remain | Correctly NOT converted by the F1 codemod: plumbing / control-values (`dir`/`locale`/`className`) / non-literal branches / files with no facade `t` (incl. a file with a *reversed* `t(en,ar)` facade). Convert only true string-literal copy pairs on touch. | L (multi-PR) |
| **H9** | `marketplace.cross-org.spec.ts` seller-convert UI walk is `test.fixme` | Un-`fixme` was attempted (v4.32.0) but CI re-confirmed the **"Convert to Deal" button never renders** on the my-listings incoming-inquiries grid (30s timeout; the DB OPEN inquiry exists). A real pre-existing my-listings grid render issue, not flakiness. Convert is covered at the action/DB-gate layer. Needs a focused grid debug. | M |
| **A4-runbook** | `packages/db/sql/2026-06-v4.28-manual-steps.md` Step 5 not marked done | Doc-only: the org-id backfill + NOT-NULL flip were applied + verified live this session; the runbook line should record it. | S |
| **B2-proof** | CustomerDrawer mobile bottom-sheet + RTL end-slide verified by code/build, not an interaction screenshot | The §3.9 harness captures page-load states; the drawer opens on row-click. Add an interaction screenshot when convenient. | S |

---

## C. Engineering backlog — legacy v4.7-era (re-verify before doing) — P3
> Predate the v4.27–v4.32 work — re-verify each against current code; several may already be resolved.

| ID | Gap | Location | Effort |
|---|---|---|---|
| I2-ledger-followups | The ledger enables reversals/refunds but the **reversal UI is not wired** (`reverseRentPayment` action exists, no UI control yet). | `PaymentsView.tsx` | M |
| I1-test | `payment-correctness-test.ts` now imports `effectivePaid` from `lib/money.ts` ✅ — but still re-implements the recordPayment ledger path inline rather than importing the real action (a `"use server"` import constraint). | `e2e/seed/payment-correctness-test.ts` | M |
| H8-pepper | Per-tenant blind-index keys (currently one global pepper — "acceptable at this scale") | `lib/pii-crypto.ts` | M |
| eslint-gap | The `mimaric/no-non-async-export-in-use-server` rule **exempts `export type` re-exports**, which Turbopack still mis-lowers into a runtime binding (the D1 `RetentionTable` 500 this session). Harden the rule to flag `export { ... }`/`export type { ... }` re-exports inside `"use server"` files. | `packages/eslint-config/next.js` | S |

---

*Last updated 2026-06-17 post-v4.32.0. The detailed pre-closure A–I backlog is preserved in git history (`git show HEAD~:future-plans/REMAINING-WORK.md`).*
