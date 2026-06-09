# Mimaric v4.11 — Verified UI Audit

**Date:** 2026-06-08 · **Scope:** Review of the `UI/` folder audits + design specs, **verified against the live codebase**, plus 2026 design research. **No code changed yet — this is the audit + decision brief that precedes the build.**

---

## 0. How this audit was produced

Every concrete claim from the source files was re-checked by reading the actual code (file + line), not trusted from summaries (repo rule §3.8). Verdicts: **✅ Confirmed**, **🟡 Partial**, **❌ False/Overstated**.

**Sources reviewed (all of `UI/`):**
- `UI audit by Agent 1.txt` — broad PropTech UX audit (exceptions-first dashboards, provenance, role views, copy).
- `UI audit by Agent 2.txt` — 5 "AI slop tells".
- `mimaric-ai-saas-slop-study.html` — a prior meta-review that already cross-checked claims against code. **Its conclusions hold up — I re-verified them.**
- `mimaric_enterprise_ui_ux_audit.pdf` — 10 forensic "tells" + resolutions.
- `mimaric_ui_ux_refactoring_guide_en.pdf` — refactor spec (KPI freshness, asymmetric priority, chips, chart axes).
- 5 component-swap specs: `Button toggle for theme change.txt`, `Date picker change…txt`, `navigiation side bar…txt`, `Notification center change.txt`, `System alerts change banners.txt`.

---

## 1. Executive verdict

The investor reaction ("AI SaaS slop") is **partly fair and partly wrong**, and the distinction matters:

- **Fair:** the *visual grammar* leans generic — a glass page-header on every page, equal-weight KPI grids, symmetric `.map()` priority cards, raw `W-2/W-4` chart axes, freshness labels repeated ~5× per page. These are real and concentrated in a **small number of shared components**, which is good news — fixing few files fixes many pages.
- **Wrong / overstated:** the product is **not** shallow. Navigation is domain-specific (not "Dashboard/Analytics/Insights"), property data is already tokenized (not raw strings), RTL chevrons are already mirrored in 50 places via `DirectionalIcon`, and freshness is centralized (not hardcoded per card). The audits that claimed otherwise were inspecting screenshots, not code.

**Strategic framing for the build (use this, not "make it less AI"):**
> *Make every Mimaric screen prove workflow depth, data confidence, and regulatory seriousness before it tries to look impressive — flat, dense, authored, asymmetric by severity.*

**Highest-leverage finding:** `PageIntro` hardcodes `glass rounded-xl p-8` (`packages/ui/src/components/PageIntro.tsx:23`) and is rendered on **14 dashboard pages**. De-glassing this one component is the single biggest visual win.

---

## 2. Verified claim table

| # | Claim (source) | Verdict | Evidence (verified) |
|---|---|---|---|
| 1 | Glass / mesh "AI aesthetic" overused | ✅ Confirmed | `PageIntro.tsx:23` = `glass rounded-xl p-8`, used on **14 pages** (billing, units, finance, reservations, payments, contracts, crm, leasing, maintenance×2, marketplace×2, onboarding, reports). Direct `.glass` also in `dashboard/page.tsx`, landing `Vision2030.tsx`. Tokens defined in `globals.css` (`.glass`, `.glass-heavy`, `.mesh-bg`, `--glass-*`). |
| 2 | KPI cards have "side shading" (colored side stripe) | ✅ Confirmed | `KPICard.tsx`: `border-s-4` (standard) / `border-s-[6px]` (hero) at lines 211–215, colored via `BORDER[accent]` (102–110) applied at 414–415. Plus purple-tinted `shadow-card`/`shadow-md` (412–413). |
| 3 | "Last updated moments ago" repeated everywhere | 🟡 Partial | Implementation is centralized (`LastUpdatedAgo.tsx`, `KPICard.lastUpdated` at 405–407) — **not** hardcoded per card as Agent 2/PDF claimed. **But the rendered result is real:** finance/leasing/maintenance/dashboard each render the freshness label **5×** (1 page-level `<LastUpdatedAgo>` in `PageIntro` actions + 4 per-card `lastUpdated`). Verified by grep (22 occurrences / 5 files). |
| 4 | Maintenance priority cards too symmetric/equal-weight | ✅ Confirmed | `maintenance/page.tsx:384–402` — `grid grid-cols-2 sm:grid-cols-4 gap-4`, every priority an identical box with 4px `borderInlineStart`, same `text-2xl` count. Urgent looks like Low. |
| 5 | Chart axes show raw `W-2/W-4`, `D-5` | ✅ Confirmed | `finance/page.tsx:114–127` — `week: \`W-${…}\``, `day: \`D-${…}\``. No business/date/SAR `tickFormatter` on these trend series. |
| 6 | ZATCA compliance shown as an ordinary KPI | 🟡 Partial | `admin/page.tsx` renders ZATCA Clearance as a standard `KPICard` with severity accent + conditional warning. Functional, but no "official/compliance-module" treatment (clearance vs reporting split, failed-submission list, certificate/API health). |
| 7 | Raw unformatted numbers (e.g. `400000`) | 🟡 Partial | Money largely flows through `SARAmount` / `toLocaleString` (e.g. finance `fmt`, CRM budget at `crm:1607`). Spot leaks possible but **not** systemic. Treat as a lint sweep, not a redesign. |
| 8 | Property features = raw concatenated strings | ❌ False | Units/marketplace/property cards already use icon+token columns and chips. Not accurate for current code. |
| 9 | Navigation is generic (Dashboard/Analytics/Insights/Reports) | ❌ False | `nav-items.ts` is domain-specific: Leasing, Finance, CRM, Properties, Reservations, Contracts, Marketplace, Payments, Maintenance, Documents — sectioned + audience-filtered. |
| 10 | RTL chevrons/arrows not mirrored | ❌ Mostly False | `DirectionalIcon` used **50× across 21 files**; CRM card uses it for `ChevronRight` (`crm:1628`). Only **8 raw** `<ChevronRight/ArrowRight…>` leaks across 5 files (help, crm, reports, marketplace×2) — a small cleanup, not a systemic flaw. |
| 11 | DataTable lacks row grouping / "clustering" | ✅ Confirmed (gap) | `DataTable.tsx` has only TanStack `getHeaderGroups` + density radio. **No `getGroupedRowModel`, no row/section clustering.** Relevant to your "table clustering" ask. |
| 12 | CRM Kanban "looks bland" | ✅ Confirmed | Verified `crm:1556–1678` (card) + `2820–2893` (columns). See §4. |
| 13 | Product lacks workflow depth | ❌ False (as architecture) | Real server actions, role task queues, Ejar validation, contracts/payments/maintenance lifecycles exist. The depth is real; the *first visual read* hides it. |
| 14 | "Unpacking…" / "requires JavaScript" are live states | ❌ Not in code | Strings appear only in Agent 1's capture, not in repo source. |

---

## 3. Your three explicit priorities — current state + interpretation

### 3.1 Card redesign — "remove the side shading"
**What "side shading" maps to in code (high confidence):** the colored inline-start accent stripe on cards —
- `KPICard` `border-s-4` / `border-s-[6px]` + `BORDER[accent]` (the purple/green/amber vertical bar).
- The same pattern repeated ad-hoc: `maintenance/page.tsx` priority cards (4px), `payments/page.tsx` rows (`border-s-4`), `units`, `maintenance/tickets` (`border-s-2`), sidebar active state.
- Secondary candidate: the **purple-deep-tinted shadows** (`--shadow-sm/md`, `--shadow-card`) — a softer "shading."

**Ruthless note (so you can decide deliberately):** the left-accent-bar is *not* itself an AI-slop tell — it's still a current 2026 pattern (e.g. shadcn "Stats Card 10" ships exactly this). The slop signal is **uniformity** (every card equal weight + glass + same stripe), not the stripe's existence. Removing it is a legitimate *taste* choice toward flatter/cleaner; just know we're choosing aesthetics, not fixing a defect. **→ Decision D1.**

### 3.2 Table "clustering"
DataTable today renders **flat rows only**. "Clustering" most plausibly means **group rows into collapsible sections by a column** (e.g. payments by status, units by building, contracts by stage) and/or **grouped column headers**. TanStack supports `getGroupedRowModel` + `getExpandedRowModel` — additive, no rewrite. **→ Decision D2** (confirm which clustering you mean).

### 3.3 CRM Kanban — "looks so bland"
**Verified current state:**
- **Column header:** a 2px dot + bold label + count pill. Background tinted only 4% with stage hue. No pipeline-value subtotal, no WIP/limit signal.
- **Card:** flat white `bg-card border rounded-xl`, name + (Arabic name) + phone + budget (oddly behind a `Star` icon) + source. Quick-actions appear on hover. **No stage-color tie-in on the card, no avatar/initials, no time-in-stage / aging signal, no deal-value prominence, no "stale" warning.**
- 🔴 **Redundant "view profile" affordances (3× the same action).** Verified: the card fires `onViewProfile(customer)` from THREE separate controls — `Eye` IconButton (top-right hover, ~`crm:1575`), the footer `"View Profile"` link (~`crm:1620`), and the `ExternalLink` IconButton ("Open profile", bottom rail, ~`crm:1669`). Three buttons, one destination = clutter + ambiguity. **Resolution: reduce to ONE affordance** — make the card body the click target to open the profile; keep only the *distinct* actions (call / WhatsApp / email rail + delete, each with `stopPropagation`). Fold into the Phase 1 Kanban redesign.
- Drag-drop = native HTML5 (fine).

This is the textbook "bland Kanban": low hierarchy, muted color, no flow signals. 2026 best practice (Atlassian/Businessmap/Wrike): **card aging, time-in-stage, WIP `(x/y)` counters, owner avatars, value prominence, blocked states.** Strong, well-defined redesign target.

### 3.4 Redundant-affordance sweep — additional verified findings

A targeted sweep for "multiple controls firing the same action" across all dashboard surfaces. Each entry **read & verified** (false positives dismissed per §3.8).

| Surface | Verdict | Finding (file:line) | Resolution |
|---|---|---|---|
| **CRM Kanban card** | ✅ Confirmed | 3 controls → same `onViewProfile`: `Eye` (`crm:1575`), footer `"View Profile"` link (`crm:1620`), `ExternalLink` (`crm:1669`). | Card body = single click target; remove all 3; keep call/WhatsApp/email + delete (`stopPropagation`). → Phase 1. |
| **Units table** | ✅ Confirmed | `openUnitDetail` reachable **3 ways**: `onRowClick` (`units:1171`) + `Eye` (`units:406–411`) + `Pencil` (`units:412–418`). The `Pencil` is **labeled "Edit"/تعديل but opens the read-only detail drawer** — semantic bug. | Row click = view (keep). **Remove the `Eye`** (duplicates row click per §6.6.5). **Fix `Pencil`** to open real edit, or remove it. Keep delete. → add to Phase 1. |
| **Contracts table** | ❌ Dismissed | `Eye`=View + conditional `PenLine`=**Sign** + delete (`contracts:441,449`). Distinct actions; correct §6.6.5 order. "Duplicate Eye across sale/lease tables" = two separate tables, legitimate. | No change. |
| **Maintenance tickets** | ❌ Dismissed | `Eye` **navigates** to detail page (`tickets:492`); `Pencil` opens **edit modal** (`tickets:499`). Two distinct destinations. | No change. |

**Audit takeaway:** redundant view-affordances are a recurring pattern (CRM + Units). The §6.6.5 row-action standard ("icon-only ghost, view→forward→destructive") plus the rule **"a clickable row must NOT also carry a duplicate view button"** should be enforced wherever `onRowClick` opens the same target as an Eye button.

---

## 4. Component-swap specs — assessment (ruthless)

You dropped 5 "integrate this component" specs. They are **uneven** — some are good, two are wrong for an enterprise SaaS. My recommendations:

| Spec | Recommendation | Why |
|---|---|---|
| **System Alerts** (`alert-1`, solid/outline/light × 7 variants) | ✅ **Adopt the variant model**, retokenized to Mimaric vars | Genuinely richer than current `Alert` primitive + `ProcessBlockerBanner`. The `appearance` (light/outline/solid) × `variant` matrix is exactly the §6.11.2 banner taxonomy. Drop the hardcoded `violet/yellow` colors; map to `--info/--warning/--success/--destructive`. |
| **Notification center** (category-filter popover) | ✅ **Adopt the pattern**, not the file | Adding All/Updates/Alerts/Reminders filter tabs to the existing bell-popover is a clean upgrade. Reuse our Radix `Popover`/`Badge`/`Button` — don't import the spec's shadcn copies (duplicate primitives). |
| **Theme toggle** (16×8 pill, Moon/Sun) | ✅ **Adopt**, tokenized + wired to `next-themes` | Self-contained, nicer than the current icon-swap button. Must replace hardcoded `zinc-*` with theme tokens, wire to `useTheme()`, add `aria-label`/`role=switch`, respect reduced-motion. Low risk. |
| **Date picker** (`react-aria-components` "Jolly") | ⚠️ **Do NOT swap wholesale — restyle what we have** | Pulls in **2 new deps** (`react-aria-components`, `@internationalized/date`) + a *parallel* button/calendar/field/popover stack that **duplicates** our shadcn primitives. We already have `DateRangePicker` (react-day-picker + date-fns) **and** a Saudi `HijriDatePicker`. Verified: those deps are absent today. Recommend: restyle the existing pickers for visual consistency; **skip** the library swap unless you specifically want react-aria's a11y model platform-wide. **→ Decision D3.** |
| **Sidebar** → `CircleMenu` (radial framer-motion menu) | 🔴 **Strongly advise against** | A radial circle menu cannot hold **45 nav items in 3 audience-filtered sections**, isn't discoverable, has no collapsed/expanded/active states, no RTL story, and is the *opposite* of the "enterprise restraint" both audits demand. It's a portfolio/showcase toy. It also needs `framer-motion` (absent today). This would *increase* the AI-slop feel, not reduce it. Keep `AppSidebar`; polish it (active state, density, section headers). **→ Decision D4.** |

---

## 5. 2026 design rules (researched) — what we steer toward

Synthesized from current enterprise-UI sources (links in §8):

**Restraint & hierarchy.** 2026 enterprise UI is defined by restraint and progressive disclosure (Linear/Stripe/Vercel/Ramp). Show the *next decision*, not max density. Lead with exceptions, not a wall of equal KPIs.

**Color discipline.** Semantic only — green=on-target, amber=threshold, red=below, one brand accent (our purple) for primary/focus. No decorative gradients/glow on product surfaces. Keep chart hues stable across themes.

**Depth.** Light mode = subtle shadow; dark mode = lighter surface + hairline border, **no shadow** (already our §6.13 rule). Flat single-layer canvases over card-in-card nesting; structure with dividers + type weight.

**Asymmetry as judgment.** Severity drives size: an urgent SLA breach or failed ZATCA clearance must outweigh a routine count. Kill the symmetric 4-up priority grid.

**Cards.** Flat-bordered is the premium-enterprise default; accent bars are acceptable but should be *meaningful* (status), not uniform decoration. Avoid equal-weight grids.

**Kanban.** Card aging / time-in-stage, WIP `(x/y)` counters, owner avatars, value prominence, blocked/stale states (Atlassian, Businessmap, Wrike).

**Tables.** Grouping/clustering with collapsible sections, sticky identifying column, tabular-nums, density toggle (Linear/Notion/Airtable conventions; TanStack `getGroupedRowModel`).

**Arabic/RTL.** Beyond mirroring: Arabic ~10–15% larger, line-height ≥ ~1.8 for body, weight ≥400 body / ≥600 headings, **never** letter-spacing on Arabic, CSS logical properties throughout. Native phrasing, not dictionary translation (PDF Tell #8: "Lead Pipeline" → «مسار الفرص العقارية»).

**Charts/numbers.** Real date/business axis labels + SAR `tickFormatter` (`(v)=>\`${v/1000}k SAR\``); tabular-nums everywhere; numbers LTR-wrapped in Arabic context.

---

## 6. Prioritized remediation backlog (proposed for v4.11)

**P0 — visual de-slop (high leverage, low risk):**
1. **De-glass `PageIntro`** → flat bordered enterprise header (`bg-card border rounded-lg`, no backdrop-blur). Fixes 14 pages at once. Keep `.glass`/`.mesh-bg` for **landing only**.
2. **Card "side shading" decision (D1):** remove/soften `border-s-*` accent bars + retune shadows in `KPICard` and the ad-hoc usages.
3. **Single global freshness:** keep `<LastUpdatedAgo>` at page level only; drop per-card `lastUpdated` rendering (remove the 4× repeat). One-line change in `KPICard` + call-site cleanup.

**P0 — the three named asks:**
4. **CRM Kanban redesign** (column header with value subtotal + count + WIP; card with stage color, initials avatar, value prominence, time-in-stage/aging chip, blocked state).
5. **Table clustering (D2):** add `getGroupedRowModel`/expand to `DataTable` with collapsible group rows + group-by control.
6. **Asymmetric maintenance priority:** Urgent = dominant `col-span-2` alert block; Medium/Low = compact secondary list.

**P1 — credibility & polish:**
7. Chart axis `tickFormatter`s (dates + `k SAR`) on finance/maintenance trends; replace `W-/D-`.
8. Adopt **Alert variant model** + **notification category filter** + **theme-toggle pill** (the 3 good swaps).
9. ZATCA → compliance-module treatment on admin (clearance/reporting/failed/cert health).
10. Actionable empty states (PDF Tell #9) where missing.

**P2 — sweeps:**
11. 8 raw chevron/arrow → `DirectionalIcon`.
12. Number-format lint sweep (Tell #7).
13. Arabic domain-term pass in CRM (Tell #8).

---

## 7. Open decisions (need your call before build)

- **D1 — "Side shading":** Remove the colored left accent bar from cards entirely? Or keep it only as a *status* signal (e.g. overdue/at-risk) and drop it from neutral KPIs? Also: retune the purple-tinted shadows to neutral, or keep?
- **D2 — "Table clustering":** Do you mean **collapsible grouped rows** (group by status/building/stage), **grouped column headers**, or denser visual row-grouping? 
- **D3 — Date picker:** Restyle existing pickers (my recommendation), or commit to the `react-aria-components` swap platform-wide (adds 2 deps + parallel primitives)?
- **D4 — Sidebar:** Confirm we **keep & polish `AppSidebar`** and **drop the `CircleMenu` radial swap** (my strong recommendation). If you want CircleMenu, tell me where (it could work as a mobile FAB speed-dial, not primary nav).
- **D5 — Scope/sequencing:** Ship all of P0–P1 as v4.11, or flagship-first (Finance + Maintenance + CRM Kanban) to prove the direction, then roll out?

---

## 8. Sources

**Code (verified, file:line in §2):** `PageIntro.tsx`, `KPICard.tsx`, `LastUpdatedAgo.tsx`, `globals.css`, `DataTable.tsx`, `nav-items.ts`, `crm/page.tsx`, `finance/page.tsx`, `maintenance/page.tsx`, `admin/page.tsx`, all `package.json`.

**Prior local artifacts:** the 4 audits/specs + `mimaric-ai-saas-slop-study.html` in `UI/`.

**2026 design research:**
- [925studios — 35 SaaS Dashboard Design Examples 2026](https://www.925studios.co/blog/saas-dashboard-design-examples-2026)
- [Aufait UX — Enterprise UX Design Trends 2026](https://www.aufaitux.com/blog/enterprise-ux-design-trends/)
- [Think.design — Dashboard Design 2026 Do's & Don'ts](https://think.design/blog/dashboard-design-in-2026-dos-and-donts/)
- [Atlassian — Kanban boards](https://www.atlassian.com/agile/kanban/boards) · [Businessmap — Kanban board features 2026](https://businessmap.io/blog/best-kanban-board-features) · [Wrike — Kanban cards anatomy](https://www.wrike.com/kanban-guide/kanban-cards/)
- [Aivensoft — RTL Arabic design guide](https://aivensoft.com/en/blog/rtl-arabic-website-design-guide) · [Milaaj — RTL mobile UI guide](https://www.milaajbrandset.com/blog/rtl-mobile-app-design-arabic-users/)
- [Shadcnblocks — Stats Card 10 (accent-border metric card)](https://www.shadcnblocks.com/block/stats-card10)
