# `t()` Migration — Deferred Tail (v4.30 best-effort)

> **Decision (2026-06-16, Omar):** "Marketplace P3 first, t() best-effort." The full
> `t()` migration is **zero-user-value churn** (the app already renders both languages
> correctly via inline `lang === "ar" ? … : …` ternaries) with real per-string
> regression risk. So v4.30 ships a **bounded best-effort** demonstration and logs the
> rest here rather than risk a 2,200-string big-bang (which §3.8 forbids anyway).

## What shipped in v4.30
- **`apps/web/app/dashboard/DashboardView.tsx`** — 26 simple string-literal ternaries
  → `t("ar","en")` (the `LanguageProvider` Arabic-first helper). 10 occurrences
  correctly left (helper-scoped `lang` param, `Intl`/locale args, a `useMemo`
  fallback, a nested non-flat ternary).

## The pattern (for whoever resumes this)
- Helper: `const { lang, t } = useLanguage()`; `t(ar, en)` returns the active-language
  string (Arabic FIRST).
- Convert ONLY `lang === "ar" ? "<arabic>" : "<english>"` where **both branches are
  user-facing string (or string-template) literals** → `t("<arabic>", "<english>")`.
- **NEVER convert** ternaries where a branch is JSX / a variable / a number / null, or
  that feed `dir` / `locale` / `calendar` / `className` / `Intl` / a CSS value, or a
  bare `lang === "ar"` boolean guard. Under-converting is correct; a wrong conversion
  is a rendered-copy bug.
- Per-route batches (§3.8 — never one mega-commit); `npm run check-types` + a 4-theme
  render per batch.

## Deferred tail — approximate `lang === "ar" ?` ternary counts by highest-traffic route
| Route | count |
|---|---|
| `contracts/ContractsView.tsx` | ~157 |
| `units/UnitsView.tsx` | ~116 |
| `reservations/ReservationsView.tsx` | ~98 |
| `crm/CrmView.tsx` (+ `AddCustomerModal`, `CustomerDrawer`) | ~65 |
| `payments/PaymentsView.tsx` | ~65 |
| `DashboardView.tsx` | **done (26 of 36)** |
| …remainder across ~70 other files | balance of ~2,230 repo-wide |

**Status:** ~26 of ~2,230 migrated. The rest is deliberately deferred — a standalone
maintainability sweep, to be done per-route with full verification when prioritized
over user-facing work. Not a release blocker for v4.30.
