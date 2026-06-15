# Mimaric CX-Audit Remediation — Developer Handover

> **Date:** 2026-06-14 · **Revised:** 2026-06-15 against `main` v4.26.0 (`100547e`) · **Author:** Omar Al-Ghamdi (sole author) · **Audience:** the next developer picking up the CX-audit remediation.
> This document is self-contained — you do **not** need the original auditor's local files (the audit HTML and the working plan live in gitignored/local paths; their substance is reproduced here).

---

## 1. What this is

A CX audit of Mimaric (build v4.19.0) scored the product **63/100** — well-architected and design-system-driven, but with functional gaps a buyer feels immediately (search, latency, error hygiene, instrumentation). It produced **22 findings (CX-001 … CX-022)**. This handover tracks remediation: what shipped, what remains, the exact plan for each remaining item, the reusable assets already in place, and the hard rules + gotchas you must respect.

**Source artifacts (regenerate/locate if needed):**
- Audit report: `verification/Mimaric-CX-Audit.html` (gitignored — local only; open in a browser → Print-to-PDF). The `verification/` folder also holds the capture/verify scripts and screenshots.
- The auditor's working plan: `~/.claude/plans/you-are-in-plan-delightful-patterson.md` (local only — its content is reproduced in §4 below).
- Live dev/design SSOT: **`AGENTS.md`** (repo root) — §3 (dev rules), §4 (schema/RLS), §6 (design system), §7 (release), §8 (access model). Read it before touching code.
- Changelog: `CHANGELOG.md` (top = latest release).

---

## 2. Status snapshot

- **Branch/main:** all shipped work is on `main`. Latest tag **v4.26.0** (merge `100547e`). Releases live on GitHub.
- **Shipped:** v4.19.1 → v4.26.0 (8 releases). **All 22 findings addressed.** CX-003 pt2 was found already done (CrmView is already RSC-seeded — no waterfall); CX-017's a11y *gate* is expanded to all routes × tenant+system.
- **Polish tail → v4.27 (not findings, but the remaining quality work):** CX-006 CRM add-customer form RHF; CX-017 Lighthouse CI; and the **actual a11y-debt fixes** the expanded axe gate baselined — `color-contrast` (the ~5 non-success-badge instances), `select-name` (QA-FE-03 native selects → governed `Select`), `label` (QA-FE-01 → governed `Field`).

### Findings status (all 22)

| Finding | Sev | Status | Where |
|---|---|---|---|
| CX-001 admin 500-on-load | Critical | ✅ shipped | v4.19.1 |
| CX-002 federated record search | Critical | ✅ shipped | v4.23 |
| CX-003 DB latency / RSC | High | ✅ shipped | pt1 v4.25 (5 pages RSC); **pt2 CrmView verified already RSC-seeded in v4.26** (no waterfall — decomposition not needed); raw-latency DB move is out-of-scope ops |
| CX-004 analytics (GA4) | High | ✅ shipped | v4.21 |
| CX-005 non-blocking consent | High | ✅ shipped | v4.21 |
| CX-006 inline form validation | High | 🟡 partial | v4.22 (reservations+contracts done; **CRM add-customer form RHF → v4.27**) |
| CX-007 unsaved-changes guard | High | ✅ shipped | v4.22 |
| CX-008 SAR input locale + adoption | Med | ✅ shipped | v4.22 |
| CX-009 join-request dead-end | Med | ✅ shipped | v4.22 |
| CX-010 bulk ops + CSV import | Med | ✅ shipped | v4.24 |
| CX-011 DRAFT contract edit | Med | ✅ shipped | v4.24 |
| CX-012 error sanitizer | Med | ✅ shipped | v4.21 |
| CX-013 ConfirmDialog adoption + guard | Med | ✅ shipped | v4.21 |
| CX-014 DataTable saved views/reorder/export | Med | ✅ shipped | v4.23 |
| CX-015 Help in nav | Med | ✅ shipped | v4.23 |
| CX-016 success-badge contrast | Med | ✅ shipped | v4.20 |
| CX-017 a11y CI (axe all routes + Lighthouse) | Med | 🟡 gate shipped | **v4.26** — axe expanded to all routes × tenant+system; a11y debt (color-contrast/select-name/label) baselined for QA-FE-01/03 fixes; **Lighthouse CI → v4.27** |
| CX-018 buyer/USER portal landing | Med | ✅ shipped | v4.25 |
| CX-019 Western numerals | Low | ✅ shipped | v4.20 |
| CX-020 Kanban name truncation | Low | ✅ shipped | v4.20 |
| CX-021 single-click sign confirm | Low | ✅ shipped | v4.21 |
| CX-022 mobile 44px tap targets | Low | ✅ shipped | v4.20 |

---

## 3. ✅ ROADMAP GAPS — RESOLVED in v4.23.0

The two findings that were absent from every planned bundle shipped in **v4.23.0** (2026-06-14, PR #29, merge `71f9e5e`), bundled with CX-014 at full-federated scope (Omar's call).

### CX-002 — Federated record search (Critical) — ✅ SHIPPED v4.23.0
- `globalSearch` (`apps/web/app/actions/search.ts`) rewritten plaintext-3-entity → **7-entity** (customers/units/contracts/reservations/payments/maintenance/documents). Customers via blind index (ported `getCustomers` OR-query — `phoneSearchHash`/`hashForSearch`/`nameArabic`/`emailHash`/`nationalIdHash`); results **masked** (`***NNNN`; raw never in the payload — note the real token is `***`+last4, NOT `******`), per-entity permission-gated, §8-scoped (empty for system/no-org via `getSessionOrThrow`), audit-logged.
- Shared `hooks/useFederatedSearch.ts` + `lib/search-entity-meta.ts` + `lib/search-types.ts`. **Cmd-K now searches records**; the top-bar dropdown + mobile sheet upgraded in place via the shared hook. **Correction to the original note:** the desktop top-bar *already* had a (plaintext) search wired to `globalSearch` — CX-002 was a server-action upgrade, not "no desktop search at all." Cmd-K was the only net-new surface.

### CX-015 — Help discoverability (Med) — ✅ SHIPPED v4.23.0
- **Scope correction:** the live nav is the **radial `CircleMenu`** (`components/shell/radial-groups.ts`), NOT a sidebar — Help was **already** there (System hub `extras`, tenant audience) + in the profile menu. The "no nav entry" finding was measured against the obsolete `nav-items.ts`. So CX-015 reduced to: add the missing `ROUTE_GUARDS["/dashboard/help"]` (tenant; completes the F4 SSOT + makes the edge audience gate explicit) + surface Help in Cmd-K. **No `nav-items.ts` seed** (would be redundant + contradict the radial architecture).

---

## 4. The remaining roadmap (detailed)

The remaining audit findings were **bundled into tags** so each ships behind one §3.9 gate + §7 ritual. Order respects the dependency chain. Everything below is verified against current `main`.

### ✅ v4.24.0 — Bulk ops + CSV import + DRAFT contract edit (CX-010, CX-011) — SHIPPED 2026-06-14 (PR #30, merge `56d626d`)
- **CX-010 bulk:** `DataTable.bulkActions` wired on **Payments** (Mark-as-paid → `bulkMarkInstallmentsPaid`, `finance:write`), **Reservations** (bulk cancel + delete), **Contracts** (bulk send/cancel + delete, **DRAFT-only server-enforced**). Each = atomic `$transaction` + `requirePermission` + org-scope + one `logAuditEvent`; destructive bulk via `ConfirmDialog`.
- **CX-010 CSV/Excel import:** new `components/import/ImportWizard.tsx` (5-step: **Requirements → Upload → Map → Validate-preview → Import**) reachable from **Import** buttons on CRM + Units. **Step 1 is a self-documenting requirements panel** (required/optional columns, formats — Saudi phone/national-ID/unit-type enum, **5,000-row / 10 MB caps**, accepted `.csv`/`.xlsx`, bilingual `.xlsx` **Download template**). **Validate-all → all-or-nothing** in one bumped-timeout txn (`{ timeout: 120000, maxWait: 10000 }`) + opt-in **"skip bad rows"**; per-row + in-file + DB dedupe via batched blind-index hash. **Customers written ONLY via `encryptCustomerData`** (pre-encrypted `tx.customer.createMany`; `customer-import.ts` added to the PII ESLint exempt list). New actions: `customer-import.ts`, `unit-import.ts`, `import-parse.ts`.
- **CX-011 contract edit:** new `updateContract` in `app/actions/contracts.ts` — **DRAFT-only** (`if (contract.status !== "DRAFT") throw "Forbidden"` server-side + `requirePermission` + `logAuditEvent` before/after); lease-term changes **regenerate rent installments** via new module-private `buildRentInstallments` (shared by create+update). Drawer edit affordance reuses the v4.22 RHF contract form pre-filled; non-DRAFT read-only + server-blocked.
- **§3.11 /mimaric-qa QA gate — first run** (new standing rule): fixed **H1** (`bulkMarkInstallmentsPaid` raised `payments:write`→`finance:write`, closing a privilege-escalation gap vs single-row `recordPayment`) + **M2** (bilingual zod import-validation messages). ⚠️ **Pre-existing follow-up flagged:** the Payments page UI affordance gate vs server gate had a `payments:write`/`finance:write` mismatch — server fixed; the page-level UI gate inconsistency is a separate pre-existing item.
- **Verified §3.9:** build green, lint/check-types/cspell 0 errors, prod-server Playwright capture (`scripts/capture-v4240.mjs` + `verify-draftedit.mjs`) — import requirements EN + AR-RTL-dark, bulk toolbars × 3 pages, DRAFT-only edit pencil × themes; 0 console errors. Graphify refreshed (4482 nodes).

### ✅ v4.25.0 — RSC for 5 list pages (CX-003 pt1) + USER→portal (CX-018) — SHIPPED 2026-06-15 (PR #31, merge `38f8df8`)
- **CX-003 pt1 — SCOPE GREW to 5 pages** (Omar's call): **Contracts, Reservations, Payments, Marketplace, Documents** converted from `"use client"` mount-fetch god-components to Server Components — each `page.tsx` is a thin shell (`requirePermission` + server fetch via the list action → `initial*` props) and the old body moved verbatim into a client island `*View.tsx` (seeded from props, `loading=false`, only the mount `useEffect(()=>loadX(),[])` dropped; `loadX()` kept for post-mutation refresh; lazy lookups untouched). Method: `cp page.tsx XView.tsx` + 3-4 surgical edits + thin shell. **Permission parity = match the ACTION not the route guard** (reservations:read, finance:read for payments, contracts/documents/marketplace:read). **Marketplace wrinkle:** server reads `searchParams` (finance-range style) + client `didMountRef` first-run-skip (filter change refetches; mount doesn't double-fetch). Deliberately **no response caching** (stale/cross-tenant risk on tenant money data). Perceived-latency only (the Bahrain DB move is still the raw lever).
- **CX-018 — real security fix:** the `USER` role holds `dashboard:read`, which gated the Dashboard/Leasing/Finance pages → a Tenant could open the owner's KPIs by URL. `auth.config.ts` now redirects `role==="USER"` off every `/dashboard/**` → `/portal`, **before** the onboarding redirect. (No `ROUTE_GUARDS` change — `/portal` isn't under `/dashboard`; its own layout + `actions/portal.ts` already guard it.)
- **§3.11 /mimaric-qa:** GO; fixed M-1 (`getDocuments` now `serialize()`s at the RSC boundary) + L-1 (DocumentsView dead `loading`/`loadError` → real `loadDocs()` refresh).
- **§3.9 verified:** build green (5 pages emit `ƒ` dynamic), 25 screenshots / 0 console errors; probes: all render + no Decimal leak + contracts SSR-has-data (no waterfall) + CX-018 USER→/portal on every dashboard URL. (Verify gotcha: a USER must log in via `?mode=tenant`.)

### ⏳ v4.26.0 — RSC CrmView (XL, alone) + CRM-form RHF + QA gates (CX-003 pt2, CX-017, deferred CRM RHF) · risk XL
- **CX-003 pt2:** `crm/page.tsx` is already an RSC parent — eliminate `CrmView.tsx`'s (**3,756 lines**, `"use client"`) internal mount-fetch and extract client islands (Kanban, add-customer form, drawer). **Preserve PII masking** (`apps/web/lib/pii-masking.ts` `maskPhone`/`maskEmail`/`maskCustomerPii`, applied in Kanban/list/drawer) **and the CX-020 ellipsis.** Caching + optimistic mutations on the encrypt path.
- **Deferred CRM RHF:** migrate the add-customer form to RHF+zod (the v4.22 pattern) as part of the island extraction.
- **CX-017:** expand `apps/web/e2e/accessibility.admin.spec.ts` from 5 routes/admin-only → **all dashboard routes × system+tenant**; **remove the now-fixed `color-contrast` `KNOWN_BASELINE_RULES` exclusion** (v4.20's `--success-strong` fixed it; the `aria-allowed-attr` Radix-`asChild` exclusion is separate — keep or fix); add **Lighthouse CI** (Lighthouse command-line runner, ≥95).
- **Risk XL — ship ALONE.** Put the gate in this final tag so it measures the finished structure. **If the axe-all-routes expansion surfaces latent violations that would block the XL merge, split the gate into a tiny 7th tag.**
- **Verify:** §3.9 CRM list/Kanban/drawer × 4 + mobile; PII masked at all surfaces (`***4567` / `***NNNN`); first paint shows customers; ellipsis intact; axe all routes/both audiences zero violations; Lighthouse runs on PR.

---

## 5. Reusable assets already built (don't reinvent)

| Asset | Path | Use it for |
|---|---|---|
| Western-numeral formatters | `apps/web/lib/format-number.ts` | any number/date display (Latin digits both langs) |
| Error sanitizer | `apps/web/lib/error-sanitizer.ts` | `toast.error(sanitizeError(err, lang))` — never leak Zod/Prisma/SDK text |
| GA4 analytics | `apps/web/lib/analytics.ts` | `trackEvent(AnalyticsEvent.X, {...})` (no-op pre-consent) + `identify()` |
| Unsaved-changes guard | `apps/web/hooks/useUnsavedChanges.ts` | `useUnsavedChanges(form.formState.isDirty)` |
| Confirm primitive | `@repo/ui` `ConfirmDialog` | all destructive confirms; native `confirm()`/`alert()` are ESLint-banned |
| RHF+zod form pattern | `reservations/page.tsx`, `contracts/page.tsx` | copy the `useForm`+`Controller`+per-render-zod-schema pattern for new forms |
| Export (XLSX/PDF) | `apps/web/lib/export.ts` | `exportToExcel`/`exportToPDF` — branded, bilingual, Western digits |
| PII masking | `apps/web/lib/pii-masking.ts` | `maskPhone`/`maskEmail`/`maskCustomerPii` (respect `customers:read_pii`) |
| PII encrypt path | `apps/web/app/actions/customers.ts` `createCustomer`/`encryptCustomerData` | the ONLY way to write a Customer (ESLint-guarded) |
| Blind-index search | `customers.ts` `getCustomers()` OR-query | the pattern CX-002 should port into `globalSearch` |
| RLS generator | `packages/db/scripts/generate-rls.ts` (`cd packages/db && npm run rls:generate` / `npm run rls:check`) | regenerate the RLS SQL after any schema model add/rename/remove |
| RSC page pattern | `finance/page.tsx` + `FinanceView.tsx` | the server-fetch → client-View reference for CX-003 |
| Domain labels | `apps/web/lib/domain-labels.ts` | bilingual status/category label + badge-variant registry |
| Route guards SSOT | `apps/web/lib/route-guards.ts` | add a `ROUTE_GUARDS` entry for every new route (permission + audience) |

---

## 6. Hard project rules (read AGENTS.md, but at minimum)

- **§3.9 release gate (no exceptions):** before any tag, full `npm run build` green + a production server (`next build && next start`) + **4 screenshots per touched route (light/dark × AR/EN)** + zero console errors + 375px mobile pass + claim-specific checks, **posted before tagging.** CI-green ≠ working UI. CI does not render the UI.
- **§7 release ritual:** commit → update `CHANGELOG.md` (same commit) → PR → CI green → merge → `git tag -a vX.Y.Z` → `gh release create` (notes from CHANGELOG + a `compare` link) → **`/graphify . --update` (mandatory, never skip)** → update the version-state memory.
- **§4 schema:** changes use **`prisma db push`, NOT migrate.** New required columns must carry `@default(...)` or `db push` aborts on populated tables (CI's ephemeral DB won't catch this — prod drifts). After any model add/rename/remove: update `packages/db/sql/2026-06-enable-rls.sql` via `cd packages/db && npm run rls:generate` in the same change, and **manually apply the RLS `ALTER` in Supabase** (double-quoted identifiers!) on every long-lived env, then verify `relrowsecurity=t`.
- **`"use server"` files export only `async` functions** (an ESLint rule + a real runtime landmine — tsc/Playwright don't catch it).
- **PII:** customers only via the encrypt path (above). Phone hashing uses `phoneSearchHash(normalizeSaudiPhoneE164(x) ?? x)` on both write and search.
- **§8 access model:** tenant vs platform(system) audiences never share surfaces; permission ≠ audience (SYSTEM_ADMIN has all permissions). New routes need a `ROUTE_GUARDS` entry.
- **§6 clickables:** `Button`/`IconButton`/`ActionLink` only — raw `<button>` is ESLint-banned (except `role="switch"`).
- **Commits:** Omar is sole author. **No `Co-Authored-By` / "Generated with" lines.** No `--no-verify`.
- **Manager mode (§0.2/§3.2):** decompose, delegate to subagents for breadth, but **validate every "X is missing/absent" claim yourself with a direct Read/Grep before trusting it** (§3.8) — subagents are not authoritative on absence. Use the `/plan` skill for non-trivial work; no execution before explicit approval (§3.10).

---

## 7. Environment & gotchas (learned the hard way)

- **Mimaric is never deployed.** The only environment is the local checkout against the Supabase DB in `apps/web/.env.local`. "Prod" = that DB. Manual RLS steps apply there.
- **`PII_ENCRYPTION_KEY` / `PII_HASH_PEPPER`:** never rotate on an env with live data — existing ciphertext becomes unrecoverable. (The original key was lost once and regenerated; the 20 fake customers were re-encrypted under a fresh key.) Keys live in gitignored `.env.local`; `.env.example` is all-zeros.
- **Don't `| tail` the build when you need its exit code** — the pipe returns tail's exit (0), masking a failed `next build`. Run `npm run build --workspace=apps/web` without a pipe (a background task reports the real exit code), or run `check-types` (`tsc --noEmit`) to surface ALL type errors at once.
- **`next dev` hangs/OOMs** compiling heavy `/dashboard/*` routes. Always verify against `next build && next start`.
- **Verification recipe:** `preview_start` (the `mimaric-web` launch config = `npm run start`) → `curl localhost:3000/auth/login` (expect 200) → a Playwright script logs in via `.fill` (`#login-email`/`#login-password`, Enter; creds `mimaric2026`) and screenshots route × theme × lang to PNG files. Theme = `localStorage.theme` (`dark|light`); lang = `mimaric-lang` cookie + localStorage (`ar|en`); set then reload; wait for `.animate-pulse` count → 0 before shooting. The **preview-MCP browser login is flaky** (it can drift to the landing page) — prefer Playwright for driving forms.
- **cspell gate:** CI runs cspell on tracked `**/*.{ts,tsx,md,mdx,json}`. New proper nouns / British spellings fail it. **Pre-flight locally** before pushing: `git diff --name-only <base> HEAD | grep -E '\.(ts|tsx|md|json)$' | npx cspell --no-progress --file-list stdin`. Add legit words to `cspell.config.json` (it already lists Saudi terms + British spellings).
- **RHF + zod resolver gotcha:** `z.string().default("X")` makes the schema's *input* type optional but *output* required, which breaks the `zodResolver` generic (a real type error hit on the lease `paymentFrequency`). Use `z.string().min(1)` + a `defaultValues` entry instead.
- **`verification/` is gitignored** (local audit artifacts). graphify honors `.gitignore`, so it won't graph the screenshots.
- **Graphify graph:** `graphify-out/` (local, gitignored). ~4,284 nodes. Query before cold-reading (`/graphify query/path/explain`); `/graphify . --update` after each merge (code-only changes skip the LLM step — fast/free).

---

## 8. Per-release execution checklist (repeat for each remaining tag)

1. `git checkout main && git pull`; `git checkout -b feat/cx-vX.Y.Z-<theme>`.
2. Implement (manager mode: delegate disjoint workstreams to subagents on non-overlapping files; validate every output by Read/Grep + build).
3. `npm run build --workspace=apps/web` without a pipe — green. (`check-types` first to catch all type errors at once.)
4. §3.9 gate: prod server + Playwright capture (routes × 4 themes + 375px) + console-clean + the release's claim checks. Review screenshots.
5. Pre-flight cspell locally.
6. Commit(s) + update `CHANGELOG.md`. (Split into coherent commits where the themes are separable.)
7. Push, open PR, **watch CI `build-and-test` to green** (report it).
8. Merge (merge commit) → `git tag -a vX.Y.Z <merge-sha>` → push tag → `gh release create` (notes from CHANGELOG + compare link).
9. **`/graphify . --update`.**
10. Update the version-state record. **Schema releases (v4.23):** apply the manual Supabase RLS `ALTER` + verify `relrowsecurity=t`.

---

## 9. Manual steps owed (human-only)

- **v4.23 (`SavedTableView`):** ✅ **DONE** — Omar applied `ALTER TABLE IF EXISTS public."SavedTableView" ENABLE ROW LEVEL SECURITY;` in the Supabase SQL Editor (2026-06-14). No RLS step owed.
- **v4.24.0:** none — no schema/RLS change this release.

---

## 10. Out of scope / deferred backlog (don't lose these)

**Out of scope (ops or a separate product roadmap):**
- **DB region migration Sydney → `me-south-1` (Bahrain)** — the single biggest **raw**-latency lever (~223ms→~15ms RTT). Ops-owned (Supabase region move + data migration + maintenance window). The RSC work (v4.25/26) only improves *perceived* latency.
- **Saudi regulatory integrations** — Ejar electronic-lease auto-registration, ZATCA Phase-2 QR e-invoicing, off-plan status surfacing, and national single-sign-on e-signature. A separate product roadmap (requirements were researched during the audit).

**Deferred backlog (pre-existing, outside the CX bundles):**
- **True HTTP 403** — the in-shell Access-Denied page returns HTTP 200 (streaming SSR commits status first); a real 403 needs an edge-middleware contract. (Next's experimental `forbidden()` crashed on hydration — rejected.)
- **`/dashboard/more` decommission** — still live-wired (auth.config allowlist + `MobileUserMenuSheet` + a `more/profile` child); needs careful removal.
- **Full `t()` migration** — ~2,000 inline `lang === "ar" ? …` ternaries remain; opportunistic (touched files only), never big-bang.
- **axe `aria-allowed-attr` baseline exclusion** — a Radix `asChild` `<span aria-expanded>`; a shared-primitive fix (can fold into CX-017 / v4.26 if cheap).

---

## 11. References & test credentials

- **SSOT:** `AGENTS.md` (dev/design/release/access rules) · `CHANGELOG.md` (release history).
- **Audit + scripts:** `verification/` (local) — `Mimaric-CX-Audit.html`, `capture-*.mjs`, `verify-cx001-fix.mjs`, `validate-forms-v4.22.0.mjs`.
- **CI:** `.github/workflows/ci.yml` — `build-and-test (20.x)`: typecheck → lint/cspell → `prisma db push` → `next build` → vitest → Playwright e2e (+ axe). ~6 min.
- **Test users (local seed, password `mimaric2026` unless noted):** `system@mimaric.sa` (SYSTEM_ADMIN), `support@mimaric.sa` (SYSTEM_SUPPORT), `admin@mimaric.sa` (ADMIN), `pm@mimaric.sa` (MANAGER), `ahmed@mimaric.sa`/`sales2026` (AGENT), `fatima@mimaric.sa`/`finance2026` (MANAGER/finance), `leasing@mimaric.sa` (LEASING), `finance@mimaric.sa` (FINANCE), `khalid@mimaric.sa`/`sales2026` (TECHNICIAN), `buyer@mimaric.sa`/`tenant@mimaric.sa`/`user@mimaric.sa` (USER). Re-seed: `pnpm --filter @repo/db prisma db seed`.
- **Stack:** Turborepo monorepo · Next.js 16 (`apps/web`, `apps/portal`) · NextAuth v5 (Credentials, JWT) · Prisma 7 + `@prisma/adapter-pg` → Supabase Postgres · Server Actions · Tailwind v4 · `@repo/ui` (TanStack Table, Recharts, Radix) · bilingual AR-RTL/EN-LTR · light+dark.

---

## 12. Suggested next-up order

1. ~~CX-002 · CX-015 · v4.23.0 DataTable saved views~~ — ✅ **all shipped in v4.23.0** (2026-06-14).
2. ~~v4.24.0 — bulk ops + encrypt-path CSV import (CX-010) + DRAFT `updateContract` (CX-011)~~ — ✅ **shipped in v4.24.0** (2026-06-14, PR #30).
3. ~~v4.25.0 — RSC for 5 list pages (CX-003pt1) + USER→`/portal` (CX-018)~~ — ✅ **shipped in v4.25.0** (2026-06-15, PR #31). Scope grew from 2→5 pages (added payments/marketplace/documents).
4. ~~v4.26.0 — RSC CrmView (CX-003 pt2) + CX-017 axe-all-routes~~ — ✅ **shipped in v4.26.0** (2026-06-15, PR #32, TEST-ONLY). CX-003 pt2 was found **already done** (CrmView already RSC-seeded — no decomposition needed). CX-017 axe gate **expanded to all 16 tenant + 8 system routes**. Key correction: the "v4.20 fixed color-contrast" claim was over-stated (only the success badge) — the expansion surfaced ~5 color-contrast + 2 label + many select-name violations, all baselined as QA-FE-01/FE-03 debt.
5. **v4.27.0 (NEXT — the polish tail)** — three independent pieces:
   - **CX-006** — migrate the CRM add-customer form (~300-line, 13-field + property-linking, in `CrmView.tsx`) to RHF+zod (v4.22 pattern). Needs its own §3.9 4-theme interactive verification (empty-submit → inline errors). Preserve the `createCustomer` encrypt-path + optimistic `setCustomers`.
   - **a11y-debt fixes** (un-baseline the axe rules): a governed `<Select>` primitive in `@repo/ui` (fixes `select-name` across ~63 native selects, QA-FE-03) + bake `useId()`+`htmlFor` into a `<Field>`/`<Input>` wrapper (fixes `label`, QA-FE-01) + tune the ~5 remaining `color-contrast` instances (§6.2). Remove each rule from `KNOWN_BASELINE_RULES` in both `accessibility.*.spec.ts` as it's fixed.
   - **Lighthouse CI** — add `@lhci/cli` + `lighthouserc` + a CI job (≥95) on key routes against the prod build. New CI dep/job — verify CI carefully.

*End of handover.*
