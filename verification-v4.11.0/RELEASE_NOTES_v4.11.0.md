The **"make Mimaric feel authored, not AI-template slop"** release. It replaces the linear sidebar and mobile bottom-tabs with a two-level **radial navigation** (CircleMenu), adapts four reference UI components to the Mimaric design system **with no new dependencies**, and sweeps the credibility "tells" flagged by two UI audits.

## Added — radial navigation (Phase 2)

- **`CircleMenu`** — a two-level hub→spoke radial menu that replaces the sidebar (desktop 360° wheel) and mobile bottom-tabs (180° bottom half-wheel), launched from a single **floating bottom-center pill on every breakpoint**. Six category hubs (Dashboard, Properties, CRM & Contracts, Finance, Operations, System), each expanding to its child routes. `cmdk` (⌘K) retained as the always-available keyboard/SR twin.
- A11y per **W3C APG** (site nav is *not* an ARIA menu): `role="dialog"` + `aria-modal` wrapping a real `<nav>` of links; hubs are disclosure buttons; DOM-order Tab + focus-trap + **return-focus-to-launcher**; Escape ladder; arrow-key ring nav; `aria-current`. RTL angular mirroring; reduced-motion → instant; first-run coachmark; framer-motion code-split out of the initial bundle.
- Taxonomy references `nav-items.ts` by href (single source of truth) and re-applies the §8.3 audience filter, so tenant/platform separation is automatic.

## Changed — credibility & component swaps (Phase 3)

- **Theme toggle** → sliding sun/moon pill on the Radix Switch (real `role="switch"`, §6.6.6), RTL-correct, `resolvedTheme`-aware.
- **Alert** → `variant × appearance` model (neutral/primary/destructive/success/info/warning × solid/outline/light), Mimaric semantic tokens; `light` default matches the §6.11.2 banner taxonomy; RTL icon fix.
- **Notification center** → category filter pills (All/Alerts/Reminders/Updates) on the topbar popover.
- **Chart axes** → localized `tickFormatter`s replace raw `W-2` labels with `Wk 12` / `أسبوع 12` + compact-`k` amounts.
- **DataTable** → `emptyAction`/`emptyIcon` slot for §6.12.1-compliant empty states.
- **Date-range picker** → restyled (presets → Button primitive); kept on `react-day-picker` — **no new dependency**.

## Changed — sweeps (Phase 4)

- **Side-shading swept** — every `border-s-*` status stripe removed from payments/units/maintenance rows + `NextActionPanel`; status now reads from a faint full-row tint + the status pill.
- RTL arrows → `DirectionalIcon`; marketplace numbers LTR-wrapped + `tabular-nums`; admin/marketplace bilingual empty; CRM Kanban contextual copy; one card-in-card de-nested.

## Deferred (with rationale)

- **ZATCA compliance module — intentionally not built.** The e-invoicing pipeline does not exist yet: every invoice defaults to `zatcaStatus = NOT_APPLICABLE` and no clearance/QR/XML is ever populated. Building the module now would render empty UI over absent data — the exact "slop" this release removes. Build it when the clearance pipeline lands.
- Micro-polish follow-ups: `DataTable emptyAction` wiring across desktop lists, the mobile notification-sheet category filter, an Arabic domain-term pass.

## Verification

- **Full production build** green; `check-types` + ESLint (0 errors) + cspell + **42 E2E tests** pass in CI.
- **Live verification** against the prod build across light/dark × AR/EN + mobile 375×812 — **21 screenshots** in `verification-v4.11.0/`. Console error-free (radial a11y, theme toggle, notification filter EN+AR, localized chart axes, side-shading removal all confirmed).

## Upgrade notes

- The sidebar and mobile bottom-tabs are gone; the radial `CircleMenu` + `cmdk` are the navigation surfaces (`AppSidebar`/`MobileBottomTabs` kept unmounted for rollback).
- `framer-motion` added to `@repo/web` (code-split).
- `Alert` gained an `appearance` prop (default `light`); existing `destructive` alerts now render as a soft tint.

**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/v4.10.0...v4.11.0
