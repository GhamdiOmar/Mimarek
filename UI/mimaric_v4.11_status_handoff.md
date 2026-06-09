# Mimaric v4.11 — Status & Handoff

**Updated:** 2026-06-09 · **Branch:** `feat/v4.11-ui-overhaul` (off `main` @ `85f548b`) · **Theme:** UI overhaul — make Mimaric feel authored/enterprise, not "AI SaaS slop."

This is the single status doc for v4.11. Companion artifacts in `UI/`: `mimaric_v4.11_verified_audit.md` (findings), `mimaric_v4.11_design_direction.md` (creative direction + decisions). Future work: `future-plans/crm-kanban-card-enrichment.md`.

---

## 1. What happened (this engagement)
1. **Reviewed all inputs** in `UI/` (2 text audits, 2 PDFs of "AI-slop tells", a prior HTML meta-study, 5 component-swap specs) and **verified every concrete claim against the code** (file:line, ✅/🟡/❌) → `mimaric_v4.11_verified_audit.md`.
2. **Researched** 2026 enterprise UI (anti-slop), DESIGN.md brand systems (cards), and radial-nav UX — via subagents + web.
3. **Locked the creative direction** with Omar (see §3).
4. **Shipped Phase 0 + Phase 1** (cards, de-glass, CRM Kanban, units/maintenance fixes, DataTable clustering) — all typecheck + lint green, committed.
5. **Validated** with 15 Playwright screenshots (light/dark × AR/EN) against the running app.
6. **Found & logged gaps** as a manager: a CRM data gap (future-plan), an SoT divergence (reconciled), and scope decisions (locked).

---

## 2. Decisions locked
- **Cards:** "Outlined Precision" — flat outlined tile; hierarchy via surface + hairline + type; **no colored side accent bar**; hero = 2px inset top rule; depth `.card-quiet` (light) / no-shadow (dark). Glass = marketing/auth-splash only.
- **Navigation:** radial **CircleMenu fully replaces the sidebar** (desktop) **and** BottomNav (mobile = 180° half-wheel). cmdk command palette is the mandatory WCAG keyboard/SR twin.
- **Side-shading:** **sweep all** — remove every `border-s-*` status stripe (payments/units/tickets rows + `NextActionPanel`); status → pills/dots/tint. (Phase 4.)
- **Table clustering:** collapsible grouped rows; **broad rollout** (payments done + units + contracts + reservations/reports/marketplace).
- **Scope:** all P0 + P1 ship in v4.11.

---

## 3. Current state — done & verified
Commits on `feat/v4.11-ui-overhaul`:

| Commit | What |
|---|---|
| `1b1fdd7` | **Phase 0 foundation** — KPICard Outlined Precision (no side bar; top-rule tiers; card-quiet/dark-no-shadow; per-card freshness removed); PageIntro de-glassed (fixes 14 pages); dashboard hero de-glassed; `--card-hover` token + `.card-quiet` utility; glass/mesh marked marketing-only |
| `2d0c61c` | **Phase 1** — CRM Kanban redesign (single view affordance, avatar, deal-value, column subtotals); Units row-action fix (drop redundant Eye + mislabeled Pencil); Maintenance asymmetric priority; AGENTS.md §6.6.7 "one action = one affordance" rule |
| `081d80e` | 15 validation screenshots + capture scripts |
| `684159b` | **DataTable collapsible grouped rows** (clustering) + payments wired (group by Status/Type) |
| `5ede53c` | future-plan: CRM Kanban card enrichment gap |
| `fe1e43d` | AGENTS.md §6.8 reconciled to Outlined Precision |
| `3d91e85` | decisions locked in the plan doc |

**Verification:** `@repo/web` + `@repo/ui` typecheck green; ESLint 0 errors on all changed files; 15 screenshots posted (CRM/dashboard/finance/maintenance/units, light+dark, EN+AR) in `docs/screenshots/v4.11.0/`.

---

## 4. Phase plan & progress
- **Phase 0 — Foundation:** ✅ done.
- **Phase 1 — Three named asks + clustering:** ✅ Kanban / Units / Maintenance / DataTable grouping (payments) done. ⏳ grouping rollout to units/contracts/reservations/reports/marketplace pending (decision: broad).
- **Phase 2 — Navigation (radial replaces sidebar + cmdk):** ⏳ **next**. Backbone (cmdk palette) already exists.
- **Phase 3 — Credibility & swaps:** ⬜ chart axis formatters (replace `W-2/D-5`); Alert variant model + notification category filter + theme-toggle pill (retokenized, no new deps); ZATCA compliance-module treatment; actionable empty states.
- **Phase 4 — Sweeps:** ⬜ side-shading sweep (rows + NextActionPanel → pills/dots); 8 raw chevron/arrow → `DirectionalIcon`; number-format lint; Arabic domain terms (e.g. «مسار الفرص العقارية»); card-in-card de-nesting.
- **Phase 5 — Release gate (§3.9):** ⬜ full `next build` + prod-server preview, 4 screenshots/route × light/dark × AR/EN, console zero-errors, keyboard tab, mobile 375×812, axe; then CHANGELOG + tag `v4.11.0` + GitHub release.

---

## 5. Next steps (immediate — Phase 2)
1. Add **framer-motion** (`LazyMotion`/`domAnimation`).
2. **`radial-groups.ts`** — map ~20 nav items (3 sections) into radial hubs.
3. **`CircleMenu`** — two-level hub; desktop 360° / mobile 180° half-wheel; `role=menu` + roving tabindex + focus trap + Escape ladder + reduced-motion; RTL angular mirroring; active state from `usePathname`.
4. **Integrate** in `apps/web/app/dashboard/DashboardClientLayout.tsx`: remove `AppSidebar` + `MobileBottomTabs`, mount `CircleMenu`, rewire topbar menu button, **keep `CommandPalette`** as the guaranteed fallback. Build behind the palette so nav never fails.
5. First-run coach-mark; 44×44 wedge targets.
6. Verify: typecheck/lint/axe + **prod-build** screenshots.

Key files: `components/CommandPalette.tsx` (exists — extend), `components/shell/nav-items.ts` (nav model), `components/shell/AppSidebar.tsx` (filter logic to reuse, then remove), `DashboardClientLayout.tsx` (shell).

---

## 6. Decisions still needed / open
- **Pre-existing SoT drifts** — reconcile or leave? (a) AGENTS.md §6.4.4 radius `10/16px` vs globals `8/12px`; (b) §6.4.2 sidebar `256/68` vs code `240/64` (becomes moot when radial replaces the sidebar). *Default if no answer: leave (b), align (a) to code during Phase 4.*
- **Mobile radial risk acceptance** — half-wheel on mobile is the bold choice; if first-run testing shows discoverability issues, fallback is to keep BottomNav on mobile only. *Flag for review after the Phase 2 prototype.*
- Everything else is locked (§2).

---

## 7. Verification status & gate caveats
- Per **AGENTS.md §3.9**, v4.11 (not part of the journey-first transformation) requires the **full preview-screenshot gate at tag time**.
- **Known blocker:** the dev server **OOM-crashes on `/dashboard/payments`** (Turbopack dev, exit 134 at any heap). Independent of our code (route renders 200, then process dies). **Mitigation:** run the §3.9 capture against a **production build** (`next build && next start`) — stable, no per-request compile. Confirm payments stability there; if it also crashes in prod, investigate as a real pre-existing issue.
- DataTable **grouping screenshot deferred** to the prod-build gate for this reason (feature is typecheck+lint verified).

---

## 8. Known gaps / future work
- **CRM Kanban enrichment** (`future-plans/crm-kanban-card-enrichment.md`): owner avatar + card-age are **available now** (Tier 1, UI-only); true time-in-stage needs a `stageEnteredAt` field (Tier 2, schema). P2, post-v4.11.
- Side-shading sweep + RTL/number/Arabic-term sweeps + ZATCA module + component swaps + empty states → Phases 3–4 (above).

---

## 9. Artifacts index
- Audit: `UI/mimaric_v4.11_verified_audit.md`
- Direction + decisions: `UI/mimaric_v4.11_design_direction.md`
- This status: `UI/mimaric_v4.11_status_handoff.md`
- Future gap: `future-plans/crm-kanban-card-enrichment.md`
- Screenshots: `docs/screenshots/v4.11.0/` (15)
- Capture scripts: `scripts/capture-v4.11.0.mjs`, `scripts/capture-v4.11-extra.mjs`, `scripts/capture-v4.11-grouping.mjs`
