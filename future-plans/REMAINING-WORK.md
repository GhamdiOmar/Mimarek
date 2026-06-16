# Mimaric — Outstanding Work Report

> **Generated 2026-06-16, post-v4.30.1** from an exhaustive multi-agent re-verification of all four
> audit/backlog sources (`QA-AUDIT-REMEDIATION.md`, `REMAINING-WORK.md`, `CX-REMEDIATION-HANDOVER.md`,
> `verification/Mimaric-CX-Audit*.html`) against the **actual code + git history** at `main`, with an
> adversarial completeness critic. Every item below was confirmed by direct Read/Grep — not the docs' prose.
>
> **Framing (per Omar):** only **two** items are true deferrals — **DB region migration** and **ZATCA**.
> *Everything else in this report is in-place to be done.* Items are grouped by area, each with
> **Gap · Reason · Location · What to do · Effort/Priority**.
>
> **Effort:** S = <½ day · M = 1–3 days · L = >3 days / multi-PR. **Priority:** P1 (do next) · P2 · P3.

---

## ✅ Already closed in v4.30.1 (for reference — not outstanding)
- **PasswordResetToken hashed-at-rest** + atomic single-use (was plaintext + double-spend race).
- **Units bulk-status `<select>` aria-label** (the one unguarded a11y violation axe couldn't see).
- **QA-TEST-01 runtime locks** — tenant org-isolation (8 actions) + coupon atomic-redemption race; vitest 149/149.

The audit found **no falsely-marked-done defects**: marketplace P3's 5-gate settlement, both auth-token flows, and the Postgres rate limiter are genuinely robust.

---

## A. Security & data integrity — **P1**

### A1. Ciphertext envelope (versioned prefix) + DB CHECK constraint — `§3.3`
- **Gap:** Encrypted PII is stored as a bare `iv:authTag:ciphertext` string with **no version byte** and **no DB-level CHECK**. There is no write-time guard that a column that should be encrypted actually *is*.
- **Reason:** Deferred in the doc to "the next PII schema work"; v4.27 (security) and v4.28 (schema) both shipped without it. It is the layer that would have caught the historical P1-1 plaintext-customer leak at write time.
- **Location:** `apps/web/lib/encryption.ts` (`encrypt()` ~line 28 emits the bare triple; `decrypt()` ~line 44-52 branches only on colon-count). No `CHECK` in `packages/db/sql/`.
- **What to do:** Add a `v1:` magic prefix in `encrypt()`; teach `decrypt()`/`safeDecryptField` to branch on it; **backfill** existing ciphertext with the prefix; then add a Postgres `CHECK (col LIKE 'v1:%')` on the encrypted columns (manual SQL in `packages/db/sql/`, applied to the live DB after the backfill). Stage it like the v4.28 money recast.
- **Effort:** M · **Priority:** P1 (it's the write-time integrity guard for all PII).

### A2. `decrypt()` plaintext-passthrough has no telemetry
- **Gap:** `decrypt()` returns *any* value that isn't the `iv:tag:ct` shape **as-is** (legacy-plaintext passthrough), silently. A bug that wrote plaintext PII (the P1-1 class) is therefore invisible at **read** time — no signal anything is wrong.
- **Reason:** Intentional for the pre-encryption migration, but it became a permanent silent path with no monitoring.
- **Location:** `apps/web/lib/encryption.ts:45-52`; `apps/web/lib/pii-crypto.ts` (`safeDecryptField`).
- **What to do:** Emit a security-event log when the legacy-plaintext branch fires on a column that should be encrypted (until A1's CHECK constraint makes plaintext impossible). Pairs with A1.
- **Effort:** S · **Priority:** P1.

### A3. Rate limiter **fails open** on a DB error
- **Gap:** The Postgres-backed rate limiter is durable/multi-instance, but on **any DB error it allows the request** (fail-open). A Postgres blip silently disables *all* throttling — login, password-reset, marketplace inquiry — at exactly the moment an attacker might exploit it.
- **Reason:** A deliberate availability-over-security trade-off (not a bug). No doc captured the trade-off explicitly.
- **Location:** `apps/web/lib/rate-limit.ts` (`checkRateLimit` catch path).
- **What to do:** Either (a) document an explicit risk-acceptance, or (b) add a **fail-CLOSED** mode for the most sensitive keys (`login:*`, `password-reset:*`, `resend-verification:*`) while the rest stay fail-open. Your call — it's your deliberate design.
- **Effort:** S · **Priority:** P2 (needs your decision).

### A4. `organizationId` / `*Hash` NOT-NULL + FK tightening — `QA-DB-04/05`
- **Gap:** The denormalized `organizationId` on `Lease`/`Reservation`/`PaymentPlanInstallment` and the `phoneHash`/`emailHash`/`nationalIdHash` columns are **nullable** — the NOT-NULL + FK tightening is the second half of QA-DB-04/05.
- **Reason:** Deliberate staged rollout — a NOT-NULL column with no default aborts `db push` on a populated table (AGENTS.md §4), so the column shipped nullable and the tightening is gated on a verified backfill.
- **Location:** `packages/db/prisma/schema.prisma` (Lease ~575, Reservation ~345, PaymentPlanInstallment ~503); backfill `packages/db/sql/2026-06-orgid-backfill.sql`; runbook `packages/db/sql/2026-06-v4.28-manual-steps.md` Step 5.
- **What to do:** Run the backfill SQL against the live DB → verify 0 NULLs → set the columns NOT-NULL + add the cross-org FK/indexes → `db push`. (This is the "owed by Omar" live-DB step from v4.28 — I can run it.)
- **Effort:** M · **Priority:** P1 (it's an already-started item one step from done).

---

## B. Accessibility & UX — **P2**

### B1. Raw `<select>` → governed `SelectField` sweep — `QA-FE-03` tail
- **Gap:** The governed `SelectField` primitive exists and the axe gate is green, but **~55 raw native `<select>`** remain across the app (they're labelled, so not an axe failure, but they keep the dark-mode/RTL styling inconsistency the finding called out, and interaction-revealed ones can regress unseen).
- **Reason:** Built the primitive + greened the gate (the deliverable); the wholesale mechanical swap was never the gate requirement and is opportunistic.
- **Location:** ~20 pages — `admin/coupons`, `admin/email`, `admin/tickets`, `contracts`, `settings` (×8), `onboarding` (×8), `payments`, `help` (×5), `crm/CustomerDrawer` (×3), `marketplace` (×2), `portal` (×2). (The one *unlabelled* one, UnitsView:1139, is already fixed.)
- **What to do:** Touched-files-only swap to `<SelectField>` (highest-traffic first: contracts, payments, settings, crm/CustomerDrawer). Add a `no-restricted-syntax` lint ban on raw `<select>` in `app/**` to stop regressions. Do **not** big-bang all 55.
- **Effort:** M (incremental) · **Priority:** P2.

### B2. CRM `CustomerDrawer` → `ResponsiveDialog` — `QA-FE-04`
- **Gap:** The customer detail drawer is still a hand-rolled `fixed inset-0` overlay + `slide-in-from-right` panel — the slide direction **does not flip for Arabic RTL** and it gets **no mobile bottom-sheet** (re-implements by hand the exact hazards the finding flagged).
- **Reason:** The v4.30 decompose extracted the drawer into its own file and migrated its inner *modal forms* to `ResponsiveDialog`, but not the drawer *shell* itself.
- **Location:** `apps/web/app/dashboard/crm/CustomerDrawer.tsx:356-366` (hardcoded `slide-in-from-right`).
- **What to do:** Re-platform the drawer onto `ResponsiveDialog` (or a shared `Drawer` primitive) so RTL slide-from-end + mobile bottom-sheet are inherited. Verify in AR-RTL + 375×812 per §3.9.
- **Effort:** M · **Priority:** P2.

---

## C. Architecture / tech-debt — **P2/P3**

### C1. Adopt the abandoned shared seams + add lint-bans — `QA-ARCH-02`
- **Gap:** The shared seams are mostly dead: `action-result.ts` (0 importers), `lib/routes.ts` `ROUTES` (2 importers vs **~23 raw `revalidatePath("/dashboard…")` strings**), `lib/serialize.ts` (2 vs ~24 inline `JSON.parse(JSON.stringify)`), the `t()` facade (0 vs ~87 inline). No lint-bans were added, so the inline alternatives keep accruing.
- **Reason:** Adoption was framed as opportunistic; only `UNIT_STATUS` landed. **The raw `revalidatePath` strings are a live §8.5 stale-rename correctness hazard** (a renamed route leaves a stale revalidate string → confusing stale-data bug), not just churn.
- **Location:** `app/actions/**` (the raw `revalidatePath` strings + inline serialize); seams in `apps/web/lib/{routes,serialize,action-result}.ts`.
- **What to do:** Add the prescribed lint-bans (no inline `JSON.parse(JSON.stringify)` in `app/actions`; no raw `revalidatePath("/dashboard…")` → force `ROUTES`). Migrate the `revalidatePath` strings **first** (the actual hazard).
- **Effort:** M · **Priority:** P2 (the revalidatePath part), P3 (the rest).

### C2. Delete or document the dead `apps/portal` app — `QA-ARCH-03`
- **Gap:** `apps/portal` ships 3 redirect-only routes that just redirect to `apps/web /auth/login` — build/maintenance overhead + a discoverability trap, with a stale "Create Next App" / "Generated by create next app" metadata title.
- **Reason:** Never cleaned up; rated LOW.
- **Location:** `apps/portal/app/{page,layout,dashboard/leases/page}.tsx`. (Confirmed redundant: the USER-role `/portal` redirect resolves to `apps/web/app/portal`, **not** `apps/portal`.)
- **What to do:** Delete `apps/portal` and drop it from the build matrix, **or** add a top-of-file redirect-only comment + fix the stale metadata title. Verify no route depends on it first.
- **Effort:** S · **Priority:** P3.

### C3. `any`/exhaustive-deps budget reduction — `QA-ARCH-04`
- **Gap:** Named `any`s persist (`massUpdateUnits` types `status?: any`) and 11 `eslint-disable react-hooks/exhaustive-deps` are un-audited (each a latent stale-closure bug).
- **Reason:** Lowest-priority cleanup; no sprint targeted it.
- **Location:** `apps/web/app/actions/units.ts:87` (+ `:347` `as any`); `CrmView`/`UnitsView`/`customers.ts` named `any`s; the 11 disables across hooks-heavy views.
- **What to do:** Type `massUpdateUnits` status as the `UnitStatus` enum; focused pass on the named `any`s; fix or justify each exhaustive-deps disable. Fold into the next touch of each file.
- **Effort:** M · **Priority:** P3.

### C4. F9 code-hygiene tail — `§3.5`
- **Gap:** (a) No shared capture lib (`scripts/lib/capture.mjs`) — the `capture-v42xx.mjs` scripts re-implement login/shot; (b) `apps/web/lib/hijri.ts` not relocated to `packages/ui/src/lib/` (Saudi-generic); (c) `LocalizedText` still re-declared in ~15 components; (d) legacy `MobileKPIDelta` runtime-guard shape not deprecated.
- **Reason:** Sparkline dedup + UNIT_STATUS landed (d4c02d1); the rest of F9 is opportunistic and untouched.
- **Location:** `scripts/`, `apps/web/lib/hijri.ts`, the ~15 components.
- **What to do:** Move `hijri.ts` to `@repo/ui` + re-export; centralize `LocalizedText`; build the capture lib; deprecate `MobileKPIDelta`. Each is independent + small.
- **Effort:** S each · **Priority:** P3.

---

## D. Data lifecycle / compliance — **P2**

### D1. Retention/destruction for audit & notification tables — platform-admin UI + scheduler — `QA-DB-07`
- **Gap:** No retention or destruction strategy for `AuditLog` / `ConsentLog` / `Notification` / `WebhookEvent`. Unbounded growth **and** a **PDPL data-minimization** concern (indefinite ConsentLog/AuditLog PII retention). There is also no operator-facing way to see or control it.
- **Reason:** Out-of-`db-push` scheduled-job; rated LOW; silently dropped (no tracked deferral). No UI was ever planned for it.
- **Location:** The only purge cron is `apps/web/app/api/cron/clean-expired-email-tokens` (unrelated). No retention anywhere else; no admin surface.
- **What to do — build a platform-admin Data-Retention & Destruction console (UI-driven, §3.1) + an unattended scheduler.** Treat it as a small feature, not just a cron:
  - **UI surface (§8 platform-only).** New route `/dashboard/admin/data-retention`, `requireSystem()` + SYSTEM-audience gate, `ROUTE_GUARDS` entry + admin-nav link (NOT a tenant surface — it spans all tenants' data). The page shows, per table (AuditLog / ConsentLog / Notification / WebhookEvent): **row count, oldest-record age, est. size**, the **configured retention window**, and **last-run / next-scheduled-run**.
  - **Configure (persisted in `SystemConfig`).** Per-table retention window (a **documented PDPL default** for ConsentLog/AuditLog — never below the lawful-basis/ROPA minimum), and a **scheduler** toggle + frequency (daily/weekly) for the automated run.
  - **Manual "Run destruction now" (governed destructive action).** A platform server action (`requireSystem` + audience) that first returns a **dry-run preview** (rows that *would* be deleted per table for the current windows) → an explicit **`ConfirmDialog`** (§6.6.4, destructive) → then executes a **batched/chunked** delete (avoid long table locks).
  - **Every run is audit-logged** (actor, timestamp, per-table rows deleted, window applied). Hard rule: the AuditLog purge must **never** delete its own destruction-run records inside the retention window (self-referential safety).
  - **Unattended path:** a cron route under `app/api/cron/` (guarded by `isAuthorizedCronRequest`) that reads the same `SystemConfig` windows and runs the identical batched purge on schedule (so the schedule runs without a human). The UI button and the cron call the **same** underlying destruction function.
  - **Scale:** for very large tables, range-partition by month + drop old partitions (manual SQL in `packages/db/sql/`) instead of row-deletes.
  - **Schema:** additive `SystemConfig` fields for the per-table windows + scheduler settings (no RLS owed — existing table); optionally a `DataRetentionRun` log table (then add it to `2026-06-enable-rls.sql` + the live Supabase ALTER per §4).
- **PDPL note:** the retention windows + the destruction process are themselves a **documented, audited** control (record in CHANGELOG/ROPA); ConsentLog destruction must respect the lawful-basis retention minimum.
- **Effort:** L (UI + scheduler + server action + cron + schema, sharing one destruction core) · **Priority:** P2 (PDPL angle).

---

## E. Features partially shipped — **P2**

### E1. Registration verification — full layer — `§3.2`
- **Gap:** The core email-verify shipped (user-level `emailVerified`, deny-login-until-verified, verify pages, daily token-purge cron). Missing: **(a) org-level `PENDING_VERIFICATION` quarantine** (only user-level today), **(b) a 7–14-day unverified-org auto-expiry cron**, **(c) anti-bot (Cloudflare Turnstile)** on signup.
- **Reason:** Scoped to the user-level gate for v4.30; the org-quarantine + auto-expiry + Turnstile were the stretch.
- **Location:** `apps/web/lib/email-verification.ts`, `app/api/cron/clean-expired-email-tokens` (token-only). No `expire-unverified-orgs` cron; no Turnstile.
- **What to do:** Add `Organization.status PENDING_VERIFICATION` + gate; an `expire-unverified-orgs` cron (PDPL-friendly minimization of abandoned signups); Turnstile on the register form (PDPL-friendlier than reCAPTCHA).
- **Effort:** M · **Priority:** P2.

### E2. `/dashboard/more` decommission — finish — `§3.6`
- **Gap:** The `more` hub was deleted but `more/profile` was intentionally kept; the §3.6 acceptance ("`grep -r /dashboard/more` empty") is not met.
- **Reason:** Deliberate partial — `more/profile` is still linked (UI-First).
- **Location:** `DashboardClientLayout.tsx:33`, `MobileUserMenuSheet.tsx:81`, `app/dashboard/more/profile/`.
- **What to do:** Either fully retire `more/profile` (move the profile surface to `settings`) or formally close §3.6 as "profile kept by design." Mostly a decision + small wiring.
- **Effort:** S · **Priority:** P3.

### E3. Date-picker spec-completeness — `§6.2`
- **Gap:** The react-aria migration shipped (`aria-calendar.tsx`, Hijri toggle, no `react-day-picker` left), but it's a custom react-aria-hooks calendar, not the full Jolly\* `react-aria-components` stack (`datefield.tsx`/`date-range-picker.tsx` named in the spec); "all date inputs migrated" isn't fully proven (the ~14 native `<input type="date">` remain native).
- **Reason:** Core migration was the goal; the native date-inputs + full component stack are the tail.
- **Location:** `packages/ui/src/primitives/aria-calendar.tsx`; the ~14 `<input type="date">` across settings/maintenance/reservations/payments/crm/reports/coupons.
- **What to do:** Decide whether the native `<input type="date">` need the custom picker (they're accessible as-is). If yes, migrate on touch. Otherwise close §6.2 as done.
- **Effort:** M (if migrating the inputs) · **Priority:** P3.

### E4. Marketplace `viewCount` dedup + pagination — `QA-MKT-06`
- **Gap:** `viewCount` increments on **every** buyer detail-view with no per-viewer/session dedup (inflates on refresh/bots; unreliable for any future ranking/seller analytics). Cursor pagination + counts also not added (search half is covered by CX-002).
- **Reason:** Listed P3-local; only the search/federated half shipped.
- **Location:** `apps/web/lib/marketplace/listing-view.ts:201` (`viewCount: { increment: 1 }`).
- **What to do:** Gate the increment on a `(listingId, viewerKey, date-bucket)` row or a short-TTL rate-limit key; keep best-effort/non-blocking. Add cursor pagination when listing volume warrants.
- **Effort:** S (dedup) / M (pagination) · **Priority:** P3.

---

## F. Large refactors (you want these done — NOT deferred) — **P2/P3**

### F1. Full `t()` migration tail — `§3.8`
- **Gap:** Only `DashboardView` was migrated (26 ternaries). **~2,200–2,585 inline `lang === "ar" ? …` ternaries** remain across ~80 files.
- **Reason:** Bounded best-effort for v4.30 (it's zero-user-value churn with real per-string copy-regression risk; AGENTS.md §3.8 forbids a big-bang).
- **Location:** repo-wide. Highest-traffic per-route counts: `contracts/ContractsView` ~157 · `units/UnitsView` ~116 · `reservations/ReservationsView` ~98 · `crm/CrmView` (+`AddCustomerModal`/`CustomerDrawer`) ~65 · `payments/PaymentsView` ~65 · `DashboardView` **done (26 of 36)** · ~70 other files for the balance of ~2,230.
- **Conversion rule (for whoever resumes):** `const { lang, t } = useLanguage()`; convert ONLY `lang === "ar" ? "<ar>" : "<en>"` where **both branches are user-facing string/template literals** → `t("<ar>", "<en>")` (Arabic first). NEVER convert a branch that is JSX / a variable / number / null, or that feeds `dir`/`locale`/`calendar`/`className`/`Intl`/CSS, or a bare `lang === "ar"` boolean. Under-converting is correct; a wrong conversion is a rendered-copy bug.
- **What to do:** Per-route batched commits (never big-bang), `check-types` + a 4-theme render per batch, convert **only** string-literal text pairs (not `dir`/`locale`/JSX ternaries). Add a lint-ban on new inline ternaries once a route is migrated.
- **Effort:** L (multi-PR program) · **Priority:** P3 (maintainability, not user-facing).

### F2. True HTTP-403 edge middleware — `§3.1`
- **Gap:** Authorization denials redirect / render an in-shell AccessDenied at **HTTP 200**, not a true 403. No `apps/web/middleware.ts`.
- **Reason:** Deferred — Next's `forbidden()` caused a hydration crash (rejected), and a new edge middleware carries CVE-2025-29927 risk for marginal 403-vs-200 value (server-side guards already enforce).
- **Location:** `apps/web/auth.config.ts` (the `authorized` redirect); `app/dashboard/_components/AccessDenied.tsx` (returns 200).
- **What to do:** If you want a real 403: add an edge `middleware.ts` keyed off `lib/route-guards.ts` (`ROUTE_GUARDS`) as **defense-in-depth only** (keep the server-side guards), patched against CVE-2025-29927. Otherwise document the 200-on-denial as accepted.
- **Effort:** M · **Priority:** P3 (server-side guards already secure; this is HTTP-semantics polish).

---

## G. Regulatory roadmap (excluding ZATCA) — **P3 / product-gated**

### G1. Ejar auto-registration + national e-sign SSO
- **Gap:** Saudi-integration roadmap items — Ejar electronic-lease auto-registration and national e-signature (Nafath/IAM) SSO — are unbuilt.
- **Reason:** External-integration roadmap, separate from the core product; not regressions.
- **Location:** n/a (greenfield).
- **What to do:** Scope as their own features when the integrations are prioritized (each needs the external API + credentials). *(Off-plan/projects scope was explicitly removed in v4.2.5 — that one is obsolete, not outstanding.)*
- **Effort:** L each · **Priority:** P3.

---

## H. Housekeeping & loose ends — **P3**

| ID | Gap | Location | What to do | Effort |
|---|---|---|---|---|
| H1 | Untracked `packages/db/prisma/migrations/` dir contradicts the `db push` model (AGENTS.md §4) | working tree `?? packages/db/prisma/migrations/` | **Delete it** (stay on `db push`); confirm not referenced | S |
| H2 | `CI-CD-Pipeline-Proposal/` untracked, undecided | working tree `?? CI-CD-Pipeline-Proposal/` | Commit as a labeled study or delete | S |
| H3 | 2 pre-existing server logs never closed (`unexpected export *`, active-subscription error) | from the v4.18 marketplace CI run | Reproduce → fix or close-out as test-seed noise | S |
| H4 | Arabic domain-term pass for **reservations/contracts** headings + empty-states not done (marketplace strings done in §1.2) | `apps/web/lib/domain-labels.ts` + those views | Native-speaker review of the AR copy | S |
| H5 | Dashboard greeting hydration (`getHours()` server/client mismatch) — latent | `DashboardView.tsx:193` | `useMounted()` guard if the warning surfaces | S |
| H6 | Asset 404 (the v4.11 dashboard 404) never re-confirmed post-RSC | dashboard route | Re-confirm in network tab; resolve if it persists | S |
| H7 | Lint-warning burn-down (~480 warnings) | repo-wide | Ratchet rule-classes to `error` incrementally | M |
| H8 | Per-tenant blind-index keys + document remote-deletion+audit | `lib/pii-crypto.ts`, `app/actions/documents.ts` | Per-tenant pepper (noted "acceptable at this scale"); document lifecycle | M |
| H9 | Marketplace cross-org E2E: one narrow `test.fixme` remains (seller convert→settle UI walk — pre-existing DataTable convert-button hang) | `apps/web/e2e/marketplace.cross-org.spec.ts:599` | Debug the DataTable convert-button hang, then un-fixme | M |

---

## I. Engineering backlog — legacy v4.7-era roadmap (re-verify before doing) — **P3**
> Folded in from the former root `FUTURE_PLANS.md §2`. These predate the v4.27–v4.30 work — **re-verify each against current code before acting** (some may already be resolved).

| ID | Gap | Location | What to do | Effort |
|---|---|---|---|---|
| I1 | The partial-payment CI test **re-implements** the money algorithm instead of exercising real code | `apps/web/e2e/seed/payment-correctness-test.ts` | Extract the pure money logic into a shared non-`"use server"` module the test imports (T3 — money). | M |
| I2 | No append-only `RentPayment` ledger — the `effectivePaid`/`coalesce` legacy rule blocks per-payment reversals/refunds | rent-payment write paths | Introduce an append-only RentPayment ledger (T3 — money; long-term-correct payment model). | L |
| I3 | Reports-page group headers render English in the Arabic view | `ReportsView.tsx` `REPORT_GROUPS` (page-level `lang`-source quirk; config is already bilingual) | Fix the header `lang` source. Cosmetic; Arabic-first product. | S |
| I4 | `marketplace.ts` writes `Customer.status` directly inside the cross-org transfer txn, bypassing Deal-sync | `app/actions/marketplace.ts` (v4.5 follow-up) | Route the status change through the Deal-sync path inside the atomic transfer. | S |
| I5 | confirm-after-convert can create a 2nd `WON` deal row | the convert→confirm path (v4.5 follow-up) | Make convert idempotent (status still resolves via deterministic sync — low impact). | S |
| I6 | Dev `@axe-core/react` "2 issues" overlay (a v4.7 observation) | dev-mode only | **Likely already resolved** by the v4.29/v4.30 axe-26/26 work — re-confirm in dev, close if clean. | S |

---

## Deferred — your two only (DB migration + ZATCA)
| Item | Why / scope | Detail |
|---|---|---|
| **DB migration & release / DB-evolution governance** | The deferred "going-public" infra program (you're aware). Encompasses: **adopt Prisma Migrate of-record** (retire prod `db push`) via a one-time PII-sanitized-clone-rehearsed prod baseline (`migrate diff` must be zero-drift; prod gets metadata-only `migrate resolve --applied`, **no DDL**) + an atomic CI cutover (`db push --accept-data-loss` → `migrate deploy`); **Vercel + Supabase deploy pipeline** with instant atomic rollback + PR previews; **observability** (Sentry + `/api/health` + uptime/alerting + structured no-PII logging); **PDPL/NDMO release gates** (`npm audit` / gitleaks / SBOM + non-prod de-identification + a T3 PDPL checklist); a **per-change risk-tiered (T0–T3) developer playbook**; and the **DB region move** Sydney → Bahrain `me-south-1` (the ~223ms-RTT latency lever; RSC work shipped as the interim perceived-latency win). Prereqs you configure first: Vercel project, disposable Supabase clone, PITR/backup access, Sentry DSN, sole `DIRECT_URL` ownership. | The full step-by-step baseline runbook + pipeline + tier-gates is preserved in git history (`FUTURE_PLANS.md`, removed in this handover commit — `git show` to retrieve). |
| **ZATCA Phase-2 e-invoicing** | Large compliance integration blocked on the external clearance pipeline. Schema is ready (`ZatcaStatus` enum + Invoice fields, default `NOT_APPLICABLE`). | `billing.ts:282` |

---

## Suggested sequencing if you want me to proceed
1. **P1 security/data:** A1 ciphertext envelope + A2 decrypt telemetry (one change), A4 the org-id backfill + NOT-NULL (live-DB, I run it).
2. **P2:** D1 retention/PDPL, E1 registration-verification layer, B2 CustomerDrawer, A3 rate-limiter decision, C1 revalidatePath lint-ban.
3. **P3:** the select-sweep, the F9 hygiene, apps/portal, any-budget, the housekeeping table, then the `t()` program + HTTP-403 as standalone efforts.

Tell me which tier (or specific IDs) to take, and I'll run them through the same delegate → QA-gate → §3.9 → release cycle.
