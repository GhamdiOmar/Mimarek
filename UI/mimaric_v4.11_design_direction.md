# Mimaric v4.11 — Design Direction & Execution Plan

**Date:** 2026-06-08 · Companion to `mimaric_v4.11_verified_audit.md`. Captures the creative direction (researched via DESIGN.md + radial-nav UX research) and the build sequence for v4.11. Scope = **all P0 + P1** (your call).

---

## A. Card system — "Outlined Precision" (recommended)

**Source of truth:** mined real DESIGN.md systems (Linear, Stripe, Vercel, Cohere, IBM Carbon, Notion) via `VoltAgent/awesome-design-md` + `google-labs-code/design.md`. **Finding: not one premium enterprise system uses a colored side-accent bar.** Hierarchy is carried by *surface ladder + hairline border + type scale*; status by *pill / dot / tinted icon-chip*; depth in dark mode by *lighter surface + hairline, no shadow* (which is already our §6.13 law — the accent bar was fighting our own system).

**The direction (replaces "side shading"):**
- Container: `rounded-lg border border-border bg-card p-6`. Light = barely-there shadow `0 1px 2px hsl(var(--primary-deep)/0.04)`; **dark = no shadow** (hairline is the edge).
- **Kill** `KPICard` `BORDER` map + `border-s-4/[6px]` side bar entirely.
- **Tier rank** via inset **TOP** rule, not a side bar: hero = `inset 0 2px 0 hsl(var(--primary)/0.7)` (RTL-safe — top/bottom don't mirror); standard = hairline; utility = none. Plus value type-scale + padding.
- **Status encoding:** tinted icon chip (already `ICON_BG[accent]`) + delta pill + optional leading status dot. Category never an edge stripe.
- **Hover (interactive):** `hover:border-primary/30 -translate-y-px`; dark steps surface one level lighter (`--card-hover`).
- **Glass:** deprecate on data surfaces; keep for login/marketing splash only.

**New tokens (minimal):** `--card-hover` (light + dark) and a `.card-quiet` shadow utility. No new colors/radius.

Full class-level spec (KPI tile, Kanban card, list row, DESIGN.md card section) is in the creative subagent output — to be transcribed into the components and a new `DESIGN.md`.

*Honest caveat:* awesome-design-md files are marketing-site analyses, so treat exact shadow hexes as directional, not as Linear's literal product tokens. The structural patterns (hairline-over-shadow, pill-status, surface ladder) are consistent across 6 systems → safe to generalize.

---

## B. Navigation — radial CircleMenu, done right

**Your decision:** CircleMenu as primary. **Research reality (NN/G, Hopkins pie-menu studies, game-UI):** radial beats linear on Fitts's-law speed but (1) loses the gain if unfamiliar and (2) breaks past ~8 items. Mimaric has ~45. So the design must get 45 items through an 8-slot door without losing the speed win.

**The design that makes it work:**
- **Two-level hub-and-spoke:** 6 category spokes → each expands to ≤8 children (one nesting level max, never a flat 45-wheel). Taxonomy maps the real `nav-items.ts` into 6 groups (Dashboard, Properties, CRM & Contracts, Finance, Operations, System) via a new `radialGroup` field — one source of truth, same audience filter (§8.3 preserved).
- **cmdk command palette = mandatory accessible/keyboard twin** (cmdk already installed). Built first as the source-of-truth grouping + the WCAG-compliant equivalent path. Radial is the visual layer on top of an already-accessible model.
- **A11y:** `role=menu/menuitem`, roving tabindex, focus trap + return-to-trigger, Escape laddering, `aria-current`, reduced-motion = instant positions, 44×44 wedge targets.
- **RTL:** mirror angular layout (leading-edge first), flip arrow-key mapping, never mirror clocks/media/logos, numbers stay LTR.
- **Mobile:** 180° bottom-anchored half-wheel (not 360°) to avoid thumb occlusion.
- **Tech:** framer-motion via `LazyMotion` + `domAnimation` (~5KB), lazy-loaded chunk; layout math framework-agnostic so it renders without motion.

**Open sub-decision (B-Q):** does "primary" mean **replace** the sidebar entirely, or radial-primary **with a slim collapsible sidebar kept as the always-available safety net**? Research + our own UI-First (§3.1) and WCAG (§6.17) rules strongly favor keeping cmdk + a slim sidebar so navigation can never fail; removing all linear nav is the one residual risk.

---

## C. Execution plan (phased; all P0+P1)

**Phase 0 — Foundation (unblocks everything):**
- globals.css: add `--card-hover`, `.card-quiet`; mark `.glass`/`.mesh-bg` "marketing-only" in comments.
- KPICard → Outlined Precision (delete side-bar maps; top-rule tiers; status dot; dark no-shadow).
- PageIntro → flat enterprise header (`bg-card border rounded-lg`, no glass). **Fixes 14 pages at once.**
- Single global freshness: drop per-card `lastUpdated` rendering; keep page-level `<LastUpdatedAgo>`.

**Phase 1 — The three named asks:**
- CRM Kanban redesign (stage-colored header + count + value subtotal; card with initials avatar, value prominence, time-in-stage aging chip, blocked leading-rule + pill).
  - **Reduce the 3 redundant "view profile" controls to ONE:** card body = the click target to open the profile; remove the `Eye`, footer `"View Profile"` link, and `ExternalLink` triggers. Keep only distinct actions (call/WhatsApp/email + delete), each `stopPropagation`. (Audit finding.)
- DataTable collapsible grouped rows (`getGroupedRowModel` + expand + group-by control) — wire into payments/units/contracts first.
- **Row-action redundancy fix (audit §3.4):** where a clickable row opens the same target as an `Eye` button, drop the `Eye`. **Units:** remove the `Eye` (row click already views), fix the `Pencil` (currently labeled "Edit" but opens the read-only drawer) to open real edit or remove it. Enforce §6.6.5 (icon-only ghost, view→forward→destructive; no duplicate view button on clickable rows).
- Maintenance asymmetric priority (Urgent = dominant block; Med/Low = compact list).

**Phase 2 — Navigation:**
- Build cmdk command palette (grouped, audience-filtered) → shared `filterNavItems()` helper.
- Build `CircleMenu` (two-level hub) + `radial-groups.ts`; add `framer-motion` (LazyMotion).
- Wire as primary launcher; resolve B-Q (replace vs slim-sidebar safety net).

**Phase 3 — Credibility & component swaps:**
- Chart axis `tickFormatter`s (dates + `k SAR`) replacing `W-/D-`.
- Adopt Alert variant model + notification category filter + theme-toggle pill (retokenized; no new deps — reuse Radix).
- ZATCA → compliance-module treatment (clearance/reporting/failed/cert health).
- Actionable empty states where missing.

**Phase 4 — Sweeps:**
- 8 raw chevron/arrow → `DirectionalIcon`.
- Number-format lint sweep.
- Arabic domain-term pass in CRM (e.g. «مسار الفرص العقارية»).

**Phase 5 — Release gate (§3.9, mandatory):**
- Full `npm run build` green; preview server; per-route 4 screenshots (light/dark × AR/EN); console zero-errors; keyboard tab-through; mobile 375×812 pass; axe. Then CHANGELOG + tag `v4.11.0` + GitHub release.

---

## D. Decisions still open
- **B-Q:** radial fully replaces sidebar, or radial-primary + slim safety-net sidebar (recommended).
- **Card direction:** confirm "Outlined Precision" (recommended) vs one of the 3 alternatives (Elevated Quiet / Flat Editorial / Data-Dense Terminal).

## E. Decisions locked (2026-06-09)
- **Card direction:** ✅ Outlined Precision.
- **Nav model:** ✅ radial CircleMenu **fully replaces** the sidebar (desktop) **and** the mobile BottomNav (mobile = 180° bottom half-wheel). cmdk palette is the mandatory WCAG keyboard/SR twin.
- **Side-shading:** ✅ **sweep all** — remove every `border-s-*` status stripe (payments/units/tickets rows + `NextActionPanel`); convey status via pills/dots/tint. (Phase 4.)
- **DataTable grouping rollout:** ✅ broad — payments (done) + units + contracts + reservations/reports/marketplace where grouping helps.
- **Mobile nav risk mitigations (required for the half-wheel):** thumb-reachable bottom anchor, ≥44×44 wedge targets, first-run coach-mark, cmdk + full keyboard/SR fallback, reduced-motion = instant.
