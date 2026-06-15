# Mimaric — Consolidated Remaining Work

**Created:** 2026-06-13 (post-v4.18.0) · **Owner:** Omar Alghamdi
**Last revised against `main`:** 2026-06-16 · `main` = **v4.26.0** (`100547e`, tag `v4.26.0`).
**Status of baseline:** the **entire CX-audit remediation (CX-001…CX-022) is shipped** across v4.19.1 → v4.26.0 (22/22 findings addressed). What's left is a small polish tail + the separate QA-audit / governance programs — all gathered in the **Master Status** section immediately below.

This is the **single backlog** — it folds in everything from the former `v4.18.0-plan`, `v4.18.0-followups`, `architecture-required-fixes`, `performance-and-load`, `v4.11-followups`, `v4.16-handover`, and the five `UI/*.txt` change-request specs (all now deleted). It is self-contained; no external doc references remain.

Order: **(0)** must-do prod ops → **(1)** v4.18.0 follow-ups that still apply → **(2)** housekeeping → **(3)** near-term backlog → **(4) LATER IMPLEMENTATION** → **(5)** open product question → **(6)** UI backlog / already-shipped plan cleanup → **(7)** load-bearing patterns (reference).

---

## ★ MASTER STATUS — all remaining work (as of v4.26.0 · 2026-06-16)

This is the single, current top-of-funnel. The dated sections below (§0–§7) are the historical detail; where they conflict with this block, **this block wins**.

**Shipped since this file's old v4.23.0 baseline:**
- **v4.24.0** — CX-010 bulk ops (Payments/Reservations/Contracts) + CSV/Excel import wizard (customers+units) + CX-011 DRAFT contract edit.
- **v4.25.0** — CX-003 **pt1**: RSC conversion of 5 list pages (contracts, reservations, payments, marketplace, documents) → no first-paint waterfall; + CX-018 USER→`/portal` lockout (closed a real `dashboard:read` leak).
- **v4.26.0** — CX-017 axe gate expanded 5 routes → **all 16 tenant + 8 platform routes** (new system-role spec). CX-003 **pt2** (RSC CrmView) was found **already done** (CrmView already RSC-seeded) → no code needed.
- ⇒ **§3.4 (F8 RSC) and §3.7 (axe closeout) below are now largely DONE** — see the inline ✅ marks.

**ALL REMAINING WORK, by cluster** (each names the doc that owns the detail):

**A · CX-audit polish tail → v4.27 (small; the last of the CX program).**
- **CX-006** — CRM add-customer form → RHF + zod (the one form still on `useState`; ~300-line / 13-field + property-linking form in `CrmView`). Owns detail: `CX-REMEDIATION-HANDOVER.md` §4/§12.
- **CX-017 Lighthouse CI** (≥95) — new `@lhci/cli` dep + a CI job; verify CI carefully.
- **a11y debt the expanded axe gate baselined** (un-baseline each as it's fixed, in `e2e/accessibility.{admin,system}.spec.ts`): `color-contrast` (~5 non-success-badge instances), `select-name` (~63 native `<select>` → a governed `<Select>` primitive), `label` (inputs missing `htmlFor` → a governed `<Field>` primitive). Owns detail: `QA-AUDIT-REMEDIATION.md` QA-FE-01 / QA-FE-03.

**B · QA-audit remediation (security · DB · architecture · marketplace) — NOT started; its own program.** Owns detail: **`QA-AUDIT-REMEDIATION.md`** (P0 security hotfixes · P1 DB governance + schema correctness · P2 a11y + architecture · P3 marketplace lawful redesign). Still-open highlights: unguarded `"use server"` exports (QA-SEC-01), coupon authz + redemption race (QA-SEC-02), security headers / JWT idle-timeout (QA-SEC-03/04), money precision `Decimal(65,30)` → `Decimal(14,2)` (QA-DB-02), cascade-delete of financial/audit rows → Restrict (QA-DB-03), tenant tables lacking a direct `organizationId` (QA-DB-04), client god-objects / abandoned seams (QA-ARCH-01/02), marketplace proof-gated facilitation + REGA license gating (QA-MKT — gated on the §5 product question + licensing).

**C · Standing engineering backlog (still valid — detail in §1–§3 + §6 below):** marketplace cross-org E2E un-`fixme` (§1.1) · native review of 5 Arabic marketplace-status strings (§1.2) · true HTTP-403 edge middleware (§3.1) · registration email-verification layer (§3.2) · `/dashboard/more` decommission, 4 wire points (§3.6) · full `t()` migration, touched-file only (§3.8) · F9 verification-tooling + `@repo/ui` hygiene (§3.5) · load-test baseline / k6 (§3.9) · `@repo/ui` specs: **system-wide date-picker replacement** (§6.2) + **Alert compound API** (§6.4). (Theme-toggle, notification-center, CircleMenu radial nav = already shipped.)

**D · Parked by Omar (do not schedule):** DB region move **Sydney → Bahrain `me-south-1`** (§4.1 — ops; the raw-latency lever for CX-003, ~10–15×) · **ZATCA e-invoicing** module (§4.2 — blocked on the external clearance pipeline).

**Open product question (gates marketplace compliance scope):** marketplace **inquiry-only vs reserve-and-buy** (§5) — Omar's call; prerequisite for scoping the QA-MKT legal/compliance work.

---

## Current-main audit summary (2026-06-15)

**Correct and confirmed against `main`:**
- Current DB governance is still `prisma db push` + generated/manual RLS SQL, not Prisma Migrate. Proof: `.github/workflows/ci.yml` runs `cd packages/db && npx prisma db push --accept-data-loss`; `packages/db/prisma/migrations/` is absent on `main`; `AGENTS.md` §4 explicitly says schema changes use `db push`.
- `SavedTableView` and DataTable saved views/reorder/export are no longer future work. Proof: `packages/db/prisma/schema.prisma` has `model SavedTableView`; `apps/web/app/actions/saved-views.ts` exists; Payments, Reservations, and Contracts pass `enableColumnReorder`, `exportable`, and `savedViews` into `DataTable`.
- Marketplace cross-org E2E is still a real follow-up. Proof: `apps/web/e2e/marketplace.cross-org.spec.ts` still has `test.fixme(...)` on the publish → browse → inquire → convert → settlement flow.
- The true HTTP-403 contract is still deferred. Proof: `apps/web/lib/auth-helpers.ts` documents inline `<AccessDenied>` and rejects the experimental `forbidden()` path.

**Partially correct:**
- The axe baseline section was stale. `color-contrast` still appears in `KNOWN_BASELINE_RULES`, but v4.20.0 added `--success-strong`; current work should first remove/confirm that exclusion, not blindly retune success colors again. `aria-allowed-attr` remains a live baseline item.
- USER portal work is smaller than originally scoped. `/portal` exists, `app/portal/layout.tsx` gates `role === "USER"`, and `loginAction` routes tenant-mode logins to `/portal`; the remaining question is explicit direct `/dashboard` landing/redirect behavior for USER.
- Notification center and ThemeToggle are implemented in `apps/web`, not `@repo/ui`; future work is extraction/polish only.

**Incorrect or stale:**
- Any plan that treats `FUTURE_PLANS.md` as a `main` file is branch-local/stale; it is not tracked on `main` at v4.23.0.
- The deleted main-only `future-plans/crm-kanban-card-enrichment.md` should not be resurrected as written: `Customer.stageEnteredAt DateTime? @default(now())` already exists on `main`, so the old "schema gap" premise is outdated. If the item returns, scope it as UI rendering + write-path verification.
- The old "build CircleMenu" plan is stale. `apps/web/components/shell/CircleMenu.tsx`, `CircleMenuOverlay.tsx`, and `radial-groups.ts` already ship the radial menu.

---

## 0. v4.18.0 DB ops — ✅ DONE (2026-06-13, local DB)

**Resolved.** Mimaric is not deployed; the only environment is the local checkout against the Supabase DB in `.env.local`. What was done:
- **Schema indexes applied** — `prisma db push` synced the v4.18.0 Customer composite `[organizationId, *Hash]` indexes (dropped the dead `nationalId` index). No RLS SQL needed (no new tables).
- **Encryption key re-established** — the original `PII_ENCRYPTION_KEY` was **lost** (absent from both `.env.local` files; the `.env.example` value is an all-zeros placeholder that decrypts nothing), so the encryption layer was non-functional and the data had drifted (11 plaintext seed phones + 9 ciphertext rows encrypted under the lost key). A fresh 32-byte key was generated and set in `.env.local` + `apps/web/.env.local` (gitignored).
- **Data normalized** — all 20 (fabricated) customers re-encrypted under the new key with correct HMAC blind-index hashes; the 9 unrecoverable lost-key rows were given fresh fake Saudi mobiles. Verified: 20/20 decrypt, 20/20 hashes consistent, cross-format phone search works (`05…` and `+9665…` both match). The marketplace repair script was a no-op (0 marketplace-source customers).

**Standing note for a future real deployment:** any new environment must set its **own** `PII_ENCRYPTION_KEY` + `PII_HASH_PEPPER` (see `.env.example`), run `prisma db push`, then `packages/db/scripts/repair-marketplace-customer-pii.ts` + `rehash-customer-phones.ts` against that env's data with the env's key. Never rotate `PII_ENCRYPTION_KEY` on an env with live data — existing ciphertext becomes unrecoverable (exactly what happened here).

---

## 1. v4.18.0 follow-ups

- **1.1 Stabilize the marketplace cross-org E2E (`test.fixme`).** `apps/web/e2e/marketplace.cross-org.spec.ts` was silently skipped until P4-1 surfaced it. It **passes the P1-1 inquiry step** (PII encryption works) but **hangs in the seller's convert→settlement flow**: `clickVisible(/تحويل لصفقة|Convert to Deal/)` never resolves though the label matches the real button exactly (`my-listings/page.tsx:483`) — a loading/timing issue in the incoming-inquiry `DataTable`. Fix: run the two-org flow interactively, replace the fixed `waitForTimeout` with `await expect(seller.getByText(/Convert to Deal/)).toBeVisible()` (or scroll the inquiries section in), then remove `test.fixme`. Project already has a 180s budget; `marketplace.mylistings-link.spec.ts` passes.
- **1.2 Native review of 5 inferred Arabic marketplace-status strings** (`apps/web/lib/domain-labels.ts`): `UNDER_CONTRACT → تحت العقد` · `SOLD_TRANSFERRED → مُنقَّل` · `UNPUBLISHED → غير منشور` · `REJECTED → مرفوض` · `SUSPENDED → موقوف`.
- **1.3 Two pre-existing server logs** seen during the marketplace CI run (not v4.18.0 regressions): `[WebServer] unexpected export *` (no literal `export *` in `apps/web/app|lib` — likely a barrel/dep; confirm not a malformed server-action surface); `Error: Your organization already has an active subscription` (incidental — the marketplace test only creates a unit fixture; billing seed / another spec emits it).

---

## 2. Repo housekeeping (status)

- **Done in this cleanup:** removed audit artifacts (screenshots, QA HTML reports, slop study, UI/UX PDFs, v4.11 status/verified-audit), old `verification-v4.15.1/`, Zone.Identifier junk + stray `git`/`gitignore`, the shipped `v4.18.0-plan.md` + `v4.18.0-followups.md` + the 4 future-plans detail docs + the 5 `UI/*.txt` specs (folded here), and the `Individual data Absher.json` PII file.
- **Current `main` reality:** `future-plans/REMAINING-WORK.md` is tracked; `future-plans/crm-kanban-card-enrichment.md` exists on `main` but is deleted in this working branch; `future-plans/QA-AUDIT-REMEDIATION.md` and `future-plans/CX-REMEDIATION-HANDOVER.md` are branch-local additions. `FUTURE_PLANS.md` is also branch-local, not a `main` source.
- **Decide deliberately:** `packages/db/prisma/migrations/` is not tracked on `main` and **contradicts AGENTS.md §4** if introduced accidentally. Delete any untracked migrations directory, or run a separately approved, atomic CI+AGENTS conversion to Prisma Migrate. `CI-CD-Pipeline-Proposal/` is a study — keep ignored or commit as a clearly labeled study. `scripts/capture-v4151.mjs` is an old one-off capture script — delete or fold into the F9 capture library (§3).
- **Trivial:** delete stale remote branch `v4.16.1-permission-forbidden` (`git push origin --delete v4.16.1-permission-forbidden`).

---

## 3. Near-term backlog (opportunistic)

### 3.1 True HTTP-403 contract (blocked on nothing now — F4 seam shipped)
`getTenantPageAccess()` returns HTTP **200** even on denial (streaming SSR commits status before the denial renders). Next's `forbidden()`/`authInterrupts` was **tried and rejected** — crashes on client hydration inside the LanguageProvider/ConsentProvider stack; do NOT re-attempt without a hydration fix. Build an **edge-runtime 403 middleware** off the now-shipped `lib/route-guards.ts` (`ROUTE_GUARDS`) + the `ActionResult<T>` / `ok`/`fail` helpers (`lib/action-result.ts`, shipped v4.17.0). Resolve the pre-existing `"User has no organization"` throw in `lib/auth-helpers.ts` (fires when a system user transiently touches a shared dashboard surface) in the same change.

### 3.2 Registration verification layer (A5 remainder — rate-limiting shipped, verification didn't)
Email verification before activation + `PENDING_VERIFICATION` org quarantine + auto-expiry of unverified orgs (7–14d cron) + optional Cloudflare Turnstile (PDPL-friendlier than reCAPTCHA — no tracking cookies). Refs: OWASP Authentication + Email-Verification cheat sheets; Auth0 `email_verified` gating. Schema change → §4 RLS contract applies.

### 3.3 Ciphertext envelope + DB CHECK constraint
Versioned prefix on encrypted values + a `CHECK` validating it (the only layer that would have caught the P1-1 plaintext leak at write time). Requires a format migration of all encrypted columns; revisit with the next PII schema work.

### 3.4 F8 — RSC page+View migration — ✅ mostly DONE (v4.25.0 / v4.26.0)
**Shipped:** contracts, reservations, payments, **marketplace, documents** all converted to the `finance/` RSC pattern (server `page.tsx` shell → props-driven client `*View.tsx`; mount-fetch waterfall removed) in **v4.25.0**; **`crm/CrmView.tsx` was found already RSC-seeded** (verified v4.26.0 — no waterfall). **Remaining (opportunistic):** `settings/page.tsx` (~1,372 lines), help, billing, admin sub-routes — convert when touched. Original guidance below.

Convert client pages to the `finance/` RSC pattern (server `page.tsx` = guard + `parseRangeParams` + `Promise.all` + render; props-driven client `XView.tsx`). **Order:** contracts (`page.tsx` ~1,421 lines) → reservations → payments; then opportunistically `crm/CrmView.tsx` (3,481 lines), `settings/page.tsx` (~1,372), help, billing, admin sub-routes. Per conversion: bank the F5 label registry + F6 seams (`serialize`/`ActionResult`), migrate `lang==="ar"` ternaries to `t()` (touched-file rule), full §3.9 gate.

### 3.5 F9 — verification tooling + @repo/ui hygiene (opportunistic)
1. Capture library `scripts/lib/capture.mjs` exporting `{ login, shot, waitForServer, PRESETS }` — the ~7 `capture-*.mjs`/`verify-ui.mjs` scripts (~1,050 lines) each re-implement `login()`/`shot()`. New scripts become declarative shot-lists; do NOT retrofit the historical ones.
2. Sparkline dedup → `packages/ui/src/lib/sparkline.ts`, import in `KPICard.tsx:131` + `mobile/MobileKPICard.tsx:90`.
3. `LocalizedText` — export from a ui-local types module (re-declared in ~15 components, originally `LifecycleRail.tsx:15`).
4. Deprecate the legacy `MobileKPIDelta` shape needing a runtime guard at `MobileKPICard.tsx:105`.
5. Move `apps/web/lib/hijri.ts` → `packages/ui/src/lib/` (Saudi-generic), re-export.
6. E2E page objects — add only when writing new specs (opportunistic).

### 3.6 `/dashboard/more` decommission (4 wire points — don't delete the route without all four)
1. `auth.config.ts` — system-user allowlist includes `/dashboard/more`; remove. 2. `components/shell/MobileUserMenuSheet.tsx` — links to it; update/remove. 3. `app/dashboard/DashboardClientLayout.tsx` — references it; audit/remove. 4. `app/dashboard/more/profile/` child route — delete after confirming nothing links to it. Then `grep -r "/dashboard/more" apps/web` must be empty before tagging.

### 3.7 axe baseline closeout — ✅ scan EXPANDED (v4.26.0); debt fixes remain (→ v4.27, cluster A)
**Shipped (v4.26.0):** the scan was expanded from 5 tenant-admin routes → **all 16 tenant + 8 platform routes × both audiences** (new `accessibility.system.spec.ts` + system auth-setup). **Finding:** removing the `color-contrast` exclusion was tried and **reverted** — v4.20's `--success-strong` fixed only the *success badge*; the expansion surfaced ~5 OTHER `color-contrast` + 2 `label` + widespread `select-name` violations. Current `KNOWN_BASELINE_RULES = [aria-allowed-attr, color-contrast, select-name, label]`, each documented. **Remaining:** fix that debt + un-baseline each rule (Master Status cluster A) and `aria-allowed-attr` (make the Radix trigger a real `<button>`). Original notes below.

1. **`color-contrast` exclusion is likely stale.** v4.20.0 introduced `--success-strong`, but `apps/web/e2e/accessibility.admin.spec.ts` still disables `color-contrast`. First remove only that exclusion and run the current axe suite; if it passes, keep the token as-is and delete the stale comment. If it fails on a new selector, fix that specific surface.
2. **`aria-allowed-attr` remains live.** A Radix/asChild path still needs direct verification; make the trigger target a real `<button>` or otherwise remove the invalid `aria-expanded` target. Then expand the scan from 5 tenant-admin routes to all dashboard routes by audience.

### 3.8 Other standing items
- **Full `t()` migration** of remaining ~2,000 inline `lang==="ar"` ternaries — touched-file only, never big-bang (F5 already centralized the densest cluster).
- **Arabic domain-term pass for reservations + contracts** headings + empty-state copy (CRM done in v4.15.0). **Do this on the `lib/domain-labels.ts` registry after F5**, with native review (AGENTS.md §6.11.4).
- **`"use cache"` / `cacheComponents` migration** — keep `unstable_cache` for now (`getPublicPlans` key/tag are stable for the switch).
- **Policy-based RLS** — incompatible with the owner-role Prisma connection; not a patch. Current RLS-on-no-policy firewall stays.
- **Lint-warning burn-down** — ~484 warnings (only-warn keeps CI at 0 errors); ratchet specific rules to error as files are cleaned.
- **Marketplace cursor pagination + counts**, **document lifecycle** (remote deletion + audit), **per-tenant blind-index keys** (current per-app pepper acceptable at this scale).
- **Dashboard greeting hydration** (`DashboardView` uses `new Date().getHours()` at render → hour-boundary server/client mismatch). Fix only if it surfaces: gate behind `useMounted()` (like `LastUpdatedAgo`).
- **Asset 404** — `verification-v4.11.0` logged 2× "Failed to load resource: 404" (likely a favicon/image on a dashboard route); re-confirm it still exists post-v4.16 RSC before chasing.

### 3.9 Load-test baseline (unmeasured — new item)
Add a committed **k6** (or autocannon) script under `apps/web/loadtest/` — login + 3-dashboard flow, ramp 20→200 VUs, run against a deployed/staging HTTP/2 instance (browser load caps at 6 concurrent HTTP/1.1 conns, so single-tab tests only drove ~6-way concurrency). Measure pool-exhaustion threshold, timeout threshold, p50/p95/p99 TTFB. Gotchas: concurrent logins rotating users overwrite the shared session cookie (re-establish one known session before authed measurement); prefetch `_rsc` GETs showing `net::ERR_ABORTED` are Next cancelling prefetch, not failures.

---

## 4. LATER IMPLEMENTATION (explicitly parked — do not schedule yet)

### 4.1 DB region migration: Sydney → Bahrain (`me-south-1`)
The dominant felt-latency lever. **Measured baseline:** TCP RTT app→Supabase = **223ms avg** (region `aws-1-ap-southeast-2` = AWS Sydney; users in Riyadh ~12,000 km). Warm static page (no DB) = 9–26ms. Expected post-migration ~15ms/round-trip (~10–15× better). Ops/runbook task (data move + downtime window), not code. Notes: `DATABASE_URL` uses port **5432 session mode** (not the 6543 transaction pooler) — fine for the `pg.Pool` singleton; revisit for serverless/edge. Prod `pool_size: 15` → `db push` + a running preview can throw `EMAXCONNSESSION` (stop preview before prod builds). Bahrain region is also the **NDMO/SDAIA data-residency** argument. **Parked by Omar.**

### 4.2 ZATCA e-invoicing module
**Root gap:** `actions/billing.ts` `generateSubscriptionInvoice` (~L315–345) creates invoices but never sets ZATCA fields → every `Invoice.zatcaStatus` defaults `NOT_APPLICABLE`; QR/xml/submittedAt/clearedAt stay null. **Schema ready:** `enum ZatcaStatus { NOT_APPLICABLE, PENDING, CLEARED, REPORTED, REJECTED }` (schema.prisma ~L997) + Invoice ZATCA block (~L1182–1188). **Build order:** (1) clearance/reporting service populating ZATCA fields on issue — *the external dependency / blocker*; (2) tenant invoices page (`billing/invoices/page.tsx`) per-invoice clearance badge + QR + retry (data already returned, unrendered); (3) Finance dashboard compliance widget (reuse `admin-analytics/getZatcaClearanceRate.ts` → `{rate,cleared,rejected,pending,last7Rejections,alertSpike}`); (4) keep the platform-admin ZATCA KPI; (5) update `lib/help-content.ts:~106` FAQ. **Parked by Omar — blocked on the ZATCA clearance pipeline.**

---

## 5. Open product question (gates marketplace compliance scope)

**Marketplace positioning: inquiry-only vs reserve-and-buy.** Decides whether the audit's marketplace compliance / license-verification items are P0 or P2. Product call for Omar; prerequisite for scoping marketplace legal/compliance work.

---

## 6. Pending UI features (component specs — folded from the deleted UI/*.txt)

> All five are new `@repo/ui` component work, untouched by v4.18.0. Each must follow AGENTS.md §6 (RTL-first, 4-theme verification, 44px targets, governed primitives). Replace any prototype `useState`/raw-button stubs in the source specs with the real wiring noted below.

### 6.1 Theme toggle button — ✅ shipped in `apps/web`
Already implemented as `apps/web/components/ThemeToggle.tsx`, wired to `next-themes`, Radix Switch, bilingual `aria-label`, RTL-safe logical thumb positioning, and used in auth, portal, and topbar surfaces. Future work only if we deliberately extract it to `@repo/ui`; do not rebuild it from this old spec.

### 6.2 Date picker — system-wide replacement
Replace EVERY date / date-range picker with a stack on `react-aria-components` + `@internationalized/date`, all in `packages/ui/src/components/`: `date-range-picker.tsx` (`DatePicker`/`DateRangePicker`/`JollyDatePicker`/`JollyDateRangePicker`), `calendar.tsx` (`Calendar`/`RangeCalendar`/`CalendarHeading`… — `CalendarHeading` already flips chevrons via `useLocale()`, **preserve**), `datefield.tsx`, `field.tsx`, and a `react-aria`-based `popover.tsx` that must **coexist** with the existing Radix `Popover` (do not shadow/rename it). Deps: `react-aria-components`, `@internationalized/date`. **Mimaric musts:** RTL chevron flip; **Hijri toggle** (`calendar="islamic"` / `showHijriToggle`) wired to the per-user pref (AGENTS.md §6.15.3, `lib/hijri.ts`) — don't break the existing `saudi/HijriDatePicker`; migrate the dashboard range picker (`lib/use-date-range-query.ts` + `lib/dashboard-range.ts`) to `JollyDateRangePicker` without changing the query-string interface; tabular-nums on segments; 44px cells/nav; label-above + `--ring` focus to match Saudi input primitives. **Acceptance:** all date inputs migrated (none left on the old impl); RTL chevrons; Hijri toggle persists; 4-theme pass on a form date field + dashboard range header + contracts page.

### 6.3 Notification center — ✅ shipped in app shell
Already implemented in `components/shell/AppTopbar.tsx` and `MobileNotificationsSheet.tsx`, backed by `app/actions/notifications.ts` (`getMyNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead`) and shared `notification-categories.ts`. Future work: extract to a reusable `@repo/ui` component only if another app needs it, and run 4-theme popover/sheet screenshots when touched.

### 6.4 System alert banners (compound `Alert` redesign)
Partially done: `packages/ui/src/primitives/alert.tsx` already has tokenized `variant × appearance` support for `default|primary|destructive|success|info|warning` and `solid|outline|light`. Remaining work is the compound API (`AlertContent`/`AlertIcon`/`AlertToolbar`), `mono`/`stroke`/size variants if still wanted, dismiss ownership via `IconButton`, usage migration, and a 4-theme variant-demo verification. Do not create a second `packages/ui/src/components/Alert.tsx` that conflicts with the existing primitive export; extend or wrap the existing primitive deliberately.

### 6.5 Navigation — radial `CircleMenu` — ✅ shipped in `apps/web`
The radial menu is already the live shell: `DashboardClientLayout.tsx` renders `components/shell/CircleMenu.tsx`, which lazy-loads `CircleMenuOverlay.tsx`; `radial-groups.ts` resolves the two-level groups from `navItems` with audience filtering. It uses a dialog/nav/link model rather than `role="menu"` (correct for site navigation), supports Escape/focus trap/arrow enhancement, reduced motion, RTL mirroring, and a mobile half-wheel. Future work: audit discoverability and keyboard coverage during any shell change, keep Cmd-K as the accessible twin, and do not rebuild this from the pre-implementation spec.

---

## 7. Load-bearing engineering patterns (reference — do not unknowingly override)

- **`getTenantPageAccess()` + inline `<AccessDenied>` is the stable permission-denial pattern.** `forbidden()`/`authInterrupts` was tried and rejected (hydration crash in the provider-wrapped layout) — don't re-attempt without a hydration fix.
- **Finance dashboard is the canonical RSC reference** (`finance/page.tsx` + `FinanceView.tsx` + `lib/dashboard-range.ts`) — copy it for F8 conversions.
- **Consent = block-until-consent.** Do NOT switch to Consent Mode v2 (fires cookieless pings pre-consent); keep all `ad_*` denied.
- **E2E overlays must be suppressed in storageState** — any new always-on overlay must be handled in `e2e/consent-helper.ts` or it breaks bottom-anchored interactions.
- **CI badge ≠ CI pass.** `gh run watch --exit-status` returned 0 on a run with a failed step in this very project — always `gh run view --job <id>` (or `gh pr checks`) for per-step conclusions before merging/tagging.

---

*When an item ships, strike it here and note the version. This file is the only surviving record of the deleted planning + UI-spec docs.*
