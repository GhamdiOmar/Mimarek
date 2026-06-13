# Mimaric — Consolidated Remaining Work

**Created:** 2026-06-13 (post-v4.18.0) · **Owner:** Omar Alghamdi
**Status of baseline:** v4.18.0 is **shipped** (PR #23 `74af715`, tag + GitHub release live, CI green). F4 (route-guards SSOT) and F5 (domain-label registry) shipped in v4.18.0.

This is the **single backlog** — it folds in everything from the former `v4.18.0-plan`, `v4.18.0-followups`, `architecture-required-fixes`, `performance-and-load`, `v4.11-followups`, `v4.16-handover`, and the five `UI/*.txt` change-request specs (all now deleted). It is self-contained; no external doc references remain.

Order: **(0)** must-do prod ops → **(1)** v4.18.0 follow-ups → **(2)** housekeeping → **(3)** near-term backlog → **(4) LATER IMPLEMENTATION** → **(5)** open product question → **(6)** pending UI features → **(7)** load-bearing patterns (reference).

---

## 0. v4.18.0 post-release prod ops — SUPERVISED, NOT YET RUN

Deploy the v4.18.0 schema + data fixes to **production** (Sydney prod: `aws-1-ap-southeast-2.pooler.supabase.com`). NOT run from the dev session because `.env.local` lacks `PII_ENCRYPTION_KEY` (only `PII_HASH_PEPPER`); both data scripts fail closed without it, and `rehash` would corrupt every `phoneHash` if run with a mismatched key. Run in the real ops env, recording before/after counts:

```bash
cd packages/db && npx prisma db push          # additive index diff; run PLAIN — self-aborts on destructive diffs (AGENTS.md §4)
PII_ENCRYPTION_KEY=… PII_HASH_PEPPER=… DATABASE_URL=… npx tsx packages/db/scripts/repair-marketplace-customer-pii.ts
PII_ENCRYPTION_KEY=… PII_HASH_PEPPER=… DATABASE_URL=… npx tsx packages/db/scripts/rehash-customer-phones.ts
```
No RLS SQL needed (no new tables; `rls:check` confirms).

---

## 1. v4.18.0 follow-ups

- **1.1 Stabilize the marketplace cross-org E2E (`test.fixme`).** `apps/web/e2e/marketplace.cross-org.spec.ts` was silently skipped until P4-1 surfaced it. It **passes the P1-1 inquiry step** (PII encryption works) but **hangs in the seller's convert→settlement flow**: `clickVisible(/تحويل لصفقة|Convert to Deal/)` never resolves though the label matches the real button exactly (`my-listings/page.tsx:483`) — a loading/timing issue in the incoming-inquiry `DataTable`. Fix: run the two-org flow interactively, replace the fixed `waitForTimeout` with `await expect(seller.getByText(/Convert to Deal/)).toBeVisible()` (or scroll the inquiries section in), then remove `test.fixme`. Project already has a 180s budget; `marketplace.mylistings-link.spec.ts` passes.
- **1.2 Native review of 5 inferred Arabic marketplace-status strings** (`apps/web/lib/domain-labels.ts`): `UNDER_CONTRACT → تحت العقد` · `SOLD_TRANSFERRED → مُنقَّل` · `UNPUBLISHED → غير منشور` · `REJECTED → مرفوض` · `SUSPENDED → موقوف`.
- **1.3 Two pre-existing server logs** seen during the marketplace CI run (not v4.18.0 regressions): `[WebServer] unexpected export *` (no literal `export *` in `apps/web/app|lib` — likely a barrel/dep; confirm not a malformed server-action surface); `Error: Your organization already has an active subscription` (incidental — the marketplace test only creates a unit fixture; billing seed / another spec emits it).

---

## 2. Repo housekeeping (status)

- **Done in this cleanup:** removed audit artifacts (screenshots, QA HTML reports, slop study, UI/UX PDFs, v4.11 status/verified-audit), old `verification-v4.15.1/`, Zone.Identifier junk + stray `git`/`gitignore`, the shipped `v4.18.0-plan.md` + `v4.18.0-followups.md` + the 4 future-plans detail docs + the 5 `UI/*.txt` specs (folded here), and the `Individual data Absher.json` PII file.
- **Kept, untracked, worth committing if wanted:** `future-plans/REMAINING-WORK.md` (this file — committed), `UI/mimaric_v4.11_design_direction.md` (cited by AGENTS.md §6.8 — KEEP), `env.example`, `docs/`, `user-guides/`, `FUTURE_PLANS.md`.
- **Decide deliberately:** `packages/db/prisma/migrations/` **contradicts AGENTS.md §4** (this repo has NO migration history; uses `db push`) — delete it, or do the full CI conversion to `prisma migrate` in one change. `CI-CD-Pipeline-Proposal/` is a study (AGENTS.md "Do NOT touch") — keep ignored or commit as a labeled study. `scripts/capture-v4151.mjs` is an old one-off capture script — delete or fold into the F9 capture library (§3).
- **Trivial:** delete stale remote branch `v4.16.1-permission-forbidden` (`git push origin --delete v4.16.1-permission-forbidden`).

---

## 3. Near-term backlog (opportunistic)

### 3.1 True HTTP-403 contract (blocked on nothing now — F4 seam shipped)
`getTenantPageAccess()` returns HTTP **200** even on denial (streaming SSR commits status before the denial renders). Next's `forbidden()`/`authInterrupts` was **tried and rejected** — crashes on client hydration inside the LanguageProvider/ConsentProvider stack; do NOT re-attempt without a hydration fix. Build an **edge-runtime 403 middleware** off the now-shipped `lib/route-guards.ts` (`ROUTE_GUARDS`) + the `ActionResult<T>` / `ok`/`fail` helpers (`lib/action-result.ts`, shipped v4.17.0). Resolve the pre-existing `"User has no organization"` throw in `lib/auth-helpers.ts` (fires when a system user transiently touches a shared dashboard surface) in the same change.

### 3.2 Registration verification layer (A5 remainder — rate-limiting shipped, verification didn't)
Email verification before activation + `PENDING_VERIFICATION` org quarantine + auto-expiry of unverified orgs (7–14d cron) + optional Cloudflare Turnstile (PDPL-friendlier than reCAPTCHA — no tracking cookies). Refs: OWASP Authentication + Email-Verification cheat sheets; Auth0 `email_verified` gating. Schema change → §4 RLS contract applies.

### 3.3 Ciphertext envelope + DB CHECK constraint
Versioned prefix on encrypted values + a `CHECK` validating it (the only layer that would have caught the P1-1 plaintext leak at write time). Requires a format migration of all encrypted columns; revisit with the next PII schema work.

### 3.4 F8 — RSC page+View migration (ongoing)
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

### 3.7 axe baseline closeout (two rules in `KNOWN_BASELINE_RULES`, `e2e/accessibility.admin.spec.ts`)
1. **`color-contrast`** — success badge (`bg-success/10 text-success`) is 4.28:1 (< 4.5:1 AA). Darken the badge text or lift the bg; verify the `--secondary` dark-mode HSL before touching the light token. 2. **`aria-allowed-attr`** — a Radix `asChild` trigger renders a `<span>` with `aria-expanded`; make the `asChild` target a `<button>`. Remove both from the baseline, then per-route axe scan the radial nav + all 8 RSC dashboards.

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

### 6.1 Theme toggle button
Pill toggle (`w-16 h-8` rounded-full, Sun+Moon icons, active icon in a sliding filled circle) → `packages/ui/src/components/ThemeToggle.tsx`. Wire to `next-themes` `useTheme()` (`resolvedTheme`/`setTheme`), not local state. Neutral shell colors (dark `bg-zinc-950 border-zinc-800` / light `bg-white border-zinc-200`) — deliberately NOT Mimaric Purple. Dynamic bilingual `aria-label` ("Switch to dark/light mode" / "التحويل إلى الوضع الداكن/الفاتح"), `role="switch"` + `aria-checked` (prefer the shared `<Switch>` primitive, §6.6.8), 44px target, RTL-safe slide direction (logical, leading=active). Place in desktop top nav + optionally settings. Keyboard-operable; no flash on toggle; persists across nav.

### 6.2 Date picker — system-wide replacement
Replace EVERY date / date-range picker with a stack on `react-aria-components` + `@internationalized/date`, all in `packages/ui/src/components/`: `date-range-picker.tsx` (`DatePicker`/`DateRangePicker`/`JollyDatePicker`/`JollyDateRangePicker`), `calendar.tsx` (`Calendar`/`RangeCalendar`/`CalendarHeading`… — `CalendarHeading` already flips chevrons via `useLocale()`, **preserve**), `datefield.tsx`, `field.tsx`, and a `react-aria`-based `popover.tsx` that must **coexist** with the existing Radix `Popover` (do not shadow/rename it). Deps: `react-aria-components`, `@internationalized/date`. **Mimaric musts:** RTL chevron flip; **Hijri toggle** (`calendar="islamic"` / `showHijriToggle`) wired to the per-user pref (AGENTS.md §6.15.3, `lib/hijri.ts`) — don't break the existing `saudi/HijriDatePicker`; migrate the dashboard range picker (`lib/use-date-range-query.ts` + `lib/dashboard-range.ts`) to `JollyDateRangePicker` without changing the query-string interface; tabular-nums on segments; 44px cells/nav; label-above + `--ring` focus to match Saudi input primitives. **Acceptance:** all date inputs migrated (none left on the old impl); RTL chevrons; Hijri toggle persists; 4-theme pass on a form date field + dashboard range header + contracts page.

### 6.3 Notification center (popover + category filter)
Bell trigger in top nav with unread-count `<Badge>` (hidden at 0) → `packages/ui/src/components/NotificationsFilter.tsx`. 320px popover (`side="bottom"`, `align` end-LTR/start-RTL). Header "Notifications" + `<Filter>` icon; category pills **All/Updates/Alerts/Reminders** (الكل/التحديثات/التنبيهات/التذكيرات) — active=`primary`, inactive=`subtle`, `size="sm"`, `rounded-full`, `aria-pressed` (§6.6.8). Scrollable list (`max-h-80`), rows = category icon (`updates→Info`, `alerts→AlertCircle`, `reminders→Calendar`) + bold title + muted desc + relative time, hover `bg-muted/50`. Empty-filtered: "No notifications in this category / لا توجد إشعارات في هذه الفئة" + Clear-filter (§6.12). **Wire to the real `Notification` DB model** (re-fetch on open; unread count = unread only). Add **mark-as-read** on row click (server action + optimistic, decrements badge) and **mark-all-read** in the header. RTL: badge `inset-inline-end`; `--popover` token (no hardcoded bg). **Acceptance:** correct badge count; filter updates immediately; read marking works; 4-theme popover-open screenshots.

### 6.4 System alert banners (compound `Alert` redesign)
Rebuild `packages/ui/src/components/Alert.tsx` as a compound component (named exports `Alert`/`AlertContent`/`AlertTitle`/`AlertDescription`/`AlertIcon`/`AlertToolbar`). Variants `secondary|primary|destructive|success|info|warning|mono` × appearances `solid|outline|light|stroke` × sizes `sm|md|lg`; `close` prop → `<IconButton icon={X} aria-label="Dismiss" variant="ghost">` firing `onClose` (caller owns visibility). **Map appearances to Mimaric HSL tokens, NOT the spec's `color-mix()`/`oklch()`:** `solid success`→`bg-secondary` (Circuit Green), `solid info`→`bg-info`, etc.; `light`→`bg-<v>/10 border-<v>/20 text-foreground` with `[data-slot=alert-icon]:text-<v>`. Add/verify tokens in `globals.css`: `--info: 210 65% 50%`, `--info-foreground`, `--warning-foreground`. Map to §6.11.2 banner taxonomy (Info/Success/Warning/Error/Promotional); page banner=`lg`, section=`md`, inline=`sm`; ≤2 stacked (collapse-to-count). RTL: `×` on inline-end, icon on inline-start. Audit + migrate existing shadcn `Alert` usages (`grep -r "from.*alert" apps/web --include="*.tsx"`) — no second button impl. **Acceptance:** all 7×4 combos render light+dark; dismiss works; usages migrated; 4-theme variant-demo screenshot.

### 6.5 Navigation — radial `CircleMenu` (two-level hub-and-spoke)
**Recorded decision (locked 2026-06-09; never built — re-confirm before starting, it's a large change):** the radial CircleMenu **fully replaces** the sidebar (desktop) **and** the mobile BottomNav; the **cmdk command palette is the mandatory WCAG keyboard/SR twin** (cmdk already installed). Research caveat (NN/G, Hopkins pie-menu studies): radial beats linear on Fitts's-law speed but loses the gain if unfamiliar and breaks past ~8 items — Mimaric has ~45, so the design must get 45 items through an 8-slot door.

**The design that makes it work — two-level hub-and-spoke:** 6 category spokes → each expands to ≤8 children (one nesting level max, never a flat 45-wheel). A new `radialGroup` field on `nav-items.ts` maps the real nav into 6 groups (Dashboard, Properties, CRM & Contracts, Finance, Operations, System) — one source of truth, same audience filter (§8.3 preserved). **Build cmdk first** (grouped, audience-filtered, via a shared `filterNavItems()` helper) as the accessible source-of-truth model; the radial is the visual layer on top of an already-accessible path.

**Component** `packages/ui/src/components/CircleMenu.tsx`: 48px pill trigger (animated `Menu`↔`X` blur, `framer-motion` `AnimatePresence`) fanning 46px item buttons onto a circle (radius 125px, spring `stiffness 300/damping 30`, open stagger 0.02s; close = sequential scale-pulse "collection" + −360° rotate + blur, stagger 0.07s). Items = `<a href>` from the navItem (icon + `t(ar,en)` label).
- **A11y:** `role=menu/menuitem`, roving tabindex, focus trap + return-to-trigger, Escape laddering, `aria-current`, per-item `aria-label` (icon-only), **`prefers-reduced-motion` → instant positions (no spring)**, 44×44 wedge targets.
- **RTL:** mirror the angular layout (leading-edge first), flip arrow-key mapping; never mirror clocks/media/logos; numbers stay LTR.
- **Mobile:** 180° bottom-anchored half-wheel (not 360°, avoids thumb occlusion) + first-run coach-mark.
- **Tech:** `framer-motion` via `LazyMotion` + `domAnimation` (~5KB), lazy-loaded chunk; layout math framework-agnostic so it renders without motion.
- **Safety-net caveat (UI-First §3.1 + WCAG §6.17):** removing ALL linear nav is the one residual risk — strongly consider keeping cmdk + a slim collapsible sidebar as the always-available fallback even though the locked decision says "fully replaces." Resolve this (full replace vs radial-primary + slim safety-net) before shipping.

**Acceptance:** cmdk palette ships first and is fully keyboard/SR navigable; radial animates correctly with live role/audience-filtered items via `radialGroup`; bilingual labels; reduced-motion = instant; mobile 180° half-wheel; 4-theme screenshots desktop + mobile (375px).

---

## 7. Load-bearing engineering patterns (reference — do not unknowingly override)

- **`getTenantPageAccess()` + inline `<AccessDenied>` is the stable permission-denial pattern.** `forbidden()`/`authInterrupts` was tried and rejected (hydration crash in the provider-wrapped layout) — don't re-attempt without a hydration fix.
- **Finance dashboard is the canonical RSC reference** (`finance/page.tsx` + `FinanceView.tsx` + `lib/dashboard-range.ts`) — copy it for F8 conversions.
- **Consent = block-until-consent.** Do NOT switch to Consent Mode v2 (fires cookieless pings pre-consent); keep all `ad_*` denied.
- **E2E overlays must be suppressed in storageState** — any new always-on overlay must be handled in `e2e/consent-helper.ts` or it breaks bottom-anchored interactions.
- **CI badge ≠ CI pass.** `gh run watch --exit-status` returned 0 on a run with a failed step in this very project — always `gh run view --job <id>` (or `gh pr checks`) for per-step conclusions before merging/tagging.

---

*When an item ships, strike it here and note the version. This file is the only surviving record of the deleted planning + UI-spec docs.*
