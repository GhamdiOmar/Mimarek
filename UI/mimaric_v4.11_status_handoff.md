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
- **Phase 2 — Navigation (radial replaces sidebar + cmdk):** ✅ **done.** `CircleMenu` two-level hub→spoke wheel replaces the sidebar **and** mobile bottom-tabs, launched from a **floating bottom-center pill on every breakpoint** (desktop/tablet/mobile — no topbar corner button, per Omar's call). Desktop = 360° wheel; mobile = 180° half-wheel. cmdk retained as the always-available fallback/twin. RTL angular mirroring, reduced-motion = instant, focus-trap + **return-focus-to-launcher**, Escape ladder, arrow-key ring nav. **ARIA model corrected** vs. the written plan: the plan said `role=menu/menuitem`, but APG/Roselli are explicit that menu roles are wrong for site navigation (they impose application-menu semantics) — implemented the correct `role=dialog`+`aria-modal` wrapping a real `<nav><ul>` of links, hubs as disclosure buttons (`aria-expanded`). Taxonomy (`radial-groups.ts`) references `nav-items.ts` by href (single SoT) + re-applies the §8.3 audience filter. Orphan fix: removing the bottom-tabs "More" tab cut the only path to `/dashboard/more/profile` → re-wired via the mobile avatar sheet. Verified live on a **prod build** (light/dark × AR/EN desktop wheel + L2 children + mobile half-wheel, focus-return, zero console errors).
- **Phase 3 — Credibility & swaps:** ✅ *mostly done* (verified on prod build). Theme-toggle **pill** (Radix Switch, retokenized); **Alert variant×appearance model** (neutral/primary/destructive/success/info/warning × solid/outline/light, Mimaric tokens); **notification category filter** (All/Alerts/Reminders/Updates pills); **chart axis formatters** (finance `W-2`→`Wk 12`, % + compact-k); **DataTable `emptyAction`/`emptyIcon` slot**; **date-picker restyle** (presets → Button primitive, no new dep). All retokenized, **no new deps** (decision 2026-06-09). ⬜ **Deferred — ZATCA compliance module:** the e-invoicing pipeline does not exist (every Invoice defaults `zatcaStatus=NOT_APPLICABLE`; no clearance/QR/XML is ever populated — `billing.ts` never sets the fields). Building the module now = empty UI over absent data (the slop we're removing). **Build it when the clearance pipeline lands.** The one real surface (admin ZATCA-clearance KPI) already exists.
- **Phase 4 — Sweeps:** ✅ *mostly done.* **Side-shading swept** (payments/units/maintenance rows + `NextActionPanel` — stripes → faint full-row tint on alerting states only + status pill); **3 raw arrows → `DirectionalIcon`** (marketplace); **finance chart axis** localized; **marketplace listing numbers** LTR-wrapped + tabular-nums; **2 empty-state fixes** (admin/marketplace bilingual, CRM Kanban contextual copy). ⬜ **Remaining polish (low-risk, deferred):** wire `DataTable emptyAction` on the ~10 desktop lists; team-page bare-string empty; one card-in-card on `help/page.tsx:738`; Arabic domain-term pass (e.g. «مسار الفرص العقارية»).
- **Phase 5 — Release gate (§3.9):** ✅ **SHIPPED — `v4.11.0` (2026-06-09).** PR [#17](https://github.com/GhamdiOmar/Mimaric/pull/17) merged to `main` (`7be5834`); tag `v4.11.0` + [GitHub release](https://github.com/GhamdiOmar/Mimaric/releases/tag/v4.11.0) published; CHANGELOG updated. CI green (typecheck/lint/cspell/build + **42 e2e**, incl. the billing-nav test rewired off the removed sidebar onto the radial). Full verification run = **21 screenshots in `verification-v4.11.0/`** (all phases × light/dark × AR/EN + mobile), console error-free. ZATCA stays deferred (no e-invoicing pipeline — see Phase 3). *Caveat:* a per-route axe scan + full keyboard tab-through on every touched route were not exhaustively run (reused primitives carry audited a11y; new controls verified structurally).

---

## 5. Phase 2 — DONE (2026-06-09). Next: Phase 3

**Shipped (feature branch, typecheck + lint green, verified on a prod build):**
- `framer-motion@11.18.2` (LazyMotion + domAnimation, code-split via `next/dynamic` so it never enters the initial dashboard bundle).
- `components/shell/radial-geometry.ts` — pure layout math (full 360° / half 180°, RTL mirroring, y-down handling, responsive radius ≥44px nodes).
- `components/shell/radial-groups.ts` — 6-hub taxonomy referencing `nav-items.ts` by href (single SoT) + §8.3 audience filter; empty hubs drop, single-hub roles auto-open.
- `components/shell/CircleMenuOverlay.tsx` — the wheel (lazy chunk): two-level hub→spoke, dialog+nav+links ARIA, focus-trap + return-focus, Escape ladder, arrow-ring nav, first-run coachmark, body-scroll lock.
- `components/shell/CircleMenu.tsx` — controlled launcher; **universal floating bottom-center pill** (all breakpoints).
- Integrated in `DashboardClientLayout.tsx`: `AppSidebar` + `MobileBottomTabs` unmounted (files kept for rollback), `CommandPalette` retained as fallback. `AppTopbar` corner button removed. `MobileUserMenuSheet` profile header re-wired to `/dashboard/more/profile`.

**Deviations from the written plan (deliberate, justified):** (1) ARIA `dialog`+`nav`+links instead of `role=menu` (APG: menu roles are wrong for site nav). (2) Launcher = floating overlay pill on desktop/tablet too (Omar: no topbar corner button) — same affordance as mobile.

**Open follow-ups:** `/dashboard/more` (the mobile nav aggregator) is now superseded by the radial — its nav-list is dead; left in place (deep-link only) pending a deliberate retire. Verified screenshots were captured live via the preview browser (Bash/Playwright are network-isolated from the host localhost in this env — only the preview MCP browser reaches the server; the dev server also OOM/hangs on route compile, so all verification ran against `next build && next start`).

---

## 6. Decisions still needed / open
- **Pre-existing SoT drifts** — reconcile or leave? (a) AGENTS.md §6.4.4 radius `10/16px` vs globals `8/12px`; (b) §6.4.2 sidebar `256/68` vs code `240/64` (becomes moot when radial replaces the sidebar). *Default if no answer: leave (b), align (a) to code during Phase 4.*
- **Mobile radial risk acceptance** — ✅ resolved: half-wheel built + verified; thumb-anchored floating launcher, ≥44px wedges, first-run coachmark, cmdk fallback. Label spacing tuned (half-wheel radius `0.34→0.42`) after Omar flagged top-arc label crowding.
- **Launcher placement** — ✅ resolved: floating bottom-center pill on all breakpoints (no topbar corner button).
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
