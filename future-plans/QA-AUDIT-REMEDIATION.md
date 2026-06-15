# Mimaric — QA Audit Remediation Plan & Handover

> **Date:** 2026-06-14 · **Revised:** 2026-06-15 against `main` v4.23.0 (`71f9e5e`) · **Author:** Omar Al-Ghamdi (sole author) · **Source:** full-repo QA & code audit, then current-main verification.
> **Status:** This is a research-backed fix-plan for QA audit findings. Some premises from the first pass were stale against current `main`; the corrections are called out in §0.1. Execute later through the AGENTS.md per-change playbook; do **not** start any item without an explicit go-ahead.
> **Gates verified at audit time:** `check-types` ✅ · `lint` ✅ (0 errors / 483 warnings) · unit ✅ (122/122) · `build` ✅. A green build ≠ a working UI (§3.4).

## 0. How to use this doc
- Each finding has an ID (`QA-<area>-nn`), a verified location, a researched fix + citations, a severity, and a phase.
- **Reconcile, don't duplicate.** Items cross-referenced to `CX-REMEDIATION-HANDOVER.md` (CX-nn) are executed there; this doc only adds the QA-specific delta. `FUTURE_PLANS.md` is branch-local and is not a `main` source of truth at v4.23.0.
- Re-verify every fix on the running app per AGENTS.md §3.4/§3.9; validate the change-set with `/mimaric-qa`.

## 0.1 Current-main correction summary (2026-06-15)

**Correct and confirmed:**
- The P0 security findings still reproduce on `main`: unguarded/internal `"use server"` exports, coupon permission/race gaps, `massUpdateUnits` status writes, missing global security headers, account-mode enumeration, fail-open decrypt, and missing marketplace inquiry rate limiting.
- The marketplace direction is correct when framed as **proof-gated facilitation**, not legal conveyance. Official REGA/ZATCA/RER sources support license/ad-number obligations, registry proof, and real-estate transaction-tax registration rails; they do not support Mimaric self-executing ownership transfer.
- Money precision and direct tenant keys remain real DB correctness risks on `main`.

**Partially correct:**
- Prisma Migrate is an industry/research-backed destination for production schema governance, but it is **not current Mimaric main**. Main still deliberately uses `prisma db push` plus generated/manual RLS SQL. Keep any Migrate conversion as a separately approved governance program, not as a dependency for all P1 fixes.
- The accessibility label gap is real, but the counts were stale: current `main` has 268 `<label>` occurrences and 10 `htmlFor` occurrences, not 245/0.
- Marketplace legal/API research is directional. REGA/RER/ZATCA official sources are authoritative; third-party registry/API claims remain unconfirmed and must not be treated as launched platform capability.

**Incorrect or stale and revised below:**
- `packages/db/prisma/migrations/0_baseline` is not tracked on `main`; treating it as a current-main contradiction was wrong. The real risk is the untracked branch-local migrations directory.
- `SavedTableView` is present on `main` and RLS-covered in `packages/db/sql/2026-06-enable-rls.sql`.
- Penalty amounts and registry API launch claims from non-official sources are not confirmed enough to state as fact.

## 1. Phasing overview

| Phase | Theme | Why this order | Deploy model |
|---|---|---|---|
| **P0** | Security hotfixes | Code-only, no schema; highest risk, shippable immediately | current `db push` |
| **P1** | DB governance + schema correctness | Needs current Mimaric `db push` discipline now; Prisma Migrate only if separately approved | `db push` + manual/generated SQL, or approved Migrate conversion |
| **P2** | a11y + architecture + frontend | High leverage, low risk; centralize once | current |
| **P3** | Marketplace lawful redesign | Largest; gated on REGA licensing/legal verification (business prereq) | current schema process unless a separate Migrate program lands first |

---

## 2. P0 — Security hotfixes (code-only)

### QA-SEC-01 — Unguarded `"use server"` exports = network-reachable RPCs **[CRITICAL]**
- **Verified:** `app/actions/admin-analytics/snapshotMrrForMonth.ts:1,20` (no guard; comment falsely says "NOT a user-callable server action" — it IS, imported by cron); `app/actions/customer-interests.ts:1,40,96` (`syncCustomerPipelineStatus`, `syncDealStageForUnit` write `Customer`/`Deal` keyed on caller-supplied IDs, no guard); `app/actions/paginated.ts:1,33` (`paginatedQuery` — arbitrary model + `where`, no guard; **zero importers** → latent, not currently registered).
- **Why it's real:** Every exported `async` fn in a `"use server"` file is a public POST endpoint. The pipeline helpers enable **cross-tenant data mutation**. Action-ID encryption is *loss-prevention, not access control* — authorization must be inside the action. (Next.js official: [Data Security](https://nextjs.org/docs/app/guides/data-security), [Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions).)
- **Fix (D4):**
  1. **Surgical:** move every internal helper OUT of `"use server"` files into plain `lib/` modules marked with `import "server-only"`; import them from the guarded callers. Delete `paginated.ts` (dead) or make it a `server-only` helper that *mandates* an `organizationId` filter. Keep this as a standalone security hardening item until it is folded into a tracked `main` plan.
  2. **Systemic:** add an ESLint rule in `packages/eslint-config` requiring every exported action in `app/actions/**` to call a guard (`requirePermission`/`requireSystem`/`getTenantSessionOrThrow`) — mirrors the existing `no-non-async-export-in-use-server` rule. Optionally adopt a `next-safe-action`-style authz wrapper as the one sanctioned action factory.
- **Verify:** a new integration/lint test fails if any exported action lacks a guard call (see QA-TEST-01).

### QA-SEC-02 — Coupon authz bypass + redemption race **[HIGH]**
- **Verified:** `app/actions/coupons.ts:17-18,69-70` — `applyCoupon`/`validateCoupon` gate only on `getTenantSessionOrThrow()`, no `billing:*` permission → any tenant role rewrites invoice `total`/`discountAmount`/`vatAmount`. `:83-129` — check-then-increment redemption with no `maxRedemptions` re-check in the write.
- **Fix:** add `requirePermission("billing:write")` to `applyCoupon`, `billing:read` to `validateCoupon`. Make redemption atomic + idempotent inside the `$transaction`: conditional `updateMany({ where: { id, currentUses: { lt: maxRedemptions } } })` + a unique `(couponId, organizationId)` on `CouponRedemption`. (Race-safe patterns: atomic conditional `UPDATE`, `INSERT … ON CONFLICT`, `SELECT … FOR UPDATE` — [PostgreSQL race conditions](https://oneuptime.com/blog/post/2026-01-25-postgresql-race-conditions/view).) The unique-constraint add is a P1 schema item; the permission + conditional-update fixes ship in P0.

### QA-BE-01 — `massUpdateUnits` writes status with no state-machine validation **[HIGH]**
- **Verified:** `app/actions/units.ts:85-114` — caller-supplied `status: any` written directly; per-row `where:{id}` (org pre-checked in bulk, so org-safe) but no transition check.
- **Fix:** validate `status` against a unit transition table (mirror `CONTRACT_TRANSITIONS` in `lib/contracts/state-machine.ts`); reject transitions that contradict an active contract/lease (e.g. → AVAILABLE while a signed contract exists).

### QA-SEC-03 — No security headers **[MEDIUM]**
- **Verified:** `next.config.js:5-24` (only `Cache-Control`).
- **Fix:** global `headers()` block — `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, a baseline CSP. (OWASP secure-headers.)

### QA-SEC-04 — JWT session: no `maxAge`/idle timeout **[MEDIUM]**
- **Verified:** `auth.ts:68` (default 30d, no idle expiry).
- **Fix:** explicit `session.maxAge` (e.g. 7d) + `updateAge`; shorter for system-admin sessions.

### QA-SEC-05 — Login account/role enumeration **[MEDIUM]**
- **Verified:** `app/actions/auth.ts:28-37` — distinct `USE_MANAGEMENT_MODE`/`USE_TENANT_MODE` errors by email+role before password check and before the rate-limit gate.
- **Fix:** generic error for the mode-mismatch case, or check mode only after a successful credential verification.

### QA-SEC-06 — GCM `decrypt()` fails open **[MEDIUM]**
- **Verified:** `lib/encryption.ts:35-39,57-59` — returns input on auth-tag mismatch (legacy-plaintext convenience) → defeats GCM tamper-detection.
- **Fix:** distinguish "not in `iv:tag:ct` format" (legacy plaintext → return as-is) from "format valid but decrypt threw" (→ throw + log a security event).

### QA-SEC-07 — Rate-limit coverage gaps **[HIGH for marketplace; else MEDIUM]**
- **Verified:** `lib/rate-limit.ts` exists + is used by auth/invites but **not** by the public marketplace inquiry (`marketplace.ts:444`). The limiter **fails open** on DB error (`:70-74`).
- **Fix:** add `checkRateLimit` to `confirmMarketplaceInterest` (P3) and any other public-facing write; consider fail-closed for the login path specifically. (Rate-limit best practice: stricter limits on auth + public writes — [Upstash](https://upstash.com/blog/nextjs-ratelimiting).)

---

## 3. P1 — Database governance + schema correctness (current `db push` baseline)

> **Current-main rule:** AGENTS.md §4 is authoritative today: schema changes use `prisma db push`, not Prisma Migrate. If Mimaric later adopts Migrate, do it as a separately approved, atomic governance program: complete baseline, CI switch, docs switch, and RLS/manual SQL plan in the same change. Until then, the items below must use populated-table-safe `db push` discipline plus explicit SQL where Prisma cannot express the operation.

### QA-DB-01 — Keep schema governance coherent **[HIGH]**
- **Verified on current `main`:** `.github/workflows/ci.yml` runs `cd packages/db && npx prisma db push --accept-data-loss`; `packages/db/prisma/migrations/` is absent on `main`; `SavedTableView` exists in `schema.prisma`; `packages/db/sql/2026-06-enable-rls.sql` already includes `ALTER TABLE IF EXISTS public."SavedTableView" ENABLE ROW LEVEL SECURITY;`.
- **Correction:** the earlier finding that `packages/db/prisma/migrations/0_baseline` exists and is missing `SavedTableView` is **incorrect for `main`**. That directory exists only as branch-local/untracked work and should not be committed accidentally.
- **Fix:** either delete the untracked migrations directory and continue the current `db push` process, or plan a real Migrate conversion as its own approved project: complete baseline from the live schema, `migrate resolve --applied`, CI `migrate deploy`, RLS/manual SQL handling, and AGENTS.md updates in one change. Prisma documents `db push` as the prototyping/sync tool and Migrate/baselining as the versioned deployment workflow; Mimaric has deliberately chosen `db push` for now, so do not mix both models casually. ([Prisma development/production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production), [Prisma baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining).)

### QA-DB-02 — Money precision `Decimal(65,30)` **[HIGH]**
- **Verified:** every monetary field is bare `Decimal` (e.g. `schema.prisma:166,1229-1233`).
- **Fix:** standardize `@db.Decimal(14,2)` for SAR totals (or `(19,4)` if sub-cent precision needed); document the scale. Apply `decimal.js` ROUND_HALF_UP at the app layer before persist. Never `@db.Money` (locale-dependent), never `Float`. Prisma's default PostgreSQL mapping for bare `Decimal` is `decimal(65,30)`, while PostgreSQL recommends exact `numeric`/`decimal` for monetary exactness. ([Prisma schema reference](https://www.prisma.io/docs/orm/reference/prisma-schema-reference), [PostgreSQL numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html).) **Deployment:** changing scale on populated columns needs a deliberate staged rollout: validate/round data first, then `db push`/manual SQL only after proving no destructive cast or data loss.

### QA-DB-03 — Cascade deletes of financial/audit data **[HIGH]**
- **Verified:** `schema.prisma:1163` (`SubscriptionEvent`, its own comment = "audit trail"), `:1184,1186` (`SubscriptionMrrSnapshot`) are `onDelete: Cascade`.
- **Fix:** change to `Restrict` (or `SetNull` + nullable). Audit/ledger/financial-history rows must never cascade; subscriptions are cancelled/archived, not row-deleted. ([Prisma referential actions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions).)

### QA-DB-04 — Tenant financial tables lack direct `organizationId` **[HIGH]**
- **Verified:** `Lease` (`schema.prisma:535-553`, none), `PaymentPlanInstallment` (`:470-488`, none), `PaymentPlan.organizationId` nullable (`:458`), `Reservation` (`:314-341`, none) — tenant scope is transitive-join-only.
- **Fix:** add denormalized non-null `organizationId` + `@@index` (consistent with Unit/Customer/Contract); backfill. Transitive-only scoping is a documented cross-tenant-leak class; the fix is a direct tenant key on every tenant table + defense-in-depth tenant scoping. Supabase documents RLS as defense in depth, while Mimaric's owner-role Prisma connection bypasses RLS, so app-level scoping still carries the main load. ([Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).) **Deployment:** under current `db push`, expand first with nullable/default-safe columns, run an explicit backfill SQL, prove row counts, then set NOT NULL in a later step.

### QA-DB-05 — Orphan-able cross-org pointers + nullable `phoneHash` **[MEDIUM]**
- **Verified:** `Contract`/`Unit` cross-org pointers are plain `String?` no FK (`schema.prisma:422-424,209-215`); `Customer.phone` NOT NULL but `phoneHash` nullable (`:234,245`).
- **Fix:** model cross-org pointers as real FK relations (like `Reservation`) or document as immutable snapshots + index if queried; NOT NULL the hash columns once backfilled so the DB rejects PII writes that are not hashed.

### QA-DB-06 — Indexes for tenant-scoped queries **[MEDIUM]**
- **Fix:** composite `@@index([organizationId, status])` / `([organizationId, createdAt])` (tenant column leading) on hot tables; partial indexes; `CREATE INDEX CONCURRENTLY` for large tables. ([Percona indexes](https://www.percona.com/blog/a-practical-guide-to-postgresql-indexes/).)

### QA-DB-07 — Unbounded audit/notification growth **[LOW]**
- **Fix:** retention/partition plan for `AuditLog`/`ConsentLog`/`Notification`/`WebhookEvent` (also PDPL data-minimization). Out-of-DSL → a scheduled purge/partition job.

---

## 4. P2 — Accessibility + architecture + frontend

### QA-FE-01 — Label↔input association missing repo-wide **[HIGH — blocks the a11y gate]**
- **Verified on current `main`:** 268 `<label>` occurrences and only 10 `htmlFor` occurrences (`crm/CrmView.tsx`, `settings/page.tsx`, `admin/seo/page.tsx`, …). Fails WCAG 1.3.1/3.3.2/4.1.2 and the §6.17 Lighthouse-≥95 gate.
- **Fix (highest leverage):** bake `useId()` + `htmlFor`/`id` + `aria-invalid` + `aria-describedby` into the shared `Input`/`Field` wrapper in `@repo/ui` so association can't be forgotten; migrate pages to it. Error container `role="alert"`. ([React useId](https://react.dev/reference/react/useId), [W3C labels](https://www.w3.org/WAI/tutorials/forms/labels/), [ARIA21 aria-invalid](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA21).) Cross-ref **CX-017** (axe CI).

### QA-FE-02 — Inconsistent form validation **[MEDIUM]**
- **Verified:** only contracts + reservations use RHF + after-blur inline validation; CRM/Units/Maintenance use raw `useState` (Units create has none — `units/UnitsView.tsx:198-224`).
- **Fix:** adopt the contracts RHF + Zod + `zodResolver` pattern, validate on blur, `aria-invalid` + `aria-describedby`. Cross-ref **CX-006** (CRM form already scheduled for v4.26).

### QA-FE-03 / QA-FE-04 — Native selects + hand-rolled CRM drawer **[MEDIUM]**
- **Verified:** 63 native `<select>` (label-detached, poor dark/RTL — needs preview verification); CRM drawer is a fixed-`<div>` overlay, not `ResponsiveDialog` (`crm/CrmView.tsx:540-552`).
- **Fix:** add a governed `Select` primitive to `@repo/ui`; migrate the drawer to `ResponsiveDialog` (RTL slide + mobile bottom-sheet for free).

### QA-ARCH-01 — Client god-objects **[HIGH]**
- **Verified:** `CrmView.tsx` 3,756 LOC / 59 `useState`; 7 files >1,000 LOC.
- **Fix:** decompose into child components (Kanban, drawer, forms, filters); lift related state into `useReducer`/sub-context. Target <600 LOC page shells.

### QA-ARCH-02 — Abandoned shared seams **[HIGH]**
- **Verified:** `serialize.ts` (90 inline `JSON.parse(JSON.stringify)`), `action-result.ts` (0 uses), `routes.ts` `ROUTES` (89 raw `revalidatePath` strings — stale-rename hazard §8.5), `t()` facade (70 files inline `lang==="ar"?…`), `domain-labels.ts` (Unit status missing).
- **Fix:** adopt each seam in new + touched code; lint-ban the inline alternatives (opportunistic, not big-bang). Add `UNIT_STATUS` to `domain-labels.ts`.

### QA-ARCH-03 / QA-ARCH-04 — Dead `apps/portal` + `any`/disable budget **[LOW]**
- **Fix:** delete or formally document the redirect-only `apps/portal`; budget down `any` in `CrmView`/`UnitsView`/`customers.ts`; audit the 11 `exhaustive-deps` disables (latent stale-closure bugs).

---

## 5. P3 — Marketplace lawful redesign (proof-gated facilitation)

> **Verdict (researched): PASSES WITH CONDITIONS.** The right product posture is a regulated facilitation/record workflow: Mimaric can help publish, inquire, verify proof, and mirror records, but it must not present `settleMarketplaceTransfer` as legal conveyance. Official sources support REGA advertising/broker obligations, the Real Estate Registry as ownership-record infrastructure, and ZATCA real-estate transaction-tax registration/payment before conveyance documentation. Registry/API availability is **unconfirmed** and must not be a committed dependency until official access is verified directly.

### The lawful model (D1)
1. **Listing publish is REGA-gated.** Before a listing goes live, verify the org's valid REGA advertising/brokerage authorization and display the advertising-license number where required. The REGA regulations require broker/advertiser license details in advertisements and include a public real-estate broker inquiry path. Exact platform eligibility, API access, and penalty exposure require Saudi legal confirmation.
2. **Pre-publish moderation queue** (replace the current self-asserted `APPROVED`-on-any-license + suspend-only model): `PENDING_REVIEW → APPROVED/REJECTED` (the `rejectedReason` column already exists).
3. **Transfer = proof-gated record, not conveyance.** Legal ownership transfer is proved through official deed/registry rails outside Mimaric. The user uploads title-deed/registry proof (deed number, owner, property #); Mimaric verifies it against available official/manual sources and only on verified proof runs the existing atomic `settleMarketplaceTransfer` (CAS + `$transaction` + idempotency, already staff-quality at `marketplace.ts:738`) to mirror the unit org→org. Repurpose that function to fire on verified proof, not on a self-marked SIGNED contract.
4. **Facilitation-only ToS** stating Mimaric is a record/facilitation tool, not a party to conveyance; the parties and government rails perform the legal transfer; proof authenticity is the parties' representation until verified.
5. **Payments/tax:** ZATCA's real-estate transaction-tax service registers the property and transaction before final conveyance/contract documentation and handles tax due/payment electronically. Treat the tax step as a seller/transaction compliance item to surface and document, not as money Mimaric unilaterally calculates or remits without counsel.

### QA-MKT findings
- **QA-MKT-01 [CRITICAL]** Replace "buy = clone unit on self-marked SIGNED contract" (`marketplace.ts:738-867`, `694`) with the proof-gated flow above. New: deed-proof model + verification step + repurposed settlement.
- **QA-MKT-02 [CRITICAL — legal]** REGA license gate + pre-publish moderation queue at `publishMarketplaceListing:252` + `admin/marketplace/page.tsx`.
- **QA-MKT-03 [HIGH]** Rate-limit `confirmMarketplaceInterest:444` (QA-SEC-07).
- **QA-MKT-04 [HIGH]** PDPL Tier-4 governance for deed/owner data: encrypt at rest (extend `pii-crypto`), documented lawful basis (contractual necessity), retention (≥5y then secure delete), data protection impact assessment, access-logged. ([SDAIA PDPL guide](https://www.sgc.consulting/sdaia-saudi-personal-data-protection-law-pdpl-compliance-guide/).)
- **QA-MKT-05 [HIGH]** Un-`fixme` the cross-org E2E (`e2e/marketplace.cross-org.spec.ts:134`); make it a CI gate.
- **QA-MKT-06 [MEDIUM]** Dedupe `viewCount` (`listing-view.ts:194`); add pagination/sort + Arabic-aware search (cross-ref CX-002 federated search).

### Marketplace research citations
- REGA implementing regulations: official definitions for real-estate license/ad license, registry inquiry availability, and broker advertisement/license obligations: [REGA regulations](https://rega.gov.sa/en/regulations-and-by-laws/regulations/implementing-regulations-of-real-estate-brokerage-law/).
- REGA Real Estate Registry: official ownership/registration infrastructure and transfer-of-ownership service framing: [Real Estate Registry](https://rega.gov.sa/en/rega-services/platforms/real-estate-registry/).
- ZATCA real-estate transaction-tax service: property + transaction registration before final conveyance/contract documentation and electronic payment flow: [tax registration](https://zatca.gov.sa/en/eServices/Pages/VatRequest.aspx).
- **Uncertainty flags:** registry/API access, non-broker platform eligibility, and any automated REGA license-verification API are not publicly confirmed in the official sources above. Confirm directly with REGA/the registry provider and Saudi legal counsel before P3 execution.

---

## 6. Tests (cross-cutting)

- **QA-TEST-01 [HIGH]** Add server-action **integration tests**: (a) every tenant action rejects a foreign-org ID (org-isolation); (b) a test/lint that **fails if an exported `"use server"` fn lacks a guard call** (locks QA-SEC-01); (c) coupon authz + concurrent-redeem. Current suite (122 unit) covers money/state-machine math but not the data layer's authz/isolation.
- **QA-TEST-02** Un-`fixme` the marketplace cross-org E2E (QA-MKT-05).

## 7. Cross-reference map (do not duplicate)

| QA item | Existing plan it rides on |
|---|---|
| QA-DB-01..06 | AGENTS.md §4 current schema/RLS rules; any Prisma Migrate conversion needs a separate approved plan |
| QA-SEC-01 | Standalone security hardening: extract internal helpers from `"use server"` and add guard-detection lint/integration tests |
| QA-FE-02 | **CX-006** (CRM form RHF, scheduled v4.26) |
| QA-FE-01 / a11y CI | **CX-017** (axe all routes + Lighthouse, v4.26) |
| QA-MKT-06 search | **CX-002** shipped v4.23.0; marketplace-specific ranking/pagination remains a P3 local enhancement |
| QA-MKT-01 status-write | P3 marketplace lawful redesign in this doc |

---

> End of `future-plans/QA-AUDIT-REMEDIATION.md`.
