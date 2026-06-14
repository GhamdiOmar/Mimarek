# Mimaric — QA Audit Remediation Plan & Handover

> **Date:** 2026-06-14 · **Author:** Omar Al-Ghamdi (sole author) · **Source:** full-repo QA & code audit (build at `c37e8ad`, v4.22.0).
> **Status:** NOTHING here is implemented. This is the canonical, research-backed fix-plan for the QA audit findings, to be executed later through the AGENTS.md §A Per-change Playbook. Do **not** start any item without an explicit go-ahead.
> **Gates verified at audit time:** `check-types` ✅ · `lint` ✅ (0 errors / 483 warnings) · unit ✅ (122/122) · `build` ✅. A green build ≠ a working UI (§3.4).

## 0. How to use this doc
- Each finding has an ID (`QA-<area>-nn`), a verified location, a researched fix + citations, a severity, and a phase.
- **Reconcile, don't duplicate.** Items cross-referenced to `FUTURE_PLANS.md` (§1 Migrate program, §2 backlog) and `CX-REMEDIATION-HANDOVER.md` (CX-nn) are executed there; this doc only adds the QA-specific delta.
- Re-verify every fix on the running app per AGENTS.md §3.4/§3.9; validate the change-set with `/mimaric-qa`.

## 1. Phasing overview

| Phase | Theme | Why this order | Deploy model |
|---|---|---|---|
| **P0** | Security hotfixes | Code-only, no schema; highest risk, shippable immediately | current `db push` |
| **P1** | DB governance + schema correctness | Needs Migrate + expand/contract; must follow FUTURE_PLANS §1 | Prisma **Migrate** |
| **P2** | a11y + architecture + frontend | High leverage, low risk; centralize once | current |
| **P3** | Marketplace lawful redesign | Largest; gated on REGA licensing (business prereq) | Migrate |

---

## 2. P0 — Security hotfixes (code-only)

### QA-SEC-01 — Unguarded `"use server"` exports = network-reachable RPCs **[CRITICAL]**
- **Verified:** `app/actions/admin-analytics/snapshotMrrForMonth.ts:1,20` (no guard; comment falsely says "NOT a user-callable server action" — it IS, imported by cron); `app/actions/customer-interests.ts:1,40,96` (`syncCustomerPipelineStatus`, `syncDealStageForUnit` write `Customer`/`Deal` keyed on caller-supplied IDs, no guard); `app/actions/paginated.ts:1,33` (`paginatedQuery` — arbitrary model + `where`, no guard; **zero importers** → latent, not currently registered).
- **Why it's real:** Every exported `async` fn in a `"use server"` file is a public POST endpoint. The pipeline helpers enable **cross-tenant data mutation**. Action-ID encryption is *loss-prevention, not access control* — authorization must be inside the action. (Next.js official: [Data Security](https://nextjs.org/docs/app/guides/data-security), [Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions).)
- **Fix (D4):**
  1. **Surgical:** move every internal helper OUT of `"use server"` files into plain `lib/` modules marked with `import "server-only"`; import them from the guarded callers. Delete `paginated.ts` (dead) or make it a `server-only` helper that *mandates* an `organizationId` filter. Extends **FUTURE_PLANS §2.1**.
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

## 3. P1 — Database governance + schema correctness (under Migrate)

> **Hard dependency: execute FUTURE_PLANS.md §1 (Prisma Migrate adoption + one-time prod baseline) FIRST.** All items below change a populated, money/PII schema → they need Migrate + the expand/contract discipline (§A Step 5), never casual `db push`.

### QA-DB-01 — `prisma/migrations/` contradicts `db push --accept-data-loss` **[HIGH — resolved by §1]**
- **Verified:** `packages/db/prisma/migrations/0_baseline` + an analytics migration exist; `.github/workflows/ci.yml:59` still runs `db push --accept-data-loss`; baseline is **stale** (missing `SavedTableView`, `ConsentLog`, `SubscriptionMrrSnapshot`, `SequenceCounter`, `RateLimitCounter`).
- **Fix:** do NOT leave the half-applied state. Either (a) execute FUTURE_PLANS §1 (regenerate a complete baseline, `migrate resolve --applied`, flip CI to `migrate deploy` atomically), or (b) interim-remove the premature `migrations/` dir until §1 runs. Prisma: `db push` is prototyping-only; production needs `migrate deploy`; baseline an existing DB via `migrate diff --from-empty` + `migrate resolve`. ([Baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining), [Deploy changes](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate).)

### QA-DB-02 — Money precision `Decimal(65,30)` **[HIGH]**
- **Verified:** every monetary field is bare `Decimal` (e.g. `schema.prisma:166,1229-1233`).
- **Fix:** standardize `@db.Decimal(14,2)` for SAR totals (or `(19,4)` if sub-cent precision needed); document the scale. Apply `decimal.js` ROUND_HALF_UP at the app layer before persist. Never `@db.Money` (locale-dependent), never `Float`. ([Crunchy: money in Postgres](https://www.crunchydata.com/blog/working-with-money-in-postgres), [Prisma: avoid @db.Money](https://www.prisma.io/docs/optimize/recommendations/avoid-db-money).) **Migration:** scale change on populated columns = a deliberate, tested expand/contract migration.

### QA-DB-03 — Cascade deletes of financial/audit data **[HIGH]**
- **Verified:** `schema.prisma:1163` (`SubscriptionEvent`, its own comment = "audit trail"), `:1184,1186` (`SubscriptionMrrSnapshot`) are `onDelete: Cascade`.
- **Fix:** change to `Restrict` (or `SetNull` + nullable). Audit/ledger/financial-history rows must never cascade; subscriptions are cancelled/archived, not row-deleted. ([Prisma referential actions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions).)

### QA-DB-04 — Tenant financial tables lack direct `organizationId` **[HIGH]**
- **Verified:** `Lease` (`schema.prisma:535-553`, none), `PaymentPlanInstallment` (`:470-488`, none), `PaymentPlan.organizationId` nullable (`:458`), `Reservation` (`:314-341`, none) — tenant scope is transitive-join-only.
- **Fix:** add denormalized non-null `organizationId` + `@@index` (consistent with Unit/Customer/Contract); backfill. Transitive-only scoping is a documented cross-tenant-leak class; the fix is a direct tenant key on every tenant table + (defense-in-depth) Prisma Client Extension to auto-inject the filter + RLS. ([Prisma multi-tenant](https://dev.to/whoffagents/multi-tenant-saas-data-isolation-row-level-security-tenant-scoping-and-plan-enforcement-with-1gd4), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).) **Migration:** expand (nullable + backfill) → set NOT NULL later (§A Step 5).

### QA-DB-05 — Orphan-able cross-org pointers + nullable `phoneHash` **[MEDIUM]**
- **Verified:** `Contract`/`Unit` cross-org pointers are plain `String?` no FK (`schema.prisma:422-424,209-215`); `Customer.phone` NOT NULL but `phoneHash` nullable (`:234,245`).
- **Fix:** model cross-org pointers as real FK relations (like `Reservation`) or document as immutable snapshots + index if queried; NOT NULL the hash columns once backfilled so the DB rejects unhashed PII writes.

### QA-DB-06 — Indexes for tenant-scoped queries **[MEDIUM]**
- **Fix:** composite `@@index([organizationId, status])` / `([organizationId, createdAt])` (tenant column leading) on hot tables; partial indexes; `CREATE INDEX CONCURRENTLY` for large tables. ([Percona indexes](https://www.percona.com/blog/a-practical-guide-to-postgresql-indexes/).)

### QA-DB-07 — Unbounded audit/notification growth **[LOW]**
- **Fix:** retention/partition plan for `AuditLog`/`ConsentLog`/`Notification`/`WebhookEvent` (also PDPL data-minimization). Out-of-DSL → a scheduled purge/partition job.

---

## 4. P2 — Accessibility + architecture + frontend

### QA-FE-01 — Label↔input association missing repo-wide **[HIGH — blocks the a11y gate]**
- **Verified:** 245 `<label>` across 21 pages, **0 `htmlFor`** (`crm/CrmView.tsx`, `settings/page.tsx` (55), `admin/seo/page.tsx` (36), …). Fails WCAG 1.3.1/3.3.2/4.1.2 and the §6.17 Lighthouse-≥95 gate.
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

> **Verdict (researched): PASSES WITH CONDITIONS.** KSA built digital rails (Najiz e-deeds with QR verification; Aamal Real-Estate Registry **API**, launched Jan 2026) that expect third-party platforms to **facilitate, verify, and record** — not execute — transfers. **Business prerequisite (Omar): obtain REGA Electronic Platform + FAL/brokerage licensing; engage a Saudi REGA-specialist legal firm before launch.** Sources below.

### The lawful model (D1)
1. **Listing publish is REGA-gated.** Before a listing goes live, verify the org's valid REGA **FAL advertising license** + **brokerage license** (REGA public Broker-Inquiry service; confirm API). Display the advertising-license number + expiry on every listing. Penalties for non-compliant platforms up to ~SAR 1M. **Legally required.**
2. **Pre-publish moderation queue** (replace the current self-asserted `APPROVED`-on-any-license + suspend-only model): `PENDING_REVIEW → APPROVED/REJECTED` (the `rejectedReason` column already exists).
3. **Transfer = proof-gated record, not conveyance.** Legal deed transfer happens off-platform on **Najiz/MoJ**. The user uploads the new **title-deed (صك)** proof (deed number, owner, property #). Mimaric **verifies** it against the registry — Najiz "Verify Transaction"/QR (manual/Nafath) now, **Aamal Registry API** when access is granted (read-only deed/ownership lookup) — and **only on verified proof** runs the existing atomic `settleMarketplaceTransfer` (CAS + `$transaction` + idempotency, already staff-quality at `marketplace.ts:738`) to mirror the unit org→org. **Repurpose** that function to fire on verified-proof, not on a self-marked SIGNED contract.
4. **Facilitation-only ToS** stating Mimaric is a record/facilitation tool, not a party to conveyance; the parties + Najiz perform the legal transfer; deed proof authenticity is the parties' representation.
5. **Payments:** resale escrow is **optional** (best-practice via SAMA-regulated bank), off-plan escrow is mandatory (Mimaric is pure property-mgmt → off-plan out of scope; disclaim it). **5% RETT** is the seller's obligation to ZATCA within 30 days — not the platform's; state in ToS.

### QA-MKT findings
- **QA-MKT-01 [CRITICAL]** Replace "buy = clone unit on self-marked SIGNED contract" (`marketplace.ts:738-867`, `694`) with the proof-gated flow above. New: deed-proof model + verification step + repurposed settlement.
- **QA-MKT-02 [CRITICAL — legal]** REGA license gate + pre-publish moderation queue at `publishMarketplaceListing:252` + `admin/marketplace/page.tsx`.
- **QA-MKT-03 [HIGH]** Rate-limit `confirmMarketplaceInterest:444` (QA-SEC-07).
- **QA-MKT-04 [HIGH]** PDPL Tier-4 governance for deed/owner data: encrypt at rest (extend `pii-crypto`), documented lawful basis (contractual necessity), retention (≥5y then secure delete), DPIA, access-logged. ([SDAIA PDPL guide](https://www.sgc.consulting/sdaia-saudi-personal-data-protection-law-pdpl-compliance-guide/).)
- **QA-MKT-05 [HIGH]** Un-`fixme` the cross-org E2E (`e2e/marketplace.cross-org.spec.ts:134`); make it a CI gate.
- **QA-MKT-06 [MEDIUM]** Dedupe `viewCount` (`listing-view.ts:194`); add pagination/sort + Arabic-aware search (cross-ref CX-002 federated search).

### Marketplace research citations
- Najiz e-deed + QR verify: [Sakan/Najiz](https://sa.sakan.co/blog/en/najiz/), [verify ownership](https://alrossais.com/en/verify-property-ownership-saudi-arabia/)
- Aamal Registry API (Jan 2026, read deed/ownership; OpenAPI not yet public — confirm access): [WebMobInfo](https://www.webmobinfo.ch/blog/real-estate-tokenization-platform-for-saudi-aamal-registry)
- REGA brokerage law + advertising license + broker-inquiry + penalties: [REGA regs](https://rega.gov.sa/en/rules-regulations-and-guidelines/regulations/implementing-regulations-of-real-estate-brokerage-law/), [broker inquiry](https://rega.gov.sa/en/rega-services/eservices/real-estate-broker-inquiry/), [Arab News](https://www.arabnews.com/node/2311096/amp)
- RETT 5% / seller / 30 days: [ZATCA](https://zatca.gov.sa/en/MediaCenter/News/Pages/News_936.asp), [Deloitte](https://www.deloitte.com/middle-east/en/services/tax/perspectives/ksa-key-amendments-to-rett-regulations.html)
- **Uncertainty flags:** Aamal OpenAPI spec + non-broker platform eligibility not yet public; REGA license-verification API not documented; confirm all with REGA directly + Saudi legal counsel before P3 execution.

---

## 6. Tests (cross-cutting)

- **QA-TEST-01 [HIGH]** Add server-action **integration tests**: (a) every tenant action rejects a foreign-org ID (org-isolation); (b) a test/lint that **fails if an exported `"use server"` fn lacks a guard call** (locks QA-SEC-01); (c) coupon authz + concurrent-redeem. Current suite (122 unit) covers money/state-machine math but not the data layer's authz/isolation.
- **QA-TEST-02** Un-`fixme` the marketplace cross-org E2E (QA-MKT-05).

## 7. Cross-reference map (do not duplicate)

| QA item | Existing plan it rides on |
|---|---|
| QA-DB-01..06 | **FUTURE_PLANS.md §1** (Migrate adoption + baseline) — execute first |
| QA-SEC-01 | **FUTURE_PLANS.md §2.1** (extract money logic from `"use server"`) — extend to all helpers |
| QA-FE-02 | **CX-006** (CRM form RHF, scheduled v4.26) |
| QA-FE-01 / a11y CI | **CX-017** (axe all routes + Lighthouse, v4.26) |
| QA-MKT-06 search | **CX-002** (federated record search — currently open/unscheduled) |
| QA-MKT-01 status-write | **FUTURE_PLANS §2.4/§2.5** (marketplace cross-org follow-ups) |

---

> End of `future-plans/QA-AUDIT-REMEDIATION.md`.
