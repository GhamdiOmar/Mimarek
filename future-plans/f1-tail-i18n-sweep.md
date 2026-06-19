# F1-tail — i18n ternary sweep (deferred dedicated sprint)

> **Status: PLANNED, deferred.** On 2026-06-19 (post-v4.33.6) Omar promoted F1-tail from "on-touch-only"
> to a **dedicated multi-PR sweep**, then deferred execution to a future session. This doc captures the
> scope + the safety constraints so it can be picked up cleanly. A classification pass (read-only Explore)
> was the next step when it was deferred.

## Goal
Convert the remaining **~649** inline `lang === "ar" ? "<ar>" : "<en>"` ternaries in `apps/web`
(across ~67 files) to the `t()` facade — but ONLY the true display-copy subset. The v4.32.0 "F1"
codemod already converted 1,834; these ~649 are the harder tail it deliberately skipped.

## What is CONVERTIBLE (all must hold)
- Both branches are plain STRING LITERALS that are user-facing DISPLAY COPY (e.g. `lang === "ar" ? "حفظ" : "Save"`).
- NOT a control value: skip `"rtl"/"ltr"`, `"right"/"left"`, locale codes `"ar-SA"/"en-US"` / `"ar"/"en"`, className toggles, `dir=`/`locale=` props.
- The file HAS a usable `t()` facade (from `useLanguage()` or a local `const t`).
- Neither branch is interpolation / JSX / a template with expressions.

## NON-convertible (leave, documented)
Control values; non-literal branches; files with NO `t` facade; the i18n plumbing (`lib/i18n.ts`,
`lib/format-number.ts`, `components/LanguageProvider.tsx`); the e2e spec (`e2e/marketplace.cross-org.spec.ts`);
SSR/server files without a client `t`.

## ⚠️ CRITICAL safety — facade argument ORDER (swap risk)
The `t()` facade order VARIES per file: most are `t(ar, en)` (Arabic-first), but some — notably the
**marketplace files** (`admin/marketplace/page.tsx`; verify `my-listings/page.tsx`, which has 64 ternaries)
— use a REVERSED `t(en, ar)` English-first facade. **A wrong-order conversion silently SWAPS the
languages** (Arabic surface shows English copy and vice-versa). Before converting a file, READ its `t`
facade definition and use the matching order. v4.32.0's codemod was shadow-guarded (zero swaps); the tail
needs the same rigor **plus a §3.9 swap-verification** (render each touched route in AR + EN and confirm
the copy is in the correct language, not just "no console errors").

## Scale / high-count files (raw counts — convertible subset is a fraction)
CustomerDrawer 88, my-listings 64 (reversed-facade — verify!), AddCustomerModal 47, billing/invoices 42,
LoginClient 24, register 21, settings/team 19, billing/page 18, admin/coupons 18, admin/subscriptions 17,
reset-password 17, invite 15, billing/plans 14, verify-email 13, data-retention 12, + an ~11-count cluster
(KanbanCard, ContractsView, ReservationsView, PaymentsView, admin/plans). Many counts are
control-values/non-literal; the genuinely-convertible total needs the classification pass.

## Recommended approach
1. **Classify first** (read-only): per-file, count convertible-display-copy vs control-value/non-literal,
   and map each file's `t` facade ORDER.
2. **Codemod** (preferred, matches v4.32.0): a ts-morph codemod matching `lang==="ar" ? <lit> : <lit>`
   where both are string literals AND not a control-value code, that reads the file's facade order and
   emits `t(...)` in the right order — with a shadow-guard asserting rendered output is unchanged. OR
   batched per-file agents with EXPLICIT per-file facade-order instructions + central validation.
3. **Ship in reviewable PRs** grouped by area (auth / CRM / billing / admin / dashboard-views), each
   through `/mimaric-qa` + the §3.9 AR+EN swap-verification + the §7 release ritual.

## Priority / effort
P3 cosmetic — no functional impact (the ternaries already render correctly today; this is a
maintainability / consistency cleanup). **Effort: L (multi-PR, likely multi-session).**
