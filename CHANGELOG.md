# Changelog — Mimaric PropTech

## [4.33.5] — 2026-06-19 — Lint sweep PR 3/4: UI/handler no-explicit-any → typed

Batch 3 continues. PR 3 of 4 eliminates **14** `@typescript-eslint/no-explicit-any` suppressions in **rendered** React pages/components — **no behavior or rendering change** (type annotations only; emitted JS byte-identical). Suppressions: **61 → 47** (no-explicit-any 30 → 16; the remaining 16 are legit test stubs → PR 4). `turbo run check-types` 2/2 · `next build` green · vitest **160/160** · `/mimaric-qa` **GO** (behavior/rendering-preserving, all 5 risk points verified). **§3.9 4-theme preview walk done** (see below).

### Typed (no runtime change)
- **Auth pages** — `LoginClient.tsx` (1, `catch (e)` + `instanceof Error`), `register/page.tsx` (3, `validatePassword` `{en,ar}[]` map + structural result casts), `reset-password/page.tsx` (1) + `verify-email/page.tsx` (1) (`{en,ar}[]` map / a `VerifyErrorReason` union).
- **Dashboard** — `DashboardClientLayout.tsx` (3, local `DashboardSession`/`DashboardSessionUser` types mirroring the loose `SessionData` — deliberately NOT the precise NextAuth `Session`, to avoid re-tightening the provider contract), `ReportsView.tsx` (2, chart map callbacks typed to the real row shapes; `costPerSqm` typed optional to preserve the identical render), `admin/plans/page.tsx` (1, `catch (e)`), `settings/audit/page.tsx` (1, `metadata: unknown`, field never read), `settings/security/page.tsx` (1, `{en,ar}[]` map).

### §3.9 preview walk (PR 3 touches rendered pages)
Verified against a local prod build (`next start`): `/auth/login` in **all 4 combos** (light-RTL, dark-RTL, dark-LTR, light-LTR), and `/dashboard` (DashboardClientLayout), `/dashboard/reports` (ReportsView), `/dashboard/settings/security` authenticated — **all render correctly, zero console errors**.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.33.4...v4.33.5

## [4.33.4] — 2026-06-19 — Lint sweep PR 2/4: Tier-2 server-side no-explicit-any → typed

Batch 3 continues. PR 2 of 4 eliminates **45** `@typescript-eslint/no-explicit-any` suppressions in server-side code (12 server actions + 4 cron routes + uploadthing) — **no behavior change**. Suppressions: **106 → 61** (no-explicit-any 75 → 30). `turbo run check-types` 2/2 · `next build` green · vitest **160/160** · `/mimaric-qa` **GO** (behavior-preserving throughout, all 6 risk items verified). §3.9 N/A — no rendered pages touched (server actions / API routes only).

### Typed (no runtime change)
- **Maintenance** — `maintenance.ts` (8) + `preventive-maintenance.ts` (8): `Prisma.<M>WhereInput`/`UncheckedUpdateInput` (scalar-FK assignments), `MaintenanceStatus`/`Category`/`Priority`/`RecurrenceType` enums cast at write sites.
- **`support-tickets.ts`** (7) — `Prisma.<M>WhereInput`, `Ticket*` enums; `catch (e)` + `instanceof Prisma.PrismaClientKnownRequestError && code==="P2002"` with array-or-string `meta.target` handling.
- **Finance/billing** — `payment-plans.ts` (3, incl. a union `GetPayload` tx-return type + `InstallmentStatus`), `dashboard-finance.ts` (2, money stays `Prisma.Decimal`), `billing.ts` (1) + `coupons.ts` (1) `Prisma.InputJsonValue` for `Json` columns, `audit.ts` (1) `Prisma.AuditLogWhereInput` + a semantically-identical `DateTimeFilter` build.
- **Docs/templates/permissions/password** — `documents.ts` (2), `contract-templates.ts` (2), `permission-requests.ts` (2) enums cast at write sites; `password.ts` (1) `Prisma.TransactionClient`.
- **`uploadthing/core.ts`** (3) — removed dead `(session.user as any)` casts (the `next-auth.d.ts` augmentation already types `role`/`organizationId`); `?? "USER"` fallback preserved.
- **4 cron routes** (1 each) — `catch (e)` + `instanceof Error` for the 500 message; auth-secret + retention/expiry logic untouched.

Per the PR1 lesson, **no server-action param was narrowed** — enum-ish `string` params stay `string`, cast only at the Prisma write site. Caught + fixed in validation: `payment-plans.ts` imported `type Prisma` but used it as a runtime value in `instanceof` → value import.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.33.3...v4.33.4

## [4.33.3] — 2026-06-19 — Lint sweep PR 1/4: Tier-1 (money/PII/auth) no-explicit-any → typed

Batch 3 of the post-v4.33.0 plan begins — paying the `eslint-suppressions.json` backlog down to zero. PR 1 of 4 eliminates **54** `@typescript-eslint/no-explicit-any` suppressions in the highest-safety-value server actions (money, PII, auth), replacing each `any` with a proper type — **no behavior change**. Suppressions: **160 → 106** (no-explicit-any 129 → 75). `turbo run check-types` 2/2 · `next build` green · vitest **160/160** · `/mimaric-qa` **GO** (behavior-preserving throughout). §3.9 preview walk N/A — the one UI file touched (billing/invoices) changed only type annotations (byte-identical emitted JS; no JSX/logic/value change).

### Typed (no runtime change)
- **`customers.ts`** (13) — `Prisma.InputJsonValue` for `Json` fields, `Prisma.Customer{Where,Update}Input`, the real `CustomerStatus`/`PersonType`/`Gender`/`ActivityType` enums; params kept `string` (caller-compatible) and cast at the write boundary. The `encryptCustomerData` blind-index path is untouched.
- **`billing/invoices/page.tsx`** (16) — new `InvoiceRow`/`InvoiceLineItemRow` view-model interfaces + `ColumnDef<InvoiceRow>`, so the DataTable `cell`/`mobileCard`/`getRowId` callbacks infer their params. Purely type annotations.
- **`auth.ts` actions** (5) — `catch (e)` (`unknown`) + `instanceof Error` / `instanceof Prisma.PrismaClientKnownRequestError` narrowing, `Prisma.TransactionClient`. Error-handling semantics (incl. the P2002 unique-constraint branches) byte-identical.
- **`organization.ts`** (7) + **`onboarding.ts`** (6) — enum params kept `string` + cast at write sites, `Prisma.*UpdateInput`/`InputJsonValue`, a shared `targetIncludes` helper.
- **`contracts.ts`** (4) — `Prisma.Contract{Where,Update}Input`, `RecurrenceType` casts.
- **`auth.ts` root** — `signIn`/`signOut` typed; `auth` kept as a single documented inline-`eslint-disable` `any` (its precise NextAuth v5 type cascades into the intentionally-loose `SessionData`/`DashboardClientLayout` session layer — out of this PR's scope).

**Caught in validation:** two caller-breakages the typing introduced (over-narrowed `organization.ts` enum params broke `settings/page.tsx`; the precise root `auth` type broke `portal/layout.tsx`) — both fixed before merge.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.33.2...v4.33.3

## [4.33.2] — 2026-06-19 — H9 resolved: seller-convert E2E un-fixme'd (test-only root cause)

Batch 2 of the post-v4.33.0 remaining-work plan. Closes the last tracked test-coverage gap (H9): the marketplace seller-convert E2E now runs and passes, after a focused diagnostic pinned the long-standing "empty grid / Convert button never renders" timeout to two TEST-only defects — no product bug. `turbo run lint check-types` 4/4 · `next build` green · cspell clean · the full `marketplace.cross-org` spec **8/8 green** locally (`next build && next start` + real DB), including H9 + the 0-console-error gate · `/mimaric-qa` verdict GO. §3.9 preview walk N/A (test-only; no app/UI code changed).

### Fixes (test-only — no product change)
- **H9 — seller-convert E2E un-`fixme`'d and passing.** The grid, the OPEN inquiry row, and the "Convert to Deal" button were always present; two bugs in the *test* made it time out:
  1. **English-only matcher vs an Arabic-rendered page.** `setLangTheme("en")` pins the language via `localStorage`, but the UI language is driven by the server-readable `mimaric-lang` cookie (v4.16.0), so my-listings renders Arabic-first and the affordance reads `تحويل لصفقة`. The test matched the English `/Convert to Deal/` only → 30s timeout. It now matches **bilingually** (`/Convert to Deal|تحويل لصفقة/`, `/Confirm Convert|تأكيد التحويل/`), the convention the rest of the suite already uses.
  2. **Convert collision.** The settlement-refusal test attaches a reservation keyed to the same inquiry; `convertMarketplaceInquiryToDeal` creates a reservation with a UNIQUE `marketplaceInquiryId`, so convert threw `Unique constraint failed (marketplaceInquiryId)` and the inquiry stayed OPEN. The test now strips that test-arranged scaffolding (transfer + deed proof + reservation) before converting, so convert sees a clean pre-convert state.
- **Local-runnable marketplace E2E.** `playwright.config.ts` now loads `.env.local` (`DATABASE_URL`) into the test runner via `@next/env` `loadEnvConfig` — a no-op in CI (no `.env.local`; job env unchanged). `@next/env` is declared as a direct devDependency.
- **Doc accuracy.** `future-plans/REMAINING-WORK.md` marks H9 closed and drops the now-fixed contracts.ts note; stale "DataTable hang / test.fixme" comments in the spec corrected to the real root cause.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.33.1...v4.33.2

## [4.33.1] — 2026-06-18 — Findings cleanup: doc accuracy, only-warn dead-dep removal, contract return-shape honesty

A small post-v4.33.0 cleanup patch — three verified doc/config findings + one minor type-debt fix. No behavior change, no schema, no UI. tsc green · `turbo run lint` 4/4 · vitest 160/160 · `next build` green · `/mimaric-qa` verdict GO (zero code findings). §3.9 preview walk N/A (nothing renders differently).

### Fixes
- **`contracts.ts` return-shape honesty.** `updateContractStatus` re-fetched/updated the contract inside its transaction WITHOUT `include:{ customer:true }` then cast `as typeof contract` — a shape-lie that would hand a future caller `customer: undefined` behind a type that claims otherwise. Both transaction branches (the SIGNED re-fetch + the non-SIGNED update) now fetch WITH the customer relation and drop the cast. The sole caller (`ContractsView.tsx`) discards the return, so this is type-honesty / future-proofing only — zero runtime change.
- **Removed the dead `eslint-plugin-only-warn` devDependency.** It was dropped from the active ESLint config in v4.33.0 (the H7 ratchet) but the `packages/eslint-config` devDependency plus two stale code comments lingered. Removed the dependency (lockfile regenerated) and corrected the two comments (`packages/eslint-config/next.js`) to describe the post-v4.33.0 reality: the governed rules surface as real errors; the pre-existing backlog lives in `eslint-suppressions.json`. The lockfile regeneration also clears the stale `apps/portal` workspace stub left behind by v4.32.0's C2 app deletion.
- **`future-plans/REMAINING-WORK.md` accuracy.** Corrected "two"→"three" tracked tails; fixed the lint-backlog suppression counts to 160 (129 `no-explicit-any` + 20 `no-unused-vars` + 7 `react-hooks/exhaustive-deps` + 4 misc); reframed H9 from "low-value / incremental" to **test-coverage debt on a working path (Medium)** — the seller-convert feature works and is covered at the action/DB-gate layer; only the automated E2E regression is `test.fixme`.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.33.0...v4.33.1

## [4.33.0] — 2026-06-18 — Close the tracked tails: per-tenant blind index, payment reversal UI, lint ratchet, i18n + test/quality cleanup

Closes Sections B + C of `future-plans/REMAINING-WORK.md` — every non-deferred tail from the post-v4.32.0 backlog. The only items left are the three indefinitely-deferred ones (DB region migration / DB-evolution governance, ZATCA Phase-2, Ejar/Nafath SSO). Delivered under manager-mode delegation, the `/mimaric-qa` gate (verdict SHIP, 2 Low findings fixed), and the §3.9 4-theme preview walk. tsc green · `turbo run lint` 2/2 · vitest 160/160 · `next build` green · 0 console errors.

### Security & data (H8)
- **Per-tenant blind index (cross-tenant unlinkability).** `lib/encryption.ts` derives a per-tenant subkey via **HKDF-SHA256** (RFC 5869, native `crypto.hkdfSync`) keyed by a domain-separated `mimaric/blind-index/v2/<orgId>` label, so two organizations produce **different** hashes for the same phone/email/national-ID — a DB-read attacker (without the master pepper) cannot correlate a customer across tenants. `hashForSearch(value, orgId)` → `"v2:"…`; `legacyHashForSearch(value)` → `"v1:"…` kept only for the migration window + backfill. `lib/pii-crypto.ts` adds `searchHashCandidates`/`phoneSearchHashCandidates` (**dual-read** `WHERE hash IN (v2, v1)` so search is non-breaking even mid-migration) and `encryptCustomerData(data, orgId)`; `orgId` is threaded through every write/search site (`customers`, `search`, `portal`, `customer-import`, `marketplace` — the marketplace CRM customer keys to `listing.sellerOrgId` inside the tx). **Live DB:** all 20 customers re-hashed v1→v2 (`scripts/rehash-blind-index-v2.ts`, idempotent, decrypt-then-rehash; 0 failures; 0 v1 remaining; backup table `customer_hash_backup_v4_33`); search-match + cross-tenant unlinkability verified.

### Features (I2, H9)
- **Payment reversal UI.** `PaymentsView` wires the existing `reverseRentPayment` action: an icon-only `Undo2` row action (destructive, §6.6.7) on PAID/PARTIALLY_PAID rent rows opens a `ResponsiveDialog` collecting a **required reason** + amount (defaulted to the collected amount), mints a per-open idempotency key, and writes a signed-negative entry to the append-only `RentPayment` ledger (`finance:write`, atomic, over-reversal guard, audit log). Permission gate now runs before input validation.
- **H9 — my-listings incoming-inquiries grid (robustness fix; spec still `test.fixme`).** `loadAll()` switched from `Promise.all` to `Promise.allSettled` so a single failing sibling fetch (REGA-auth/listings) can no longer blank the inquiries grid; the grid is verified rendering live with 0 console errors. This did NOT make the `marketplace.cross-org` seller-convert spec pass in CI (the seller grid still arrives empty in the CI fixture even though the OPEN inquiry exists), so that spec **remains `test.fixme`** — a tracked tail pending a focused fixture repro. Convert stays covered at the action/DB-gate layer.

### Quality / tooling (H7, C3, W1, I1, F1-tail)
- **Lint genuinely gates now (H7).** Removed `eslint-plugin-only-warn` (it silently downgraded every error to a warning); `@typescript-eslint/no-explicit-any` + `react-hooks/exhaustive-deps` bumped to `error`; added the standard `^_` intentionally-unused ignore pattern. The pre-existing ~159-item backlog is snapshotted into a committed `apps/web/eslint-suppressions.json` (ESLint 9 native `--suppress-all`) so CI **blocks any NEW violation** while the backlog is pruned incrementally (`npm run lint:prune`). No governed rule (`mimaric/*`, PII `no-restricted-syntax`, `forbid-elements`) has any suppression. A ~78-file `any`→precise-type sweep was independently review-verified behavior-preserving.
- **Hardened `no-non-async-export-in-use-server` (W1)** to also flag re-exports (`export { … } from`, `export type { … } from`, `export *`) inside `"use server"` files — the exact Turbopack-mis-lowering class behind the D1 `RetentionTable` 500.
- **`payment-correctness-test` (I1)** now exercises the REAL ledger helpers (`decidePaymentApplication` + `appendRentPayment`) instead of a ~70-line inline re-implementation.
- **i18n facade fixes (F1-tail).** `CircleMenuOverlay` canonicalized to `t(ar, en)`; the 124-call-site `admin/marketplace` English-first facade documented as deliberate (not swapped — silent-flip risk). 14 `require-action-guard` escape-hatch comments re-affirmed across the public/token-gated actions.

## [4.32.0] — 2026-06-17 — Close the non-deferred backlog: security, PDPL compliance, UX, payment ledger, i18n

The backlog-closure release. Delivers every remaining non-deferred item from `future-plans/REMAINING-WORK.md` in one branch / one push — security & data-integrity, a PDPL data-retention console, registration hardening, the UX re-platform, architecture seams, an append-only payment ledger, and the full `t()` i18n migration. The only items intentionally left are the two indefinitely-deferred ones (DB region migration, ZATCA) and Ejar/Nafath SSO. All work delivered under manager-mode delegation with a consolidated `/mimaric-qa` gate (157/157 unit tests, the gate caught + we fixed a Critical unguarded-destructive-action leak) and the §3.9 4-theme preview walk.

### Security & data integrity
- **A3 — hybrid fail-CLOSED rate limiter.** `checkRateLimit`/`peekRateLimit` gain a `failClosed` option; the auth-sensitive keys (`login:*`, `password-reset:*`, `resend-verification:*`) now DENY on a DB error instead of failing open (OWASP-aligned). All other keys stay fail-open (availability).
- **A4 — denormalized `organizationId` NOT-NULL + cross-org FK.** `Lease`/`Reservation`/`PaymentPlan`/`PaymentPlanInstallment` flipped from nullable to `String` NOT-NULL with a real `Organization` FK + index (second half of QA-DB-04/05). **Every `.create()` of these models now sets `organizationId`** — the contracts/reservations actions use `session.organizationId`, the marketplace cross-org reservation uses the **seller** org (`inquiry.sellerOrgId`, which owns the unit), payment-plan installments inherit the plan's org, and the seeds/E2E fixtures set it too. Live DB: org-id backfilled via the transitive owners (incl. the `PaymentPlan ← Contract ← Unit` chain), verified 0 NULLs, then `db push` (plain — non-destructive). Hash columns (`emailHash`/`nationalIdHash`) correctly stay nullable (optional sources).
- **F2 — hardened edge `proxy.ts` (true HTTP 403).** Next 16 uses `proxy.ts` (not `middleware.ts`); the existing proxy now adds a true `403` for non-navigation permission denials (API/fetch/direct) while HTML navigations still render the friendly in-shell 200 AccessDenied — plus an unconditional `x-middleware-subrequest` reject (CVE-2025-29927 defense-in-depth; 16.1.5 already postdates the patched range, so no risky bump). Server-side guards remain authoritative.

### Data lifecycle / PDPL compliance
- **D1 — Data-Retention & Destruction console.** New platform-admin surface `/dashboard/admin/data-retention` (§8 `requireSystem`, `ROUTE_GUARDS` + nav). Per-table (AuditLog/ConsentLog/Notification/WebhookEvent) row-count / oldest-age / window / next-run; a dry-run preview → `ConfirmDialog` → batched/chunked destruction; an unattended cron sharing the same core. PDPL-documented default windows: AuditLog & ConsentLog **730d** (NDMO 2-year audit floor, clamped server-side), Notification 180d, WebhookEvent 90d. The destruction core uses a Postgres **advisory lock** (no concurrent runs), a **self-purge guard** (never deletes its own run's audit rows), and every run is logged to the new `DataRetentionRun` table + `AuditLog`. **The destructive core lives in `lib/server/data-retention-core.ts` (`server-only`)** — only the `requirePermission("billing:admin")` wrappers are `"use server"` (closes the QA-gate-caught unguarded-RPC leak). Scheduler ships **dark** (`retentionSchedulerEnabled=false`).

### Features
- **E1 — registration hardening.** New `Organization.appStatus` enum (`ACTIVE`/`PENDING_VERIFICATION`/`EXPIRED`, `@default(ACTIVE)`); signup quarantines the org as `PENDING_VERIFICATION`, email-confirm flips it `ACTIVE` (same tx as user-verify), an `expire-unverified-orgs` cron quarantines abandoned signups after 14d (PDPL minimization), and a dependency-free **Cloudflare Turnstile** widget + server `siteverify` gate the register form (gracefully disabled when keys are unset, so local/undeployed registration still works).
- **E2 — `/dashboard/more` fully retired** into `/dashboard/settings#profile`; the hub directory is deleted (§3.6 closed).
- **E4 — marketplace `viewCount` dedup** (per `(listing, viewer-org, day)` via the rate-limit lib, fire-and-forget).

### UX re-platform
- **B1 — ~40 raw `<select>` → governed `<SelectField>`** across settings/admin/crm/maintenance/onboarding/help/marketplace/etc. (label/id wiring, RTL, validation state). 0 raw `<select>` remain in `app/**`.
- **B2 — CRM `CustomerDrawer`** re-platformed to a logical-property responsive shell: slides from the inline-END in RTL + becomes a mobile bottom-sheet (the old hardcoded `slide-in-from-right` is gone).
- **E3 — ~13 native `<input type="date">` → the Saudi `HijriDatePicker`** (consistent Hijri toggle); 0 native date inputs remain in `app/**`.

### Architecture / tech-debt
- **C1 — shared seams adopted + lint-bans.** **126** raw `revalidatePath("/…")` strings → `ROUTES.*` (the §8.5 stale-rename hazard) and **~93** inline `JSON.parse(JSON.stringify)` → `serialize()`, plus ESLint bans (`mimaric/no-raw-revalidate-path`, `mimaric/no-inline-json-serialize`, raw-`<select>` via `react/forbid-elements`) to stop regressions.
- **C2** — deleted the dead `apps/portal` app. **C3** — typed `massUpdateUnits` status as `UnitStatus`. **C4** — moved `hijri.ts` to `@repo/ui`, deduped `LocalizedText`, added a shared capture lib, deprecated `MobileKPIDelta`. **H5** — `DashboardView` greeting `useMounted` hydration guard.

### Money / correctness
- **I2/I1 — append-only `RentPayment` ledger.** Rent payments now append immutable signed ledger rows (`PAYMENT`/`REVERSAL`/`REFUND`/`ADJUSTMENT`, `@@unique([installmentId, idempotencyKey])`) and recompute `RentInstallment.paidAmount` as the `SUM` cache inside the transaction — enabling reversals/refunds. `recordPayment`, `bulkMarkInstallmentsPaid` (now `FOR UPDATE`-locked + deterministic idempotency), and a new `reverseRentPayment` all route through one `appendRentPayment` primitive; the pure `effectivePaid` rule extracted to `lib/money.ts`. Live backfill: one synthetic `PAYMENT` per paid installment, reconciled (cache == ledger SUM, 0 divergent rows).
- **I3** — ReportsView AR headers verified correct. **I4** — marketplace `Customer.status` now routes through the Deal-sync state machine. **I5** — convert-after-inquiry made idempotent. **H8** — document delete now removes the remote UploadThing object + audit-logs. **H9** — un-`fixme` of the cross-org convert UI walk was attempted, but CI re-confirmed the "Convert to Deal" button doesn't render on the my-listings grid (a real pre-existing issue, not the flakiness first assumed); kept `test.fixme`, tracked for a focused grid debug. **H4** — reservations/contracts AR copy reviewed.

### Internationalization
- **F1 — full `t()` migration.** A deterministic, shadow-guarded ts-morph codemod converted **1,834** inline `lang === "ar" ? "<ar>" : "<en>"` string-literal ternaries → `t("<ar>", "<en>")` across 40 files (Arabic-first preserved, **zero swap bugs**). It correctly skipped control-value ternaries (`dir`/`locale`/`className`), non-literal branches, and files with no facade `t` (incl. a file with a *reversed* local `t(en, ar)` facade that a blind convert would have language-swapped). ~656 ternaries remain by design (plumbing + the documented tail).

### Deferred (unchanged)
- DB region migration / Prisma-Migrate-of-record governance, ZATCA Phase-2, and Ejar/Nafath SSO remain indefinitely deferred. Opportunistic tails left tracked: the lint-warning ratchet (H7), the 14 `exhaustive-deps` disables (C3 tail), the ~656-ternary i18n tail, and the H9 cross-org convert UI-walk E2E (`test.fixme` — my-listings grid render debug).

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.31.0...v4.32.0

## [4.31.0] — 2026-06-17 — PII ciphertext envelope (`v1:`) + write-time DB CHECK + plaintext read-path telemetry

Sprint 1 of the backlog-closure program (one branch, one push). Closes **A1** (ciphertext envelope + DB CHECK — the §3.3 write-time PII integrity guard) and **A2** (plaintext-passthrough read-path telemetry).

### Security
- **Versioned ciphertext envelope (A1).** `encrypt()` now emits `v1:iv:tag:ct`; a pure `classifyCiphertext()` distinguishes versioned / legacy / plaintext, and `decrypt()` reads BOTH the new `v1:` form and the legacy `iv:tag:ct` form (zero-downtime). A new idempotent, classification-driven backfill (`packages/db/scripts/envelope-backfill-pii.ts` — legacy→prefix, plaintext→encrypt, versioned→skip; `--dry-run`) brought every encrypted column onto the envelope, then `packages/db/sql/2026-07-ciphertext-envelope.sql` added Postgres `CHECK (col LIKE 'v1:%' OR col IS NULL)` constraints — **the write-time guard that makes a plaintext-PII write (the P1-1 class) impossible at the DB layer**. Coverage is global, not Customer-only: `Customer.{phone,email,nationalId}`, `MarketplaceDeedProof.{deedNumberEnc,ownerNationalIdEnc}`, `SystemConfig.smtpPasswordEncrypted` (the JSON `Organization.managerInfo.managerId` is enforced at the write path + A2 telemetry — a column CHECK can't reach a JSON sub-field). Live DB: 20 customers backfilled (legacy→`v1:`) and 1 org `managerId` found **plaintext** and now encrypted; constraints applied + self-validated.
- **Plaintext read-path telemetry (A2).** `safeDecryptField` now classifies before decrypt: a should-be-encrypted field holding plaintext emits a structured, no-PII `[security] PII_PLAINTEXT_DETECTED field="…"` signal (field NAME only, never the value) via the new `apps/web/lib/security-log.ts`, then degrades by surfacing the real value. Until A1's CHECK is live this is the read-side leak detector; after it, plaintext is impossible.
- **Disarmed 3 legacy one-time PII scripts.** `encrypt-existing-pii.ts`, `rehash-customer-phones.ts`, `repair-marketplace-customer-pii.ts` detected "already encrypted" by counting colon-parts (`=== 3`), which the 4-part `v1:` format would have broken — a re-run could have double-encrypted PII or hashed ciphertext into the blind index. All three are now `v1:`-aware (and noted superseded by `envelope-backfill-pii.ts`).

### Tests
- `encryption.test.ts` updated for the `v1:` shape + a full `classifyCiphertext` matrix; new `pii-crypto.test.ts` covers the A2 branch (plaintext flags + returns the value; versioned/legacy do not flag). Crypto suite green; full production build green.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.30.1...v4.31.0

## [4.30.1] — 2026-06-16 — Security patch: password-reset token hash-at-rest + completeness-audit follow-ups

A focused patch after an exhaustive multi-agent re-verification of every audit/backlog source against the shipped v4.30.0 code.

### Security
- **`PasswordResetToken` now hashed at rest (OWASP Forgot Password).** It previously stored the reset token in **plaintext** (`requestPasswordReset` wrote `randomBytes(32).toString("hex")` raw; `resetPassword` looked it up by the raw value) — a DB read (leaked backup/log/Supabase) could use any live token directly. Now: a shared `lib/token-hash.ts` (`sha256Hex`) used by both the reset and email-verification flows; the schema field is `tokenHash @map("token")` (additive `db push`, no RLS change); generation emits a base64url raw token but persists **only** its SHA-256 hash; consume looks up by hash, **validates the password before consuming** (a weak password no longer burns the token), and claims single-use **atomically** in one `$transaction` (`updateMany(usedAt:null, expiresAt>now)` gated on `count===1`) — **closing the previous non-atomic double-spend race**. All four error codes the reset page consumes are preserved. Stale plaintext rows cleared from the live DB.
- **`QA-TEST-01` regression locks.** New runtime-mocked vitest suites (no DB/CI infra) exercising the **real** guard chain: `tenant-isolation.test.ts` (a foreign-org session is refused by 8 representative tenant actions — the §8 contract, with positive controls) and `coupon-redemption-race.test.ts` (N-parallel `applyCoupon` vs the cap → exactly N win — locks the QA-SEC-02 atomic redemption). vitest **149/149**.

### Accessibility
- Added an `aria-label` to the Units bulk-status `<select>` (`UnitsView.tsx`) — a real unguarded violation the axe page-load gate couldn't see (it renders only after row-selection).

### Audit follow-ups (tracked, not dropped)
- `future-plans/v4.30-audit-followups.md` records the verified verdict (CX-Audit **22/22**, CX-Handover 26 done + 5 deferred, QA-Audit 19/2/3/6, Remaining-Work 36/8/3/10/1; **no falsely-marked-done** defects) and **tracks** the genuinely-missed items the critic found were being silently dropped — notably the **§3.3 ciphertext-envelope + DB CHECK** write-time integrity guard (MEDIUM) and **QA-DB-07** audit/consent-log retention (LOW, PDPL). The four known deferrals (ZATCA, DB-region-move, full `t()` tail, HTTP-403) are confirmed legitimate.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.30.0...v4.30.1

## [4.30.0] — 2026-06-16 — Capstone: Marketplace P3 reserve-and-buy + refactors + registration verification

The v4.30 program capstone — delivered as a stack of QA-gated, preview-verified sprint-commits on one branch, one merge. Lights up the headline **proof-gated cross-org conveyance** (shipped DARK behind a kill-switch), decomposes the CRM god-component, swaps the date pickers to react-aria, and adds email-verification-before-activation. After this, the only remaining backlog is the two explicitly-parked ops/regulatory items (DB region move, ZATCA) + the deferred `t()` maintainability sweep.

### Marketplace P3 — reserve-and-buy conveyance rails (behind `SystemConfig.marketplaceConveyanceEnabled`, default OFF)
- **Lawful rails, shipped dark.** Full reserve-and-buy ownership-transfer flow built end-to-end but gated: the irreversible settlement re-reads the conveyance flag **uncached** on every call (instant kill-switch, fail-closed) and again **inside** the `$transaction` (TOCTOU). The adversarial security gate confirmed settlement **cannot** fire with the flag OFF, moderation **cannot** be bypassed, and deed PII **cannot** leak.
- **Self-approve bug fixed.** `publishMarketplaceListing` can now only reach `PENDING_REVIEW`; only a SYSTEM `moderateApproveListing` (`marketplace:moderate`) sets `PUBLISHED`/`APPROVED`. `buyerVisibleWhere` now requires `complianceStatus=APPROVED` (single visibility chokepoint).
- **Proof + authorization gates.** New `MarketplaceDeedProof` (deed# + owner national-ID **AES-256-GCM encrypted at rest**, doc URL/hash, RETT ref) and `OrgRegaAuthorization` (FAL/ad-license, `SELF_ASSERTED → VERIFIED`) tables (RLS enabled). Settlement gates: flag ON → SIGNED contract → deed proof `VERIFIED` → both orgs REGA `VERIFIED` → transfer `READY`. `MANUAL_ATTESTATION → API_VERIFIED` enum so a future REGA/ZATCA API needs **no migration**.
- **State machine** (`lib/marketplace/state-machine.ts`) with validating CAS transitions; `verifyDeedTransferProof` advances `PENDING_SETTLEMENT → READY`, settlement claims `READY → COMPLETED` (idempotency sentinel + CAS double-lock kept).
- **UI:** admin moderation page restructured into Listings / REGA Authorizations / Deed Proofs / **Conveyance** (the SYSTEM_ADMIN-only kill-switch + required legal-signoff note); seller deed-proof submit + org-REGA surface; public REGA-ad-license display.
- **E2E:** the cross-org spec rewritten + un-`fixme`'d — **7 passing** (moderation gate, admin approval, cross-org inquiry PII-encryption, dark-launch kill-switch, settlement-refused-with-flag-OFF asserted at the gate layer).
- **Go-live is gated externally** (Omar's action): platform FAL license, legal sign-off, PDPL DPIA, REGA/ZATCA verification process — the code ships ready, the flag stays OFF until those clear.

### CrmView decompose (QA-ARCH-01) + CX-006
- `CrmView.tsx` **3,788 → 1,518 LOC** — extracted `CustomerDrawer`, `KanbanCard`, `AddCustomerModal`, and config/helpers into co-located modules (verbatim moves, byte-identical behavior).
- **CX-006:** the ~15-field add-customer form migrated to **react-hook-form + zod** + the v4.29 `Field`/`SelectField` primitives (after-blur validation); the `createCustomer` encrypt path, optimistic insert, and PII masking preserved exactly.

### Date pickers → react-aria (Hijri-capable)
- `DateRangePicker` + `HijriDatePicker` internals swapped to **`react-aria-components` + `@internationalized/date`**, public APIs byte-identical (all 5 dashboard consumers + Contracts untouched; the `?from=&to=` query contract preserved). `react-day-picker` removed.
- RTL nav-arrow glyph flips via `useLocale()`; **Gregorian/Hijri display toggle** (Umm al-Qura via locale extension) that keeps the stored value Gregorian; **Western digits forced** in the Arabic calendar (§6.3.4). Timezone-correct Date⇄CalendarDate (local components, Gregorian-normalized) — verified by the QA gate.

### Registration email-verification-before-activation (§3.2)
- New users must verify their email before sign-in. OWASP token hygiene: `randomBytes(32)` emailed, **SHA-256 hash stored**, single-use atomic, 24h expiry. `authorize()` throws `EMAIL_NOT_VERIFIED` after the password check (no enumeration); the GET verify link renders a confirm page, activation only on POST (prefetch-safe). Resend rate-limited + anti-enumeration. New `User.emailVerified` (existing rows backfilled) + `EmailVerificationToken` (RLS); daily token-purge cron. Invitation acceptance auto-verifies (invite link proves email control).

### QA-FE-02 + a11y + housekeeping
- Units + Maintenance create forms → react-hook-form + zod + `Field`/`SelectField`.
- **axe 26/26 green** maintained: new `--destructive-strong` + `--accent-strong` tokens fixed pre-existing data-dependent badge-text color-contrast (the `--success-strong` pattern; base `--destructive` unchanged).
- Platform REGA **FAL-license** field (admin settings + login/landing placeholder). Removed a dead `/dashboard/gis/assets` link. `/dashboard/more` hub decommissioned; UNIT_STATUS registry + sparkline dedup + k6 baseline (standing backlog).
- **`t()` best-effort** (Omar's call): DashboardView migrated (26 ternaries); the ~2,200-string tail deliberately deferred + logged (`future-plans/t-migration-deferred.md`) — zero-user-value churn, not a release blocker.

### Database (applied to the live Supabase DB this cycle)
- `db push` for: marketplace P3 tables/enums + `SystemConfig` conveyance/legal-signoff columns + `MarketplaceListingStatus.PENDING_REVIEW`; `User.emailVerified` + `EmailVerificationToken`. Both new-table sets RLS-enabled + verified (`relrowsecurity=t`); 21 existing users backfilled `emailVerified`. v4.28 money-precision/orgId-backfill manual steps also applied + verified.

### Gates
- Per-sprint `/mimaric-qa` security/QA gates (all SHIP; fixed an invitation-lockout regression + dead unguarded action). **`npm run build` + check-types green; axe-core e2e 26/26 green** (both audiences × both themes); marketplace E2E 7 passing. §3.9: 4-theme walk across all touched routes (CRM/units/maintenance/payments/contracts/reservations/marketplace/admin-marketplace/verify-email), mobile 375px no-overflow, 0 real console errors (residual = benign Next RSC prefetch-aborts on login).

### Deferred (unchanged)
- DB region move (Sydney → Bahrain), ZATCA e-invoicing — explicitly parked. The full `t()` migration tail. True HTTP-403 edge middleware (CVE-2025-29927 risk vs. marginal value — server-side guards already enforce).

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.29.0...v4.30.0

## [4.29.0] — 2026-06-16 — Accessibility-green + governed primitives + Lighthouse CI (QA-FE-01/03 · CX-017)

Third release of the v4.30 program. Closes the accessibility debt the v4.26 axe-gate expansion baselined, behind new governed primitives, and adds a Lighthouse CI gate. **The axe-core gate now enforces every critical/serious WCAG 2.1 A/AA rule across all 16 tenant + 8 platform routes with an EMPTY baseline — 26/26 green.**

### Governed accessibility primitives (`@repo/ui`)
- **`Field`** — mints a stable `useId()` and wires `<label htmlFor>` ↔ control `id` + `aria-invalid` + `aria-describedby` + `role="alert"` errors, via a render-prop. Removes the "label with no `htmlFor`" class of bug (QA-FE-01).
- **`SelectField`** — a thin governed wrapper over a NATIVE `<select>` that guarantees an accessible name (label-associated or `aria-label`), keeping value/onChange/`<option>` semantics so migration is near-mechanical (QA-FE-03).
- **`Alert`** compound API — `AlertIcon` / `AlertContent` / `AlertToolbar` + an `IconButton`-owned dismiss, extending the existing tokenized `variant × appearance` primitive (§6.4).

### A11y debt fixed → all 4 baselined rules un-baselined
- **`aria-allowed-attr` (was 19 nodes, one shared cause):** the AppTopbar notifications `PopoverTrigger asChild` wrapped a `<span>` (invalid `aria-haspopup`/`aria-expanded`/`type`) — now wraps the real-`<button>` `IconButton`, with the unread badge positioned via the parent.
- **`color-contrast`:** new **`--info-strong`** + **`--warning-strong`** tokens (mirroring v4.20's `--success-strong`) for text-on-tint badges; applied to the billing trial-expiry text, audit event badges, invoice ISSUED badge, Units RESERVED/MAINTENANCE chips, CRM assignee initial, and a muted `RouteError` line.
- **`label` / `select-name`:** the flagged inputs/selects (reports date pickers, settings org form, admin/tickets + admin/seo filters) now use `<Field>` / `<SelectField>` / `htmlFor`+`id` / `aria-label`.
- Both `accessibility.admin.spec.ts` and `accessibility.system.spec.ts` now carry `KNOWN_BASELINE_RULES = []`.

### Lighthouse CI (CX-017)
- Added `@lhci/cli` + `lighthouserc.json` + a CI step auditing the **public** `/auth/login` page (no auth script needed; authenticated-route a11y is gated more thoroughly by the axe suite). Assertions: **accessibility ≥ 0.95 (error)**, best-practices/SEO (warn). Verified locally — the login page passes the 0.95 a11y gate.

### Deferred to the v4.30 capstone
- **QA-ARCH-02** seam adoption (UNIT_STATUS label, serialize/ROUTES) and **QA-FE-02** (Units/Maintenance form RHF) — both touch files the capstone reworks (CrmView/forms), so they ride there with CX-006.

### Gates
- **axe-core e2e 26/26 green** (empty baseline, all routes × both audiences); a live re-scan confirms label/select-name/color-contrast/aria-allowed-attr = 0. `npm run build` + check-types (web+portal) + lint (0 errors) green; Lighthouse local pass. §3.9: 13 screenshots (settings/billing/audit/reports × themes + topbar popover), 0 console errors.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.28.0...v4.29.0

## [4.28.0] — 2026-06-16 — Schema correctness & DB governance (QA-DB-01…06 · QA-SEC-02 schema)

Second release of the v4.30 program. Tightens database correctness across money precision, tenant scoping, referential actions, and uniqueness. **Schema-only** — no app-code change; the Prisma client types are unchanged (Decimal stays Decimal). Validated by CI's ephemeral `db push` + a real precheck against the populated local DB.

### Money precision (QA-DB-02)
- Every SAR-monetary `Decimal` field is now explicit **`@db.Decimal(14,2)`** (43 fields across Unit/Customer/Reservation/Contract/PaymentPlan/Lease/Invoice/Payment/Subscription/Coupon/Deal/Marketplace…) instead of Prisma's default `decimal(65,30)`; the two `vatRate` columns → **`@db.Decimal(6,4)`**. Postgres `numeric` is the exact type for money; the wide default invited drift.
- **Precheck run against the live DB:** all money values fit except 5 `mrrSar` rows (`399.1666…` = a 4790-SAR annual plan ÷ 12 — a legit computed MRR), which round to `399.17`. The runbook (`packages/db/sql/2026-06-v4.28-manual-steps.md`) carries the explicit round-first remediation so the cast is provably lossless.

### Tenant scoping (QA-DB-04) + indexes (QA-DB-06)
- Denormalized **`organizationId`** (nullable this release) + `@@index` added to `Lease`, `Reservation`, `PaymentPlanInstallment` so their list/AR queries stop joining through Unit/PaymentPlan to scope by org. Tenant-leading composite `@@index([organizationId, status])` added to `Customer`, `MaintenanceRequest`, `Reservation`, `PaymentPlanInstallment`. Backfill SQL (`2026-06-orgid-backfill.sql`, idempotent, transitive-join) + the NOT-NULL tightening are deferred post-backfill follow-ups (a NOT-NULL column with no default aborts `db push` on a populated table — §4).

### Referential actions (QA-DB-03) + uniqueness (QA-SEC-02 schema)
- `onDelete: Cascade → Restrict` on `SubscriptionEvent.subscription` and `SubscriptionMrrSnapshot.subscription`/`.organization` — audit/financial-history rows must never cascade (verified no org-delete flow relies on the cascade). `@@unique([couponId, organizationId])` on `CouponRedemption` completes the v4.27 coupon-redemption race fix (precheck: 0 existing rows → safe).

### Governance (QA-DB-01)
- Removed the stray untracked `packages/db/prisma/migrations/` directory — the repo deliberately uses `prisma db push`, not Migrate (§4). No new tables → `2026-06-enable-rls.sql` unchanged (`rls:check` green, 50 tables).

### Manual populated-DB steps (owed on every long-lived env)
- `packages/db/sql/2026-06-v4.28-manual-steps.md` is the ordered runbook: money/coupon prechecks (done for local) → round `mrrSar` → `db push` → org-id backfill → (deferred) NOT-NULL tightening. CI's ephemeral DB needs none of it; the populated DB does.

### Gates
- `prisma generate` + `prisma validate` + `rls:check` green; `db:generate` + **check-types green (web + portal)**; `npm run build` green. CI `prisma db push --accept-data-loss` (ephemeral) + seed + payment tests are the schema-applies-cleanly proof. No UI change → no §3.9 preview walk (the §3.9 gate scopes to UI-touching releases).

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.27.0...v4.28.0

## [4.27.0] — 2026-06-16 — P0 security hardening (QA-SEC-01…07 · QA-BE-01)

First release of the **v4.30 "finish the backlog" program**. Closes every reproducing P0/P1 finding from the full-repo QA audit (`future-plans/QA-AUDIT-REMEDIATION.md`). Code-only — no schema change. Every finding was re-validated against `main` before the fix, and every diff was main-thread-audited (§3.8).

### Server-action authorization (QA-SEC-01)
- Every exported async function in a `"use server"` file is a network-reachable POST RPC. Internal helpers that wrote tenant data on **caller-supplied IDs** are no longer exported actions: `syncCustomerPipelineStatus` / `syncDealStageForUnit` → `lib/server/pipeline-sync.ts`, `snapshotMrrForMonth` → `lib/server/mrr-snapshot.ts`, `autoExpireReservations` → `lib/server/reservation-expiry.ts` — all now `import "server-only"` modules, imported by their guarded callers / CRON_SECRET-gated routes. The dead arbitrary-query action `paginated.ts` (zero importers, arbitrary model + `where`, no guard) was deleted.
- **New ESLint rule `mimaric/require-action-guard`** (`packages/eslint-config`): every exported async fn in `app/actions/**` `"use server"` must call an auth guard (`requirePermission` / `requireTenantPermission` / `requireSystem` / `getTenantSessionOrThrow` / …) or carry an inline disable with a reason.

### Coupon authorization + redemption race (QA-SEC-02)
- `applyCoupon` now requires `billing:write`, `validateCoupon` requires `billing:read` (`requireTenantPermission`) — previously any tenant role could rewrite invoice `total`/`discountAmount`/`vatAmount`. The redemption increment is now an **atomic conditional `updateMany`** (`currentUses < maxRedemptions`) inside an interactive `$transaction` — two concurrent redemptions can no longer both slip past the cap. (The `@@unique([couponId, organizationId])` belt-and-suspenders constraint lands in v4.28.0.)

### Unit bulk-update state machine (QA-BE-01)
- `massUpdateUnits` validated caller-supplied `status` against a new `UNIT_TRANSITIONS` state machine (`lib/units/state-machine.ts`, mirroring contracts) and **blocks `→ AVAILABLE`/`→ RESERVED` while a SIGNED contract or active lease exists** on the unit. Invalid transitions reject the whole batch with the offending unit codes.

### Security headers (QA-SEC-03)
- Global `headers()` now sets `X-Frame-Options: DENY`, `Strict-Transport-Security` (2y; includeSubDomains; preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and a **`Content-Security-Policy-Report-Only`** baseline (ships Report-Only first; promoted to enforcing in a later tag once violations are reviewed).

### Session lifetime (QA-SEC-04)
- JWT session now carries an explicit `maxAge` (7 days) + `updateAge` (24h) instead of the implicit 30-day default.

### Login account/role enumeration (QA-SEC-05)
- `loginAction` now verifies credentials via `signIn()` **first** and only resolves the management/tenant-mode routing **after** auth succeeds — the `USE_MANAGEMENT_MODE` / `USE_TENANT_MODE` hints can no longer reveal whether an email exists or its account type before a password is proven.

### Encryption integrity (QA-SEC-06)
- `decrypt()` no longer fails **open**: a value in valid `iv:tag:ciphertext` shape whose GCM `final()` throws (tampering / wrong key) now logs a security event and **re-throws** instead of silently returning the ciphertext. The legacy-plaintext convenience (non-`:` / non-3-part input → return as-is) is preserved.

### Marketplace inquiry rate-limit (QA-SEC-07)
- `confirmMarketplaceInterest` (the public-facing inquiry write) is now rate-limited: **10/org/hour** + **3/(org,listing)/day** via the existing Postgres limiter.

### Guard-coverage gate (QA-TEST-01)
- New deterministic `__tests__/guard-coverage.test.ts` (TS-AST) asserts **every** exported `"use server"` action in `app/actions/**` either calls a guard or is in an audited `GUARD_EXEMPT` allowlist (15 entries, each with a reason) — a NEW unguarded action now fails the test, even though lint warnings are tolerated. Includes a "no stale exemptions" honesty check.

### QA gate (AGENTS.md §3.11)
- A `/mimaric-qa` subagent audit gated this release (**GO**, no Critical/High). Fixed **M-1**: the fail-closed `decrypt()` (QA-SEC-06) could 500 a list render if one row had stale-key/tampered ciphertext — `decryptCustomerData` / `decryptOrgManagerId` now degrade per-field gracefully (`safeDecryptField` → masks + logs, never returns ciphertext) so a corrupt row reads "unavailable" instead of taking the page down. Added `lib/encryption.test.ts` (round-trip · tamper→throw · wrong-key→throw · legacy-plaintext passthrough). Two Lows accepted/deferred: coupon per-org duplicate race → the `@@unique([couponId, organizationId])` constraint in v4.28.0 (`applyCoupon` has no UI callers yet); rate-limit-on-failed-inquiry → intentional safe ordering (blocks pre-validation spam).

### Gates
- `npm run build` green; `check-types` + lint (**0 errors**, warnings only) + cspell green; **vitest 126/126** (122 existing + 4 guard-coverage). §3.9 preview walk + the security claim checks (headers present, login works, CSP Report-Only console-clean, CRM PII still decrypts/renders) posted in the release thread. No schema/RLS change.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.26.0...v4.27.0

## [4.26.0] — 2026-06-15 — Accessibility CI gate: all routes × tenant + system (CX-017)

Final CX-audit remediation wave. Expands the automated axe-core gate and closes the **CX-017** accessibility-CI portion. **Test-only change** — no application/runtime code touched.

### Accessibility gate expansion (CX-017)
- The axe-core scan went from **5 routes under 1 role** to **all 16 tenant dashboard routes (ADMIN)** + **8 platform routes (new SYSTEM_ADMIN role)** — i.e. "all routes × system + tenant". New `e2e/auth.system.setup.ts` + `system-tests` Playwright project (storageState for `system@mimaric.sa`) + `e2e/accessibility.system.spec.ts`.
- The gate now enforces **every** critical/serious WCAG 2.1 A/AA rule across that full surface, except the documented pre-existing-debt baseline.

### Honest correction — `color-contrast` baseline stays
- The roadmap expected to **drop** the `color-contrast` baseline (v4.20's `--success-strong`). Verified against the running app, that claim was **partial**: v4.20 fixed the *success badge* specifically, but the route expansion surfaced **~5 other** `color-contrast` (serious) violations plus **2 `label`** (critical) and widespread **`select-name`** (critical, native `<select>` with no accessible name). These are pre-existing **QA-FE-01 / QA-FE-03** debt, SURFACED — not introduced — by the expansion. They are baselined with accurate per-rule documentation; the gate catches every other rule. Fixing them is the governed `Field` / `Select` primitive effort (tracked in `future-plans/QA-AUDIT-REMEDIATION.md`).

### CX-003 part 2 — already satisfied (no code)
- The audit's CX-003 pt2 (RSC `CrmView`) was found **already done**: `crm/page.tsx` is a Server Component that fetches server-side and `CrmView` seeds from props (`loadData()` is a post-mutation refetch only, never a mount fetch). The first-paint waterfall is already gone, so the risky 3,756-line decomposition is intentionally **not** undertaken (no user-facing benefit; §3.5/§3.7).

### Deferred to v4.27
- **CX-006** — the CRM add-customer form RHF migration (a ~300-line, 13-field + property-linking form in `CrmView`) deserves its own verified §3.9 cycle.
- **CX-017 Lighthouse CI** — adds a new CI dependency + job that needs careful CI verification.

### Gates
- `check-types` + lint (0 errors) + cspell green; **axe suite green locally** — 26/26 (16 tenant + 8 system routes + setups), 0 critical/serious outside the documented baseline. No app code changed, so no §3.9 preview walk applies; the axe suite (re-run in CI) is the verification.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.25.0...v4.26.0

## [4.25.0] — 2026-06-15 — RSC server-rendering (no first-paint waterfall) · Tenant→portal lockout

Sixth CX-audit remediation release. Closes **CX-003 part 1** (server-render the heavy list pages — kill the client mount-fetch "waterfall") and **CX-018** (route the Tenant `USER` role away from the owner dashboard). No schema change.

### RSC conversion of 5 list pages (CX-003 pt1)
- **Contracts, Reservations, Payments, Marketplace, Documents** are converted from `"use client"` god-components that fetched their list *after* mount (empty skeleton → round-trip to the DB → flash of content) into **Server Components**: each `page.tsx` now `requirePermission`s and fetches the list server-side, passing it to a new client island (`ContractsView` / `ReservationsView` / `PaymentsView` / `MarketplaceView` / `DocumentsView`). The page arrives **already filled** — no first-paint client fetch. (This is a *perceived*-latency fix; the raw ~223 ms Sydney round-trip is still paid server-side — the 10–15× lever is the deferred Bahrain DB move. `CrmView` RSC is deferred to v4.26.)
- The client islands seed state from props and keep their existing `loadX()` for post-mutation refresh (create / edit / sign / bulk / record-payment / upload) and their lazy lookups (customers/units on modal open) — so no behaviour changes. **Marketplace** additionally threads `searchParams` into the server fetch and adds a first-run skip so a filter change still re-fetches but the initial render does not double-fetch.
- **Permission parity:** each server shell requires the *same* key its list action enforces — `contracts:read`, `reservations:read`, `documents:read`, `finance:read` (payments), `marketplace:read` — so a forbidden role gets a clean denial instead of an empty shell.
- `getDocuments` now `serialize()`s its rows (consistent with the other list actions; hardens the RSC prop boundary).

### Tenant → portal lockout (CX-018)
- The `USER` (Tenant) role holds `dashboard:read`, which gated the **Dashboard home, Leasing, and Finance** pages — so a Tenant could open the **owner's financial KPIs** by typing the URL (login routed them to `/portal`, but nothing blocked direct navigation). `auth.config.ts` now redirects any `role === "USER"` off **every** `/dashboard/**` to `/portal`, placed **before** the onboarding redirect (a Tenant is never bounced to `/dashboard/onboarding`, an org-owner flow). System and PropertyOwner routing unchanged.

### QA gate (AGENTS.md §3.11)
- A `/mimaric-qa` subagent audit gated this release (GO, no Critical/High). Findings fixed: **M-1** `getDocuments` now serializes at the RSC boundary; **L-1** `DocumentsView` dead `loading`/`loadError` state replaced with a real `loadDocs()` refresh (cleared 2 lint warnings + restored the skeleton/error states).

### Gates
- `npm run build` green (all 5 pages emit as `ƒ` dynamic / server-rendered); `check-types` + lint (0 errors) + cspell green. §3.9: 25 screenshots (5 pages × light·dark × AR·EN + 3 mobile) — **0 console errors**; probes: every page renders + no Decimal leak; contracts list HTML present in the **first server response** (no waterfall); CX-018 — a Tenant is redirected from `/dashboard`, `/dashboard/finance`, `/dashboard/contracts`, `/dashboard/crm`, `/dashboard/onboarding` to `/portal`, and `/dashboard/finance` shows the portal (not owner KPIs). No schema/RLS change.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.24.0...v4.25.0

## [4.24.0] — 2026-06-15 — Bulk ops · CSV/Excel import · DRAFT contract edit

Fifth CX-audit remediation release. Closes **CX-010** (bulk operations + CSV/Excel import) and **CX-011** (DRAFT contract editing). No schema change.

### Bulk operations (CX-010)
- **Payments** — select rows → **Mark as paid** (the "record N rent payments at once" flow; ConfirmDialog-gated; writes `paidAmount`+`status` per §4). Gated `finance:write` to match single-row `recordPayment` — the bulk path is never more permissive.
- **Reservations** — bulk **Cancel** + **Delete** (ConfirmDialog). **Contracts** — bulk **Send/Cancel** + **Delete (DRAFT-only, server-enforced)**.
- All via `enableSelection` + `DataTable.bulkActions`; each bulk action is an atomic `$transaction`, permission-gated, org-scoped, with one audit event.

### CSV/Excel import wizard (CX-010)
- New 5-step wizard (**Requirements → Upload → Map columns → Validate-preview → Import**) for **customers + units**, reachable from an **Import** button on CRM + Units. Step 1 is a **requirements panel** — required/optional columns, data formats (Saudi phone, national-ID, unit-type enum), the **5,000-row + 10 MB caps**, accepted `.csv`/`.xlsx`, and a **Download template** (bilingual `.xlsx`).
- **Validate-all-then-all-or-nothing** import in one bumped-timeout `$transaction` (default), with an opt-in **"skip bad rows"** toggle. Per-row + in-file + DB dedupe via the **blind-index hash** (batched). Bilingual RTL column-map.
- **Customers are written ONLY through `encryptCustomerData`** (pre-encrypted `createMany`; raw PII never inserted). `customer-import.ts` is whitelisted in the PII ESLint guard; validation re-runs server-side; one audit event per import (`importBatchId` is a runtime UUID — no schema column).

### DRAFT contract editing (CX-011)
- New `updateContract` server action — **DRAFT-only** (rejects non-DRAFT server-side; `requirePermission` + `logAuditEvent` before/after). For leases, term changes (dates/frequency/amount) **regenerate the rent installments** via the shared `buildRentInstallments` helper (no stale rows).
- The contracts list exposes an **edit affordance on DRAFT contracts only**, reusing the v4.22 RHF create form pre-filled in edit mode (`useUnsavedChanges` attached). Bulk status transitions validated through `isValidContractTransition`.

### QA gate (AGENTS.md §3.11, first run)
- A `/mimaric-qa` subagent audit gated this release. Findings fixed: **bulk Mark-as-paid permission** raised `payments:write` → `finance:write` (closes a privilege-escalation gap vs single-row `recordPayment`); **import validation messages** bilingualized (AR / EN). Flagged/deferred: the pre-existing payments-page UI gate uses `payments:write` while the actions require `finance:write` — an access-model product call.

### Gates
- `npm run build` green; `check-types` + lint (0 errors) + cspell green; §3.9 screenshots (import requirements EN + AR-RTL-dark, bulk toolbars on payments/reservations/contracts, DRAFT-only edit pencil) — **0 console errors**; claims: bulk select→action shows the selected count, requirements panel + caps render, DRAFT-only edit affordance present (absent on Signed), import writes go through the encrypt path. No schema/RLS change.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.23.0...v4.24.0

## [4.23.0] — 2026-06-14 — CX bundle: federated record search, DataTable power tools, Help in Cmd-K

Fourth CX-audit remediation release. Closes **CX-002** (the audit's #1 Critical leverage item), **CX-014**, and **CX-015** — CX-002 and CX-015 were absent from the original roadmap. Bundled behind one §3.9 gate.

### Federated record search (CX-002)
- `globalSearch` (`apps/web/app/actions/search.ts`) rewritten from a plaintext-only 3-entity lookup into a **7-entity federated search** — customers, units, contracts, reservations, payments, maintenance tickets, documents. Customers match by name / Arabic name / **encrypted phone · email · national-ID via blind index** (ports the `getCustomers` OR-query — `phoneSearchHash`/`hashForSearch`, so `05…` and `+9665…` both hit). Each entity is **permission-gated** (a role only sees record types it can read) and **tenant-scoped**; customer results are **PII-masked** (`***NNNN` — raw values never enter the payload) and every search is audit-logged (`READ_PII`/`READ`).
- **§8 audience gate:** the action returns empty for system/no-org sessions; the Cmd-K records group is hidden for platform staff (system Cmd-K stays navigation-only).
- New shared client hook `apps/web/hooks/useFederatedSearch.ts` (200ms debounce, 2-char / 3-digit minimum, monotonic sequence token dropping stale responses, ~500ms spinner threshold, never throws) + one `apps/web/lib/search-entity-meta.ts` (icon + bilingual label + "See all" list route) feeding all three surfaces.
- **Cmd-K** (`CommandPalette.tsx`) now searches records (was navigation-only) — `shouldFilter={false}` self-filtering, grouped results, masked PII rendered `dir="ltr"`, "See all →", `aria-live` count, query-aware empty + friendly inline error. The **top-bar dropdown** and **mobile search sheet** upgrade in place via the shared hook.
- Fires `search_performed` (result count only — never the query, which may be PII).

### DataTable saved views · column reorder · Excel export (CX-014)
- New `SavedTableView` model (personal, org+user-scoped) + `apps/web/app/actions/saved-views.ts` (async-only; every query scoped by `organizationId` AND `userId`). A view = `{ sorting, columnFilters, columnVisibility, columnOrder, density, pageSize }` (versioned JSON), reconciled against live columns on apply so a schema change never hides or crashes a column.
- `packages/ui/src/components/DataTable.tsx` gains three **opt-in** features (existing tables render unchanged): a **Views** menu, **@dnd-kit** column reorder (header-only drag handle, RTL-aware keyboard sensor, restrict-to-horizontal), and a toolbar **Export to Excel** (`onExport` → `lib/export.ts`, Western digits, bilingual headers). Wired on **Payments / Reservations / Contracts** (sale + lease).
- Hardened the shared `exportToExcel` against **CSV/spreadsheet formula injection** (neutralizes leading `= + @` / control chars; preserves plain negative numbers).

### Help in Cmd-K + route-guard (CX-015)
- Added the missing `/dashboard/help` entry to `ROUTE_GUARDS` (tenant audience — completes the F4 SSOT and makes the edge audience gate explicit) and surfaced **Help in Cmd-K** for tenant users. (Help was already discoverable via the radial nav + profile menu; the "no nav entry" finding was measured against the obsolete sidebar source.)

### Accessibility
- The mobile `BottomSheet` gained an opt-in `srOnlyTitle` so the search sheet carries an accessible Radix `DialogTitle` — clears a pre-existing "DialogContent requires a DialogTitle" console warning.

### Gates
- `npm run build` green; `check-types` + lint (0 errors) green; §3.9 screenshots — Cmd-K search, top-bar dropdown, mobile sheet, Payments/Reservations/Contracts tables, Cmd-K Help, system-user Cmd-K × light/dark × AR/EN + 375px; **0 console errors**; claim probes: name/phone search → masked customer (`***NNNN`) across Customers/Reservations/Payments; system Cmd-K → no tenant records; Views + Export controls present on all three tables.

### Schema / RLS
- `prisma db push` applied the additive `SavedTableView` table; `2026-06-enable-rls.sql` regenerated (CI `rls:check` green). **Manual step owed:** apply `ALTER TABLE IF EXISTS public."SavedTableView" ENABLE ROW LEVEL SECURITY;` in the Supabase SQL Editor and verify `relrowsecurity=t` (RLS-on + no-policy = the PostgREST/anon firewall; §4).

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.22.0...v4.23.0

## [4.22.0] — 2026-06-14 — CX bundle: form validation (RHF), unsaved-changes guard, SAR adoption, join-request status

Third CX-audit remediation release. Closes CX-006, CX-007, CX-008, CX-009.

### Inline form validation (CX-006)
- The **reservation** create form and both **contract** create forms (sale + lease) now use **react-hook-form + zod** (`mode: "onTouched"`) — required fields show a **field-level bilingual error after blur/submit** (red border + one-line message under the field) instead of a single submit-time toast, with a "Required fields marked with *" legend. Server-side validation is unchanged. The complex autocomplete (customer/unit), `SARAmountInput`, and `HijriDatePicker` inputs are wired via RHF `Controller`; URL prefill (reservation `?customerId`, contract `?dealId`) preserved; the v4.21.0 contract sign-confirm is untouched.
- The CRM add-customer form keeps its current submit-time validation for now; its full RHF migration folds into v4.26 (where CrmView is converted to RSC) to avoid rewriting the deeply-coupled form twice.

### Unsaved-changes guard (CX-007)
- New `apps/web/hooks/useUnsavedChanges.ts` — warns before tab close / refresh / external navigation while a form is dirty (`beforeunload`). Attached to the reservation + contract forms via RHF `isDirty`.

### SAR input (CX-008)
- `SARAmountInput` now formats with `en-SA` (Western digits + comma grouping in both languages, matching KPI values / CX-019; localized ر.س / SAR suffix unchanged). **Adopted** for the reservation amount and the CRM budget field (were raw `type=number`).

### Join-request status (CX-009)
- New **"My Requests"** tab in the Help Center showing the user's organization join requests (org name, status badge, submitted/expiry dates, review note) with a **Cancel** action on pending requests — reusing the existing `getMyJoinRequests` + `cancelJoinRequest`. The onboarding "join request submitted" screen now links to it (`/dashboard/help#join-requests`), closing the previous dead-end.

### Gates
- `npm run build` green; CI green; §3.9 screenshots (reservations/contracts/CRM/help × light/dark × AR/EN + 375px mobile); 0 console errors; interactive proof: empty-submit on the reservation + contract forms renders inline field errors + the required legend (not a toast).

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.21.0...v4.22.0

## [4.21.0] — 2026-06-14 — CX bundle: trustworthy errors, confirm discipline, non-blocking consent + analytics

Second CX-audit remediation release — the first *bundled* tag (5 findings, two commits, one release): CX-012, CX-013, CX-021 (errors/confirm/sign) + CX-005, CX-004 (consent/analytics).

### Trustworthy errors (CX-012)
- New `apps/web/lib/error-sanitizer.ts` (pure module) — `sanitizeError(err, lang)` maps any thrown error to a safe bilingual message, hiding Zod/Prisma/SDK internals, stack traces, status codes, and variable names (AGENTS.md §6.11.4). Short, deliberately-friendly server messages pass through; technical or over-long ones collapse to a friendly fallback.
- Routed user-facing `toast.error` / error sites through it across contracts, reservations, payments, CRM, settings, billing, help, portal, and admin. Fixed two confirmed raw leaks: the SEO uploader's raw UploadThing message and the admin email/marketplace English-only `err.message`.

### Confirm discipline + sign-confirm (CX-013, CX-021)
- New ESLint guard (`no-restricted-syntax`) banning native `confirm()`/`window.confirm()`/`alert()` — destructive confirmations must use the governed `<ConfirmDialog>` (AGENTS.md §6.6).
- Contract **signing now opens a `<ConfirmDialog>`** instead of firing immediately (irreversible action), and that dialog **surfaces the required-documents gate** (count of missing docs) at sign time — previously only visible in the detail drawer.

### Non-blocking consent (CX-005)
- The PDPL cookie banner moved from a full-width `fixed bottom-0` bar (which overlaid the Kanban "Add" buttons, the login form, and ~⅓ of mobile) to a **compact bottom-start corner card** that never covers CTAs and, on mobile, sits **above** the bottom tab bar. Equal-prominence Reject/Accept and persisted dismissal unchanged; GA4 still blocked until consent.

### Analytics (CX-004)
- New `apps/web/lib/analytics.ts` — `trackEvent(name, params)` (no-op until consent; `window.gtag` only exists post-consent — never throws) + `identify()` (opaque user/org ids, no PII) + an `AnalyticsEvent` taxonomy. Wired the funnel: `customer_created`, `reservation_created/confirmed`, `contract_created/signed`, `payment_recorded`, `maintenance_ticket_created`, `export_performed`. Numeric params are Western-digit; no PII in any event.

### Gates
- `npm run build` green; §3.9 screenshots (login + contracts/CRM/payments/dashboard × light/dark × AR/EN + 375px mobile); 0 console errors; claim probes: `window.gtag` undefined pre-consent, sign opens ConfirmDialog, consent banner clears CTAs.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.20.0...v4.21.0

## [4.20.0] — 2026-06-14 — CX Quick Wins: Western numerals, success contrast, tap targets, Kanban polish

First CX-audit remediation release (Quick Wins). Closes CX-019, CX-016, CX-022, CX-020 from the CX audit (`verification/Mimaric-CX-Audit.html`).

### Western numerals everywhere (CX-019)
- New `apps/web/lib/format-number.ts` — Latin-digit number/currency/date helpers. Matches the modern Saudi convention (Absher, Aqar, Bayut, and ZATCA/Ejar APIs all use 0–9) and the existing KPI values.
- Migrated ~78 formatter call sites + `lib/hijri.ts` + the shared `DateRangePicker` and `HijriDatePicker` from `ar-SA` → `ar-SA-u-nu-latn` (keeps Arabic month/weekday names + RTL, forces Western digits). Non-formatter `ar-SA` (hreflang, SchemaMarkup, `<html lang>`) deliberately untouched.
- Resolves the dashboard inconsistency where dates rendered Arabic-Indic digits (٢٠٢٦) while metrics used Western. Verified: **0** Arabic-Indic digits on the AR dashboard (was 11 — the date-range label).

### Success-badge contrast → WCAG 2.2 AA (CX-016)
- New `--success-strong` token (light: darker, dark: lighter) so text-on-tint success badges clear 4.5:1 while filled-green stays vivid. Applied across `apps/web` and the shared `Badge` / `KPICard` / mobile primitives (one Badge fix propagates everywhere). Fixed 2 green-on-white violations (`auto-save-indicator`, `CustomerActivityTimeline`).

### Mobile tap targets (CX-022)
- `mobile/ApprovalRow` + `mobile/CustomerCard` icon buttons 36→44px on mobile (`h-11 w-11 md:h-9 md:w-9`), meeting the WCAG 2.5.8 / mobile minimum.

### Kanban card name (CX-020)
- Root cause: the global `button { display: inline-flex; justify-content: center }` rule broke Tailwind `truncate` — centered flex overflow clipped the leading glyph ("ohammed Al-Qahta"). Fixed with `block` + a `title` tooltip; names now ellipsize at the end ("Mohammed Al-Q…").

### Gates
- `npm run build` green; 28 screenshots (CRM / Payments / Finance / Contracts / Dashboard / Billing × light/dark × AR/EN + 375px mobile) in `verification/screenshots-v4.20.0/`; **0** console errors; CX-019 digit-probe = 0.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.19.1...v4.20.0

## [4.19.1] — 2026-06-14 — Hotfix: platform-admin 500 on every page load

Fixes an HTTP 500 logged on every platform-admin (and mobile-admin) page load. The shared top bar called the tenant-scoped `getOrgName()` on mount for all roles; for org-less system users (`SYSTEM_ADMIN` / `SYSTEM_SUPPORT`) it threw "User has no organization". Invisible to users — the client `.catch` swallowed it — but it flooded server logs and would trip any error-rate alarm.

### Fixed
- `getOrgName()` (`apps/web/app/actions/organization.ts`) resolves the session without requiring an organization and returns `null` for org-less sessions (its return type already allowed `null`) — the root fix.
- The shared top bars (`AppTopbar`, `MobileTopbar`) skip the org-name lookup for system roles (`isSystemRole`) — no tenant action invoked in a platform context (§8), no wasted round-trip.

### Verification
- System-user probe across all admin routes on a fresh production build: **0** "User has no organization" errors, **0** HTTP 500s, clean server logs; system→tenant redirects intact; tenant org-name path unchanged.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.19.0...v4.19.1

## [4.19.0] — 2026-06-13 — Help Center refresh + onboarding wizard + planning discipline

Rebuilds the Help Center against current product truth, expands it to the modules it was missing, humanizes the bilingual copy, completes the onboarding wizard, removes placeholder UI, and tightens the desktop help flow (search-first landing, working deep-links, grouped FAQs). Also codifies a planning/approval workflow (new `/plan` skill + AGENTS.md §3.10).

### Help Center content (`apps/web/lib/help-content.ts`)
- **13 factual corrections** against the codebase: 7 org roles (added Leasing/Finance, dropped platform roles from the tenant list), CRM kanban stages → New/Contacted/Qualified/Viewing/Negotiation, org-prefixed contract numbers (`ABC1-SALE-2026-0001`), sale-sign sets the linked deal → Won (not customer → Converted), Manager/Agent have `contracts:write`, document categories → General/Legal/Contract/Marketing/Finance (chosen on upload), installment statuses (+Partially Paid), report types → Revenue/Occupancy/Rent Collection/Maintenance/Maintenance Costs, payments KPIs → Collected This Month/Total Overdue/Expected Next 30 Days, annual-discount wording, removed the fake storage-meter claim.
- **Coverage expansion:** 2 new categories (Marketplace, Account & Notifications); 9 new FAQs (marketplace browse/list/convert/roles, notifications, global search, role dashboards, PII visibility, settings overview); 2 new Marketplace guides; corrected the stale team-management guide to the real email-invite flow.
- **Bilingual humanization:** EN strings de-AI'd via the `humanizer` skill; AR strings naturalized to a professional Saudi business register via `saudi-software-arabic-humanizer`. Exact values/terms preserved (audited — zero factual drift).

### Help Center flow (`apps/web/app/dashboard/help/page.tsx`)
- **Deep-links now work.** `helpHref="/dashboard/help#<topic>"` (14 links across 9 modules) open the FAQ tab, select the mapped category, and scroll — via a hash map + `hashchange` listener (fresh nav and when Help is already open). They previously landed on a redundant Overview with the anchor ignored.
- **Search-first Overview:** "How can we help?" search hero + popular questions + Contact Support / FAQs / Request Permissions cards (replacing the 3 tab-duplicating cards; also fixed the shrink-to-content card-misalignment bug).
- **Category-grouped FAQs** in the All view (section headers) instead of a 46-item flat wall; **empty search → "Open a ticket" CTA** (desktop + mobile).

### Onboarding (`apps/web/app/dashboard/onboarding/page.tsx`)
- Completed the **4-step wizard** (Join existing company by CR / continue independently → Organization → Contact → Team invite → Done), wiring the existing onboarding server actions; reuses `CRInput`/`SaudiPhoneInput`, KSA cities, and the team-invite pattern. Full cycle verified EN + AR, 0 console errors.

### Documents (`apps/web/app/dashboard/documents/page.tsx`)
- Removed the hardcoded placeholder storage meter (no quota infrastructure exists) and wired the desktop search to filter by name (matching mobile).

### Roles / i18n
- Added Arabic labels for the **Leasing** and **Finance** roles in team management (were falling back to the English key).

### Planning discipline
- New global **`/plan` skill** codifying explore → design → review → approve → execute, with a hard no-execute-before-approval gate, delegate-and-validate, and project-deferred UI-verify + release steps.
- **AGENTS.md §3.10 Plan-Approval Gate** (scope-clarification answers are not execution approval) + §3.2/§3.3/§3.8 reinforcement.

### Gates
- `check-types` 2/2; full `next build` green; §3.9 preview walk across help (overview + grouped FAQs), onboarding (full cycle), documents — all 4 theme/lang combos + mobile, **0 console errors**. Deep-link (`#contracts` → Sales & CRM) and empty-search CTA asserted in the browser.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.18.0...v4.19.0

## [4.18.0] — 2026-06-13 — Stabilization + planned architecture: PII trust, CRM a11y, route-guards SSOT

Closes the post-v4.17.0 QA audit criticals and carries the F4/F5 architecture fixes. Hardens the PII trust boundary (marketplace plaintext leak + blind-index correctness), fixes the failing CRM accessibility and billing E2E specs, makes contract signing atomic, adds registration anti-automation, and collapses three sources of route→permission/audience truth into one. Two new ESLint guards and an E2E coverage guard mechanize the landmines this release fixed.

### Trust & correctness (P0)

- **Marketplace inquiry no longer writes plaintext PII.** `confirmMarketplaceInterest` required a valid Saudi mobile and wrote `phone: contactPhone || "—"` as raw plaintext into the encrypted column with no blind-index hash — invisible to search, breaking the masking model (PDPL/NDMO exposure). It now normalizes + routes through `encryptCustomerData` (AES-256-GCM + HMAC blind index), exactly like the canonical customer path. Idempotent repair script `repair-marketplace-customer-pii.ts` + an ESLint guard banning `customer.create/upsert` outside the canonical modules.
- **CRM Kanban accessibility.** The draggable card was `<div role="button" tabIndex=0>` wrapping nested buttons/links — a serious axe `nested-interactive` violation (failing spec). Rebuilt as a redundant-click card: plain container, the card title is the single open-profile control, drag has a keyboard/SR-equivalent "Move to <stage>" overflow menu with an `aria-live` announcement. Call/WhatsApp render only from a derived, E.164-normalized `contactPhoneE164` (masked/ciphertext → omitted, never a broken `tel:` link). New `lib/phone.ts` normalizer (26 tests).
- **`getPlans` out of `"use server"`.** Moved the cached query to a server-only DAL (`lib/server/plans.ts`); a thin async wrapper in `billing.ts` exposes it to client pages over RPC. New custom ESLint rule `no-non-async-export-in-use-server` mechanizes the §4 v4.7.0 landmine.
- **Maintenance reassignment BOLA.** `updateMaintenanceRequest` now validates the new assignee belongs to the caller's org (OWASP API1:2023), mirroring the create-path guard.
- **Billing invoices E2E.** Fixed a brittle `isVisible().catch(()=>false)` assertion (→ real `.or()` locator + `waitFor visible`) and made the subscription seed idempotent. No product regression.

### Hardening (P1)

- **Registration rate limiting.** Per-IP (5/hr, skipped on missing header) + per-normalized-email (3/hr, `+alias`-proof) via the durable `checkRateLimit`; `RATE_LIMITED` with bilingual copy.
- **Contract signing is atomic.** The full SIGNED/CANCELLED/VOID lifecycle (contract + unit + customer + lease) runs in one `db.$transaction` with an optimistic-concurrency `updateMany` count check to reject a double-sign race.
- **Phone blind-index correctness (schema change).** `phoneHash` is HMAC over the E.164-normalized phone on both write and search sides, so `0551234567` and `+966551234567` match. Added composite `[organizationId, *Hash]` indexes, dropped the dead `@@index([nationalId])` (random-IV ciphertext), corrected the misleading schema comments. Backfill script `rehash-customer-phones.ts`.
- **Turbo env allow-list.** Declared `CRON_SECRET`, `MOYASAR_API_KEY`, `MOYASAR_WEBHOOK_SECRET`, `NODE_ENV`, `CI` — undeclared-env lint warnings cleared.

### Planned architecture (F4 / F5)

- **Route-guards single source of truth (F4).** New edge-safe `lib/route-guards.ts` (`ROUTE_GUARDS`) replaces three drifting copies of route→permission/audience; `nav-items.ts`, the `auth.config.ts` edge gate (longest-prefix), and `getTenantPageAccess()` all derive from it. Behavior-preserving; Settings gets an explicit `audience: "tenant"` (audit A8). The 403 middleware stays deferred — only the seam is built.
- **Domain-label registry (F5).** New `lib/domain-labels.ts` centralizes bilingual `{ar,en}` status/category/priority maps typed against the Prisma enums; 7 pages migrated. (5 inferred Arabic marketplace-status strings flagged for native review.)

### Coverage & tooling

- **Marketplace Playwright project + zero-coverage guard.** Two marketplace specs matched no project and were silently skipped; added the `marketplace-tests` project and `check-e2e-coverage.mjs` (fails CI on any unmatched spec).

### Tests & gates

92 → **122 unit tests**; full `next build` green; lint 0 errors; `check-types` 3/3; RLS drift OK (49 tables, no new tables). §3.9 preview walk: CRM verified deeply (a11y structure, dark-LTR + light-RTL, contact-link safety, console-clean); contracts/billing/register/F4-audience verified rendering error-free.

### Upgrade notes (supervised ops steps)

1. `cd packages/db && npx prisma db push` — additive index-only diff (run plain first; it self-reports blockers). No RLS change (no new tables).
2. `PII_ENCRYPTION_KEY=… PII_HASH_PEPPER=… DATABASE_URL=… npx tsx packages/db/scripts/repair-marketplace-customer-pii.ts` — encrypt/repair marketplace customer phones.
3. `… npx tsx packages/db/scripts/rehash-customer-phones.ts` — re-hash all phones to the normalized HMAC blind index. Record before/after counts.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.17.0...v4.18.0

## [4.17.0] — 2026-06-12 — Architecture foundations: unit-test harness, durable rate limits, RLS generator

Phase 1 of the architecture required-fixes program (`future-plans/architecture-required-fixes-2026-06-12.md`). Gives the highest-risk business rules a **fast unit-test safety net** (the repo previously had zero unit tests), fixes a **production rate-limiting gap**, fixes **three confirmed bugs**, creates the shared action-layer seams, and makes the RLS coverage script **generated instead of hand-maintained**. No schema changes; UI-invisible except a 2-line logo-component fix.

### Unit-test harness + pure business-rule extraction (F1)

- **Vitest harness**: `test:unit` script in `apps/web`, turbo task, and a CI step between type-checking and build. **92 unit tests across 6 suites** run in <1s.
- **Six rules extracted from `"use server"` hosts into pure modules** (move-verbatim — behavior byte-identical, each pinned by tests):
  - `lib/contracts/state-machine.ts` — contract status transitions (terminal states allow nothing).
  - `lib/payment/subscription-transitions.ts` — subscription status map (incl. CANCELED→ACTIVE resubscribe); `subscription-machine.ts` now imports the predicate.
  - `lib/maintenance/recurrence.ts` — `computeNextRunDate` (7 recurrence types; JS month-end rollover behavior pinned, not "fixed").
  - `lib/billing/ar-aging.ts` — AR aging bucket math (30/60/90 boundaries, null-dueDate skip).
  - `lib/entitlements/evaluator.ts` — pure `evaluateEntitlement` + `resolveEntitlement` (override > plan > deny; LIMIT/BOOLEAN/METERED). The `unstable_cache` wrapper in `lib/entitlements.ts` is untouched.
  - `lib/payments/recording.ts` — `decidePaymentApplication` (already-paid guard, overpay rejection with ±0.005 tolerance, PAID vs PARTIALLY_PAID threshold). The `recordPayment` transaction machinery — FOR UPDATE lock, idempotency replay, P2002 race handling, audit — is untouched, and the CI money-correctness test passes unchanged.

### Rate limiting now survives deploys (F2 — security)

- Password-reset (3/hour) and CR-lookup (5/10min) limits previously counted attempts in **per-process in-memory Maps** — reset on every cold start/instance, so largely decorative in production. Both now use the existing DB-backed `checkRateLimit()` (atomic UPSERT on `RateLimitCounter`, shared across instances). Contracts preserved exactly: silent success on blocked password reset (anti-enumeration), `TOO_MANY_LOOKUPS` before format validation, invalid CR consumes no quota (via `peekRateLimit`).

### Bug fixes (F3)

- **Stale admin cache refresh**: `adminCreateCoupon`/`adminToggleCoupon` revalidated `/admin/coupons` and `adminUpsertPlan` revalidated `/admin/plans` — routes that don't exist (real: `/dashboard/admin/...`). The revalidation silently no-op'd, so admins could see stale coupon/plan data. Now uses `ROUTES` constants pointing at the real pages.
- **MimaricLogo `cn()` duplicate**: the component carried a local `filter(Boolean).join(" ")` helper instead of the canonical `cn` (clsx + tailwind-merge) from `@repo/ui` — Tailwind class conflicts wouldn't de-dupe. Now imports the canonical helper.

### Action-layer seams (F6 — adopt opportunistically)

- New `lib/serialize.ts` (one Decimal-safe `serialize<T>()` — replaces marketplace's private `SERIALIZE`, 16 call sites), `lib/action-result.ts` (`ActionResult<T>` discriminated union + `ok`/`fail`), `lib/routes.ts` (route constants for `revalidatePath`). Adoption in existing actions is touched-files-only by design — the 151 `throw` sites are explicitly not mass-migrated.

### RLS coverage script is now generated (F7)

- New `packages/db/scripts/generate-rls.ts` parses `schema.prisma` (handles `@@map`), appends `_CouponPlans` + `_prisma_migrations`, and emits the always-double-quoted `ALTER TABLE … ENABLE ROW LEVEL SECURITY` list (the unquoted-identifier silent-no-op trap is documented in the header). `2026-06-enable-rls.sql` regenerated with **proven 49-table parity** to the hand-maintained version. New CI step `rls:check` fails the build if the SQL drifts from the schema. The manual Supabase apply step per environment is unchanged; no new tables this release.

### Verification (§3.9)

- 92/92 unit tests, lint 0 errors, typecheck green, full production build green, cspell clean on changed files. Prod server via preview MCP browser: **login in light/dark × AR/EN + register + mobile 375×812 MobileTopbar** (the logo-fix surfaces) — rendering identical, keyboard focus ring intact (3px purple), **zero browser-console + zero server errors**. RLS `--check` exit 0 + negative drift test (bogus line → exit 1).

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.16.1...v4.17.0

## [4.16.1] — 2026-06-12 — Access Denied page + units:read for managers + consent compaction + cleanup

Follow-up to v4.16.0. Replaces the silent permission-denial redirect with a defined in-shell **Access Denied** page, grants `units:read` to the property-managing roles, compacts the cookie-consent banner, and clears three CI lint warnings + two dead shell components.

### Permission-denial UX — defined Access Denied page

- A tenant role hitting a route it lacks permission for (e.g. `FINANCE` → `/dashboard/units` or `/dashboard/crm`) previously redirected silently to `/dashboard` after a momentary error-boundary flash ("undefined" message). It now renders a defined, bilingual **Access Denied** state **in-shell** (nav intact): a clear "you don't have access" message + **"Request access"** (deep-links to the Help "Request permission upgrade" form) + "Back to dashboard".
- Implemented via a result-returning `getTenantPageAccess()` guard (replaces the redirecting `requireTenantPageAccess`); the `units` + `crm` pages render `<AccessDenied>` inline. **Audience separation unchanged** (§8) — system users still `redirect("/dashboard/admin")`. Adds a `"forbidden"` tone to the shared `EmptyState`.
- **Status note:** the page returns **HTTP 200, not a true 403** — streaming SSR commits the status before the denial renders. A real 403 status remains the deferred middleware-level "403 contract." (Next's experimental `forbidden()` / `authInterrupts` was trialled for a native 403 but crashed on client hydration inside the provider-wrapped dashboard layout, so it was removed in favour of the stable inline render.)

### RBAC — units:read for property-managing roles

- `MANAGER` (+ `units:write`), `AGENT`, and `LEASING` now hold `units:read` — previously only `ADMIN` did, so property managers / sales / leasing could not open `/dashboard/units`. `units:delete` stays ADMIN-only.

### Consent banner compaction

- The PDPL consent banner was a tall card (title + body + link stacked, `size="md"` buttons). Compacted to a dense single-row bar (`max-w-[920px]`, `size="sm"` buttons, title + body + policy link inline) — ~86px vs ~150px — keeping **equal-prominence Accept/Reject** and the policy link. No API/prop change.

### Cleanup

- **Lint (3):** removed an unused `DateRangeParams` import (`getFailedPaymentArrAtRisk.ts`); `data-`-prefixed the `cmdk-input-wrapper` attribute (`command.tsx`); surfaced `className` on the `TableHead` / `TableCell` types (`table.tsx`). `@repo/ui` lint warnings 8 → 6 (remainder pre-existing, out of scope).
- **Dead code:** deleted the unmounted `AppSidebar` + `MobileBottomTabs` shell components (radial nav has been live since v4.11; no importers). `/dashboard/more` left intact — still wired into the system-user allowlist.

### Verification (§3.9)

- Full production build + typecheck green; targeted lint clean. Prod server via preview MCP browser: **MANAGER / AGENT / LEASING render `/dashboard/units`**; **FINANCE → Access Denied** (no redirect, no crash, "Request access" navigates to Help); MANAGER happy-path Units intact. Access Denied + consent banner verified across **light/dark × AR/EN + mobile 375×812**; zero browser-console + zero server errors.

### Deferred

- **True HTTP 403 status** (middleware-level "403 contract") — this release ships the defined Access Denied *page*; the *status code* stays 200 under streaming SSR.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.16.0...v4.16.1

## [4.16.0] — 2026-06-12 — RSC dashboards + t() i18n facade + PDPL cookie consent

Converts all 8 dashboards from client-side mount-fetch to **React Server Components** (server-rendered first paint, no per-mount server-action waterfall), introduces an incremental **`t()` i18n facade** backed by a server-readable language cookie, and ships a **PDPL-compliant cookie-consent manager** that gates GA4/GTM analytics. The dominant remaining latency lever (DB region move) is ops, tracked separately.

### i18n facade + server-readable language (Stage 0 + 1)

- **Language is now a cookie**, not localStorage-only. `LanguageProvider` writes `mimaric-lang` (functional cookie) + localStorage, and accepts a server-threaded `initialLang` so the client hydrates with the correct value — eliminating the prior AR→EN flash for English users. A one-time localStorage→cookie migration covers existing users (at most one flash, once).
- **Root layout renders `<html lang dir>` dynamically** from the cookie (was hardcoded `ar`/`rtl`).
- **`t(ar, en)` facade** — one signature on both runtimes: `useLanguage().t` (client) and `getT()`/`getLang()` from the new `apps/web/lib/i18n.ts` (server). Adopted in touched files only; the 2,000+ inline-ternary sites migrate opportunistically, not in a big bang.

### RSC dashboard conversion (Stage 2 + 3)

- All 8 dashboards split into an `async` Server Component (auth + one server-side `Promise.all` + `searchParams`) and a thin `"use client"` view (charts, picker, refresh). The initial 3–13 server-action POSTs per dashboard collapse to a single server render.
- **Date picker now filters (URL-synced, §6.10.1).** On the index/finance/leasing/maintenance dashboards the picker was decorative; it now writes `?from=&to=`, the Server Component re-renders, and the range scopes the period (flow) metric while current-state (stock) metrics stay live. The active window is shown in the KPI label (no silent half-filter). Admin keeps its existing URL-sync.
- **Index role-redirect moved server-side** — `isSystemRole → /dashboard/admin`; `LEASING/AGENT → leasing`, `FINANCE → finance`, `TECHNICIAN → maintenance` via `redirect()`, removing the prior client paint-then-bounce flash.
- **Manual refresh** = `router.refresh()` in a transition (re-runs the server render). **units/crm** keep their list/Kanban/dialog interactivity + optimistic mutations; only the initial fetch moved server-side. **CRM PII masking unchanged** (same `getCustomers` masked path).
- Fixed a latent `LastUpdatedAgo` hydration mismatch (relative time now mounted-gated) — surfaced once timestamps arrive at SSR time.

### PDPL cookie consent (Stage 0.5)

- **Block-until-consent**: GA4/GTM is not injected until the user grants Analytics — zero `googletagmanager.com` calls fire pre-consent (advanced Consent Mode v2 default-denied still pings Google, so it was rejected). `AnalyticsProvider` sets Consent Mode v2 signals (`analytics_storage` granted on opt-in; all `ad_*` denied — no ads stack).
- Granular consent banner (`ResponsiveDialog`, bilingual, equal-prominence Accept/Reject, preferences sheet with Switch toggles), choice persisted as a versioned/timestamped/locale-stamped `mimaric-consent` cookie (documented consent) **and** a server-side `ConsentLog` row (IP minimized to /24) for defensible PDPL auditability. New bilingual `/cookie-policy` page + footer "Cookie settings" re-open.

### Deferred (with rationale)

- **Permission-denial → HTTP 403.** A tenant user direct-URL-navigating to a route they lack permission for (e.g. `FINANCE` → `/dashboard/crm`, which lacks `crm:read`) sees the generic route error boundary rather than a friendly "no access" state. Pre-existing authz behavior; a clean 403 needs the action-wide typed-result contract change. Nav is permission-filtered, so this only affects direct-URL access.
- **"User has no organization" server-log noise** when a system user (org=null) transiently touches a shared dashboard surface — pre-existing (documented in `e2e/marketplace.cross-org.spec.ts`), unrelated to this release; same 403/typed-result follow-up.
- **DB region migration (Sydney → Bahrain)** — the dominant felt-latency lever, but an ops/runbook task.
- Full 65-file `t()` migration (incremental by design).

### Verification (§3.9)

- **Full production build** (`turbo run build`) green.
- **Runtime (prod server, preview MCP browser):** all 8 dashboards server-render; finance verified across **light/dark × AR/EN** (cookie-driven `<html dir>` flip confirmed); **date filter re-renders server-side** via both direct URL (0 → 48k SAR) and picker click; index picker filters (0 MTD → 3.0M wide); **role-separation matrix (§8)** — system@ → admin and **blocked** from finance/crm; finance@ → finance and **blocked** from admin; admin@ → index; **consent** — zero GA before consent, documented cookie + `ConsentLog` row written, persists across reload; **CRM PII masked** (`***2233`); mobile 375×812 single-column; **browser console error-free** across the sweep.

### Upgrade notes

- **Manual SQL (per AGENTS.md §4):** after deploy, run the `ConsentLog` line in `packages/db/sql/2026-06-enable-rls.sql` in the Supabase SQL Editor — the new table ships RLS-disabled until then (re-triggers the `rls_disabled_in_public` advisor). `prisma db push` already created the table.
- No new env vars. No breaking changes.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.15.1...v4.16.0

## [4.15.1] — 2026-06-09 — Fixes: RTL theme-toggle thumb + admin marketplace i18n

- **Theme toggle (RTL):** the sun/moon thumb hung ~14px off the leading edge of its track in Arabic (RTL) because it mixed a logical `ms-1` margin with a physical `translate-x` slide. Reworked to position the thumb via the logical `inset-inline-start` property (RTL-safe by construction) with `-translate-y-1/2` for vertical centering only. Verified inside-track + vertically centered in LTR + RTL × light + dark.
- **Admin marketplace moderation i18n:** the `/dashboard/admin/marketplace` page header (H1 + subtitle), the "Back to Admin" link, the Refresh button, and the suspend-listing dialog (title, description, buttons, reason label/placeholder) were hardcoded English. Now bilingual — H1 renders «إدارة السوق» under `lang === "ar"`.

## [4.15.0] — 2026-06-09 — Security & integrity remediation + performance + polish

Closes the confirmed Critical/High findings from the QA/code audit (which returned a **No-Go**), plus contained performance wins, v4.11 polish follow-ups, and a CRM enrichment. Every finding was re-verified against the codebase before fixing. Decisions: Postgres-backed rate limiting (no Redis), keyed-HMAC PII blind index with reseed (pre-prod), all in one pass.

### Security & integrity (the No-Go blockers)

- **Reservation & marketplace concurrency (C1, H4)** — replaced read-then-update with **compare-and-swap** (`updateMany` + count guard) inside the existing transactions: unit `AVAILABLE→RESERVED`, inquiry `OPEN→CONVERTED_TO_DEAL`, transfer `PENDING_SETTLEMENT→COMPLETED`. Added a **partial unique index** `uniq_unit_active_reservation` as a DB backstop. Existing `transferredToOrgId` sentinel + SIGNED-contract gate retained.
- **Payment webhook hardening (C2)** — before marking an invoice PAID: payable-state guard (`DRAFT/ISSUED/PARTIALLY_PAID/OVERDUE`), currency = SAR, and amount match (Moyasar halalas ÷100 vs `Decimal` total, ±0.01). Conditional `updateMany` write; subscription transition only on `count === 1`; refunds restricted to PAID. Fail-closed + logged, no throw (200 already returned). Signature + idempotency unchanged.
- **Cron authentication (C3)** — new `lib/cron-auth.ts` accepts the `Authorization: Bearer ${CRON_SECRET}` Vercel sends, with `?secret=` fallback, **fail-closed** when the secret is unset; applied to all three cron routes.
- **Role permissions (H1)** — defined `ROLE_PERMISSIONS` for `LEASING` and `FINANCE` (previously absent → those users had zero access) and added both to `CUSTOMER_ASSIGNABLE_ROLES`.
- **Distributed rate limiting (H5)** — new Postgres `RateLimitCounter` (atomic upsert, **fail-open** on DB error) replaces the per-process in-memory `Map`s for login and invitations; thresholds preserved. No new infra.
- **PII blind index (H6)** — `hashForSearch` is now keyed **HMAC-SHA256** with a new `PII_HASH_PEPPER` (fail-closed), `v1:` prefix for rotation. Replaces brute-forceable unkeyed SHA-256.
- **Input DTOs (H3, H2)** — `createUnit` uses a strict module-private schema with explicit field mapping and forced `status: AVAILABLE`; `registerFileInDb` adds an UploadThing URL-origin allowlist, org-ownership checks for `customerId`/`unitId`, and persists the previously-dropped `unitId`.
- **Atomic numbering (H7)** — contract & invoice numbers now come from an atomic `SequenceCounter` (`INSERT … ON CONFLICT … RETURNING`) inside the create transaction, replacing `count()+1` / max-lookup races. Global scope preserves the existing global-unique numbering; idempotent backfill SQL seeds counters from existing maxes on populated DBs.
- **a11y/UX (M1, M2)** — native `confirm()` replaced with a bilingual `ConfirmDialog` (on `ResponsiveDialog`); the DataTable sort header is now a single semantic `<button>` (dropped the redundant non-semantic `<span onClick>`). Plus 5 high-value composite indexes (M3).

### Performance

- **Native bcrypt** — swapped pure-JS `bcryptjs` → `@node-rs/bcrypt` (Rust/NAPI, prebuilt win32+linux, on Next's auto-external list). Hashing leaves the JS event loop, so a login spike no longer freezes signed-in users. Existing hashes verify unchanged (no re-seed).
- **Warm connection pool** — `pg.Pool` `idleTimeoutMillis` 10s → 60s, so interactive clicks stop re-paying the TLS+auth handshake to the remote DB.
- **Prefetch storm** — `prefetch={false}` on the radial-nav links; opening the nav no longer prefetches every sibling dashboard's DB work.

### Polish

- **Empty-state CTAs** — wired `DataTable` `emptyAction`/`emptyIcon` on units, CRM, admin/coupons, settings/team (suppressed when a filter is active).
- **Mobile notification filter** — ported the All/Alerts/Reminders/Updates category pills to the mobile sheet for desktop parity (§6.14.4) via a shared categorization module.
- **Arabic terms** — CRM «خط الأنابيب» → «مسار الفرص العقارية» (+ related KPI/instruction copy).
- **Accessibility CI** — added `@axe-core/playwright` and an `accessibility.admin.spec.ts` scanning key dashboard routes for WCAG 2.0/2.1 A/AA (critical+serious gate), auto-included in the existing CI Playwright run.
- **GitGuardian** — `.gitguardian.yaml` ignores the documented seed/test credentials so the PR check stops flagging non-production fixtures.

### CRM kanban enrichment

- New `Customer.stageEnteredAt` (nullable, `@default(now())` — backfills existing rows non-destructively). `updateCustomerStatus` stamps it only when the status changes. The Kanban card now shows the assigned **owner avatar** (agent initials, nothing when unassigned) and a **threshold-colored time-in-stage chip** (≤7d muted · 8–14d warning · >14d destructive), western digits, RTL-safe, both themes.

### Deferred (with rationale)

- **Server-component dashboard conversion** — every dashboard is blocked by client-context i18n; a true RSC conversion requires reworking the LanguageProvider into a server dictionary across 7 pages. Too large/risky to bundle with a security release; its own epic. The dominant latency lever is the DB region move (ops).
- **Permission-denial → HTTP 403** — in Next's server-action model a thrown denial surfaces as 500 regardless of type; a real 403 needs an action-wide contract change. Deferred.
- **ZATCA module** — still blocked on the e-invoicing clearance pipeline; building it now = empty UI over absent data.
- **Decommission unmounted shell** (`AppSidebar`/`MobileBottomTabs`/`/dashboard/more`) — gated on the radial nav being proven in production (shipped 2026-06-09, too soon).
- **DB region migration (Sydney → Bahrain)** — the single biggest latency lever, but an ops/runbook task (data migration + downtime), not code.

### Verification

- **Full production build** (`turbo run build`) + `check-types` green.
- **Runtime (production server, reseeded DB):** login verified through the new native bcrypt; admin dashboard + CRM kanban (owner avatar + time-in-stage chip + masked PII) confirmed **light and dark**; Arabic term «مسار الفرص العقارية» rendered; **role-separation matrix** confirmed — `LEASING` lands on its dashboard and reaches CRM but is redirected away from `/dashboard/admin`; `FINANCE` reaches `/dashboard/finance` and is blocked from admin; `SYSTEM_ADMIN` reaches admin and is redirected away from `/dashboard/crm`; mobile (375×812) notification sheet shows the category pills; cron auth is **fail-closed** (no 200 without a valid Bearer). **Console error-free across the sweep.**
- The full Playwright suite (incl. the deterministic billing-invoices fix and the new axe spec) runs in CI (this environment is network-isolated from localhost).
- **Upgrade notes:** set the new **`PII_HASH_PEPPER`** env var (added to `.env.example`, `turbo.json` globalEnv, CI); **reseed** so blind-index hashes regenerate; on populated DBs run `packages/db/sql/2026-06-partial-indexes.sql` and `…/2026-06-sequence-backfill.sql` once after `prisma db push`.

## [4.11.0] — 2026-06-09 — UI overhaul: radial navigation + de-slop credibility pass

The "make Mimaric feel authored, not AI-template slop" release. It replaces the linear sidebar and mobile bottom-tabs with a two-level **radial navigation** (CircleMenu), adapts four reference UI components to the Mimaric design system (theme toggle, alerts, notification filter, date picker) **with no new dependencies**, and sweeps the credibility "tells" flagged by two UI audits. Direction and decisions are recorded in `UI/mimaric_v4.11_*.md`.

### Added — radial navigation (Phase 2)

- **`CircleMenu`** — a two-level hub→spoke radial menu that replaces the sidebar (desktop 360° wheel) and the mobile bottom-tabs (180° bottom half-wheel), launched from a single **floating bottom-center pill on every breakpoint**. Six category hubs (Dashboard, Properties, CRM & Contracts, Finance, Operations, System), each expanding to its child routes. `cmdk` command palette retained as the always-available keyboard/SR twin so navigation can never fail.
  - A11y per W3C APG (site nav is **not** an ARIA menu): `role="dialog"` + `aria-modal` wrapping a real `<nav>` of links; category hubs are disclosure buttons (`aria-expanded`); DOM-order Tab with focus-trap + **return-focus-to-launcher**; Escape ladder (child → hub → close); arrow-key ring navigation as an enhancement; `aria-current` on the active route.
  - RTL angular mirroring; `prefers-reduced-motion` → instant positions; first-run coachmark; framer-motion via `LazyMotion`+`domAnimation`, code-split so it never enters the initial dashboard bundle.
- **`radial-groups.ts`** taxonomy references `nav-items.ts` by href (single source of truth) and re-applies the §8.3 audience filter, so tenant/platform separation is preserved automatically.
- `AppTopbar` corner launcher removed; the mobile avatar sheet's profile header re-wired to `/dashboard/more/profile` (orphaned when the bottom-tabs "More" tab was removed).

### Changed — credibility & component swaps (Phase 3)

- **Theme toggle** → sliding sun/moon **pill** built on the Radix Switch (real `role="switch"` + keyboard, §6.6.6), RTL-correct thumb, `resolvedTheme`-aware. Retokenized — no `zinc-*` literals.
- **Alert primitive** → `variant × appearance` model: variant (neutral/primary/destructive/success/info/warning) × appearance (solid/outline/light), mapped to Mimaric semantic tokens; `light` is the default and matches the §6.11.2 banner taxonomy. Alert icon moved to logical `start-4`/`ps-7` for RTL. Back-compat preserved for existing `destructive` consumers.
- **Notification center** → category filter pills (All/Alerts/Reminders/Updates) on the topbar popover, mapped from the notification `type` (§6.6.6 pill standard).
- **Chart axes** → localized `tickFormatter`s replace the raw `W-2` collection-trend labels with `Wk 12` / `أسبوع 12`, plus a compact-`k` amount axis.
- **DataTable** → `emptyAction`/`emptyIcon` slot so desktop empty states can meet the §6.12.1 CTA formula.
- **Date-range picker** → restyled (preset rows now use the Button primitive instead of raw `<button>`); kept on the existing `react-day-picker` engine — **no new dependency**, RTL/Hijri intent preserved.

### Changed — sweeps (Phase 4)

- **Side-shading swept** — every `border-s-*` status stripe removed from payments / units / maintenance rows and `NextActionPanel`; status now reads from a faint full-row tint on alerting states + the existing status pill. Positive/neutral stripes dropped entirely.
- **RTL arrows** — 3 raw directional icons (marketplace back-link + Convert-to-Deal ×2) wrapped in `DirectionalIcon` (§6.15.4).
- **Numbers** — marketplace listing stats LTR-wrapped + `tabular-nums` (§6.15.3).
- **Empty states** — admin/marketplace bilingualized (§6.15); CRM Kanban column "Empty" → "No deals in this stage" (§6.12); one card-in-card de-nested on `help`.

### Deferred (with rationale)

- **ZATCA compliance module — intentionally not built.** The e-invoicing pipeline does not exist yet: `billing.ts` never sets any ZATCA field, so every invoice defaults to `zatcaStatus = NOT_APPLICABLE` and no clearance / QR / XML is ever populated. Building the module now would render empty UI over absent data — the exact "slop" this release removes. Build it when the clearance pipeline lands. (The platform-admin ZATCA-clearance KPI already exists.)
- Micro-polish kept as follow-ups: wiring `DataTable emptyAction` on the ~10 desktop lists, the mobile notification-sheet category filter (desktop popover has it), and an Arabic domain-term pass.

### Verification

- **Full production build** (`turbo run build`) green at every wave; `check-types` + ESLint (0 errors) forced green on all changed files.
- **Runtime (production server):** Phase 2 verified across light/dark × AR/EN on desktop (360° wheel + level-2 children) and mobile (180° half-wheel), with focus-return, Escape ladder, and arrow-ring navigation confirmed. Phase 3–4 verified across light+EN, dark+EN, dark+AR (RTL) and mobile 375×812 on the touched routes (dashboard, finance, payments, CRM): theme toggle toggles light↔dark with correct `aria-checked`/label; notification filter pills render EN + AR with `aria-pressed`; chart axis shows `Wk`/`أسبوع`; no `border-s-*` stripes remain (LTR + RTL); tables→cards + FAB + radial launcher on mobile. **Console error-free across the full sweep.** payments confirmed prod-stable (the Turbopack-dev OOM is dev-only).
- Not exhaustively run for this tag: a per-route axe scan and full keyboard tab-through on every touched route (the reused primitives carry audited a11y; new controls verified structurally).

### Upgrade notes

- **Navigation:** the sidebar and mobile bottom-tabs are gone; the radial `CircleMenu` (floating launcher) + `cmdk` (⌘K) are the navigation surfaces. `AppSidebar`/`MobileBottomTabs` remain in the tree (unmounted) for rollback.
- **`framer-motion`** added to `@repo/web` (code-split).
- **Alert:** new `appearance` prop defaults to `light`; existing `variant="destructive"` alerts now render as a soft tint (the §6.11.2 error look) rather than the old outline.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.10.0...v4.11.0

## [4.10.0] — 2026-06-08 — UI uniformity pass: governed badges, icon-only row actions, one pill standard, Switch migration, 15 tables → DataTable

Builds on the v4.9.0 governed-clickable system by eliminating the *visual* inconsistencies that survived it. A verified audit (`docs/uniformity-audit.md`) catalogued six classes of drift; this release fixes all six and writes the resulting standards back into AGENTS.md §6 so they can't recur. The headline structural change is migrating every hand-rolled data table onto the shared `DataTable` primitive — unlocking sort, per-column filter, column show/hide, density, and mobile-card collapse across the product.

### Changed (P1 — status badges)

- Replaced hand-rolled inline status pills (`<span>` driven by local `STATUS_COLORS`/`statusBadge()` maps) with the governed `<Badge variant size="sm">` on 9 pages: reservations, payments, contracts, dashboard, admin/tickets, help, help/tickets/[id], admin/marketplace, marketplace (plus my-listings during its table migration). Dead color maps deleted; bilingual labels unchanged. Closed-ticket status maps to neutral `default` (not the property-status `sold` variant).

### Changed (P2/P3 — row actions, icon-only standard)

- Every per-row action is now an **icon-only `IconButton` at the default size** — including forward actions, which were previously rendered three different ways. Reservations *Convert to contract* (was an `ActionLink` text link) and contracts *Sign* (was `Button variant="success"`) are now icon-only with a `text-primary` tint + distinct icon (`FileSignature` / `PenLine`); navigation preserved via `next/link` wrapping.
- Canonical sentence-case `aria-label` lexicon (View/Edit/Delete/Remove/Close/Clear/Convert to contract/Sign) replaces the prior "View Profile" / "View profile" / "View Details" drift. Removed `h-6`/`h-7`/`h-8`/`size="sm"` overrides for one uniform row-action size; CRM's bordered-chip icon buttons normalized to ghost.
- settings/team remove-member action fixed from `Button variant="secondary" size="icon"` + stray inline `style` to a proper `IconButton` with `text-destructive`.

### Changed (P4 — semantic variant normalization)

- admin/email Save is now the single `primary` CTA (was `secondary`); contracts modal Cancel buttons → `ghost` (were `outline`); units bulk-delete uses standard `destructive` (dropped the `bg-destructive/80` dimming); added a missing `aria-label` on the maintenance/preventive pause-toggle.

### Changed (P5 — filter pills + switches)

- One canonical pill mapping everywhere — active `primary` / inactive `subtle`, `rounded-full`, `size="sm"`, `aria-pressed`, **identical on mobile and desktop** — applied to units, crm, payments, reservations, help, settings/audit, coupons, and the marketplace browse/inquiries tabs (converted from underline-tabs). Fixed a crm "Lost" pill whose active/inactive variants were identical.
- Migrated the 3 remaining raw `role="switch"` toggles (landing Pricing billing, admin/plans isPublic, admin/coupons isActive) to the shared `<Switch>` primitive; the coupons toggle now uses the primitive's purple active state for cross-switch uniformity.

### Changed (P6 — DataTable + PageIntro adoption)

- Migrated **15 hand-rolled `<Table>` pages** to the shared `DataTable`: admin (coupons, payments, plans, subscriptions, marketplace), billing/invoices, contracts (sale + lease), maintenance/tickets, marketplace inquiries, my-listings, payments, reservations, settings/team, settings/audit, units. Each page keeps its existing filter/search bar feeding the data; row actions follow the icon-only standard; currency/count columns use `meta:{numeric}` (right-aligned, tabular); status-keyed row accents preserved via a new `rowClassName` prop. units bulk select/delete/price/status rewired onto DataTable `enableSelection`+`bulkActions`. The marketplace **browse** listings view is intentionally kept as a gallery; invoices retains its modal line-items sub-table.
- Added `rowClassName?: (row) => string` to the `DataTable` primitive (desktop rows + mobile cards) so per-row status accents survive migration.
- Converted hand-rolled page-title blocks to the `PageIntro` primitive on finance, leasing, maintenance, onboarding.

### Added (design system)

- **AGENTS.md §6.6.7 / §6.6.8** — ratified the icon-only row-action standard (default size, `gap-1`, view→forward→destructive order, `text-primary` forward / `text-destructive` delete, canonical `aria-label` lexicon) and the filter-pill standard (active primary / inactive subtle, rounded-full, `aria-pressed`, mobile=desktop) plus the `role="switch"` → `<Switch>` rule. (Mirrored in the local CLAUDE.md §6.6.)
- `docs/uniformity-audit.md` — the verified six-dimension flag register this release executes against.

### Verification

- **Full production build** (`turbo run build`) green — all routes compiled (exit 0). Forced `check-types` green at every wave (not just subagent self-reports). Direct grep confirmed **zero leftover raw `<Table>` usages** except the two intentional ones (marketplace browse, invoices modal).
- **Runtime (production server, port 3000):** all 10 migrated **tenant** routes verified via accessibility-tree/DOM inspection — each renders one DataTable (no duplicates), row/forward/bulk actions present, pills expose `aria-pressed`, settings/team has no inline-style buttons, **console error-free across the full sweep**. units bulk-select reveals the bulk action bar; reservations Convert and contracts Sign icon actions present and navigable.
- **§3.9 environmental substitution (unchanged from v4.8.0/v4.9.0):** the preview MCP raster `screenshot` tool times out (~30s renderer bottleneck) and eval-driven login can't set controlled inputs, so the cross-theme screenshot quadruple was substituted with production-build + accessibility-tree/DOM + console verification on the authenticated tenant routes. Admin (system-only) routes are verified at build/typecheck/structural level; authenticated admin visual review remains advisable post-merge.

### Upgrade notes

- **`role="switch"` → `<Switch>`:** the three remaining hand-rolled toggles now use the shared primitive; any downstream copy of those toggles should adopt `<Switch>`.
- New `DataTable` `rowClassName` prop is additive (optional) — no migration needed for existing consumers.
- No schema changes, no new env vars, no tenant route or permission changes.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.9.0...v4.10.0

## [4.9.0] — 2026-06-02 — Governed clickable system: Button unification, IconButton/ActionLink primitives, full migration + ESLint guardrail

Establishes a single governed model for every clickable affordance in the product and migrates the entire web app onto it. Before this, ~175 raw `<button>` elements (plus pure-text "actions" with only a color/underline change, and `onClick` on non-interactive `<div>`/`<tr>`) bypassed the design system — the inconsistency was most visible in table/card row actions. Now there is one canonical `Button`, two new primitives (`IconButton`, `ActionLink`), a written spec in AGENTS.md §6.6, and an ESLint rule that blocks reintroduction. Also folds in graph-surfaced structural cleanups (route-boundary boilerplate, dead code/assets).

### Added (design system)

- **Governed taxonomy — AGENTS.md §6.6.0 "Clickable Element Decision Rule"** — every clickable thing must be exactly one of three scenarios: (1) **Standard Button** `<Button variant>` — rectangular, background, shadow/elevation, hover recolor + press motion, focus ring; (2) **Icon Action Button** `<IconButton>` — Lucide icon, **required `aria-label` + tooltip**, hover chrome, ≥44px mobile target; (3) **Navigation Link** `<ActionLink href>` — real navigation only, never in-place actions. Plus a "Banned" list (pure-text in-place actions, `onClick` on non-interactive elements, hand-rolled `<button>`, icon buttons without `aria-label`) and a rationale block citing NN/g link-vs-button, WCAG 2.2 §2.5.8 target size, and Material 3 / IBM Carbon / GitHub Primer taxonomies. New §6.6.5 (IconButton) and §6.6.6 (ActionLink) primitive specs.
- **`IconButton` primitive** (`packages/ui/src/components/IconButton.tsx`) — wraps the canonical `Button` at `size="icon"`, default `variant="ghost"`; `aria-label` is a **required, TS-enforced** prop (impossible to render an unlabeled icon button); self-wraps a Radix `Tooltip` (defaults to the label); `directional` flips the icon in RTL via `DirectionalIcon`.
- **`ActionLink` primitive** (`packages/ui/src/components/ActionLink.tsx`) — framework-agnostic (Radix `Slot`/`asChild`, no `next/link` import in the UI package), consistent text-link styling + focus ring, optional leading/trailing icons. App composes it with `next/link` via `asChild`.
- **ESLint guardrail** (`packages/eslint-config/next.js`) — `react/forbid-elements` forbids raw `<button>` in apps ("use `<Button>`/`<IconButton>` from @repo/ui"), scoped so `packages/ui` primitives are exempt. Three legitimate `role="switch"` toggles carry an inline escape-hatch with a reason.

### Changed (Button component)

- `packages/ui/src/components/Button.tsx` — renamed the `danger` variant to **`destructive`** (codemod across 9 files / 19 callsites; aligns the component with the long-standing §6.6.1 spec); added the **`premium`** variant (gold `--accent`); made `size="icon"` **responsive** (`h-11 w-11 md:h-9 md:w-9`) to meet the 44px mobile touch target; added an optional `state="success"|"error"` post-action micro-feedback prop (check / shake, 1.5s) with a `shake` keyframe in `globals.css`.

### Changed (migration — 175 → 7)

- Migrated **~175 raw clickable elements across ~45 files** to the governed primitives — dashboard hotspots (CRM, units, contracts, reservations, documents, help, maintenance), billing/payments, all `/admin/*`, marketplace, settings, onboarding, reports, auth, the marketing landing page, **and the app shell** (topbar, sidebar, mobile nav/sheets, theme toggle). Row/card actions → `IconButton` (with `aria-label` + tooltip); filter/toggle pills → `Button` with `aria-pressed`; pure-text actions → `Button variant="link"` or `IconButton`; navigating text links → `ActionLink`; `onClick` on `<div>`/`<tr>` → keyboard-accessible (`role="button"` + `tabIndex` + `onKeyDown`, or a real button). Only **7 raw `<button>` remain**, all documented exceptions: 3 semantic `role="switch"` toggles, listbox options, and selector chips (escape-hatched pending a future Chip/Combobox primitive).

### Changed (structural cleanup — from the knowledge-graph audit)

- **Route boundaries** — 39 duplicated `error.tsx` / `loading.tsx` / `not-found.tsx` files now delegate to the shared `RouteError` / `RouteLoading` / `RouteNotFound` components (Client/Server constraints preserved); 6 intentionally-custom boundaries left as-is.
- **Dead code/assets removed** — the Turborepo stub `packages/ui/src/button.tsx` (used `alert()`), the unused `@phosphor-icons/react` dependency (0 source imports; Lucide-only is honored), and 14 orphaned starter SVGs in `apps/{web,portal}/public`.

### Verification

- **Full production build** (`turbo run build --filter=@repo/web`) green — all routes compiled. Forced, uncached `check-types` (`@repo/ui` + `@repo/web`) green at every migration wave (not just subagent self-reports). ESLint: **0 errors**.
- **Runtime (production preview, port 3000):** landing `/ar` (RTL) — 13 governed buttons, **0 icon-only buttons missing an accessible name**, `role="switch"` preserved, governed variant classes applied, **console error-free**; **axe-core 4.10.2 → `{ violations: [] }`** (WCAG 2.0/2.1 A+AA). Login page — password-visibility toggle now exposes a bilingual `aria-label` ("إظهار كلمة المرور"), governed submit button, 0 unlabeled icon buttons, console clean.
- **§3.9 known-blocker (environmental):** the preview MCP raster `screenshot` tool times out (~30s renderer bottleneck — the same limitation documented for v4.8.0), and eval-driven NextAuth login does not capture React controlled-input state, so the cross-theme screenshot quadruple (light/dark × LTR/RTL) and the authenticated-page raster walkthrough were substituted with DOM/structural + accessibility-tree + axe verification on the publicly reachable pages. Manual cross-theme visual review on authenticated dashboards (CRM/units) remains advisable post-merge.

### Upgrade notes

- **Breaking (internal):** the `Button` `variant="danger"` value is now `variant="destructive"`. All in-repo callsites were migrated; any downstream/uncommitted code using `danger` must update.
- New `@repo/ui` exports: `IconButton`, `ActionLink` (and their variant helpers). Prefer them over raw `<button>`/`<a>` — the ESLint rule now flags raw `<button>` in apps.
- No schema changes, no new env vars, no tenant route or permission changes.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.8.0...v4.9.0

---

## [4.8.0] — 2026-06-02 — Platform Admin Product Analytics v1 + landing-page a11y + login timeout + dev pool stability

Lands a revenue-mechanics analytics layer on the `/dashboard/admin` SYSTEM_ADMIN surface (Phase 1 of a three-phase plan), fixes every WCAG 2.1 AA axe violation on the marketing landing pages, adds a 30-second timeout + bilingual error to the login form, and stops the dev-mode Supabase pool from starving NextAuth after one login attempt.

### Added (analytics v1)

- **Schema (additive)** — `Subscription.mrrSar` / `acquiredMonth` / `activatedMonth` (nullable); `SubscriptionEvent.eventCategory` / `mrrDeltaSar` / `idempotencyKey @unique` (nullable); new `SubscriptionMrrSnapshot` table with `@@unique([subscriptionId, snapshotMonth])`; `User.lastActiveAt` + `@@index([organizationId, lastActiveAt])`; `Invoice.@@index([dueDate, status])`. All new columns on populated tables are nullable per AGENTS §4.
- **Back-fill** — `scripts/backfill-analytics-v1.ts` walks each Subscription's event history and derives `eventCategory` + `mrrDeltaSar` from `(fromStatus, toStatus, plan diff)`; populates `mrrSar` from `Plan.priceMonthly` / `priceAnnual` × billing cycle; sets `acquiredMonth` / `activatedMonth` from earliest TRIALING / ACTIVE event.
- **Server actions** — 10 metric actions + 1 helper in `apps/web/app/actions/admin-analytics/` (`getNetNewArr`, `getArrWaterfall`, `getArAging`, `getCollectedVsBilled`, `getFailedPaymentArrAtRisk`, `getZatcaClearanceRate`, `getTopArrConcentration`, `getDiscountLeakage`, `getTrialToPaidConversion`, `getPlatformRiskInputs`, plus `snapshotMrrForMonth`). All guarded with `requirePermission("billing:admin")`, accept `{from, to}`, return `JSON.parse(JSON.stringify(...))`-serialised payloads.
- **Cron infrastructure** — new `vercel.json` with `/api/cron/snapshot-mrr` (day 1 of each month at 00:05 UTC, writes prev-month snapshot) and `/api/cron/refresh-current-month-snapshot` (every 6h, upserts current month). Reuses the existing `?secret=$CRON_SECRET` auth pattern.
- **UI primitives** — `KPICard.description?: string` prop renders a `lucide-react` Info icon next to the label; on hover / focus opens a Radix `Tooltip` (keyboard-accessible per §6.17). Bilingual `aria-label`: "About this metric" / "حول هذا المقياس".
- **URL-synced state** — `apps/web/lib/use-date-range-query.ts` reads `?from=YYYY-MM-DD&to=YYYY-MM-DD`, defaults to MTD when absent, writes via `router.replace()` on change. Memoised on the raw query strings to prevent the re-render loop. Generic building block `apps/web/lib/use-query-state.ts`.
- **Dashboard rebuild** — `apps/web/app/dashboard/admin/page.tsx` desktop branch: `PageHeader` with `DateRangePicker` (MTD default, 6 presets) + `LastUpdatedAgo` (visible refresh); hero KPI "Net New ARR" with breakdown line + 12-mo sparkline; ARR Waterfall section (8 KPIs + Recharts BarChart + reconciliation-drift banner); Collections & AR Aging (7 KPIs + stacked bar); Tenant Risk Inputs (4 KPIs); Concentration & Revenue Mix (4 KPIs); Platform Scale demoted to `tier="utility"`; 12-mo MRR trend; existing Quick Links retained. Every metric carries a bilingual EN/AR description (24-entry catalog).

### Added (login UX)

- **30-second login submit timeout** — `apps/web/app/auth/login/page.tsx` wraps `loginAction(formData)` in `withTimeout(_, 30_000)`; on timeout the spinner stops, the button re-enables, and a red bilingual banner shows the AR / EN copy per AGENTS §6.11.4 ("what happened + what to do next"). New `TIMEOUT` entry in the page's `errorMessages` map.

### Fixed (a11y — landing pages, axe-core 4.10.2 clean in both themes)

- **Button name** — Monthly/Annual pricing toggle (`landing/components/Pricing.tsx`) is now `role="switch"` with `aria-checked` + bilingual `aria-label` (new `pricingToggleAriaLabel` translation key in both locales). Dropped the conflicting `aria-pressed` after the first axe pass flagged it as `aria-allowed-attr`.
- **Region** (96 nodes) — `landing/LandingPage.tsx` now wraps Hero → FinalCTA in `<main id="main-content">` between `<header>` and `<footer>`. The body content is no longer orphaned outside landmarks.
- **Heading order** — Footer column titles `<h4>` → `<h3>` (`landing/components/Footer.tsx`), so the page no longer skips from `<h2>` to `<h4>`.
- **Color contrast (11 elements)** — Hero subtitle / Hero link / Hero trust badges (`text-white/60` → `text-white/85`–`/90`); Vision2030 subtitle + card descriptions (`text-white/60` → `text-white/85`); Features tab active state (`bg-primary text-primary-foreground` → adds `dark:bg-primary-deep dark:text-white`); "Save 20%" + "Most Popular" pricing badges (`text-primary` → adds `dark:text-white`); Header "Start Free Trial" CTA + FinalCTA "Start Free Trial" button (white-on-primary failures → `dark:bg-primary-deep` / `text-primary-deep font-bold`); Footer "made-in-Saudi" tagline + Footer copyright + Pricing plan feature "not included" labels (`text-muted-foreground/60` → full `text-muted-foreground`).

### Fixed (dev-mode infra)

- **Supabase pg.Pool starvation under HMR** — `packages/db/src/index.ts` now memoises the `pg.Pool` on `globalThis.pgPool` (in addition to `PrismaClient`), capped at `max: 10` with `idleTimeoutMillis: 10_000`. Before this, every Next.js HMR rebuild allocated a fresh `pg.Pool`, the old connections never closed, and NextAuth + every server action hung indefinitely after one login attempt. Also dropped `"query"` from the dev log channel — the query firehose was contributing to the dev server choking under axe-core re-runs.

### Changed

- `apps/web/app/actions/trends/getMrrTrend.ts` now sources from `SubscriptionMrrSnapshot` instead of summing live invoices (immune to historical `Plan` price mutations). Signature unchanged (`number[]`).

### Verification

- Full `npx tsc --noEmit` green across `packages/ui`, `packages/db`, `apps/web`. `npm run build --workspace=apps/web` green locally.
- Schema additions applied via `prisma db push` against the live Supabase per AGENTS §4. Back-fill ran cleanly (4 subscriptions updated, 1 event categorised, 4 non-zero `mrrSar`); current-month snapshot row populated.
- `/dashboard/admin` structural verification via accessibility-tree snapshot + DOM `inspect` in all four theme/locale combinations:
  - **Light-RTL:** hero "صافي الإيراد السنوي الجديد" + breakdown line + DateRangePicker "١ يونيو ٢٠٢٦ — ٢ يونيو ٢٠٢٦" + 29 info-icon `aria-label="حول هذا المقياس"` buttons + 6 Arabic sections + reconciliation banner "تحذير المطابقة: انحراف 5K ر.س" (expected against an empty-history snapshot).
  - **Light-LTR:** "Net New ARR" + 29 "About this metric" buttons + "1 Jun 2026 — 2 Jun 2026" picker + 6 English sections.
  - **Dark-LTR:** body `rgb(16,13,22)` (warm charcoal), card `rgb(26,22,34)` (elevated, no shadow per §6.13), foreground `rgb(227,226,233)`; English labels + descriptions correct.
  - **Dark-RTL:** same dark surfaces, RTL layout confirmed via `border-inline-start-color: rgb(66,140,215)` (info accent) on cards positioned at the right-side leading edge (`x:849.75`); Arabic labels + descriptions correct, locale prop `"ar"`.
- Raster screenshots via the preview MCP tool's Chromium snapshot timed out on the heavy multi-chart page (a known Recharts + many-card rendering bottleneck); accessibility-tree + targeted `preview_inspect` calls substituted equivalent structural, colour, and layout verification.
- Landing page `/ar` (light + dark): **`axe.run()` returns `{ violations: [] }`** (axe-core 4.10.2 injected into the running production build). Verified the same on `/en`. Before this work the same scan returned 4 critical/serious violations.
- The four cross-theme/locale screenshot raster quadruple (light-LTR / light-RTL / dark-LTR / dark-RTL) + manual keyboard-Tab walk + mobile 375×812 viewport pass remain deferred per AGENTS §3.9 — surfaced as a §3.9 known-blocker before tagging.

### Upgrade notes

- **Env var:** add `AUTH_TRUST_HOST=true` to the production env. Without it NextAuth v5 returns 500 "server configuration" on non-HTTPS hosts (was already added locally; not committed since `.env*` is gitignored).
- **Cron secret:** ensure `CRON_SECRET` is set in the Vercel project before the two new cron routes can fire. The routes fail-closed with HTTP 500 when the secret is unset (same pattern as the existing `expire-reservations` cron).
- **First prod snapshot:** the monthly snapshot cron writes the **previous** full calendar month on the first of each month at 00:05 UTC, so the first deploy will only seed one historical month. To back-fill more, manually hit `/api/cron/refresh-current-month-snapshot?secret=$CRON_SECRET` (writes the current month) before relying on the 12-month MRR trend chart.
- No tenant-side schema changes; no tenant route additions; no permissions migration.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.7.0...v4.8.0

---

## [4.7.0] — 2026-05-17 — Payment money-correctness + executable dashboards

Phase 5. Headlined by a **fix to a live, pre-existing data-integrity defect**: rent payment recording could not represent a partial payment at all, which silently corrupted every collection-rate, AR-aging, revenue, and rent-collection figure in the product. Also lands the RoleTaskQueue, Documents required-by-stage, and a Reports regroup. Schema changes are additive (`prisma db push` safe).

### Fixed (data-integrity — was corrupting money figures)
- **`recordPayment` (`installments.ts`) violated AGENTS §4 and could not record partials.** It hardcoded `status: "PAID"`, never wrote `paidAmount`, and discarded the submitted amount — so any partial payment became "fully paid" with no record of how much, and every finance/AR metric (which read scheduled `amount` filtered by binary `status`) was wrong whenever a tenant paid partially. Rewritten: interactive `$transaction` + `SELECT … FOR UPDATE` row lock, accumulate-not-overwrite, **`paidAmount` always written atomically with `status`**, overpay rejection, already-paid guard, caller-supplied payment date, DB-unique idempotency key (`@@unique([leaseId, paymentReference])`) with replay-safe `P2002` handling.
- **`recordInstallmentPayment` (`payment-plans.ts`)** had no input validation, no transaction, no idempotency, no overpay guard — same hardening applied; plan-completion rollup moved inside the transaction.
- **All five corrupted metric surfaces corrected** — `dashboard-finance.ts`, `finance.ts` (incl. `getUnitRevenueBreakdown`), `reports.ts` (`getRentCollectionReport` + `getRevenueReport`), `trends/getCollectionsTrend.ts`, `trends/getRevenueTrend.ts`. Canonical `effectivePaid` rule (legacy `PAID`/`paidAmount=NULL` rows treated as fully paid for scheduled amount — non-destructive, no in-place backfill of historical money rows); AR computed as remaining (`amount − paidAmount`); revenue keyed on `paidAt` not `updatedAt`. `markOverdueInstallments` now also ages past-due `PARTIALLY_PAID`. Collected/revenue sums `effectivePaid` over **all** in-scope rows (no status filter) so a partial that later ages to `OVERDUE` does not lose its received cash.

### Fixed (production-deploy & regressions — caught by real-DB UI verification, not CI)
- **`Deal.updatedAt` was not production-deployable.** v4.5.0 added `updatedAt @updatedAt` (a `NOT NULL` column with no SQL default) to the `CustomerPropertyInterest` table. `prisma db push` cannot add such a column to a table that already has rows — it only worked in CI because ephemeral DBs start empty. Production had 5 rows and the push aborted. Added `@default(now())` (backfills existing rows; `@updatedAt` still app-manages writes). Verified on prod: 5 rows backfilled, 0 NULL, no data loss.
- **`document-requirements.ts` broke the Contracts page.** A `"use server"` file may only export async functions; it also exported a `const` object → "can only export async functions, found object", which collapsed the contracts page's server-action bundle ("Failed to load contracts"). `tsc` and the Playwright suite did not catch it. Made the constant module-private.

### Added
- **`<RoleTaskQueue>`** (`@repo/ui`) — severity-sorted actionable buckets, RTL, six states, no `dark:`. Fed by `getRoleTaskQueue` (existing dashboard stats + two minimal org-scoped counts: contracts awaiting signature, leads to follow up). Mounted as a visible card on the Org Owner, Leasing, Finance, and Maintenance dashboards.
- **Documents required-by-stage** — additive `Document.contractId` relation; new `getMissingRequiredDocs` (org-scoped) surfacing missing per-stage documents as a `<ProcessBlockerBanner>` in the contract detail drawer.

### Changed
- **Reports regrouped by business question** (Financial Performance / Operations & Utilization) — presentational only; every report, link, and export preserved on desktop and mobile.
- **Fixed a pre-existing `DocCategory` enum/UI mismatch** — the documents page filtered by `BLUEPRINT/STRUCTURAL/COMMERCIAL`, none of which are `DocCategory` values, so those filters silently returned nothing. UI aligned to the real enum.
- **Unified PII masking** — `maskNationalId`/`maskPhone` used a 6-asterisk token while `maskEmail` used 3, and masked numeric PII was not LTR-wrapped so it visually reversed in Arabic RTL (showed `2222*******` instead of `***2222`). One `***` token across nationalId/phone/email/hijri-DOB via `lib/pii-masking.ts` (convention documented in-file), every CRM PII render site wrapped `dir="ltr"`. Security/reveal policy unchanged.

### Verification (full §3.9 preview walk performed — against the real production database)
- Forced `tsc --noEmit` (cache-bypass) green for `@repo/ui` + `@repo/web`. Money write-paths **read line-by-line** and the AGENTS §4 invariant (every payment status write co-writes `paidAmount`) confirmed in both functions. CI step `apps/web/e2e/seed/payment-correctness-test.ts` exercises the deterministic correctness matrix on CI's ephemeral Postgres; PR #14 CI green (build + Playwright + ephemeral `db push`).
- **§3.9 preview walk was completed** (not deferred): the additive schema was applied to the production Supabase (plain `db push` self-aborted twice on real blockers — both surfaced and fixed; data integrity verified by before/after row counts), then the app was driven in-browser against real production data. Verified: RoleTaskQueue (real derived tasks), Documents required-by-stage `ProcessBlockerBanner` on a signed contract, Reports regroup, unified PII masking on CRM, money metrics, login, §8/§9.3 tenant↔system access separation (Layer-2 redirect), light/dark × AR-RTL/EN-LTR.
- **The walk caught two defects CI did not** (the `Deal.updatedAt` prod-deploy block and the `document-requirements` "use server" regression — both fixed above). Concrete reaffirmation of §3.9: CI ≠ working UI.
- **Honest limitation:** the CI correctness test mirrors the action logic against the real DB/schema (Server Actions can't run outside a Next runtime). Follow-ups (tracked): extract the pure money logic into a shared non-`"use server"` module for direct testing; an append-only `RentPayment` ledger is deliberately deferred; reports-page section headers show EN in the AR view (page-level `lang`-source quirk, cosmetic).

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.6.0...v4.7.0

## [4.6.0] — 2026-05-17 — Journey adoption across core screens

Phase 4 of the journey-first transformation. The Phase-3 journey library (`LifecycleRail` / `NextActionPanel` / `ProcessBlockerBanner` / `RelatedContextPanel`) goes from library-only to live on the working screens, fed by one shared, org-guarded data layer. Additive only — no schema, model, permission, or business-logic change.

### Added
- **`getJourneySummary` server action** (`app/actions/journey.ts`) — single org-scoped entry point returning a typed `JourneySummary` (`stages`/`blockers`/`nextActions`/`related`) for `contract` · `reservation` · `customer` · `unit` · `maintenance`. Stage vocabulary and blocker logic derive from the **real** state machines (`contracts.ts` VALID_TRANSITIONS, `maintenance.ts` SLA/transitions, `customer-interests.ts` `DEAL_STAGE_ORDER`, reservation lifecycle) — no invented vocabulary. Auth mirrors every other read action (`requirePermission` + per-query org filter); `Decimal` serialized per project convention.
- **Journey sections** mounted on five surfaces, each reached through an already-visible control (UI-First — no orphan routes):
  - **CRM** — customer journey in the existing `CustomerDrawer`.
  - **Reservations** — reservation journey in the existing detail dialog.
  - **Contracts** — new detail drawer (the list previously had no per-contract detail surface) reachable via a row "view" button on desktop and card tap on mobile.
  - **Units** — the unit detail modal becomes an **operational cockpit**: lifecycle rail, SLA/maintenance blockers, next action, and a related panel surfacing interested customers, the active reservation, the latest contract, and open tickets.
  - **Maintenance** — request detail renders the journey in **both** the mobile and desktop trees (shared element — field technicians get parity).

### Changed
- Contracts list gains a detail drawer + visible row/card affordance (previously no per-record detail surface existed).

### Deferred (intentional, not a gap)
- **Finance journey adoption is moved to Phase 5.** The finance surface is a portfolio AR/collections dashboard (KPIs, aging, trends) with no per-record drilldown — its meaningful "journey" is the role task queue / delinquency workflow that Phase 5 owns. A single-contract lifecycle rail on a charts dashboard would have been invisible dead code, so the speculative wiring was removed rather than shipped dark.

### Verification
- Forced `tsc --noEmit` (cache-bypass) green for `@repo/ui` + `@repo/web`. Cross-link `href`s are centralized in `journey.ts` and target real `/dashboard/*` routes (no per-screen hand-built links to drift). Zero `dark:` utilities introduced; logical RTL props; one-primary-CTA preserved by `NextActionPanel`. Production build + full Playwright suite verified by CI.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.5.0...v4.6.0

## [4.5.0] — 2026-05-17 — Deal/Opportunity entity (CRM pipeline)

Phase 2 of the journey-first transformation. `CustomerPropertyInterest` is promoted to a first-class **`Deal`** model (table preserved via `@@map` — non-destructive `db push`, no data migration). `Customer.status` becomes a derived cache recomputed from the customer's deals; tenancy lifecycle (`ACTIVE_TENANT`/`PAST_TENANT`) still wins.

### Added
- **`Deal` model** — `stage` (`DealStage`: NEW/QUALIFIED/VIEWING/NEGOTIATION/RESERVED/WON/LOST), `value`, `probability`, `expectedCloseDate`, `lostReason`, `updatedAt`; `@@index([stage])`; `@@unique([customerId,unitId])` dropped (a customer may pursue a unit across multiple deals over time). Table mapped to `CustomerPropertyInterest` — zero data migration.
- **`syncCustomerPipelineStatus`** — recomputes `Customer.status` from the most-advanced ACTIVE deal (deterministic tie-break); tenancy statuses are never overridden.
- **`updateDealStage` / `syncDealStageForUnit`** — pipeline transitions now flow through `Deal.stage`; CRM Kanban drag, "mark lost", and the customer drawer are wired to deal stage (board structure unchanged; reuses the existing stage config).

### Changed
- Reservation/contract pipeline `Customer.status` writes rerouted through the Deal entity; tenancy writes (lease → ACTIVE_TENANT, lease-archive → PAST_TENANT) and the manual override path left as direct writes.

### Known follow-ups (non-blocking)
- `marketplace.ts` cross-org conversion still writes `Customer.status` directly (inside a safety-critical atomic cross-org transaction; out of Phase 2 scope — tracked for a dedicated change).
- Confirm-after-convert can create a second `WON` deal row (consistent with the intentionally-removed unique constraint; customer status still resolves correctly via the deterministic sync).

### Verification
- `prisma generate` clean; `tsc --noEmit` green 3/3 (`@repo/ui`/`@repo/web`/`@repo/portal`); grep shows zero stale `db.customerPropertyInterest` refs. Schema application (`db push --accept-data-loss`) + full Playwright suite verified by CI.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.4.0...v4.5.0

## [4.4.0] — 2026-05-17 — Terminology honesty (Deals→Reservations) + shared journey layer

Phases 1 & 3 of the journey-first transformation. **No schema/model/permission/behavioral change.**

### Changed
- **Deals → Reservations** — `/dashboard/deals` was the `Reservation` model mislabeled "Deals" in English (Arabic already shipped "الحجوزات"). Renamed end-to-end: route dir moved with permanent `/dashboard/deals[/*]` → `/dashboard/reservations` redirects; nav + breadcrumb, Cmd-K quick action, 5 `revalidatePath` sites, all links/router pushes, `scripts/verify-ui.mjs`, and AR/EN UI copy. `deals:*` permission keys intentionally preserved (track the `Reservation` model, not the URL). `AGENTS.md`/`CLAUDE.md` §8.2 access list updated.

### Added
- **`@repo/types` journey layer** — `ProcessStage`, `ProcessBlocker`, `NextBestAction`, `JourneySummary`, `RelatedRecordSummary`, `RoleTaskQueueItem`; stage vocabulary mirrors the real `contracts.ts`/`maintenance.ts` state machines.
- **Four `@repo/ui` journey components** — `LifecycleRail`, `NextActionPanel`, `ProcessBlockerBanner`, `RelatedContextPanel`. Compose existing primitives; design-system compliant (one-primary CTA, §6.11.2 banner taxonomy, 480px drawer, six data states, logical RTL props, no `dark:` utilities). Library only — page adoption lands in Phase 4.

### Docs
- `AGENTS.md` §4 corrected — the repo has **no migration history**; CI applies schema via `prisma db push --accept-data-loss` (the prior "migration baseline" claim was stale). Added the git-worktree env/deps rule. `CLAUDE.md` (project-root SoT) synced to the same v4.3.1 + Phase-1 reality.

### Verification
- CI fully green (run `25994427697`): `build-and-test (20.x)` pass in 5m50s — typecheck + lint + cspell + production build + full **Playwright** suite (incl. the repaired `billing.admin`); GitGuardian pass. `tsc --noEmit` 3/3 locally; repo grep shows zero stale `/dashboard/deals` (only redirect sources) or `الصفقات`.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.3.1...v4.4.0

## [4.3.1] — 2026-05-17 — Dead-scope purge (Projects / Off-plan / Wafi)

Phase 0 of the journey-first transformation plan: a complete purge of all dead **Projects / Off-plan / Wafi / escrow** residue left behind after the v4.2.5 module removal. No functional product change — it removes vestigial entitlements, marketing/SEO claims for non-existent features, dead code branches, and orphaned scripts so the product, public site, and docs no longer reference capabilities Mimaric does not have.

### Removed

- **Entitlements** — `projects.max` and `offplan.access` deleted from `seed.ts`, `e2e/seed/billing-seed.ts`, `lib/entitlements.ts` (`PROJECTS_MAX`/`OFFPLAN_ACCESS`), `lib/billing-notifications.ts`, and the billing plans UI label map. `units.max` already covers the only live limit.
- **Landing site** — the "Project Management" feature pillar and the off-plan pricing feature/limit rows removed; "Sales & Off-Plan" reframed as "Sales & CRM"; hero, steps, testimonial, FAQ, and stats copy de-projected (bilingual AR/EN). Dead `screenshots/projects.png` deleted.
- **SEO** — `projects`/`Wafi` removed from live `<head>` metadata (`[locale]/layout.tsx`) and JSON-LD (`SchemaMarkup.tsx`).
- **Dead code** — unused `getProjectStatusDistribution` + `getDashboardLandStats`/`getDashboardOffPlanStats` aliases (`actions/dashboard.ts`); the dead `project` entity map in `StatusBadge`; `"Project"` audit-log resource filter; cosmetic `building.project` dead branches in three maintenance pages.
- **Orphaned scripts** — broken `scripts/e2e-seed.ts` and `prisma/v3-migrate.ts` (referenced dropped `Project`/`Escrow` tables); dead `expectOffPlanSection` e2e page-object; off-plan rows in `BILLING-TEST-PLAN.md`.
- **Docs** — stale Projects/Wafi/escrow references synced out of `AGENTS.md` (§5, §6.1, §6.9.2, §6.9.5) and `README.md`; `AGENTS.md` §4 also gains a git-worktree env/deps setup rule (load `.env.local` from the main project root into the build process env; `npm install` per worktree).

### Verification

- `tsc --noEmit` green across `@repo/ui`, `@repo/web`, `@repo/portal` (3/3). Repo-wide grep confirms zero *live* Projects/Off-plan/Wafi references — only frozen history (`CHANGELOG.md`, `.release-verification/`) retains them intentionally. Full production `next build` + Playwright suite validated in CI on the PR (the worktree has no DB/env; CI carries `DATABASE_URL`/`AUTH_SECRET` per AGENTS §4).

### Upgrade notes

- No action required. Pure dead-code / marketing-copy removal — no schema change, no API change, no behavioral change. The vestigial `projects.max` / `offplan.access` plan entitlements are gone (`units.max` already governed the only live limit; a re-seed reflects this automatically).

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.3.0...v4.3.1

---

## [4.3.0] — 2026-05-16 — Marketplace (verified-org B2B unit trading)

The first non-patch release since v4.2.x: a **verified-organization-only B2B marketplace** that lets tenant orgs trade units across organization boundaries — full workflow from seller publication → buyer inquiry → seller CRM handoff → deal conversion → settlement-gated **atomic cross-org unit transfer** with transactional rollback. Not a public/SEO marketplace (per spec Decision 20 — kept inside verified Mimaric orgs). Additive schema only; all existing single-org flows are untouched.

### Added

- **Data model** — `MarketplaceListing`, `MarketplaceInquiry`, `UnitTransferTransaction` + enums (`MarketplaceListingStatus`, `MarketplaceInquiryStatus`, `UnitTransferStatus`, `MarketplaceComplianceStatus`). `Unit` gains marketplace/transfer provenance fields; `Reservation`/`Contract` gain nullable cross-org bridge fields (`marketplaceInquiryId`, `buyerOrgId`, `sellerOrgId`). Additive only — `prisma db push` applied; existing single-org flows untouched.
- **Permissions** — `marketplace:read|publish|manage_own|inquiry:read|inquiry:write|inquiry:convert|transfer:execute` (tenant-scoped) and `marketplace:moderate` (platform-only). Registered in all four `permissions.ts` sites + role maps.
- **Hardened cross-org read layer** (`lib/marketplace/listing-view.ts`) — the single chokepoint where the org filter is deliberately relaxed; returns explicit allow-listed view models only, never raw `Unit`/`Customer`/`Contract` rows; buyer browse excludes own-org listings.
- **Server actions** (`app/actions/marketplace.ts`) — eligibility (machine-readable blocker codes), draft/publish/update/unpublish, browse/detail, confirm-interest (creates seller-side CRM customer with `source=MARKETPLACE`), convert-to-deal (cross-org reservation + transfer), settlement with `SIGNED` SALE-contract gate, transactional rollback + `FAILED` state + finance/admin notification, platform suspend. Unit clone on transfer bypasses the `UNITS_MAX` entitlement (system-initiated).
- **Maintenance guard** — transferred-away units reject new seller-side maintenance (`MAINTENANCE_BLOCKED_NOT_OWNER` audit event).
- **UI** — `/dashboard/marketplace` (buyer browse, filters, cards/table responsive), `/dashboard/marketplace/[listingId]` (detail + National Address validation + Google Maps `api=1` link + confirmation modal), `/dashboard/marketplace/my-listings` (seller listings, incoming inquiries, convert, settle), `/dashboard/admin/marketplace` (platform moderation/suspend), Publish dialog launched from `/dashboard/units`, Marketplace badge/filter on `/dashboard/crm`. Nav + Cmd-K wired. Bilingual AR/RTL-first, design tokens, audit trail on every transition.

### Fixed

- **My Listings was not discoverable (UI-First violation).** The seller "My Listings" route was set `hiddenFromNav` on the wrong assumption it was reachable via the marketplace page tabs (those are buyer-only: Browse / My Inquiries). Added a permission-gated **"My Listings"** action button in the marketplace page header (visible to `marketplace:manage_own`) and a **"Back to marketplace"** link on the My Listings page. Verified end-to-end in a real browser. AGENTS.md §3.1 updated with a `hiddenFromNav` discoverability rule.

### Verification

- Full `tsc --noEmit` green; `next build` green (all four marketplace routes compiled).
- Functional cross-org E2E through the UI (two real orgs, Playwright + Chromium): seller publish (eligibility gate enforced incl. `MISSING_ADDRESS`) → buyer cross-org browse → listing detail (Maps URL exact) → buyer express interest → seller CRM customer created (`source=MARKETPLACE`, in seller org) → convert to deal (cross-org reservation + `PENDING_SETTLEMENT` transfer) → **settlement correctly refused without a SIGNED sale contract**. Zero marketplace-attributable console errors; mobile 375px no overflow; buyer-browse own-org exclusion confirmed.
- **Screenshot evidence captured** — light/dark × AR/EN for browse, detail, my-listings + admin moderation + mobile (`apps/web/e2e/__screenshots__/marketplace/`). The earlier preview-renderer limitation was bypassed by running the suite under Playwright/Chromium.
- **axe-core accessible-name scan** — zero violations across all marketplace surfaces and dialogs (browse, my-listings, detail, admin moderation, publish/interest/edit/suspend dialogs). Pre-existing name violations elsewhere (`/dashboard/settings`, `/dashboard/reports`, `/dashboard/maintenance/tickets`) are out of scope for this feature.
### Upgrade notes

- Schema is **additive** (new models/enums + nullable columns on `Unit`/`Reservation`/`Contract`). Apply with `prisma db push` (per AGENTS §4 — no destructive migration). No backfill required; the one unique index is on a new nullable column (multiple NULLs allowed in Postgres).
- New permissions are auto-granted by role map: `ADMIN`/`MANAGER` get the full tenant marketplace set, `AGENT` gets read + inquiry, `SYSTEM_ADMIN` gets `marketplace:moderate`. No manual role migration needed.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.2.5...v4.3.0

---

## [4.2.5] — 2026-05-16 — Off-plan module removal & Wafi reference cleanup

Full removal of the off-plan sales module, project route, and all Wafi branding/content that was surfaced as dead code after the v4.2.x schema cleanup.

### Removed

- **7 stale E2E specs and page objects** — `dashboard.admin.spec.ts`, `analytics.pm.spec.ts`, `launch-readiness.pm.spec.ts`, `reservations.sales.spec.ts`, `reports.admin.spec.ts`, `pages/project-detail.page.ts`, `pages/reports.page.ts`. All tested removed off-plan/project-detail flows; their absence was causing 47 CI failures.
- **Wafi trust badge** — `Hero.tsx` no longer shows the `wafiReady` badge; `HardHat` icon import removed.
- **Wafi translations** — `wafiReady` key removed from `translations.ts` (ar + en); four strings mentioning Wafi updated to reference only Balady/MOC/ZATCA.
- **Wafi help content** — `help-content.ts`: FAQ entry `sc-6` ("What is Wafi?"), FAQ entry `sc-9` ("How do I create a Wafi-compliant sale contract?"), and guide `guide-23` ("Create a Wafi Sale Contract") removed. Entry `sc-13` updated to remove Wafi terminology from question and answer.
- **`/dashboard/projects` landing page option** — removed from `ALLOWED_LANDING_PAGES` in `auth.ts` and `preferences.ts` (route was deleted in v4.2.x; storing it as a preference caused silent redirect failures on login).
- **`pricing:read` and `launch:read` permissions** — removed from the `Permission` union type and from `ALL_PERMISSIONS` and `TENANT_SCOPED_PERMISSIONS` arrays in `permissions.ts`. No server action or route guard references these permissions.
- **Dead seed blocks** — two `try { prisma.project/building/subdivisionPlan.create ... } catch` sections removed from `seed.ts` (~450 lines). These were temporary guards added in v4.2.4; the underlying models are gone and the blocks can never succeed.

### Metrics

- 14 files changed: 7 deleted, 7 modified. Net −1,160 lines.
- TypeScript clean after removal.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.2.4...v4.2.5

---

## [4.2.4] — 2026-05-16 — CI infrastructure & seed stability

Fixes the GitHub Actions E2E pipeline which had never successfully completed an authenticated test run.

### Fixed

- **CI: PostgreSQL service missing** — Playwright tests were hitting `ECONNREFUSED` because no database was available in the Actions runner. Added a `postgres:16` service container with health-check, exposed on port 5432.
- **CI: `--skip-generate` flag invalid in Prisma 7.x** — `prisma db push` no longer accepts this flag; removed.
- **CI: schema push and seed added** — `prisma db push --accept-data-loss` and `tsx prisma/seed.ts` steps added after Prisma client generation so the E2E database has the correct schema and demo users before tests run.
- **Seed: removed-model crash** — `seed.ts` referenced `prisma.project`, `prisma.building`, and `prisma.subdivisionPlan` which were removed from the schema in v4.2.x. The seed crashed before reaching the demo-user upserts, leaving E2E tests with no auth state. Wrapped both blocks in try-catch so demo users (`dummy@demo.sa`, `pm@demo.sa`, `sales@demo.sa`, `tech@demo.sa`) are always created.

### Commits

`ad2f223`, `9e9864c`, `368b118` (merged via PR #5)

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.2.3...v4.2.4

---

## [4.2.3] — 2026-05-16 — Admin dashboard render fix

Patch targeting bugs that prevented `/dashboard/admin` from rendering for `SYSTEM_ADMIN` users after the v4.2.2 tenant-isolation hardening, plus dead report-domain code removal.

### Fixed

- **Dashboard layout infinite redirect loop** — `dashboard/layout.tsx` called `requireTenant()` which, for system users, redirects to `/dashboard/admin` — itself under the same layout — creating an infinite redirect cycle. Fixed by detecting `isSystemRole` before routing: system users go through `requireSystem()` (auth + role check only); the nested `admin/layout.tsx` remains the real access gate. Tenant users continue through `requireTenant()` as before.
- **Missing `getMrrTrend` server action** — `/dashboard/admin/page.tsx` imported `getMrrTrend` from `actions/trends/getMrrTrend` but the file did not exist in the repo, causing Turbopack to deadlock on every request to the admin route. File created with correct 12-month invoice-bucket aggregation logic.
- **`getMrrTrend` TS2532** — `noUncheckedIndexedAccess` made `buckets[idx]` type `number | undefined`; fixed with `(buckets[idx] ?? 0) + …` null-coalescing pattern.
- **`customers.ts` TS2353 — `organizationId` on `Reservation`** — `updateCustomerStatus` LOST-path transaction incorrectly included `organizationId` in the `Reservation.findMany` where-clause; `Reservation` has no direct `organizationId` field (tenant isolation is enforced via `customerId → Customer.organizationId`). Field removed.
- **`customers.ts` TS2322 — `CustomerStatus` enum cast** — Zod schema returns `string`; both `customer.update` calls now cast `validatedStatus as CustomerStatus` and import the enum from `@repo/db`.

### Removed

- **Dead report scaffolding** — 5 project-domain report functions returning hardcoded zeros removed from `reports.ts` (`getProjectProgressReport`, `getApprovalStatusReport`, `getSalesVelocityReport`, `getLaunchReadinessReport`, `getOffPlanInventoryReport`). Route `/dashboard/reports` retained; only the off-plan-specific report types were deleted.

### Metrics

- 4 files changed: `dashboard/layout.tsx`, `actions/customers.ts`, `actions/trends/getMrrTrend.ts` (new), `actions/reports.ts`.
- TypeScript clean (`tsc --noEmit` zero errors across `apps/web`).

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.2.2...v4.2.3

---

## [4.2.2] — 2026-05-15 — Security & Stability Hardening (QA Audit)

Full-pass remediation of 22 findings from the internal QA code audit. Score raised from 5.5/10 (No-Go) to production-ready. No new features — correctness, security, and data integrity only.

### Security

- **Tenant isolation on document uploads** — UploadThing `authMiddleware` now rejects system-role sessions and sessions with `null organizationId`. System staff can no longer upload files into tenant document vaults.
- **Dashboard layout tenant gate** — `/dashboard/layout.tsx` now calls `requireTenant()` (hard redirect on system users or null org) instead of bare `auth()`. System users attempting to access any tenant route are redirected immediately at the shell level, not only at action boundaries.
- **Cron endpoint fail-closed** — `/api/cron/expire-reservations` now returns `500` when `CRON_SECRET` is not configured (previously let all requests through). Returns `401` on mismatch as before.
- **Moyasar webhook hardening** — `timingSafeEqual` guard now pre-checks buffer lengths before comparison and wraps in try/catch; zero-length signatures return `{ valid: false }` rather than throwing.
- **Org-scoped cross-reference validation** — `createMaintenanceRequest` now verifies `unitId` and `assignedToId` both belong to the caller's org before inserting. `registerFileInDb` verifies `customerId`/`unitId` before attaching documents.
- **billing.ts permission** — `generateSubscriptionInvoice` switched from `getSessionOrThrow()` to `requirePermission("billing:write")`, ensuring the permission check is enforced.

### Data Integrity

- **Atomic contract numbering** — standalone `generateContractNumber()` (read-then-write, race-prone) replaced with an inline `db.$transaction` that counts and creates in the same atomic unit for both SALE and LEASE paths.
- **Atomic reservation status** — `updateReservationStatus` wraps all related writes (`reservation`, `unit`, `customer`, `reservation.count`) in `db.$transaction`.
- **Partial payments** — `recordPayment` now validates `amount > 0`, guards against cumulative overpayment, and sets `PARTIALLY_PAID` vs `PAID` correctly. Persists `paidAmount` on `RentInstallment`.
- **LOST cascade in transaction** — `updateCustomerStatus` (LOST path) runs the reservation cancel + unit status reset + interest drop inside a single `db.$transaction`. Ownership is verified *before* the transaction begins.
- **Schema: `paidAmount` on `RentInstallment`** — added `paidAmount Decimal?` (was missing; only existed on `PaymentPlanInstallment`). Migration baseline created under `packages/db/prisma/migrations/`.

### Validation

- **Zod schemas at all write boundaries** — `createCustomer`, `updateCustomerStatus`, `createMaintenanceRequest`, `registerFileInDb` all parse input with Zod before touching the database. Error messages surface field-level issues to the caller.
- **`UpdateUnitInput` type** — `updateUnit` replaced `data: any` with an explicit typed input; field whitelist prevents arbitrary field injection (`organizationId`, `id`, timestamps excluded).

### Observability / PII

- **PII phone hash** — `getCustomerInterestsForUnit` no longer selects `phoneHash` directly. Phone is fetched as encrypted, decrypted, then masked by `maskCustomerPii` based on the caller's `customers:read_pii` permission. Audit event emits `READ_PII` when PII is accessed.

### Performance

- **Revenue report N+1 eliminated** — monthly-by-month loop (2 aggregates × N months) replaced with two `db.$queryRaw` `GROUP BY date_trunc('month', ...)` queries. Calendar loop now only assembles output from Maps — zero DB calls inside.
- **Pagination on all list actions** — `getContracts`, `getReservations`, `getMaintenanceRequests`, `getUnitsWithBuildings`, `getDocuments`, `getCustomers` all accept `page`/`pageSize` (default 50, capped at 100) with `skip`/`take` applied to `findMany`.

### Removed

- **Dead project-domain scaffolding** — 5 empty report functions returning hardcoded zeros deleted from `reports.ts`. `/dashboard/projects` option removed from settings landing-page selector and global search dropdown. Stale E2E specs for deleted project/planning routes removed (`planning.admin.spec.ts`, `offplan-modals.*.spec.ts`).
- **Duplicate `createLease` / `generateContractNumber`** in `leases.ts` — zero callers confirmed, both deleted.

### CI

- `continue-on-error: true` removed from Playwright E2E step — test failures now break the build.
- Vacuous `expect(true).toBeTruthy()` assertions replaced with meaningful checks in `access-control.tech.spec.ts`, `billing.admin.spec.ts`, `dashboard.admin.spec.ts`.

### Docs

- `AGENTS.md` §4 updated: mandates `prisma migrate dev/deploy`; documents `paidAmount` schema addition.
- `README.md` setup steps and project conventions updated to match migration-based workflow.

### Migration notes

- **Breaking schema change:** run `npx prisma migrate deploy` (prod) or `npx prisma migrate dev` (local) — do NOT use `prisma db push`.
- The `paidAmount` column is nullable; existing `RentInstallment` rows default to `null` (no backfill needed for correctness).

### Metrics

- 22 findings closed (all from QA audit report 2026-05-15).
- TypeScript clean across all workspaces.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.2.1...v4.2.2

---

## [4.2.1] — 2026-05-09 — Portal a11y, Admin Email SMTP fix, Route hygiene

Patch release targeting three issues deferred from v4.2.0.

### Fixed

- **Admin email SMTP 500 error** — `getEmailSettings()` and `getSecretEmailSettings()` in `lib/email.ts` now wrap `db.systemConfig.findUnique` in try/catch, returning safe defaults when no `SystemConfig` record exists. Previously, a missing record caused two `Failed to load resource: 500` errors on page load (React Strict Mode ran the fetch effect twice). `load()` in `admin/email/page.tsx` now has a proper `catch {}` block so failures degrade gracefully to the defaults form state.
- **Admin email hydration mismatch** — Added `suppressHydrationWarning` to the `dir`-bearing outer wrapper div in `admin/email/page.tsx`. The `dir` attribute is driven by `useLanguage()` which defaults to `"ar"` on the server but may differ on the client after localStorage is read; the suppression prevents a one-time React reconciliation warning.
- **Portal a11y — landmark and ARIA structure** — `PortalClient.tsx` now passes axe-core structural checks: skip-to-content link added; `id="main-content"` on the main content wrapper; all three content `<section>` elements carry `aria-labelledby` referencing their `<h3>` headings; document download links carry `aria-label` with filename; the category/priority field group uses `<fieldset>` + `<legend class="sr-only">`; a `role="status" aria-live="polite"` region announces maintenance-request submission results to screen readers.
- **Route segment hygiene for `admin/email`** — Added `loading.tsx`, `error.tsx`, and `not-found.tsx` to `app/dashboard/admin/email/`, matching every other admin sub-route. `error.tsx` uses the shared `RouteError` primitive (shows `error.digest` only, `console.error`s full error for observability).

### Known remaining

- Portal color-contrast violations (axe-core `2.43–2.47:1` ratio on specific badge and muted-text elements) — the structural fixes above eliminate the majority of the ~101 violations, but semantic-token contrast on the `Badge` `available`/`success`/`info` variants (text on `/10` opacity background) is borderline under WCAG AA for `text-xs` in certain themes. Tracked for v4.3 design-system pass.

### Metrics

- 6 files changed: 3 modified + 3 new route-segment files.
- TypeScript clean (`tsc --noEmit` green across `apps/web` and `apps/portal`).

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.2.0...v4.2.1

---

## [4.2.0] — 2026-05-09 — Tenant Portal, Transactional Email & Multi-Org Auth

**Commits:** `6a169d8`, `fe099ba`, `0ebab9c` (3 commits post v4.1.0).

Three interlocking features that complete the tenant-facing surface and lay the email infrastructure foundation.

### Added

- **Tenant Portal MVP** (`/portal`) — read-only tenant view with lease summary, documents, and a maintenance request entry point. Mounted in `apps/web` so tenant and management users share the same session and auth surface. New `app/actions/portal.ts` resolves the logged-in `USER`-role account's `Customer` record.
- **Dual-mode login** — `/auth/login` now discriminates between Management (default) and Tenant Portal via a `?mode=tenant` toggle. Wrong-mode login attempts surface a friendly redirect rather than a generic auth error.
- **Transactional email infrastructure** — Hostinger SMTP via `nodemailer`, encrypted password storage on `SystemConfig` (last-4 retained for UI audit display), branded bilingual HTML templates (`lib/email-templates.ts`), and a public-URL helper (`lib/app-url.ts`). Wired into the invitation flow so new teammates receive a real invite email.
- **Admin email settings page** (`/dashboard/admin/email`) — gated by `billing:admin`; lets a system admin configure SMTP host/port/credentials and From identity, and send a live test message. Test results persisted to `SystemConfig.emailLastTest*` for audit visibility.
- **Codex agent docs** (`AGENTS.md`, `.codex/config.toml`) — Codex sessions now inherit the same Mimaric guardrails as Claude Code sessions.

### Changed

- **`User.organizationId` is now nullable** — system/platform users can exist without a tenant org. `auth-helpers.ts` exposes a stricter `requireTenantPermission()` companion for server actions that must run inside an org context.
- `PaymentPlan.organizationId` and `AuditLog.organizationId` follow suit (nullable).
- `apps/web/app/dashboard/settings/team/page.tsx` reorganised around the new invitation + email flow.
- `apps/portal/app/page.tsx` and `apps/portal/app/dashboard/leases/page.tsx` simplified — heavy logic moved to the unified portal in `apps/web/app/portal/`.
- Office lock files (`~$*`) globally gitignored.

### Fixed

- CI: added `DMARC` to cspell allowlist.
- Removed stray PowerPoint lock file from `docs/demo-deck/`.
- **a11y:** added `aria-label` to desktop (`AppTopbar`) and mobile (`MobileSearchSheet`) search inputs — resolves unlabelled-input axe violation.
- **gitignore:** ignore `*.Zone.Identifier` Windows metadata files.
- **lockfile:** removed stale `"peer": true` entries from `package-lock.json` (npm metadata sync).

### Migration notes

- Schema change requires `npm --prefix packages/db exec prisma db push` (project uses push, not migrations).
- Set SMTP credentials via `/dashboard/admin/email` before relying on transactional email in the invitation flow.
- System/platform users seeded with `organizationId: null` — re-run seed if local data has system users with an org attached.

### Metrics

- 33 files touched, +1,850 / −727 LOC across portal, email, and auth layers.
- Build green (`turbo run build` — 2/2 tasks, 37.9s).
- Schema in sync with Supabase (verified via `prisma db push`).

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.1.0...v4.2.0

---

## [4.1.0] — 2026-04-18 — UX Coherence Pass

**Branch:** `release/v4.1-wave-a` (4 commits).

v4.0 shipped Design System v2. A five-lens council review (a11y, RTL, mobile, design-system adoption, information architecture) surfaced ~40 post-ship adoption gaps — routes bypassing primitives, palette leaks, tap targets below 44px, orphan routes, `alert()` fallbacks leaking exception strings. v4.1 means every surface uses the system.

### Phase 1 — Strike PR

- **Dead-link cleanup:** 10 sites across 8 files pointing at `/dashboard/reservations`, `/dashboard/sales/*`, `/dashboard/rentals/*` retargeted to live routes (`/dashboard/deals`, `/dashboard/contracts`, `/dashboard/payments`, `/dashboard/crm`). Includes `revalidatePath` calls in server actions and the manifest shortcut.
- **Orphan routes surfaced:** `/dashboard/reports` and `/dashboard/documents` registered in nav — now reachable from sidebar, More menu, and Cmd-K.
- **`alert()` purge:** 9 sites across 5 files replaced with `toast.error(friendlyMessage)` — raw exception strings demoted to `console.error` only.
- **Exception-string leaks killed** in `/dashboard/documents` — `${e.message}` in UI copy replaced with static friendly sentences.
- **DirectionalIcon primitive sweep:** `breadcrumb`, `pagination`, `dropdown-menu`, `context-menu`, `menubar`, `carousel` — bare directional icons in the primitive layer wrapped in `<DirectionalIcon />`. (App code was swept in v4.0; this closes the primitive-layer gap.)
- **Button focus ring fix** — `ring-1 outline-none` replaced with `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none` per § 6.6.3 / § 6.17.
- **44×44 mobile tap targets** — `h-8 w-8` → `h-11 w-11 sm:h-8 sm:w-8` on icon-only affordances across CRM, Documents, Settings/Team.
- **CRM PII unification** — deleted local `maskPhone` in `crm/page.tsx`, imported shared helpers from `@/lib/pii-masking`. Single format `******4567` everywhere; added `<Phone />` icon preceding phone values; ciphertext guard via `maskCustomerPii` wrapper.
- **`StatusBadge` variant overload** — new `{ variant: "success" | "warning" | "danger" | "info" | "neutral", label }` API so callers without an entity key stop hand-rolling inline palette badges.
- **Cmd-K audience filter** — `QuickAction.audience: "tenant" | "platform"` added; quick-action create shortcuts now filter by audience AND permission per § 8.5.

### Phase 2 — Wave A: palette cleanup + PageHeader adoption

- **Semantic-token sweep** across 26 dashboard pages — `bg-blue-*`, `text-emerald-*`, `border-red-*`, `bg-amber-*`, etc. replaced with `bg-info/10`, `text-success`, `border-destructive`, `bg-warning/10`. Mapping: blue/cyan/sky/teal→info, green/emerald→success, red/rose/pink→destructive, amber/yellow/orange→warning, purple/violet/indigo→primary, gray/slate/zinc/stone/neutral→muted. No more `dark:` utilities in the sweep surface area.
- **`PageHeader` adoption** on 11 admin + billing + documents + maintenance/preventive pages (meta-style headers). `PageIntro` kept intact as the glass-hero primitive for the 9 routes where it serves as the page hero (CRM, Deals, Contracts, Payments, Units, Reports, Billing, Maintenance/Tickets, the tenant dashboard). Council plan had called for unification — verification showed they serve different page types and both belong.

### Phase 2 — Wave B: `EmptyState` + `ResponsiveDialog`

- **`EmptyState` 5-element formula** (§ 6.12.1 — icon + title + description + primary CTA + optional secondary + optional help link) retrofitted across 23 dashboard pages. ~20 first-time empties + ~22 filter-empties + ~14 widget-compact empties. Filter-empties ship a "Clear filters" CTA; first-time empties ship permission-gated create verbs.
- **`ResponsiveDialog` migration** — three bespoke modals in `units/page.tsx` (Change Price, Unit Detail, Add Unit) rewritten as `<ResponsiveDialog>` so they render as desktop modal / mobile bottom sheet from a single source. 0 `fixed inset-0` modal wrappers remain. Net −17 lines.

### Phase 2 — Wave C: route-segment hygiene + audience helpers + DataTable

- **Route-segment hygiene** — 68 new files across 23 dashboard segments: 18 `loading.tsx` + 18 `error.tsx` + 32 `not-found.tsx`, all wired to 3 shared primitives (`RouteLoading`, `RouteError`, `RouteNotFound`) under `apps/web/app/dashboard/_components/`. `RouteError` shows `error.digest` only, never `error.message`; `console.error(error)` in `useEffect` for observability. `RouteLoading` uses skeletons matching real layout dimensions (§ 6.12 "skeleton > spinner"). All bilingual via `LanguageProvider`.
- **`requireSystem()` / `requireTenant()` helpers** added to `apps/web/lib/auth-helpers.ts` and applied to `admin/layout.tsx` (11 → 6 lines). Tenant-side audience enforcement remains in middleware + `DashboardClientLayout` as before — cleaner than scattering inline server guards across every page.
- **`help/page.tsx` DataTable migration** — 4 raw `<table>` blocks (My Tickets, Permission Request History, Pending Permission Requests, Pending Join Requests) replaced with `<DataTable>` + `mobileCard` transform (§ 6.10, § 6.14.3). Inline approve/decline forms preserved across desktop and mobile. Bilingual empty states via the primitive.

### Metrics

- 4 commits, 146 files touched (net), +2,892 / −1,289 LOC.
- Typecheck green at every wave boundary (`npx turbo run check-types --filter=@repo/web` FULL TURBO).
- Zero `alert()` calls in `apps/web/app/dashboard/**`. Zero `<table>` JSX in `help/page.tsx`. Zero `dark:` utilities in Wave-A sweep surface.

### Deferred

- Phase 0 public-repo security scrub (seed-password rotation + git history rewrite + force-push) — tracked separately; destructive to remote history, needs coordination.
- Remaining `h-8 w-8` files outside icon-only affordances (text buttons already meet 40px desktop / 48px `lg` mobile — deferred as not-a-bug).
- react-hook-form + zod form adoption (still deferred from v4.0).
- DB-backed TanStack saved views (URL-sync only this release).

**Upgrade notes**

- Call sites that imported the local `maskPhone` from `apps/web/app/dashboard/crm/page.tsx` must now import from `@/lib/pii-masking`. Format changes from `509•••567` to `******4567` (consistent with Settings / Deals / Contracts).
- Pages using `<ResponsiveDialog>` must import from `@repo/ui/components/mobile/ResponsiveDialog` (not `@repo/ui/components/ResponsiveDialog`).
- Any new route segment should drop in `loading.tsx` / `error.tsx` / `not-found.tsx` wrappers using the shared `_components/Route*` primitives.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.0.0...v4.1.0

---

## [4.0.0] — 2026-04-17 — Design System v2 + Access Model Hardening

**Branch:** `feat/audit-2026-04-mega` (mega-PR, 20 commits).

### Design System v2 (CLAUDE.md § 6 — single source of truth)

- **Foundations:** `DirectionalIcon` wrapper for RTL-aware chevrons/arrows; `ThemeProvider` now respects system preference (`enableSystem=true`); Prisma `UserRole` enum extended with `LEASING` and `FINANCE`; TanStack Table v8 + `@axe-core/react` installed.
- **Primitives:** Saudi input family (`NationalIdInput`, `CRInput`, `SaudiPhoneInput`, `SARAmountInput`, `HijriDatePicker`, `AddressPicker`), harmonized 8-field `KPICard`, `DateRangePicker`, `LastUpdatedAgo`, `EmptyState`.
- **Route-segment hygiene:** every `/dashboard/**` route now has `loading.tsx`, `error.tsx`, and `not-found.tsx`; `global-error.tsx` added.
- **RTL correctness:** logical-CSS sweep across 15 files; `DirectionalIcon` retrofit across 25 call-sites.
- **Role-based dashboards:** `/dashboard/leasing`, `/dashboard/finance`, `/dashboard/maintenance` built; `/dashboard` and `/dashboard/admin` upgraded with `DateRangePicker` + `LastUpdatedAgo`; real trend server actions replace hardcoded sparklines.
- **Tables:** TanStack Table v8 rewrite of `packages/ui/DataTable` (multi-sort, column filter, visibility, density toggle, URL-synced state, bulk actions, mobile cards, a11y caption). Migrated: admin tickets, **CRM List view**.
- **Saudi primitives wired** into CRM/org/contract/payment/admin forms.
- **Cmd-K palette:** global `⌘K`/`Ctrl+K` opens command palette with routes + top-5 create actions (platform users see routes only — no tenant create actions).
- **Accessibility:** `@axe-core/react` in dev mode, skip-to-content link, ARIA labels on icon-only buttons, `:focus-visible` rings on `--ring`.
- **CI guards:** cspell, axe-playwright × 5 dashboards × 2 themes, lhci warn-only baseline.

### Access Model — Tenant vs System (CLAUDE.md § 8)

Layer 1 (nav filter), Layer 2 (route guard), and Layer 3 (server-action audience gate) now all enforce the rule that **platform users (`SYSTEM_ADMIN` / `SYSTEM_SUPPORT`) MUST NOT reach tenant surfaces or data**, and vice versa.

- **Layer 1 fix:** Cmd-K quick actions (new customer / deal / contract / payment / ticket) now hidden for platform users — previously leaked through permission-only filter.
- **Layer 2 fix:** `DashboardClientLayout` redirects platform users from any tenant route (`/dashboard/crm`, `/dashboard/units`, `/dashboard/deals`, …) to `/dashboard/admin`. Symmetric to the existing admin-side guard.
- **Layer 3 fix:** `requirePermission` now rejects the wrong audience based on permission taxonomy — `TENANT_SCOPED_PERMISSIONS` and `SYSTEM_ONLY_PERMISSIONS` lists in `lib/permissions.ts` drive the gate. All 31 tenant action files inherit the fix with zero call-site changes.
- **Docs:** CLAUDE.md §§ 8 (access model) and 9 (test credentials) added as authoritative references.

### Housekeeping

- Dead `/dashboard/properties` route deleted (permanent 308 redirect since v3.0 IA shift) + 10 stale references cleaned up.
- `/dashboard/help` raw tables reviewed — 4 tables deferred with inline rationale (short-lived audit lists + inline review forms don't benefit from TanStack).
- 18 unused files + 3 unused deps removed.

### Deferred (follow-up PRs)

- react-hook-form + zod form adoption.
- DB-backed TanStack saved views (URL-synced state ships this PR).
- Full Balady district cascade (regions+cities now, districts follow-up).
- Prisma `User.organizationId` nullable — system users currently seeded with `organizationId` = mimaric test org because schema forbids null; CLAUDE.md § 8.1 requires null. Schema migration + seed fix tracked separately.
- WAFI escrow / ZATCA invoice KPIs (underlying data not ready).

---

## [3.2.0] — 2026-04-16

### Unified Property Linking in Add Customer Modal

**UX fixes to "Add Customer" modal:**

- **Title fix:** Modal heading changed from "إضافة عميل / عقار جديد" to "إضافة عميل جديد" / "Add New Customer" — no more misleading property reference
- **Button fix:** Header button changed from "إضافة عميل / عقار" to "إضافة عميل" / "Add Customer"
- **Removed:** Vague "نوع العقار المطلوب" (Property Type) text dropdown (APARTMENT/VILLA/etc.) — replaced with real unit linking

**New: Inline Property Linking with Budget Comparison**

- Replaced the vague property type dropdown with a live unit search — same UX as the drawer's "ربط عقار" section
- Search by unit number, city, type, or building name; shows up to 8 matching AVAILABLE/RESERVED units
- After selecting a unit: BUY / RENT intent buttons appear
- Selected unit shown as a pill with intent badge and a clear (×) button
- **Budget comparison badges** appear on each unit row when a budget is entered:
  - Red "فوق الميزانية / Over Budget" — unit price > 105% of budget
  - Green "ضمن الميزانية / On Budget" — unit price within ±10% of budget
  - Blue "أقل من الميزانية / Under Budget" — unit price < 90% of budget
- BUY intent uses `markupPrice`; RENT intent uses `rentalPrice` for comparison
- Linking is fully optional — omitting it creates the customer with no interest record
- On successful create with a unit selected: `addCustomerInterest()` is called automatically → interest appears immediately in the customer drawer's "Interested Properties" section

---

## [3.1.0] — 2026-04-16

### Mimaric v3.1 — Full Prospect-to-Close Cycle

**Strategy:** Link CRM → Properties → Deals → Contracts with automatic status propagation. An agent can now take a lead from "New" to "Converted/Tenant" without manually updating any status.

#### New Feature: CustomerPropertyInterest

- New `CustomerPropertyInterest` model linking Customer ↔ Unit with `PropertyIntent` (BUY/RENT) and `InterestStatus` (ACTIVE/CONVERTED/DROPPED)
- 5 new server actions in `customer-interests.ts`: `addCustomerInterest`, `dropCustomerInterest`, `convertInterestToDeal`, `getCustomerInterests`, `getCustomerInterestsForUnit`
- Guard: unit must be AVAILABLE or RESERVED to link; upsert reactivates DROPPED interests

#### CRM Drawer Enhancements

- **Edit Profile modal**: Edit name (EN + AR), phone, email, source, agent, budget, property type interest — with phone/email encryption preserved
- **Interested Properties section**: Link specific properties to a customer with BUY/RENT intent; status badges (ACTIVE/CONVERTED/DROPPED); "Convert to Deal" and "Drop" actions per interest row
- **Linked Deals & Contracts section**: Shows active reservations and signed contracts directly in the drawer
- **Mark as Lost button**: Added to drawer for customers in RESERVED/CONFIRMED status (not reachable via Kanban drag) — triggers the LOST reason modal and cascades cancellations

#### Properties Drawer Enhancement

- **Interested Customers section**: Lists all customers with ACTIVE interest in a unit, with intent badge (BUY/RENT), agent name, and "View Profile" link to CRM

#### Deals Page: URL Pre-fill

- `?unitId`, `?intent`, `?amount` query params pre-fill the reservation form when navigating from an interest record via "Convert to Deal"

#### Contracts Page: ?dealId Pre-fill

- `?dealId` URL param fetches the linked reservation and pre-fills customer + unit in the new contract modal

#### Status Cascade Fixes

- **Bug fix:** Cancelling/expiring a reservation now reverts customer status → QUALIFIED (was staying RESERVED)
- **Bug fix:** Marking customer LOST now cancels all active reservations → Units revert to AVAILABLE, interests set to DROPPED
- **Bug fix:** DRAFT contracts can now transition directly to SIGNED (DRAFT → SIGNED added to state machine)

#### Customer Edit Bug Fix

- **Bug fix:** After editing a customer profile, the drawer no longer shows encrypted phone ciphertext. Non-PII fields only are merged from server response; PII fields retain the decrypted value from drawer state.

#### Other Fixes

- Role name fix in `create-notification.ts`: COMPANY_ADMIN → ADMIN
- Prisma Decimal serialization fix: `JSON.parse(JSON.stringify())` applied to remaining customer action returns

---

## [3.0.1] — 2026-04-16

### CRM SOP Compliance — 7 Gap Fixes + Serialization Fix

**CRM Pipeline Enhancements:**
- Added CONTACTED and NEGOTIATION stages to the 5-stage pipeline (NEW → CONTACTED → QUALIFIED → VIEWING → NEGOTIATION)
- LOST lead flow: dragging a card to LOST now triggers a required reason selection modal (BUDGET, NO_RESPONSE, COMPETITOR, NO_MATCH, OTHER) before status update
- LOST toggle: separate view for LOST leads via toggle button — keeps active pipeline clean
- Agent assignment: Add Lead form now includes an Agent dropdown populated from team members (ADMIN/MANAGER/AGENT roles)
- Budget & property interest: Add Lead form captures SAR budget and property type preference
- Client preferences section in customer drawer: shows budget, property type, assigned agent, and LOST reason (in red) when applicable
- "Convert to Deal" button in customer drawer: navigates to `/dashboard/deals?customerId=...` for seamless pipeline handoff

**Bug Fix:**
- Fixed Prisma `Decimal` serialization error: `getCustomers()` now wraps results in `JSON.parse(JSON.stringify())` to prevent "Only plain objects can be passed to Client Components" error when `budget` field is present

---

## [3.0.0] — 2026-04-16

### Mimaric v3.0 — Universal Real Estate Operating Core

**Strategy:** Refactor, NOT rebuild. Mimaric pivots from a niche Saudi developer tool to a Universal Real Estate OS serving brokerages, property managers, and developers.

#### What Changed

**New Modules (moved/renamed from buried routes):**
- CRM (`/dashboard/crm`) — full Kanban pipeline with 5 stages, activity timeline, PII toggle, lead management
- Properties (`/dashboard/properties`) — standalone unit portfolio, decoupled from Projects/Buildings
- Deals (`/dashboard/deals`) — reservation pipeline renamed for clarity, linked to CRM + Properties
- Contracts (`/dashboard/contracts`) — merged Sale + Lease contracts in a single tabbed view
- Payments (`/dashboard/payments`) — unified installment tracker (sale + lease), 3 KPI banners
- Dashboard — redesigned with 6 v3.0 KPI cards and 3 activity widgets (Recent Deals, Payment Deadlines, Maintenance Status)

**Architecture Changes:**
- Unit model decoupled: `Unit → Organization` (direct FK) — no longer requires Project/Building hierarchy
- Added `CustomerActivity` model for CRM activity timeline (CALL, EMAIL, MEETING, SITE_VISIT, NOTE, WHATSAPP)
- `CustomerActivityTimeline` client component with log form, delete, RTL-safe layout
- 301 redirects: `/dashboard/units` → `/properties`, `/sales/*` → `/deals`, `/rentals/*` → `/contracts`, `/finance/*` → `/payments`
- Onboarding simplified to 3 steps: Company Info → Add First Property → Done

**Removed (permanently):**
- GIS Platform (8 pages, 6 action files, 5 map components, maplibre-gl/leaflet/turf npm deps)
- Planning OS (full Planning Workspace + Subdivision system)
- Land Acquisition module
- Project Management (14-stage developer lifecycle)
- Wafi / Off-Plan Compliance module (escrow, construction milestones, WafiContract)
- Collections module
- Finance section (collapsed into Payments)

**Permissions & Roles:**
- UserRole reduced from 21 → 7: SYSTEM_ADMIN, SYSTEM_SUPPORT, ADMIN, MANAGER, AGENT, TECHNICIAN, USER
- Permissions reduced from ~162 → ~50, scoped to v3.0 modules
- RBAC matrix updated for all 7 roles

**Scale:**
- Page routes: 60+ → ~22 (-38)
- Server action files: 77 → 39 (-38 deleted, 11 updated)
- Prisma models: ~100 → ~65 (-35)
- npm bundle: ~3MB smaller (maplibre-gl + leaflet + turf removed)

## [2.1.0] — 2026-03-19

### GIS Platform — Full Spatial Intelligence (Phases 1-3)

**Phase 1 — Foundation & Interactive Map**
- MapLibre GL JS map engine (GPU-accelerated, vector tiles, Saudi imagery ready)
- GIS Hub (/dashboard/gis) with project selector, layer panel, feature click
- Sales Map (/dashboard/gis/sales) with plot status coloring and filter pills
- GIS Overview (/dashboard/gis/overview) with KPI dashboard, mini-map, charts
- 6 reusable map components: MapView, Controls, Popup, Legend, LayerPanel, Store

**Phase 2 — Planning Intelligence**
- Land Bank Map (/dashboard/gis/land-bank) with acquisition pipeline and scorecards
- Phase Readiness (/dashboard/gis/phases) with checklist management and readiness scoring

**Phase 3 — Delivery & Operations**
- Construction Progress (/dashboard/gis/construction) with package CRUD and progress tracking
- Handover & Defects (/dashboard/gis/handover) with inspection records and defect management
- Operational Asset Registry (/dashboard/gis/assets) with asset creation, filtering, export

**Infrastructure**
- 5 new Prisma models: PhaseReadinessRule, ConstructionPackage, HandoverRecord, HandoverDefect, OperationalAsset
- 6 server action files with full multi-tenancy (organizationId filtering)
- 3 new permissions: gis:read, gis:write, gis:export across 5 roles
- Cross-module navigation: "View on Map" buttons in Projects, Land, Sales, Planning, Maintenance
- Deep-link support (?project=id) on all 8 GIS pages
- GIS quick action on main Dashboard
- All pages bilingual (Arabic RTL / English LTR)

## [2.0.1] — 2026-03-19

### UI Accessibility & UX Polish
- Add Documents module to sidebar navigation (was unreachable)
- Add delete buttons: Customers, Land parcels (with cascade), Planning workspaces
- Add export buttons: Rentals, Maintenance, Documents, Help/Tickets, Projects, Finance, Land, Planning
- Add onboarding re-entry from Settings page (?mode=edit with pre-filled data)
- Wire all 14 previously non-functional buttons across the application

### Interaction & Feedback Improvements
- Add loading spinners to all async buttons (finance, billing, reservations, settings, planning, help)
- Add form validation with red borders and bilingual error text (maintenance, settings, help, planning)
- Add skeleton loading states (billing, documents)
- Add error state banners with retry buttons (dashboard, finance, billing, reservations)
- Replace all alert()/confirm() with proper Dialog components and inline error displays
- Add focus-visible ring styling to 15 select elements across 5 pages

### Design System Compliance
- Fix PageIntro heading to use semantic h1 tag (global CSS letter-spacing applies)
- Fix KPICard padding to 8pt grid (p-5 → p-6)
- Fix PageIntro badge and actions spacing to 4pt grid
- Replace decorative colors with semantic palette (units, customers, projects, billing)
- Landing Hero/Pricing CTAs now use Button component for proper 4-state support
- Remove redundant inline letterSpacing overrides from auth pages

### Decision Gates Fix
- Add missing standard lifecycle transitions: PLANNING→UNDER_CONSTRUCTION→READY→HANDED_OVER
- Change VALID_TRANSITIONS from single-string to arrays for multi-path support

### Error Messages Overhaul
- Update 283+ error messages across 55 server action files to be user-friendly
- All errors now explain what went wrong and what the user should do next
- Make 7 UI pages show bilingual error messages
- Remove all technical/developer-facing error text from user-visible surfaces

### Documentation
- Capture fresh screenshots for all 18 module pages
- Update Business Documentation, Technical White Paper, and 17 User Guides for v2.0
- Replace embedded screenshots in all DOCX files

---

## [2.0.0] — 2026-03-18

### Premium UI/UX Redesign

Complete redesign as a premium bilingual proptech SaaS platform with production-ready design system.

#### Design System
- Warm charcoal purple palette (hue 260-270) with purple brand accent (`270 55% 62%`)
- IBM Plex Sans Arabic + DM Sans typography with pro header tracking (-3%, 115% line-height)
- Dark-mode-first: layered surfaces, minimal shadows, depth via surface lightness
- Glass morphism hero cards with `backdrop-blur` and subtle white borders
- Consistent 4pt/8pt spacing grid, restrained micro-interactions

#### New UI Components
- `PageIntro` — Glass hero card for major pages
- `KPICard` — Metric card with label, value, subtitle, icon, accent border, trend, loading state
- `FilterBar` — Unified filter toolbar with status tabs and search
- `StatusBadge` — Entity-aware badges (unit, contract, lease, maintenance, customer)
- `FormSection` — Grouped form card with title and description
- `DataTable` — Sortable, filterable data table with pagination

#### Icon Migration
- 100% migration from `@phosphor-icons/react` to `lucide-react` across 90+ files
- Standardized `className="h-N w-N"` sizing pattern, zero Phosphor imports remaining

#### Landing Page
- All 11 components updated to purple brand accent (was green/teal)
- Fresh authenticated dashboard screenshots for Features and Hero sections
- Purple CTAs, trust badges, pricing toggle, Vision 2030 badges

#### Dashboard Pages
- All major pages upgraded with PageIntro glass cards, KPI rows with bilingual subtitles
- Units page: complete redesign with consolidated toolbar, cards/table toggle, status filter pills
- Sales page: KPI cards, module navigation with record counts
- Finance: action buttons, escrow/collection cards, revenue breakdown
- Settings: FormSection cards, TypeScript strict mode fixes
- 20+ pages polished with consistent patterns

#### Button System
- 7 variants with 4 states (default, hover, active/pressed, disabled)
- `active:scale-[0.97]` press feedback, `transition-colors` for performance

#### Token Cleanup
- `text-neutral` → `text-muted-foreground`, `shadow-elevation-*` → `shadow-sm/md/lg`
- Removed `font-primary`, replaced `text-accent` → `text-amber-500`

#### Stats
- 98 files changed, 6,049 insertions, 5,000 deletions
- Build: 0 errors, ~20-35s

---

## [1.3.0] — 2026-03-18

### Added — Saudi RED FRD Gap Closure (Sprint 0–1)

- **6 new RED roles** — APPROVALS_MANAGER, ESCROW_CONTROLLER, COLLECTIONS_OFFICER, HANDOVER_OFFICER, QA_INSPECTOR, VENDOR_CONTRACTOR with scoped permission sets
- **15 new permissions** — `projects:approve`, `inventory:import`, `inventory:release`, `collections:read/write/assign`, `handover:read/write/approve`, `price_approval:read/write/approve`
- **Project governance workflow** — Full approval state machine (DRAFT → PENDING → APPROVED → ACTIVATED) with project code generation (PRJ-{CITY}-{YEAR}-{SEQ}), owner assignment, and readiness flags
- **Readiness validation** — Launch/handover readiness checks: pending approvals, infrastructure, escrow (off-plan), released inventory, buildings with units
- **Project tree view** — Collapsible hierarchy: Project → Phases → Buildings → Units with status badges and unit counts
- **Enhanced audit logging** — `changeSnapshot` (before/after JSON) and `fieldChanges` (auto-computed diff array) on AuditLog model
- **Paginated query helper** — Generic `paginatedQuery()` server action wrapping Prisma findMany + count
- **Pagination controls component** — Page nav with ellipsis, page size selector (10/25/50/100), bilingual labels
- **Unsaved changes guard** — Browser beforeunload + popstate interception with bilingual AlertDialog
- **Auto-save indicator** — 2-second debounced save for DRAFT records with Saving/Saved/Error status
- **Audit trail tab component** — Per-record timeline with field-level diffs, expandable change details

### Added — Approval SLA & Blocking (Sprint 2 partial)

- **Approval follow-up tasks** — ApprovalFollowUp model with task assignment, due dates, status tracking (OPEN → IN_PROGRESS → COMPLETED)
- **Blocking approvals** — `isBlocking` flag + `blockingModule` field on ApprovalSubmission to gate sales/launch/infrastructure
- **SLA tracking** — `expectedResponseDate` on submissions, computed `daysOpen` in detail view

### Added — Inventory & Pricing Enhancements (Sprint 2 partial)

- **Release status** — `ReleaseStatus` enum (NOT_RELEASED, RELEASED, HOLD) on InventoryItem with hold reason/date
- **Minimum sell price** — Floor price enforcement on inventory items
- **Price list versioning** — PriceListVersion model with snapshot, approval workflow (DRAFT → APPROVED → SUPERSEDED)
- **Price change requests** — PriceChangeRequest model with variance calculation, auto-escalation threshold, approval/rejection workflow
- **Bulk inventory import** — CSV import wizard page at `/projects/[id]/inventory/import`

### Added — Sales & Contracting Enhancements (Sprint 3 partial)

- **Payment plans** — PaymentPlan + PaymentPlanInstallment models with down payment, partial payment support, status tracking
- **Reservation guards** — Race condition protection via `$transaction`, duplicate reservation check, release status validation
- **Reservation extensions** — ReservationExtension model with approval workflow and extension count limits
- **Contract templates** — ContractTemplate model with version history and HTML variable interpolation
- **Dual signature tracking** — `buyerSignedAt`, `developerSignedAt`, signature URL fields on Contract
- **Contract financial fields** — `grossAmount`, `discountAmount`, `netAmount` with auto-calculation

### Added — Collections Module (Sprint 4 partial)

- **Collection cases** — CollectionCase model with aging buckets, status workflow (CURRENT → FOLLOW_UP → PROMISE_TO_PAY → ESCALATED → LEGAL → SETTLED)
- **Collection activities** — CollectionActivity model for call/email/SMS/visit/note logging
- **Aging report** — Receivables bucketed by 1-30, 31-60, 61-90, 90+ days
- **Per-contract financial statement** — Ledger view with debit/credit/running balance
- **Collections UI** — `/finance/collections` with aging bucket tabs, status filters, KPI cards, empty state; `/finance/collections/[id]` with activity timeline

### Added — Navigation & UI Wiring

- **Finance page** — Quick-nav cards for Escrow and Collections modules
- **Project detail** — Governance and Project Tree buttons in action bar
- **Inventory tab** — Import CSV button linking to bulk import wizard
- **Pricing tab** — Price Versions and Price Change Requests buttons
- **Contract detail** — Payment Plan button (visible when contract is SIGNED)
- **Breadcrumb labels** — governance, tree, collections, import, change-requests, versions, payment-plan, templates, statement, preview
- **Role display labels** — Arabic/English labels for all 6 new RED roles in sidebar profile

### Changed — Schema

- **UnitStatus** — Added SUSPENDED, WITHDRAWN, HANDED_OVER values
- **UserRole** — Added 6 RED roles to enum
- **AuditLog** — Added `changeSnapshot` (Json?) and `fieldChanges` (Json?) columns
- **Unit** — Added `balconyAreaSqm` (Float?) and `parkingCount` (Int?)
- **Project** — Added `projectCode` (unique), `developerEntityId`, `internalOwnerId`, `financeOwnerId`, `approvalStatus`, `activatedAt`, `plannedLaunchDate`, `plannedCompletionDate`
- **Phase** — Added `phaseCode`, `salesEnabled`, `approvalDependencyId`
- **Building** — Added `towerName`, `blockCode`
- **9 new models** — ApprovalFollowUp, PriceListVersion, PriceChangeRequest, PaymentPlan, PaymentPlanInstallment, ReservationExtension, ContractTemplate, CollectionCase, CollectionActivity

## [1.2.0] — 2026-03-14

### Added — Saudi Ejar Contract Compliance

- **Ejar-compliant lease contracts** — Create lease contracts with mandatory Ejar fields: start/end dates, payment frequency (monthly/quarterly/semi-annual/annual), security deposit (capped at 5% per regulation), auto-renewal toggle, maintenance responsibility (landlord/tenant), and 60-day default notice period
- **Auto-generated installment schedules** — Lease contracts automatically create a linked `Lease` record with installment schedule based on selected payment frequency
- **Contract-lease linking** — Contracts with `type: LEASE` auto-create a linked lease with `leaseId` FK, bidirectional navigation between contract and lease

### Added — Saudi Wafi Off-Plan Sale Compliance

- **Wafi-compliant sale contracts** — Create sale contracts with Wafi fields: expected delivery date, Wafi license reference, and escrow account reference
- **Auto-escrow deposits** — Signing a sale contract auto-deposits the contract amount into the project's escrow account (`BUYER_DEPOSIT` transaction)
- **Auto-escrow reversals** — Voiding a signed contract auto-records a `REVERSAL` transaction in the escrow account

### Added — Contract Lifecycle State Machine

- **Contract status transitions** — Full state machine: `DRAFT → SENT → SIGNED`, with `CANCELLED` from DRAFT/SENT and `VOID` from SIGNED
- **Auto-generated contract numbers** — Unique numbers per type: `SALE-2026-XXXX` and `LEASE-2026-XXXX` with random 4-char suffix
- **Lifecycle side-effects on signing** — Sale contracts: unit → SOLD, customer → CONVERTED. Lease contracts: unit → RENTED, customer → ACTIVE_TENANT, lease → ACTIVE
- **Lifecycle side-effects on cancel/void** — Unit → AVAILABLE, lease → TERMINATED (if linked), escrow reversal (if signed sale)
- **Delete contract** — Hard-delete for DRAFT contracts only, cascades to linked lease and installments

### Added — Contract Detail Page

- **Bilingual party labels** — المؤجر/المستأجر (Landlord/Tenant) for leases, البائع/المشتري (Seller/Buyer) for sales
- **Lease Terms section** — Displays period, payment frequency, security deposit, auto-renewal, maintenance responsibility, and notice period
- **Sale Terms section** — Displays delivery date, Wafi license reference, and escrow account reference
- **Payment Schedule table** — Installment-by-installment view with number, due date, amount, and status (paid/unpaid/overdue)
- **Notes section** with contract notes display
- **Sidebar contract info card** — Contract number, value, Ejar ID placeholder, Wafi/escrow references

### Added — Contracts List Page with Create Modal

- **Full contracts table** — Customer (name + phone), unit (number + building), contract type badge (بيع/إيجار), amount in SAR, Hijri + Gregorian dates, status badge
- **Status filter tabs** — All, Draft, Sent, Signed, Cancelled with counts
- **Create contract modal** — Dynamic form switching between Sale and Lease types, Ejar/Wafi field groups, customer/unit selectors
- **Empty state** with CTA to create first contract

### Added — Contract RBAC Permissions

- **Progressive vs destructive permission split** — `contracts:write` for create/send/sign (Company Admin, Sales Manager, Sales Agent), `contracts:delete` for cancel/void/delete (Company Admin only)
- **SALES_AGENT** granted `contracts:write` — Agents can draft contracts for their leads
- **SALES_MANAGER** granted `leases:read` + `leases:write` — Handle both sale and lease workflows
- **PROPERTY_MANAGER** granted `contracts:read` — Visibility into lease contracts for property management
- **TENANT** granted `contracts:read` — Ejar regulation requires tenant transparency into their own contracts

### Added — Unit-Contract Bridge

- **`getActiveContractForUnit()` server action** — Finds the active contract (DRAFT/SENT/SIGNED) linked to any unit
- **Linked Contract section in unit detail panel** — Shows contract type badge, status badge, customer name, contract number, and "View Contract" navigation button
- **Financial summary in unit detail** — Rent collected, sale revenue, maintenance costs, and net income per unit

### Added — Reservation-to-Contract Flow Enhancement

- **Inventory-source reservations** — New reservation wizard supports "From Inventory" source for off-plan items alongside "From Units"
- **4-step reservation wizard** — Source selection → customer/unit → payment details → confirmation

### Added — Help Center Content Expansion (v1.2.0)

- **14 new FAQ items** — Ejar compliance (1), Wafi compliance (1), contract lifecycle (1), Ejar lease creation (1), Wafi sale creation (1), contract RBAC (1), unit-contract linking (1), lease detail page (1), sale detail page (1), unit financial summary (1), escrow accounts (1), contract permissions RBAC (1), installment tracking update (1), unit status tracking update (1)
- **4 new step-by-step guides** — Create Ejar Lease Contract (8 steps), Create Wafi Sale Contract (8 steps), Manage Contract Lifecycle (7 steps), updated Track Sales Contracts
- **Updated 4 existing items** — Unit management guide, lease creation guide, contracts FAQ, installments FAQ
- Total: 58 FAQs (was 44) and 25 guides (was 21) — comprehensive coverage of all contract workflows

### Fixed

- **Hydration error** — `<Badge>` (renders `<div>`) was nested inside `<p>` tags in unit detail panel, changed to `<div>` wrapper
- **Prisma client stale after schema push** — `npx prisma generate` required after adding Contract–Lease relation fields

### Schema Changes

- Added `contractNumber` (String, unique) to `Contract` model
- Added `leaseId` (String, optional FK) to `Contract` model with 1:1 relation to `Lease`
- Added `paymentFrequency` (PaymentFrequency enum), `securityDeposit` (Decimal), `autoRenewal` (Boolean), `maintenanceResponsibility` (MaintenanceResponsibility enum), `noticePeriodDays` (Int), `deliveryDate` (DateTime), `wafiLicenseRef` (String), `escrowRef` (String), `notes` (String) to `Contract`
- Added `PaymentFrequency` enum: `MONTHLY`, `QUARTERLY`, `SEMI_ANNUAL`, `ANNUAL`
- Added `MaintenanceResponsibility` enum: `LANDLORD`, `TENANT`

---

## [1.1.0] — 2026-03-14

### Added — Planning-to-Execution Lifecycle Bridge

- **Project Lifecycle Stepper** — Visual 14-stage stepper spanning 5 phase groups (Land → Design → Authority → Off-Plan → Execution) with bilingual labels and color-coded progress
- **"Promote to Project" button** — Planning workspaces with approved baseline scenarios can convert directly into active projects
- **"Generate from Plan" button** — Auto-create buildings and units from approved subdivision plots via `generateBuildingsFromPlots()`
- **"Convert Sold to Units" button** — Transform sold off-plan inventory items into delivered Unit records with contracts via `convertInventoryToUnits()`
- **Linked Workspace Detection** — Land and project detail pages detect existing planning workspaces and show "Continue Planning" / "View Planning" instead of duplicating

### Added — Project Financials (P&L)

- **Financials tab** on project detail — Total Costs, Total Revenue, Net P&L summary cards
- **Cost breakdown** — Land acquisition cost, development/infrastructure costs, maintenance costs
- **Revenue breakdown** — Sale revenue from signed contracts, rental income, off-plan sold inventory value
- **`getProjectFinancials()` server action** — Aggregates financial data across land, infrastructure, contracts, installments, maintenance, and inventory

### Added — Decision Gate & Compliance Enforcement

- **Compliance gate for scenario approval** — Blocks approval if any `ComplianceResult` has `result: "FAIL"` with descriptive error
- **Decision gate routing** — Project status transitions now route through `requestStageTransition()` instead of direct updates
- **Post-handover maintenance setup** — On transition to `HANDED_OVER`, auto-creates 5 default preventive maintenance plans (HVAC, Plumbing, Electrical, Fire Safety, General) for every unit

### Added — Landing Page

- **11-section bilingual marketing page** — Header, Hero, LogoBar, Features, Vision 2030, HowItWorks, Stats, Pricing, FAQ, FinalCTA, Footer
- **Glass morphism hero** with animated trust badges (Vision 2030, Balady, ZATCA, Wafi), mesh gradient background, and architectural SVG pattern
- **Tabbed feature showcase** — 5 tabs (Projects, Sales, Rentals, Maintenance, Finance) with checklists and screenshots
- **3-tier pricing display** — Starter (free), Professional (SAR 499/mo), Enterprise (SAR 1,499/mo) with annual toggle
- **100+ bilingual translation keys** covering all landing page content

### Added — Glass Morphism Design System

- **CSS custom properties** — Glass backgrounds, borders, blur levels (light/standard/heavy) with dark mode overrides
- **Gradient mesh** (`mesh-bg`) with radial gradients for hero/dark sections
- **Glass utilities** (`.glass`, `.glass-heavy`) with backdrop-filter blur, borders, and shadows
- **Elevation system** (`--elevation-1/2/3`) replacing flat shadows
- **Glow effects** (`--glow-green`, `--glow-gold`) for accent highlights
- **New animations** — `float`, `pulse-glow`, `gradient-shift`, `mesh-drift`
- **Shadow utilities** added to Tailwind config — `glass`, `glass-hover`, `elevation-1/2/3`, `glow-green`, `glow-gold`

### Added — Auth Page Redesign

- Brand panel uses `mesh-bg` gradient with architectural SVG pattern overlay
- Floating gradient mesh blobs with animation
- Form cards use glass styling (`rounded-2xl border bg-card/80 backdrop-blur-sm`)
- ThemeToggle added to login and register pages
- Error messages styled with `bg-destructive/5`

### Added — New Server Actions

- `inventory-handoff.ts` — `convertInventoryToUnits()` for off-plan to delivery conversion
- `plot-conversion.ts` — `generateBuildingsFromPlots()` for subdivision-to-building generation
- `post-handover.ts` — `setupPostHandoverMaintenance()` for auto-creating preventive plans
- `finance.ts` — `getProjectFinancials()` for project-level P&L aggregation
- `projects.ts` — `uploadDocumentVersion()` for document version management
- `planning-workspaces.ts` — `getLinkedWorkspaces()` for workspace detection
- `contracts.ts` — Auto-post to escrow on sale contract signing

### Added — E2E Testing

- **Planning Page Object Model** — Methods for workspace list, detail, map, scenarios, compliance, and feasibility tabs
- **16 Playwright test cases** — 7 workspace list tests + 9 workspace detail tests
- **E2E seed script** (`scripts/e2e-seed.ts`) — Full 17-phase lifecycle simulation with land, planning, subdivision, buildings, units, CRM, contracts, leases, construction, handover, and maintenance

### Added — Document Management Enhancements

- Category filter dropdown with funnel icon
- Version column with expandable version history
- Upload new version inline per document row
- 4 new document categories: GIS, CAD, Planning, Permit

### Changed — UI Improvements

- **Dashboard layout** — Sidebar gradient background, active nav inset glow, glass topbar
- **KPI Cards** — Backdrop blur, semi-transparent background, hover lift effect
- **All 5 chart components** — Colors aligned to HSL design tokens, glass-styled tooltips, reduced grid opacity
- **Dialog component** — Fixed positioning with `translate: "-50% -50%"` style attribute
- **MimaricLogo** — Added `width: auto, height: auto` to prevent layout shift
- **Dashboard spacing** — Increased from `space-y-8` to `space-y-10`

### Fixed

- Leaflet map double-mount in React strict mode (check `_leaflet_id`, cleanup old instance)
- `createLandParcel()` passing empty strings instead of `undefined` for optional fields
- Map z-index stacking with `isolate` class on container

### Schema Changes

- Added `GIS`, `CAD`, `PLANNING`, `PERMIT` to `DocCategory` enum

### Seed Data

- 3 SaaS plans with 11 entitlements each (Starter/Professional/Enterprise)
- Active subscriptions for main and dummy organizations

---

## [1.0.0] — 2026-03-10

### Added — SaaS Commercialization Layer

- **Subscription plans** — 3-tier system (Lite/Professional/Enterprise) with monthly and annual billing, entitlement-based feature gating, and free trial support
- **Coupon system** — Percentage and fixed-amount discount codes with max redemptions, expiry dates, and real-time validation on the plans page
- **Invoice management** — Auto-generated invoices with subtotal, 15% VAT calculation, status tracking (Draft → Issued → Paid → Overdue), and download capability
- **Payment tracking** — Payment method storage, grace period handling for past-due subscriptions, and billing cycle management (monthly/quarterly/semi-annual/annual)
- **Platform admin panel** — 4-section admin hub: Plans Management, Subscriptions monitoring, Coupons CRUD, and Invoices & Payments overview with revenue totals
- **Billing permissions** — `billing:read`, `billing:write`, `billing:admin` permissions with role-based access control

### Added — Wafi Compliance & Escrow

- **Wafi project page** — Off-plan compliance tracking with license management, milestone certification by engineering consultants, and escrow fund monitoring
- **Escrow accounts** — Fund tracking for off-plan sales with deposit/withdrawal logging and balance monitoring
- **Engineering Consultant role** — New `ENGINEERING_CONSULTANT` role for independent milestone certification per Wafi requirements
- **System Support role** — New `SYSTEM_SUPPORT` role for platform operations and ticket management

### Added — Centralized Language System

- `LanguageProvider` context with localStorage persistence and hydration-safe initialization
- Removed ~25 per-page duplicate language toggles — single unified toggle in the topbar
- Fixed hydration mismatch (`dir="rtl"` server vs `dir="ltr"` client) by deferring localStorage read to useEffect

### Added — Dark Mode Polish

- Button CSS overrides for Tailwind v4 monorepo (`.dark .btn-primary` / `.dark .btn-secondary`) — green primary, muted secondary in dark mode
- Chart dark mode colors via shared `useChartTheme` hook across all 4 dashboard charts
- Popover/dropdown solid backgrounds in dark mode (eliminates transparency/readability issues)

### Added — User Profile Popover

- Functional profile menu in the topbar showing user name, role, organization, and email
- Quick-link navigation to Settings, Security, and Help
- Sign Out action accessible from profile popover
- Removed duplicate user info section from sidebar bottom
- Profile button visible on all screen sizes (mobile + desktop)

### Added — Help Center Content Expansion

- **12 new FAQs**: Land Management (2), Document Vault (1), Billing & Subscription (3), Rental Payments (1), Sales Contracts (1), Site Logs (1), Onboarding (2), Platform Administration (1)
- **7 new step-by-step guides**: Add & Manage Land Parcels, Upload & Manage Documents, Track Sales Contracts, Record Rental Payments, Manage Subscription & Billing, Add Site Logs, Complete Account Setup
- Total: 38 FAQs (was 26) and 19 guides (was 12) — ~95% platform coverage (was ~65%)
- Corrected role count from 11 to 13 in FAQ, fixed team management button text

### Added — UI Components

- New shared components in `@repo/ui`: Dialog, EmptyState, KPICard, Popover, Select, Skeleton, Tabs, Toast
- Usage guides section redesigned with numbered badges, accordion expand, and chevron rotation

### Schema Changes

- New models: `Subscription`, `SubscriptionPlan`, `PlanEntitlement`, `Invoice`, `InvoiceItem`, `PaymentMethod`, `Coupon`, `CouponRedemption`, `WafiLicense`, `EscrowAccount`, `EscrowTransaction`, `MilestoneVerification`, `EtmamRequest`
- New enums: `SubscriptionStatus`, `BillingCycle`, `InvoiceStatus`, `PlanTier`, `CouponType`
- New roles: `SYSTEM_SUPPORT`, `ENGINEERING_CONSULTANT` added to `UserRole` enum (13 total roles)

### Fixed

- Hydration mismatch from localStorage language read during SSR
- Build error from orphaned `setLang` references after language centralization
- Tailwind v4 `dark:` utility classes not generating CSS in monorepo package source files
- Unit selection indicator changed from bottom-left circle to top-right checkbox style
- Button text unreadable in dark mode (primary and secondary variants)

---

## [0.9.0] — 2026-03-09

### Added — Dark Mode / Light Mode

- Full dark/light theme system using `next-themes` with CSS custom properties
- `ThemeProvider` and `ThemeToggle` (Sun/Moon) components with hydration-safe mounting
- Restructured `globals.css` with `:root` / `.dark` variable layers and `@custom-variant dark`
- Sidebar stays navy in both themes via fixed `--sidebar-bg` / `--sidebar-deep` tokens
- Replaced ~225 hardcoded `bg-white` across 38+ files with theme-aware `bg-card`
- Dark palette: deep navy backgrounds (`216 55% 9%`), muted borders, adjusted accent colors

### Added — Off-Plan Development System (Stages 7–12)

- **14-tab project detail page**: Feasibility, Concept Plans, Constraints, Approvals, Subdivision, Infrastructure, Inventory, Pricing, Launch Waves, Launch Readiness, Map, Sales Tracking, Analytics, Decision Gates
- **Inventory management**: Full CRUD with 9 product types (VILLA, APARTMENT, TOWNHOUSE, LAND_PLOT, COMMERCIAL, DUPLEX, PENTHOUSE, STUDIO, OTHER), status workflow (UNRELEASED → AVAILABLE → RESERVED → SOLD), and bulk operations
- **Pricing engine**: Rules-based pricing with percentage/fixed adjustments, premium/discount modes, rule priority, and active/inactive toggling
- **Launch waves**: Wave planning, launching, and closing with sequential wave numbering
- **Launch readiness checklist**: 6-point validation (subdivision, approvals, infrastructure ≥70%, inventory, pricing, waves)
- **Reservation from inventory**: "From Inventory" flow in existing reservation page with project → wave → item selection cascade
- **4 modal dialogs**: Add Inventory Item, Add Pricing Rule, Create Launch Wave, Subdivision Plan
- **3 analytics charts**: Pricing Distribution (bar), Sales Funnel (funnel), Wave Performance (composed) — all Recharts

### Added — Cross-Module Off-Plan Awareness

- **Units page**: New "مخزون على الخارطة" (Off-Plan Inventory) tab with 5 KPI cards, searchable/filterable inventory table, and project filter
- **Sales page**: "مسار مبيعات على الخارطة" pipeline section with Pipeline Value, Reserved Value, Sold Value, and Conversion Rate
- **Finance page**: "إيرادات على الخارطة" revenue section with 4-column KPI grid and progress bar
- **Reports**: Development Pipeline report enriched with per-project inventory counts and pipeline values; Pricing Analysis report enriched with per-status value breakdown

### Added — Notification Triggers

- `LAUNCH_READINESS_COMPLETE` — all 6 readiness checks pass (30-day dedup)
- `WAVE_LAUNCHED` — wave status changes to LAUNCHED
- `INVENTORY_MILESTONE_25/50/75/100` — inventory conversion milestones (30-day dedup)
- `INVENTORY_LOW` — less than 10% inventory available in a project (30-day dedup)

### Added — E2E Test Suites

- Playwright test suites: access control, analytics, dashboard, launch readiness, off-plan modals, reports, reservations
- Role-based auth setup files for admin, PM, sales, and tech roles
- Page object models for project detail and dashboard pages

### Schema Changes

- New models: `ConceptPlan`, `RegulatoryConstraint`, `ApprovalSubmission`, `SubdivisionPlan`, `InfrastructureReadiness`, `InventoryItem`, `PricingRule`, `LaunchWave`, `DecisionGate`
- New enums: `InventoryStatus`, `ProductType`, `WaveStatus`, `GateStatus`, `GateType`
- Extended `Reservation` with optional `inventoryItemId` relation
- Extended `Notification` with `titleEn` and `messageEn` for bilingual notifications

### New Server Actions (12 files)

- `analytics.ts`, `approvals.ts`, `concept-plans.ts`, `constraints.ts`, `decision-gates.ts`, `feasibility.ts`, `infrastructure.ts`, `inventory.ts`, `launch.ts`, `launch-waves.ts`, `pricing.ts`, `subdivision.ts`

### Fixed

- Subdivision detail page language toggle was non-functional (`[lang]` → `[lang, setLang]`)
- Added bilingual error messages and RTL `dir` attribute to subdivision detail

---

## [0.8.0] — 2026-03-08

### Added — Registration & Organization Management
- **Individual/Company Registration** — Account type toggle (فرد/شركة) wired to backend; company name used as org name, individual gets personal workspace
- **Auto-Login on Registration** — New users are signed in immediately and redirected to onboarding wizard (no manual login required)
- **SUPER_ADMIN Role for Org Creators** — First user in an organization gets full admin permissions instead of USER role
- **Onboarding Wizard** — 4-step post-registration flow: organization path choice, business identity (CR/VAT/entity type), contact & location, team invitations. Every step is skippable.
- **CR-Based Organization Discovery** — Individual users can search for existing organizations by Commercial Registration number. Found → join request with masked org name. Not found → option to register business with that CR.
- **Join Request System** — Users request to join organizations, admins review/approve/decline from Help Center admin panel. On approval, user moves to target org as USER role with JWT refresh.
- **Token-Based Team Invitations** — Email-based invitations with 7-day expiry, secure token links, role assignment. Replaces password-based invite flow.
- **Invitation Acceptance Page** — `/auth/invite/[token]` — shows org name, role, inviter; new user creates account and auto-joins organization.
- **Help Center** — Searchable FAQ (6 categories, bilingual), guides, support ticket system with threaded messages, permission request workflow, admin panel for managing tickets/join requests/permissions.
- **Support Ticket System** — Users create tickets with categories, admins respond with threaded messages, status tracking (open → in progress → resolved → closed).
- **Permission Request System** — Users request role upgrades, admins review and approve/decline with notifications.
- **Notification Helpers** — `createNotification()` and `notifyAdmins()` utilities for system-wide notification delivery.
- **Password Reveal Toggle** — Show/hide password button on login, register, and invitation acceptance pages.
- **Enter Key Login** — Pressing Enter on the login form submits credentials.

### Changed
- **Password Policy** — Minimum length reduced from 15 to 10 characters (NIST-compliant, common password blocklist and contextual checks remain)
- **Registration Page** — Sends `accountType` to backend, auto-redirects on success instead of showing "registered" message
- **Login Page** — Removed `?registered=true` query param handling (replaced by auto-login)
- **Auth Config** — JWT callback now supports `trigger === "update"` with session parameter for real-time token refresh after onboarding/org changes
- **Dashboard Layout** — Sidebar shows organization name (fetched via lightweight `getOrgName()` that requires only authentication, not `organization:read` permission)
- **Permissions** — Added `invitations:read`, `invitations:write` to ALL_PERMISSIONS matrix
- **Seed Data** — All seed users have `onboardingCompleted: true` and `accountType: "company"` to skip onboarding

### Schema Changes
- **User Model** — Added `accountType` (individual/company), `onboardingCompleted` (boolean), `invitedBy`, `invitedVia` fields
- **Invitation Model** — New model with token-based flow, email, role, organization, expiry, status tracking
- **JoinRequest Model** — New model for CR-based org join requests with status machine (PENDING → APPROVED/DECLINED/EXPIRED/CANCELLED)
- **InvitationStatus Enum** — PENDING, ACCEPTED, EXPIRED, REVOKED
- **JoinRequestStatus Enum** — PENDING, APPROVED, DECLINED, EXPIRED, CANCELLED
- **Organization** — Added `invitations` and `joinRequests` relations
- **Help Models** — SupportTicket, SupportTicketMessage, PermissionRequest models with full CRUD

### Fixed
- Stale JWT after onboarding completion causing infinite redirect loop (now uses `useSession().update()` + `window.location.href`)
- SALES_AGENT users crashing on dashboard due to missing `organization:read` permission (sidebar now uses lightweight `getOrgName()`)
- Registration password validation rejecting passwords containing email substrings correctly

---

## [0.7.0] — 2026-03-08

### Changed
- Button component: ghost variant now has visible `bg-muted/40` background; secondary hover upgraded with shadow lift and `-translate-y-0.5`
- Color-coded hover accents on all action buttons (green for Excel/export, red for PDF/delete, amber for PII toggle)
- Dashboard layout: added `min-w-0` and `overflow-x-hidden` to prevent horizontal scroll in RTL views
- Customers page: compact toolbar with `sm` buttons and shortened labels for RTL fit
- Maintenance detail: per-status colored transition buttons with hover lift effects
- Reports page: export buttons with green/red hover accents
- Land page: View button upgraded from ghost to secondary with green hover
- Contracts page: View button upgraded from ghost to secondary with green hover
- Reservations page: Cancel button with red hover accent
- Projects detail: Delete buttons with red hover accent
- Preventive maintenance: Delete button with red hover accent
- README.md rewritten with full business value, expanded module coverage, design system documentation

### Fixed
- LandPipelineChart Arabic labels overlapping bars (foreignObject HTML rendering)
- Customer page horizontal scroll in full-screen RTL view (min-w-0 on main flex item)
- Chart text unreadable due to similar color shades between labels and backgrounds

---

## [0.6.0] — 2026-03-07

### Added — Comprehensive Maintenance Module (CMMS)
- **Full CRUD** — Create, read, update, and delete maintenance requests with modal forms
- **Status Workflow** — Enforced transitions (OPEN → ASSIGNED → IN_PROGRESS → ON_HOLD → RESOLVED → CLOSED) with validation
- **SLA Tracking** — Auto-computed due dates by priority (URGENT: 2h, HIGH: 24h, MEDIUM: 72h, LOW: 168h)
- **10 Maintenance Categories** — HVAC, Plumbing, Electrical, Structural, Fire Safety, Elevator, Cleaning, Landscaping, Pest Control, General (bilingual AR/EN)
- **5 KPI Dashboard Cards** — Open, Assigned, In Progress, Overdue, Completed This Month
- **Filter Toolbar** — Search by title, filter by status/priority/category
- **Detail Page** — Full work order view with status transition buttons, cost tracking, labor hours, assignment management
- **Preventive Maintenance Plans** — CRUD for recurring schedules (Daily to Annual), auto-generate work orders, toggle active/paused
- **Unit-Maintenance Linking** — Unit detail modal shows maintenance requests with status badges
- **Project-Maintenance Linking** — New "الصيانة" tab on project detail page with KPI summary
- **Assignable Users** — Assign to TECHNICIAN/PROPERTY_MANAGER/PROJECT_MANAGER roles

### Added — Land & Project Enhancements
- **Land Map Integration** — Interactive Leaflet map picker on creation, read-only map on detail page
- **Import Acquired Land into Projects** — Auto-fill project form from acquired land parcels
- **Arabic Unit Labels** — Types (شقة, فيلا, مكتب, etc.) and statuses (متاح, محجوز, مباع, etc.)
- **Unit Detail Modal** — Expand unit card to see info + maintenance requests
- **5 Arabic Sample Lands** — Seed data with real Riyadh coordinates

### Schema Changes
- Added `MaintenanceCategory` enum (10 categories), `RecurrenceType` enum (7 types)
- Added `ASSIGNED`, `ON_HOLD` to `MaintenanceStatus`
- Enhanced `MaintenanceRequest` with category, scheduledDate, dueDate, completedAt, costs, laborHours, notes, preventive link
- New `PreventiveMaintenancePlan` model with recurrence scheduling, scope, cost estimation

## [0.5.0] — 2026-03-07

### Added
- Dashboard analytics with LandPipelineChart, ProjectStatusChart, and MaintenanceCostTrendChart (Recharts + foreignObject for Arabic SVG rendering)
- SAR currency formatting component (`SARAmount`) with Hala font and bilingual display
- Reports module with Excel/PDF export, date range filtering, and 5 report types (occupancy, financial, maintenance, lease, customer)
- Hijri/Gregorian dual date display across all modules
- Notification bell with unread count and mark-all-read functionality
- Site construction logs with timestamped entries per project

---

## [0.4.0] — 2026-03-07

### Added — PDPL & NCA Compliance
- **Role-Based Permission System** — Centralized `permissions.ts` with 30+ granular permissions (`customers:read`, `customers:read_pii`, `customers:export`, `audit:read`, etc.) mapped to 8 user roles
- **PII Encryption at Rest** — AES-256-GCM encryption for national IDs, phone numbers, and emails in the Customer model; SHA-256 hash columns for exact-match search on encrypted fields
- **PII Masking UI** — Customer page masks sensitive data by default; authorized users can toggle visibility with Show/Hide PII button
- **Audit Trail** — `AuditLog` model tracking all data access, PII reads, exports, logins, and modifications with user, IP, and timestamp; dedicated audit log viewer at `/dashboard/settings/audit`
- **NIST SP 800-63B Password Policy** — Minimum length enforcement, common password blocklist, contextual checks (no username/email in password), real-time bilingual strength hints
- **Login Rate Limiting** — Progressive throttling: 30s after 5 failures, 5min after 10, 15min after 20
- **Self-Registration** — `/auth/register` page with password policy enforcement and automatic org creation
- **Password Recovery** — `/auth/forgot-password` and `/auth/reset-password` pages with time-limited tokens
- **Change Password** — `/dashboard/settings/security` page for authenticated password changes
- **Password Strength Hint Component** — Reusable bilingual `PasswordStrengthHint` component used across registration, reset, invite, and change password flows
- **User Preferences** — `preferences` JSON field on User model; configurable default landing page via Settings dropdown
- **Landing Page Selector** — Settings page dropdown to choose default post-login destination from 10 allowed pages
- **Navigation Filtering** — Sidebar links filtered by role permissions (e.g., Technicians only see Maintenance and Units)
- **Permission Badges** — Team page shows visual role capability badges (PII Access, Export, Finance)

### Changed
- Default post-login redirect changed from `/dashboard/units` to `/dashboard`
- Login action reads user's preferred landing page from preferences before redirect
- All server actions now use centralized `requirePermission()` instead of manual role checks
- Customer server actions encrypt PII on write, decrypt on read, mask based on caller's permissions
- Organization actions encrypt/decrypt manager national ID
- CI workflow updated with `PII_ENCRYPTION_KEY` env var for build compatibility

### Security
- Server-side PII masking as defense-in-depth (non-PII roles receive pre-masked data)
- Audit logging for all `READ_PII` and `EXPORT` events per PDPL Article 32
- `PasswordResetToken` model with 1-hour expiry and single-use enforcement
- bcrypt cost factor 12 for all password hashing

## [0.3.0] — 2026-03-07

### Added
- **Customers Hub** (`/dashboard/sales/customers`) — Unified Kanban and List views replacing former Leads page
- **Rentals New Lease Modal** — Added "Add New Customer" button and popup to create customers on-the-fly
- **Projects page** (`/dashboard/projects`) — Card grid with progress tracking
- **Sales hub page** (`/dashboard/sales`) — Links to Customers, Reservations, Contracts
- **Rentals hub page** (`/dashboard/rentals`) — Links to New Lease, Rent Collection
- **Finance page** (`/dashboard/finance`) — Revenue KPIs, ZATCA placeholder
- **Maintenance page** (`/dashboard/maintenance`) — Service request table with status badges
- **Reports page** (`/dashboard/reports`) — Downloadable report cards
- All sidebar navigation items now route to working pages (was 404 for 6 routes)

### Fixed
- Stabilized `NextAuth` beta type inference portability issues (TS2742).
- Addressed `useSearchParams` un-suspended bailout issue in reservation creation prerendering phase.
- **Build Error**: Register page syntax error in `backgroundImage` SVG data URL (line 23)
- **Build Error**: Stray markdown ` ```typescript ` tag at top of `register/page.tsx`
- **Build Error**: NextAuth v5 TS inference issue in `auth.ts` suppressed and strictly typed
- **Runtime Error**: Missing `Plus` icon import in Unit Matrix page
- **Runtime Error**: Missing `MimaricLogo` import in Contract page
- **Bug**: Login button was not clickable (no `onClick` handler)
- **Bug**: JSX whitespace `< ShieldCheck>` in Team page
- **Bug**: "Add Customer" inline logic in Sales Kanban columns fixed
- **Branding**: Last 2 "AntiGravity" references in Register terms text → "Mimaric"
- **Branding**: Contract signature "AntiGravity CEO" → "Mimaric CEO"
- **Branding**: "AG" avatar initials in Leads Kanban → "M"
- **UI**: Globally modernized Buttons; pure white text on dark backgrounds, `whitespace-nowrap`, and premium design tokens.

### Changed
- Refactored Prisma Schema: `Lead` model and `LeadStatus` renamed globally to `Customer` and `CustomerStatus`.
- Codebase-wide refactor replacing "Leads" logic with "Customers".
- Login button now redirects to `/dashboard/units` for testing.
- Test credentials enabled in `auth.ts`: `admin@mimaric.sa` / `mimaric2026`.

## [0.2.0] — 2026-03-06

### Added
- Mimaric brand integration (logo, colors, typography)
- MimaricLogo component with dark/light variants
- Dashboard layout with collapsible sidebar
- KPI dashboard overview
- Lead management with Kanban and list views
- Reservation wizard (4-step flow)
- Sales contract template (bilingual)
- Lease creation wizard
- Rent collection table
- Organization settings (CR/VAT)
- Team management with roles
- Document vault
- Project creation wizard
- Unit matrix with mass editing

## [0.1.0] — 2026-03-06

### Added
- Initial project scaffolding
- Monorepo structure (Turborepo)
- Next.js 16 app with Turbopack
- Prisma 7 schema
- NextAuth v5 configuration
- Shared UI package (`@repo/ui`)
