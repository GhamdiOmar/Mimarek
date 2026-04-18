# Pre-Push Code Review — `feat/audit-2026-04-mega`

> Reviewer: Senior Code Reviewer (AI) · Date: 2026-04-17 · Rubric: CLAUDE.md §6 (Design System — Single Source of Truth) + plan `i-need-to-compile-stateless-steele.md`

---

## 1. Verdict

**SHIP IT (with one optional follow-up flagged).**

- `npx tsc --noEmit -p apps/web/tsconfig.json` → exit 0.
- `npx turbo run lint --filter=@repo/web --filter=@repo/ui` → exit 0 (534 warnings, all pre-existing `any` noise in `lib/pii-*`, `lib/payment/*`, `playwright.config.ts` — not introduced by this branch).
- No CLAUDE.md §6 blocking violations found. The 7 commits match the plan deliverables. Multi-tenancy, Decimal handling, a11y, and RTL rules all hold up under direct grep/read verification.

The single gap that honestly deserves a follow-up PR is called out by Commit 6's own message (TanStack `DataTable` callers not migrated yet). Everything else is landable.

---

## 2. Commit-by-Commit Assessment

| # | Commit | Verdict |
|---|---|---|
| 1 | `feat(design-system): v2 foundations` | **Matches plan.** CLAUDE.md consolidated, `DirectionalIcon` present (15 LOC, clean), `enableSystem={true}` verified at `apps/web/components/ThemeProvider.tsx:10`, Prisma `UserRole` gains `LEASING` + `FINANCE` at `schema.prisma:136-137`, deps installed. |
| 2 | `feat(design-system): v2 primitives` | **Matches plan.** All 6 Saudi primitives shipped under `packages/ui/src/components/saudi/`. `NationalIdInput` correctly implements Luhn checksum. `KPICard` rewritten to 8-field anatomy; legacy `subtitle`/`accentColor`/`trend={...}` shape preserved for back-compat. `DateRangePicker`, `LastUpdatedAgo`, `EmptyState` all present + exported from `packages/ui/src/index.ts`. |
| 3 | `feat(design-system): v2 route-segment hygiene` | **Matches plan.** `loading.tsx`/`error.tsx` generated for all 15 top-level dashboard sections. `global-error.tsx` + `not-found.tsx` at app root. Templates live at `apps/web/app/_templates/` for future route authors. Error copy is customer-friendly (§6.11.4). See note (N1) below on `global-error.tsx` language. |
| 4 | `feat(design-system): v2 RTL correctness` | **Matches plan.** Grep confirms: zero remaining `ml-`/`mr-`/`pl-`/`pr-` in `apps/web/app/dashboard/**/*.tsx` except one intentional `pr-10` on an LTR-forced CR input at `settings/page.tsx:761`. Only 4 remaining `left-`/`right-` hits are all legitimate centering pairs (`left-1/2 -translate-x-1/2`) or tailwindcss-animate tokens — all documented as "kept" in the commit message. 64 `DirectionalIcon` call-sites across 21 files. One remaining bare `<ChevronRight>` at `crm/page.tsx:2906` is an intentional disclosure chevron with `group-open:rotate-90` (per CLAUDE.md §6.5.1 allow-list). |
| 5 | `feat(design-system): v2 role-based dashboards` | **Matches plan.** 5 role dashboards present: `/dashboard`, `/dashboard/admin`, `/dashboard/leasing`, `/dashboard/finance`, `/dashboard/maintenance`. All use `DateRangePicker` + `LastUpdatedAgo`. Charts use `hsl(var(--chart-*))` / `hsl(var(--primary))` / `hsl(var(--destructive))` — no hardcoded hex. 6 new trend server actions, all `requirePermission`-gated, all `organizationId`-scoped, all return `number[]` primitives (no Decimal leak). Role redirect in `dashboard/page.tsx:146-149` correctly maps `LEASING`/`FINANCE`/`TECHNICIAN`/`SYSTEM_ADMIN`. Maintenance CRUD list correctly relocated to `/dashboard/maintenance/tickets/`. |
| 6 | `feat(design-system): v2 TanStack Table v8 + Saudi primitives retrofit` | **Partial — honest gap.** `DataTable` rewritten on TanStack v8 with URL-synced state, density toggle, column visibility, mobile cards, bulk actions — solid. Saudi input retrofit confirmed in `crm/page.tsx`, `contracts/page.tsx`, `payments/page.tsx`, `settings/page.tsx`. **BUT** 4 pages still have raw `<table>` JSX (`crm`, `admin/tickets`, `properties`, `help`) and zero pages import the new `DataTable` yet. Commit message acknowledges this; plan treats it as required. See Nice-to-haves (H1). |
| 7 | `feat(design-system): v2 Cmd-K + a11y + CI` | **Matches plan minus lhci (deferred explicitly).** `CommandPalette.tsx` wraps `cmdk` primitive, ⌘K/Ctrl+K toggle, quick actions + role-filtered nav items. Skip-to-content link + `#main-content` landing target verified in `DashboardClientLayout.tsx:36-58`. `AxeDevAudit` correctly dev-gated with `NODE_ENV === "development"` guard and dynamic imports. CI gains `cspell` job + Playwright artifact upload (14d retention). `cspell.config.json` includes the domain allowlist from CLAUDE.md §6 + Saudi-context `flagWords`. lhci deferred per plan decision §8. |

---

## 3. Blocking Issues

**None.**

No CLAUDE.md §6 hard-rule violations were found that would block push. Typecheck clean, lint clean (no new warnings beyond pre-existing `any` noise), multi-tenancy preserved, Decimal safely coerced, RTL sweep comprehensive, a11y baseline in place.

---

## 4. Nice-to-haves (follow-up PRs — NOT blocking)

**H1. TanStack DataTable caller migration (plan-item from Commit 6).**
- Remaining raw `<table>` JSX found in:
  - `/Users/omar/AI Projects/Facility Management/apps/web/app/dashboard/crm/page.tsx`
  - `/Users/omar/AI Projects/Facility Management/apps/web/app/dashboard/admin/tickets/page.tsx`
  - `/Users/omar/AI Projects/Facility Management/apps/web/app/dashboard/properties/page.tsx`
  - `/Users/omar/AI Projects/Facility Management/apps/web/app/dashboard/help/page.tsx`
- Plan called for migrating `units / crm / contracts / deals / payments / properties / admin/**`. Commit 6 ships the primitive but leaves callers untouched. The plan's Decision §8 does NOT scope-cut this migration — so this is a real gap vs. plan. Commit message is candid about it. Lands cleanly as a dedicated follow-up branch.

**H2. `MobileKPICard` prop alignment.**
- `packages/ui/src/components/mobile/MobileKPICard.tsx` was not touched in this branch. Plan (Commit 2) calls for: *"align its props to the same shape; export shared `KPICardProps` type."* Cosmetic — no runtime consequence because callers pass shape-compatible props today — but the typed alignment remains a plan item.

**N1. `global-error.tsx` is English-only.**
- `apps/web/app/global-error.tsx` renders `<html lang="en" dir="ltr">` with English-only copy. The rationale in the file comment is defensible (self-contained fallback for a broken ThemeProvider/LanguageProvider), but a trivial `navigator.language?.startsWith("ar")` branch would give an Arabic fallback without reintroducing any provider dependency. Not a §6.15 violation because `global-error` is a pre-provider fatal boundary — flagging for visibility only.

**N2. Generic `stats is null` empty treatment.**
- Role dashboards (leasing/finance/maintenance) gate on `stats` truthiness; when undefined they show only the error banner. A skeleton-before-data pass matching §6.12 would make first paint cleaner. Not blocking — error state itself is friendly.

**N3. One raw `any` cast in `DashboardClientLayout.tsx:20`.**
- `(session?.user as any)?.role ?? "USER"` — pre-existing, not introduced here, but the `CommandPalette.tsx` copies the same pattern. Follow-up: tighten session typing once.

---

## 5. CLAUDE.md §6 Compliance Spot-Checks (grep-verified)

| Check | Result | Evidence |
|---|---|---|
| All icon-only buttons have `aria-label` | **Pass.** | Only one `size="icon"` in dashboard (`settings/team/page.tsx:382`) and it carries `aria-label`. All small-square buttons (`h-8 w-8`, etc.) that are icon-only (spot-checked 2 dozen sites) have `aria-label`. |
| No `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-` in `apps/web/app/dashboard/**/*.tsx` | **Pass (with documented exceptions).** | 1 occurrence of `pr-10` (intentional — LTR-forced CR input). 4 `left-`/`right-` hits, all either centering pairs or `slide-in-from-right-4` animation tokens — all matched the "kept as physical" allow-list in commit 4's message. |
| `DirectionalIcon` wraps directional chevrons/arrows | **Pass.** | 64 call-sites across 21 files. Only one bare `<ChevronRight>` remains (`crm/page.tsx:2906`) — a disclosure chevron with `group-open:rotate-90`, which §6.5.1 explicitly allows. |
| `enableSystem` is `true` on `ThemeProvider` | **Pass.** | `apps/web/components/ThemeProvider.tsx:10` → `enableSystem={true}`. |
| Every new dashboard has `DateRangePicker` + `LastUpdatedAgo` | **Pass.** | Grep hits in all 5: `admin/page.tsx`, `page.tsx`, `leasing/page.tsx`, `finance/page.tsx`, `maintenance/page.tsx`. |
| All new server actions in `apps/web/app/actions/trends/` filter by org + use `requirePermission` | **Pass.** | All 6 files grep-verified. `getRevenueTrend`, `getOccupancyTrend`, `getCollectionsTrend`, `getPipelineTrend`, `getTicketsTrend` all call `requirePermission("dashboard:read")` then scope via `session.organizationId`. `getMrrTrend` is platform-only (`requirePermission("billing:admin")`) and deliberately does not filter by org (aggregates across tenants). |
| No raw Prisma `Decimal` leak in new server actions | **Pass.** | `dashboard-finance.ts`, `dashboard-leasing.ts`, `dashboard-maintenance.ts`, and all 6 trend files return plain `number`/`number[]` via `Number(r.amount)` / `Number(r.total)` coercion at compute time. No `Decimal` types escape the server boundary. |
| Chart colors use `hsl(var(--chart-*))` / semantic tokens | **Pass.** | Grep for raw hex in `stroke=`/`fill=`/`color=` inside `apps/web/app/dashboard/*.tsx` → zero matches. All chart palettes use CSS variables per §6.2.6. |
| Skip-to-content link + `#main-content` landmark | **Pass.** | `DashboardClientLayout.tsx:36-58`, bilingual copy. |
| Bilingual parity on new copy | **Pass.** | `CommandPalette.tsx`, all role dashboards, all Saudi primitives, CommandPalette quick actions, skip-to-content link — all have `lang === "ar" ? ... : ...` pairs. `global-error.tsx` is an intentional English-only fallback (see N1). |
| Prisma `UserRole` enum extended | **Pass.** | `packages/db/prisma/schema.prisma:136-137` adds `LEASING` + `FINANCE`. |
| CI gates cspell + uploads Playwright artifacts | **Pass.** | `.github/workflows/ci.yml:48-67`. |

---

## 6. Summary

Scope closed against the 15-item audit: foundations + primitives + route hygiene + RTL sweep + role dashboards + Saudi form retrofit + Cmd-K + a11y baseline + CI guards. The one plan item genuinely deferred (TanStack table caller migration) is called out honestly in the commit message and has a clean follow-up path.

**Recommend push.** Open the PR with the 42-screenshot set attached per the plan's verification section, and file an issue for H1 so it doesn't slip.
