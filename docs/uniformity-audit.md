# Mimaric UI Uniformity Audit — 2026-06-03

Flag-only register (no fixes applied). Produced by a 5-dimension subagent sweep of `apps/web`,
with the highest-impact claims spot-verified by hand. Confidence column: **V** = verified at the
cited line, **R** = reported by audit (representative spot-checks done, not every instance re-read).

Reference: AGENTS.md §6.6 (button governance), §6.12.1 (empty states). Primitives live in `@repo/ui`.

---

## Verification pass — 2026-06-07 (direct re-read, corrections to the sweep)

The flag register above was re-verified line-by-line. It holds up; four corrections:

1. **P1 note is wrong.** `marketplace/my-listings/page.tsx` does **not** use `<Badge>` — it also hand-rolls
   inline `<span className={cn(LISTING_STATUS_STYLES…)}>` (mobile + desktop). There is **no** canonical
   Badge-adoption example among these pages. The fix target is unchanged (adopt `<Badge>`), but don't cite
   my-listings as the model. `Badge` primitive confirmed at `packages/ui/src/components/Badge.tsx` with all
   14 variants + sizes `sm|md`.
2. **P3 last bullet is FALSE.** `admin/seo/page.tsx:827,856` delete IconButtons **do** carry
   `className="text-destructive hover:text-destructive"`. No destructive-tone gap there — drop this item.
3. **P4 admin/email is mis-framed.** Both `admin/email/page.tsx:229` **and** `:314` use `variant="secondary"`
   (not a primary/secondary split). Real finding: both Save buttons should be `primary`.
4. **P6 counts.** Raw `<Table>` = **15** pages (add `settings/audit`), not 14. DataTable users = 3
   (crm, help, admin/tickets) — confirmed. Hand-rolled title blocks ≈ **5** dashboard pages
   (finance, leasing, maintenance, onboarding, more/profile), ~23 use `PageHeader`/`PageIntro`.

Minor: P2 crm interests cluster uses `gap-3` (not `gap-1`); `gap-1` appears elsewhere on the page.
`Switch` primitive confirmed at `packages/ui/src/primitives/switch.tsx`; three raw `role="switch"` sites
confirmed (`landing/components/Pricing.tsx:142`, `admin/plans/page.tsx:699`, `admin/coupons/page.tsx:723`).

---

## P1 — Status badges hand-rolled instead of `<Badge>`  (highest duplication)  [V]

~10 pages render inline status pills (`<span className="…rounded-full px-2 py-0.5 text-xs…">`) driven by
local `STATUS_COLORS` / `STATUS_LABELS` maps or `statusBadge()` helpers, instead of the shared `Badge`
(which exposes `success|warning|error|pending|info|overdue|draft|available|reserved|sold|rented|maintenance|default|outline|dot`, sizes `sm|md`).

| Page | Lines (map + render) |
|---|---|
| `dashboard/reservations/page.tsx` | map 89–94; spans 773, 1025 |
| `dashboard/payments/page.tsx` | map 143–155; span 750 |
| `dashboard/contracts/page.tsx` | map 85–99; spans 800, 874, 955 |
| `dashboard/page.tsx` | `statusBadge()` 89–100; use 696 |
| `dashboard/admin/tickets/page.tsx` | `statusBadge()`+`priorityBadge()` 61–91; use 437 |
| `dashboard/help/page.tsx` | helpers 239–285; uses 1172, 1233 (+ table cols) |
| `dashboard/help/tickets/[id]/page.tsx` | `statusBadge()` 128–140; uses 241, 448 |
| `dashboard/admin/marketplace/page.tsx` | `STATUS_LABELS`+`COMPLIANCE_STYLES` 60–78; use 248 |
| `dashboard/marketplace/page.tsx` | `INQUIRY_STATUS_LABELS` 85–106; uses 721, 789 |

Note: `marketplace/my-listings/page.tsx` already uses `Badge variant={…}` — adopt that pattern everywhere.
Canonical fix later: replace each inline span with `<Badge variant=… size="sm">`; delete the local maps.

## P2 — Row-action cluster uniformity  [V]

The issue Omar flagged on Reservations, generalized:

- **Mixed element types in one action cluster:**
  - `reservations/page.tsx:780–824` — IconButton(Eye) + **ActionLink text** ("تحويل لعقد") + IconButton(Ban).
  - `contracts/page.tsx:810–830, 879–899` — IconButton(Eye) + **`Button variant="success" size="sm"`** ("توقيع/Sign").
- **Same "primary forward action" rendered three different ways:**
  - Reservations → Contract: `ActionLink` text link (`reservations/page.tsx:801`).
  - CRM → Reservation: `Button variant="outline"` (`crm/page.tsx:~685`).
  - Contract draft → Sign: `Button variant="success"` (`contracts/page.tsx:~820`).
- **Action order differs** page to page (view/confirm/convert/cancel vs view/sign).
- **Cluster gap differs** — `gap-2` (reservations, invoices) vs `gap-3` (contracts) vs `gap-1` (crm interests).

Decision needed later: one canonical row-action pattern (e.g. all in-place actions = `IconButton`; a single
optional "primary forward" action = small labelled `Button`/`ActionLink` with chrome, always last; fixed order).

## P3 — IconButton size / variant / label phrasing  [V]

- **Size divergence for row actions** — `h-6 w-6` (crm 1575), `h-7 w-7` (crm 1983), `h-8 w-8` (reservations 782),
  `size="sm"` (maintenance/tickets 885), default responsive (contracts, invoices). No single row-action size.
- **`aria-label` phrasing/casing for the same action:**
  - View: "View Profile" (crm 1575) vs "View profile" (crm 1983) vs "View" (maintenance 885) vs "View Details" (reservations 784).
  - Close/dismiss: "Close" vs "Dismiss" vs "Clear" vs "Remove" used somewhat interchangeably for the `X` icon.
- **Team page bypasses `IconButton`** — `settings/team/page.tsx:351, 401` use `<Button variant="secondary" size="icon"><Trash2/></Button>` (+ stray inline `style={{display:"inline-flex"}}`) instead of `IconButton` with destructive tone.
- **Destructive tone missing** on some delete IconButtons — `admin/seo/page.tsx:827, 856` (no `text-destructive`).  [R]

Consistent where it counts: icon *choice* is uniform (delete=`Trash2`, view=`Eye`, close=`X`, filter=`Filter`,
search=`Search`, more=`MoreHorizontal`/`MoreVertical` by context). Phrasing + size are the gaps.

## P4 — Semantic → variant divergence  [V]

| Semantic | Variants seen | Divergent sites |
|---|---|---|
| Delete / Remove | `destructive` (most) · `secondary` · `ghost`+text-destructive · filled `destructive/80` | team remove `secondary` (`settings/team:351,401`); maintenance plan `ghost`+text (`maintenance/preventive:579`); units bulk filled (`units:~803`) |
| Cancel (modal) | `ghost` (8 sites) · `outline` (2) | contracts modals `outline` (`contracts:1056, 1177`) |
| Confirm/Approve | `success` (consistent) | — none |
| Save/Submit/Create | `primary` (consistent) · 1 `secondary` | `admin/email:314` save uses `secondary` while `:229` is primary |
| Edit / Export | `ghost` / `outline` (consistent) | — none |

Multi-primary-per-screen: none confirmed. (Audit flagged `marketplace/page.tsx:694` — **false positive**, it's an
empty-state CTA, not a persistent control.)

## P5 — Filter / toggle / pill mapping  [V]

Active/inactive variant mapping is not standardized:

| Mapping (active / inactive) | Pages |
|---|---|
| `primary` / `subtle` | invoices, documents, reservations, settings/audit, payments(type) |
| `subtle` / `ghost` | units **desktop**, documents drawer, help |
| `primary` / `outline` | units **mobile**, crm mobile, coupons restriction pills |
| `subtle` / `outline` | crm desktop, payments(status) |
| custom border, `rounded-none` | marketplace browse/inquiries tabs |

- **Same page, different mobile vs desktop mapping** — units (mobile `primary/outline` vs desktop `subtle/ghost`), crm.
- **Shape** — mostly `rounded-full`, but marketplace tabs `rounded-none`, some default `rounded-md`.
- **A11y state** — `aria-pressed` on some, `aria-selected` on documents (both, redundant), none on payments/reservations/crm/help/landing.
- **Raw `role="switch"` toggles** (escape-hatched) — Pricing billing toggle, `admin/plans` isPublic, `admin/coupons` isActive — should adopt the shared `Switch` primitive (`@repo/ui`) for uniformity.

Decision needed later: pick one standard (suggest active=`primary` / inactive=`subtle`, `rounded-full`, `aria-pressed`,
`size="sm"`), and route true on/off switches to `Switch`.

## P6 — Shared-primitive adoption (broader, lower priority)

- **`DataTable`** — 14 pages hand-assemble raw `<Table>` (admin/coupons, admin/marketplace, admin/payments, admin/plans,
  admin/subscriptions, billing/invoices, contracts, maintenance/tickets, marketplace, my-listings, payments,
  reservations, settings/team, units); only crm, help, admin/tickets use `DataTable`. Large refactor — unlocks
  sorting/filtering/mobile-cards if migrated.  [R]
- **`PageHeader`/`PageIntro`** — ~7 pages hand-roll the title block (finance, leasing, maintenance, more, more/profile,
  onboarding, dashboard landing); ~28 pages use the primitive.  [R]
- **Good adoption (no action):** `EmptyState`, `KPICard`/`MobileKPICard`, `Skeleton` — consistently used.

---

## Suggested priority order for the action pass
1. **P1 status badges** — highest duplication, mechanical fix, big consistency win.
2. **P2 row-action pattern** — the visible inconsistency Omar flagged; needs a canonical pattern decision first.
3. **P3 + P4** — IconButton size/label standard + destructive/cancel variant rules (small, rule-driven).
4. **P5 pill standard** + route switches to `Switch`.
5. **P6** — `DataTable`/`PageIntro` adoption (larger, schedule separately).

_All read-only. No code changed by this audit._
