# Changelog — Mimaric PropTech

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
