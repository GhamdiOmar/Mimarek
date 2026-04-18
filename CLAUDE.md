# Mimaric Development Guidelines

> This file is the **single source of truth** for all Mimaric development and design decisions across desktop, tablet, and mobile, in both Arabic (RTL) and English (LTR), and both light and dark themes.

---

## 1. User Preferences
- **NEVER add Co-Authored-By or any Claude/Anthropic attribution to git commits.** Omar Alghamdi is the sole author.
- Proceed autonomously without asking for approvals.

---

## 2. Project Architecture
- Turborepo monorepo: `apps/web` (Next.js 16), `apps/portal`, packages (`@repo/db`, `@repo/ui`, `@repo/types`)
- NextAuth v5 with Credentials provider, JWT strategy, edge-safe split (`auth.config.ts` / `auth.ts`)
- Prisma 7.4.2 with `@prisma/adapter-pg` connecting to Supabase PostgreSQL
- Server Actions pattern for all data operations (NOT REST)
- Multi-tenancy via `organizationId` filtering in all server actions
- Bilingual UI (Arabic/English) with RTL/LTR support
- Tailwind v4 with `@import "tailwindcss"` — preflight resets button display to inline-block

---

## 3. Critical Development Rules

### 3.1 UI-First Principle
- Every page, feature, CRUD function, export/import, configuration, or action MUST be accessible through the UI. When creating a new page, always add a navigation link (sidebar, topbar, or contextual button). When adding a server action, always wire it to a UI control. Never leave functionality orphaned without a user-facing path to reach it.
- **Checklist for every new feature**: (1) Is there a nav link or button to reach it? (2) Can the user discover it without knowing the URL? (3) Are related CRUD actions exposed through the UI? (4) Are export/import functions surfaced in the page header or action menu?

### 3.2 Workflow Orchestration
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re-plan immediately.
- Write detailed specs upfront to reduce ambiguity.
- Use subagents liberally to keep main context window clean — one task per subagent for focused execution.

### 3.3 Self-Improvement Loop
- After ANY correction from the user, update CLAUDE.md with the lesson learned.
- Write rules that prevent the same mistake from recurring.
- Ruthlessly iterate on these rules until mistake rate drops.

### 3.4 Verification Before Done
- Never mark a task complete without proving it works (build, preview, or test).
- Diff behavior between main and changes when relevant.
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness.
- **UI Testing is mandatory for every change that touches a page, component, or server action wired to the UI:**
  1. Start or reload the preview server
  2. Navigate to the affected page(s)
  3. Exercise the golden path AND at least one edge case
  4. Take a screenshot as proof and include it in the response
  5. Check browser console for errors — zero errors = done
- NEVER report a UI task as complete based on TypeScript compilation alone. A clean build ≠ a working UI.
- NEVER skip this step with "the logic is straightforward" — verify, screenshot, done.
- **Cross-theme verification:** for any UI change, test BOTH light + dark and BOTH Arabic + English (minimum 4 screenshots).

### 3.5 Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution."
- Skip this for simple, obvious fixes — don't over-engineer.
- Challenge your own work before presenting it.

### 3.6 Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding.
- Point at logs, errors, failing tests — then resolve them.
- Zero context switching required from the user.
- Go fix failing CI tests without being told how.

### 3.7 Core Principles
- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Only touch what's necessary. No side effects with new bugs.

### 3.8 Subagent Finding Verification (Never Trust Summaries for Critical Claims)
- Subagents are useful for discovery and breadth. They are NOT authoritative for absence claims.
- **The rule:** Any finding that says something security-critical, compliance-critical, or architecturally significant is MISSING must be verified with a direct Read or Grep before being reported.
- "Subagent said it's missing" is NOT sufficient evidence. Go read the file yourself.
- This applies to: security gaps, missing permissions, missing audit logging, missing validation, missing tests, missing error handling — any claim that something important does not exist.
- Verification steps for absence claims:
  1. Grep the codebase for the pattern you expect to find
  2. Read the relevant file(s) directly
  3. Only then report the finding as confirmed
- If you cannot verify due to context limits, state explicitly: "I was unable to directly verify this — treat as unconfirmed."
- Reporting an unverified gap as confirmed fact is worse than missing a real gap. False findings waste engineering time and erode trust.

---

## 4. Key Technical Notes
- Use `prisma db push` not migrations (DB has drift from initial setup)
- Prisma Decimal serialization: use `JSON.parse(JSON.stringify())` in server actions
- Button component needs inline `style={{ display: "inline-flex" }}` to override Tailwind v4 preflight
- CI needs `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST` env vars at job level
- Turbo needs `globalEnv` declaration for env vars to pass through to build tasks

---

## 5. Saudi Government Schema Alignment
- Customer model aligned with Absher (nationalId, personType, gender, DOB, address, documentInfo)
- Organization model aligned with MOC (entityType, legalForm, registrationStatus, etc.)
- Project model aligned with Balady (parcelNumber, deedNumber, landUse, coordinates, etc.)

---

## 6. DESIGN SYSTEM — SINGLE SOURCE OF TRUTH

This section supersedes any other design document in the repo. If `packages/ui/src/globals.css` diverges from this spec, either the code is wrong or this file is — reconcile, don't duplicate.

### 6.1 Brand Identity

**Positioning:** Mimaric is a **Saudi-first PropTech SaaS** for real estate developers. Automates property lifecycle — project management, sales, rentals, leasing, finance — compliant with Vision 2030 infrastructure (ZATCA, Ejar, REGA, Wafi).

**Personality:** Trusted & professional · Modern & Saudi · Precise & intelligent · Arabic-first, English-capable.

**Name formats:**
- English: **MIMARIC** (uppercase in display contexts)
- Arabic: **ميماريك**
- Pronunciation: Mi-MAR-ik (from معماري — architect)
- Legal: Mimaric PropTech Co.

**Voice:** Confident (no hedging). Clear (short sentences, no jargon). Bilingual (Arabic primary, English follows). Professional (formal in contracts/finance, warmer in onboarding).

### 6.2 Color System

#### 6.2.1 Primary Brand — Mimaric Purple

| Token | Light HSL | Dark HSL | Approx Hex Light | Approx Hex Dark | Use |
|---|---|---|---|---|---|
| `--primary` | `270 50% 45%` | `270 55% 62%` | `#7339AC` | `#9E69D3` | All primary CTAs, focus rings, links, active nav, selection highlights |
| `--primary-deep` | `268 40% 20%` | `265 30% 10%` | `#3E2760` | `#181024` | Shadow tints, sidebar background, deep surfaces |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | `#FFFFFF` | `#FFFFFF` | Text on primary surfaces |

**Mimaric Purple is the single UI brand color.** Every interactive primary affordance (primary buttons, focus outlines, brand badges, selection states, sidebar active indicators) uses it.

#### 6.2.2 Secondary — Circuit Green

| Token | Light HSL | Dark HSL | Hex | Use |
|---|---|---|---|---|
| `--secondary` | `158 50% 32%` | `160 45% 42%` | `#297D54` / `#3DA176` | Success states, positive KPIs, confirmation buttons, active checkmarks |
| `--green-bright` | `155 55% 38%` | `155 55% 45%` | — | PCB bright green — hover glow, success micro-interactions |

#### 6.2.3 Accent — Horizon Gold

| Token | Light HSL | Dark HSL | Hex | Use |
|---|---|---|---|---|
| `--accent` | `40 55% 48%` | `42 50% 55%` | `#C4912A` / `#C89A44` | **Premium tier only** — luxury property labels, upgrade prompts, enterprise plan callouts. Use sparingly. |

#### 6.2.4 Neutral / Surface Tokens

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `220 20% 97%` | `260 25% 7%` | App background |
| `--foreground` | `215 25% 27%` | `250 15% 90%` | Body text |
| `--card` | `0 0% 100%` | `258 20% 11%` | Card surface |
| `--popover` | `0 0% 100%` | `256 18% 14%` | Popover / menu surface |
| `--muted` | `216 20% 93%` | `258 15% 16%` | Muted bg |
| `--muted-foreground` | `215 15% 50%` | `255 10% 58%` | Muted text |
| `--border` | `216 18% 90%` | `258 15% 18%` | Borders, dividers |
| `--ring` | same as `--primary` | same as `--primary` | Focus ring color |

#### 6.2.5 Semantic Colors

| Token | Light HSL | Dark HSL | Use |
|---|---|---|---|
| `--destructive` | `0 72% 51%` | `0 62% 55%` | Delete, overdue, critical errors |
| `--success` | same as `--secondary` | same as `--secondary` | Confirm, approve, paid |
| `--warning` | `28 72% 50%` | `28 72% 55%` | Pending, expiry, maintenance |
| `--info` | `210 65% 50%` | `210 65% 55%` | Informational banners, neutral links |

#### 6.2.6 Chart Colors (ordered, hue-stable across themes)

1. `--chart-1` Blue (info) — `210 65% 50%` / `270 55% 65%`
2. `--chart-2` Green — `158 50% 38%` / `160 50% 50%`
3. `--chart-3` Gold — `40 55% 52%` / `42 55% 58%`
4. `--chart-4` Purple tint — `280 45% 55%` / `210 65% 60%`
5. `--chart-5` Magenta — `340 55% 55%` / `340 55% 60%`

#### 6.2.7 Logo-Mark Navy — NOT a UI color

| Name | Hex | Rule |
|---|---|---|
| Deep Circuit Navy | `#102038` | **Used only inside the 3D logo illustration.** Not a UI token. Never use as text, button, or surface color in the app. |
| Brand Navy | `#182840` | Same rule. Logo-only. |

If a design needs a dark navy-like tone, use `--primary-deep` (purple-dark) — consistency with the brand system.

#### 6.2.8 Color Rules (hard)

- **One primary brand color.** Mimaric Purple. Never introduce a second primary.
- **Semantic colors only** — Blue=info, Red=danger, Amber=warning, Green=success, Gold=premium. No decorative color.
- **Contrast ≥ 4.5:1** for body text, ≥ 3:1 for large text and UI icons (WCAG 2.2 AA).
- **Light mode depth** = shadows (low opacity, high blur).
- **Dark mode depth** = NO shadows — elevate surfaces by making them *lighter* than background (card 11% L > background 7% L) plus hairline white borders (`0 0 0 1px hsl(0 0% 100% / 0.03)`).
- **Chart hues stay stable between themes** — shift only lightness/saturation so users don't lose category recognition when toggling themes.
- **Never use Circuit Green as text on white** — contrast insufficient. Green is for backgrounds and filled elements only.

### 6.3 Typography

#### 6.3.1 Typefaces

| Role | Family | Weights | Use |
|---|---|---|---|
| **Primary (Arabic + UI default)** | IBM Plex Sans Arabic | 300, 400, 500, 600, 700 | All Arabic text + primary UI font |
| **Latin (English + numbers)** | DM Sans | 300, 400, 500, 600, 700 | English UI, numbers, prices (SAR), dates |
| **Monospace** | IBM Plex Mono | 400, 700 | Contract IDs, invoice numbers, unit codes, IBAN, API keys |

Load all three via `next/font/google` at root layout. CSS variables: `--font-ibm-plex-arabic`, `--font-dm-sans`, `--font-ibm-plex-mono`.

#### 6.3.2 Type Scale

| Token | Size | Line-height | Weight | Use |
|---|---|---|---|---|
| `display` | 36px (clamp 28→36) | 1.2 | 700 | Hero headings |
| `h1` | 28px | 1.3 | 700 | Page titles |
| `h2` | 22px | 1.35 | 600 | Section headings |
| `h3` | 18px | 1.4 | 600 | Widget headings |
| `h4` | 16px | 1.45 | 600 | Card titles |
| `body-lg` | 16px | 1.6 | 400 | Primary body |
| `body` | 14px | 1.6 | 400 | Table content, default UI |
| `caption` | 12px | 1.5 | 400 | Timestamps, helpers |
| `label` | 11px | 1.4 | 600 | Input labels (UPPERCASE tracking 0.05em) |

#### 6.3.3 Arabic-Specific Tuning (Hard Rules)

- Bump line-height for Arabic: h1/h2 → `1.15`, h3/h4 → `1.25`, h5/h6 → `1.35`.
- Optical letter-spacing: h1/h2 `-0.03em`, h3/h4 `-0.02em`, h5/h6 `-0.01em`.
- **Zero letter-spacing on Arabic body text** — it breaks ligatures.
- No tashkeel (diacritics) in UI labels unless content specifically demands it.
- Arabic needs ~1px larger size for equivalent visual weight — scale bumps already baked into globals.css `[lang="ar"]` overrides.

#### 6.3.4 Number Rendering

- Western digits (0–9) by default in both languages — modern Saudi standard.
- Tabular-nums (`font-variant-numeric: tabular-nums`) on every column of numbers.
- Numeric values always LTR in Arabic context — wrap in `<span dir="ltr">` or `.number-ltr` class (defined in globals.css).

### 6.4 Spacing & Layout

#### 6.4.1 Spacing Scale (4pt grid, 8pt preferred)

`0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128`

| Use | Values |
|---|---|
| Inside components (icon-label gap, input padding) | `4, 8, 12, 16` |
| Between components | `16, 24, 32` |
| Between sections | `48, 64, 96` |

#### 6.4.2 App Shell Sizes

| Element | Size |
|---|---|
| Sidebar expanded | 256px |
| Sidebar collapsed | 68px |
| Top nav bar | 64px |
| Mobile top bar | 48px (`h-mobile-appbar`) |
| Mobile bottom tabs | 64px (`h-mobile-bottomnav`) |
| Modal max width | 600px |
| Drawer width | 480px |
| Max content width (desktop) | 1440px |

#### 6.4.3 Breakpoints

| Token | Min width | Target |
|---|---|---|
| `xs` | 360px | Small phones |
| `sm` | 640px | Large phones landscape |
| `md` | 768px | Tablet portrait — mobile shell ends here |
| `lg` | 1024px | Tablet landscape / small laptops |
| `xl` | 1280px | Desktop (default target) |
| `2xl` | 1536px | Large desktop / ultrawide |

#### 6.4.4 Border Radius

| Token | Value | Use |
|---|---|---|
| `sm` | 6px | Inputs, badges |
| `md` | 10px | Buttons, cards |
| `lg` | 16px | Modals, sheets |
| `xl` | 24px | Hero cards, mobile sheets |
| `full` | 9999px | Pills, avatars |

#### 6.4.5 Shadows (light mode only — see 6.13 for dark)

```css
--shadow-sm:    0 1px 3px hsl(var(--primary-deep) / 0.10), 0 1px 2px hsl(var(--primary-deep) / 0.06);
--shadow-md:    0 4px 6px hsl(var(--primary-deep) / 0.07), 0 2px 4px hsl(var(--primary-deep) / 0.06);
--shadow-lg:    0 10px 15px hsl(var(--primary-deep) / 0.10), 0 4px 6px hsl(var(--primary-deep) / 0.05);
--shadow-modal: 0 25px 50px hsl(var(--primary-deep) / 0.25);
```

Shadows are purple-deep tinted (not neutral black) to carry brand identity.

#### 6.4.6 Z-Index Scale

| Token | Value |
|---|---|
| dropdown | 1000 |
| sticky | 1020 |
| fixed | 1030 |
| backdrop | 1040 |
| modal | 1050 |
| popover | 1060 |
| tooltip | 1070 |
| toast | 1080 |
| mobile-appbar | 30 |
| mobile-fab | 35 |
| mobile-bottomnav | 40 |
| mobile-sheet | 50 |

### 6.5 Iconography

**Primary library:** [Lucide](https://lucide.dev) (`lucide-react`). Do NOT mix with Phosphor, Heroicons, or custom SVG sets except where a specific icon is missing.

- Icon size matches text line-height (16px for body, 20px for sidebar, 24px for KPI duotone).
- Minimum touch target: **44×44px** (`h-11 w-11` on icon-only buttons).
- Every icon-only button MUST have `aria-label`.
- Never use emojis in product UI.

#### 6.5.1 RTL Icon Rules

**Directional icons (mirror in RTL):** `ArrowRight`, `ArrowLeft`, `ChevronRight`, `ChevronLeft`, `CornerUpLeft`, `CornerUpRight`, `Reply`, `LogOut`, `Undo`, `Redo`, indent arrows.

**Non-directional (never mirror):** `Heart`, `Star`, `Bell`, `Search`, `X`, `Check`, `Settings`, `Home`, `User`, `AlertTriangle`, media controls (Play/Pause), clocks.

**Pattern — use the `DirectionalIcon` wrapper (to be built):**
```tsx
<DirectionalIcon icon={ChevronRight} />
// Auto-flips via CSS when inside dir="rtl"
```

CSS class available in globals.css: `.icon-directional { transform: scaleX(-1); }` applied in RTL.

### 6.6 Buttons

#### 6.6.1 Variants

| Variant | Background | Text | Use |
|---|---|---|---|
| `primary` | Mimaric Purple `--primary` | White | Main CTA — one per screen |
| `secondary` | White / `--card` | `--foreground` + border | Cancel, alternative actions |
| `success` | `--secondary` (green) | White | Confirm, approve, paid |
| `destructive` | `--destructive` (red) | White | Delete, remove, archive-permanent |
| `ghost` | Transparent | `--foreground` | Tertiary, inline |
| `outline` | Transparent + border | `--foreground` | Low-emphasis alt |
| `subtle` | `--muted` | `--foreground` | Toolbar buttons, inline filters |
| `link` | None | `--primary` | Text-only link actions |
| `premium` | `--accent` (gold) | `--primary-deep` | Upgrade / premium tier only |

**Hard rule:** Max ONE `primary` button per screen. Two primaries = one should be secondary.

#### 6.6.2 Sizes & Touch Targets

| Size | Height | Padding-X | Font | Use |
|---|---|---|---|---|
| `sm` | 32px | 12px | 13px | Table toolbars, dense UI |
| `md` | 40px | 16px | 14px | Default |
| `lg` | 48px | 20px | 16px | Mobile primary CTAs, landing |
| `icon` | 36–44px square | — | — | Icon-only (44px mobile, 36px desktop dense) |

**Mobile minimum touch target: 44×44px (`h-11 w-11`).**

#### 6.6.3 States (all 6 mandatory)

| State | Behavior |
|---|---|
| Default | Resting appearance per variant |
| Hover | `filter: brightness(1.06)` OR `/85` bg opacity |
| Active | `translateY(1px)` + 16–20% darker bg |
| Focus-visible | 2px ring at `--ring` (Mimaric Purple), 2px offset |
| Disabled | `opacity: 0.45`, `cursor: not-allowed`, no hover change |
| Loading | Spinner replaces leading icon or prepends to label; width stays stable; disable onClick |

**Post-action micro-feedback (optional `state` prop):**
- `success` — checkmark for 1.5s (e.g., "Copied!")
- `error` — shake + red border for 1.5s

#### 6.6.4 Other Rules

- Labels are **verbs**: "Save changes", "Add unit", "Delete lease". Never "OK", "Yes", "Submit" alone.
- Cancel + primary pattern: `[Cancel] [Save]` in LTR, `[حفظ] [إلغاء]` in RTL (primary on the leading edge in RTL = right).
- Destructive actions require confirmation modal OR 5-second undo toast.
- Never use `alert()`.
- Haptic feedback on mobile primary actions via `navigator.vibrate(10)` where supported.

### 6.7 Forms & Inputs

- **Single-column layouts** unless fields are semantically parallel (first/last name, street/city).
- **Labels above inputs**, never beside (faster scan, cleaner RTL).
- Required fields marked with `*` + one-line legend "Required fields marked with *" at top of form.
- Optional fields marked with `(optional)` after the label — don't hide the fact.
- Inline validation AFTER blur, not on every keystroke (exception: password strength meter).
- Error messages under the field, red border, one-sentence action.
- Helper text under labels for format hints (e.g., "National ID — 10 digits starting with 1 or 2").
- Never use `placeholder` as the label — accessibility fail.

**Input types matter:**

| Data | Input |
|---|---|
| Email | `type="email"` + `inputmode="email"` + `autocomplete="email"` |
| Phone | Use `SaudiPhoneInput` primitive (6.19) |
| Money (SAR) | `SARAmount` primitive — handles thousands separator, 2 decimals |
| Long text | `textarea` with autogrow + character counter when bounded |
| Date | Native for narrow ranges; custom picker with Hijri toggle for records |
| National ID | `NationalIdInput` primitive (6.19) |
| CR | `CRInput` primitive (6.19) |

**Save behavior:**
- Explicit save button for transactional edits.
- Auto-save only for draft content (notes, comments) with visible "Saved ✓" indicator.
- Unsaved-changes warning on nav away.
- Optimistic UI update, revert with toast on failure.

**Form sizing:**
- 1–8 fields → modal (desktop) / bottom sheet (mobile).
- 9+ fields or multi-section → full page.
- Linear multi-step → wizard/stepper.
- Edit-in-context → right drawer (LTR) / left drawer (RTL).

### 6.8 KPI Cards

#### 6.8.1 Mandatory Anatomy (all 8 fields)

```tsx
<KPICard
  label="Monthly Revenue"              // 1. Label — noun phrase, text-caption muted
  value={1250000}                      // 2. Value — text-h1 bold
  unit="SAR"                           // 3. Unit — body muted, trailing
  format="currency-compact"            // Renders "1.25M SAR"
  delta={{ value: 12.4,                // 4. Delta — % or absolute
           direction: "up",            //    direction: up | down | flat
           isGoodIfUp: true }}         //    sets semantic color
  comparisonPeriod="vs. last month"    // 5. Comparison period — ALWAYS state it
  trend={last30Days}                   // 6. Trend — sparkline array (required desktop + mobile)
  href="/dashboard/finance"            // 7. Drill-down — click opens full view
  lastUpdated={timestamp}              // 8. Last-updated — "5 min ago"
/>
```

#### 6.8.2 Tiering — `tier: "hero" | "standard" | "utility"`

Every dashboard has one North Star metric (§ 6.9.1). The `tier` prop tells the card how to visually rank itself:

| Tier | When | Visual |
|---|---|---|
| `hero` | **Exactly one per dashboard.** The North Star metric. | Value `clamp(36px → 48px)`. Left accent bar 6px. Taller sparkline (48px). Optional `secondaryInsight` one-liner under the value (e.g. "+12 leases vs. same week last year"). `shadow-md` instead of `shadow-card`. |
| `standard` | Default. Primary KPIs beside the hero. | Value 30px. Left accent bar 4px. Sparkline 32px. Eight-field anatomy unchanged. |
| `utility` | Secondary / metadata / filter-panel metrics. | Value 20px. No accent bar. No sparkline. No icon. Used in rows below the hero + primary row. |

**Hard rule:** exactly one `tier="hero"` per dashboard — that's the North Star. More than one hero defeats the tiering.

The legacy `compact` prop maps to `tier="utility"` for back-compat and is deprecated.

#### 6.8.3 Layout Rules

- **Max 4 KPI cards per row** on desktop (`xl+`). 2 per row on tablet (`md`). 1 stacked on mobile.
- **Hero row:** hero card spans 2 columns on desktop, full-width on mobile. Place it leading-left (LTR) / leading-right (RTL).
- **Max 8 KPIs above the fold.** Force prioritization.
- **Never repeat the same KPI** twice on the same page.
- Grid gap `16px` or `24px` — CSS grid, not margins.
- Left accent bar (4px standard / 6px hero / none on utility) for category cue.

#### 6.8.4 States

- Loading: skeleton with same dimensions, `animate-pulse`.
- Empty (no data): render `— — —` not `0` to distinguish from a true zero.
- True zero: render "0 new leases this month" plainly.
- Hover: tooltip with exact value + timestamp.
- Click: drill to full report; filter state persisted in URL.

#### 6.8.5 Typography Inside Cards

| Element | Standard | Hero | Utility | Weight |
|---|---|---|---|---|
| Label | 12px | 14px | 11px | 500, text-muted |
| Value | 30px | clamp(36,48) | 20px | 700, text-foreground |
| Unit | 14px | 16px | 14px | 400, text-muted |
| Delta | 11px | 12px | 11px | 600, semantic color |
| Comparison period | 11px | 12px | hidden | 400, text-muted |
| Secondary insight (hero only) | — | 14px | — | 400, text-muted |

### 6.9 Dashboards & Metrics

#### 6.9.1 Framework — North Star + 4 Quadrants

Every dashboard MUST have:
1. **One North Star metric** — largest, top-leading position, defines success for this role.
2. **Leading indicators** — predict North Star movement.
3. **Lagging indicators** — results.
4. **Health/risk metrics** — what's breaking.
5. **Activity metrics** — real-time state.

#### 6.9.2 Role-Based Dashboards (required)

| Role | Route | North Star |
|---|---|---|
| Platform Admin | `/dashboard/admin` | Active orgs growth |
| Org Owner / Developer | `/dashboard` | NOI or project pipeline value |
| Leasing / Sales | `/dashboard/leasing` | Leases signed MTD |
| Finance / Accounting | `/dashboard/finance` | % rent collected on-time |
| Maintenance | `/dashboard/maintenance` | Open tickets / SLA % |

No one-dashboard-fits-all. Users see only their role's metrics by default.

#### 6.9.3 Mandatory Dashboard Header

- Page title + role indicator.
- **Date-range picker** with presets: Today, This Week, This Month, Last Month, This Quarter, YTD, Custom.
- **"Last updated X ago"** timestamp — auto-refreshes, click to force refresh.
- Export dropdown: CSV / XLSX / PDF snapshot.

#### 6.9.4 Charts

**Library:** Recharts (already installed). Use it.

| Comparison | Chart |
|---|---|
| Parts of a whole | Donut (≤5 slices) or 100% stacked bar |
| Trend over time | Line (1 series) / multi-line (2–4 series) |
| Many categories over time | Stacked area or small multiples |
| Ranking | Horizontal bar (sorted) |
| Distribution | Histogram, box plot |
| Correlation | Scatter |
| Geo | Choropleth, pin map |

**Avoid:** 3D charts, pie with >5 slices, dual-axis lines without clear labels.

**Every chart must have:** title, axis labels, legend, data labels on hover, accessible color palette (6.2.6), empty/loading/error state.

#### 6.9.5 Property-Management-Specific Metrics (Mimaric canon)

**Developer / Org Owner dashboard:**
- Off-plan sales (SAR) MTD
- Units sold / reserved (count + % of portfolio)
- Collections this month (% of target)
- Open maintenance tickets
- Project milestones on/off track
- WAFI escrow balance

**Leasing dashboard:**
- Leases signed MTD
- Tours today
- Pending applications
- Pipeline by stage
- Lost reasons breakdown

**Finance dashboard:**
- Rent roll (current month expected vs. collected)
- AR aging (0–30, 31–60, 61–90, 90+)
- Late fees collected
- ZATCA invoice status

**Maintenance dashboard:**
- Open tickets by category
- Avg resolution time
- Tickets > 7 days old (SLA breach)
- Tickets by property / unit

### 6.10 Tables & Data Grids

**Target primitive:** TanStack Table v8 (planned migration from the current custom `DataTable`).

#### 6.10.1 Required Features

- Multi-column sort.
- Per-column filter (popover with multi-select chips).
- Column show/hide + reorder (persisted per user).
- Saved views (DB-backed).
- Export (CSV, XLSX) from header menu.
- URL-synced state for filter/sort/page — dashboards must be shareable.
- Row actions: icon-on-hover in last column OR three-dot menu.
- Bulk actions via checkbox selection.
- Pagination OR virtualized infinite scroll (never both).
- Keyboard navigation (arrows, Enter to open).
- Empty / loading / filtered-empty states (6.12).

#### 6.10.2 Column Rules

- Max 7 columns visible by default — rest behind "Columns" toggle.
- Freeze identifying column (name/ID) on horizontal scroll.
- Right-align numbers/currency/% in LTR, start-align in RTL (numbers still flow LTR within the cell).
- Truncate long text with ellipsis + tooltip — never wrap mid-row.
- Fixed widths for numeric columns (tabular-nums); flexible for text.

#### 6.10.3 Row Density

- `compact` 32px / `default` 40px / `comfortable` 56px.
- User-toggleable via density dropdown. Persisted per user.

#### 6.10.4 Mobile Behavior

Tables transform to cards at `<md`. The card shows the identifying column + 2–3 key fields. Tap to open full record.

### 6.11 Banners, Toasts, Modals, Sheets

#### 6.11.1 Pick the right component

| Pattern | When |
|---|---|
| **Page banner** | System-wide state (trial ending, degraded service) — sticky top |
| **Section banner** | Context for a view (filter applied, no data yet) |
| **Toast** | Transient feedback for user-initiated action (saved, copied) — auto-dismiss 4s |
| **Modal** (desktop) | Blocking decision the user must make now |
| **Bottom sheet** (mobile) | Mobile equivalent of modal — slide-up, swipe-dismiss |
| **Inline error** | Field-level validation under the input |

Use `ResponsiveDialog` — one component renders modal on desktop, bottom sheet on mobile.

#### 6.11.2 Banner Taxonomy

| Type | Color | Icon | Dismissible |
|---|---|---|---|
| Info | blue bg / blue 600 text | `Info` | Yes |
| Success | green bg / green 700 text | `CheckCircle` | Auto-dismiss 4s |
| Warning | amber bg / amber 800 text | `AlertTriangle` | Yes |
| Error | red bg / red 700 text | `AlertCircle` | Manual only |
| Promotional | primary tint | Custom | Yes |

**Banner anatomy:** `[Icon] [Heading bold] [Body 1 sentence max 2 lines] [Action button] [×]`

- Max 2 lines of copy.
- Max 1 action button.
- Dismiss `×` on trailing edge (right LTR / left RTL).
- Never stack more than 2 banners vertically — collapse to "2 issues ⌄".

#### 6.11.3 Toast Rules

| Property | Value |
|---|---|
| Position desktop | Bottom-right (LTR) / bottom-left (RTL) |
| Position mobile | Bottom-center with safe-area padding |
| Max width | 360px |
| Auto-dismiss | 4s (adjustable 3–6s) |
| Max visible | 3 stacked |
| Animation | Slide-in from edge + fade, 250ms `ease-out` |

#### 6.11.4 Content Rules (Hard)

- **Error messages MUST be customer-facing friendly** — never show stack traces, status codes, variable names, "undefined", raw exception messages.
- Every error explains **what happened** + **what to do next**.
  - ❌ "Error 500: Internal Server Error"
  - ✅ "We couldn't save your changes. Try again or contact support."
- Arabic error copy reviewed by native speaker — no machine translation.
- Never silently `console.error()` without showing the user something went wrong.
- Never use `alert()` for errors — use banner, toast, or field-level inline validation.

### 6.12 Empty / Loading / Error / Offline States

Every data-backed view MUST handle all six:

| State | Rule |
|---|---|
| **Initial load** | Skeleton matching real layout dimensions, `animate-pulse`. Never a bare spinner. |
| **Empty first-time** | **5-element formula** (see § 6.12.1). |
| **Empty after filter** | "No results for '[X]'" + "Clear filters" button. |
| **Partial load** | Show what you have, spinner for what's pending. |
| **Error** | Icon + "What happened" + "Retry" button + "Contact support" link. |
| **Offline / stale** | Banner: "Offline — showing cached data from 2 min ago. Retry when you're back online." |

**Skeleton > Spinner** for anything > 1s. Spinners only for button loading states.

**Error boundaries:** every route segment (`app/dashboard/**/error.tsx`) — catch thrown errors, show friendly state, log to observability.

#### 6.12.1 Empty-first-time — 5-element formula

An empty surface the user sees for the very first time is a teaching moment: it should tell the user what this screen *does for them*, give them the primary action to populate it, and an escape hatch to learn more. Use the `<EmptyState>` primitive with all five slots:

1. **Contextual title** — subject-specific. `"No contracts yet"`, not `"No data"`. Bilingual.
2. **One-line value statement** (`description` prop) — what this surface helps the user accomplish, in one sentence. `"Track every lease and sale from draft to signed."` / `"تتبّع كل عقد إيجار أو بيع من المسودة حتى التوقيع."`
3. **Primary CTA** (`action`) — the create/import verb as a `<Button>`. `"Create contract"` / `"إنشاء عقد"`.
4. **Optional secondary action** (`secondaryAction`) — a lateral path when applicable: `"Import from Ejar"`, `"Upload CSV"`, `"View templates"`.
5. **Optional help-article link** (`helpHref` + `helpLabel`) — deep-link to an anchor on `/dashboard/help`, e.g. `"Learn about contracts"`.

Example:

```tsx
<EmptyState
  icon={<FileText className="h-12 w-12" />}
  title={t("No contracts yet", "لا توجد عقود بعد")}
  description={t(
    "Track every lease and sale from draft to signed.",
    "تتبّع كل عقد إيجار أو بيع من المسودة حتى التوقيع.",
  )}
  action={<Button onClick={openCreate}>{t("Create contract", "إنشاء عقد")}</Button>}
  secondaryAction={<Button variant="ghost" onClick={openImport}>{t("Import from Ejar", "استيراد من إيجار")}</Button>}
  helpHref="/dashboard/help#contracts"
  helpLabel={t("Learn about contracts", "تعرّف على العقود")}
/>
```

Guardrails:
- Title ≤ 8 words in EN, ≤ 6 words in AR. No trailing punctuation.
- Value statement ≤ 1 sentence, ≤ 14 words. Lead with the user benefit, not the system state.
- Primary CTA label is always a verb. Never `"OK"` / `"Got it"`.
- Omit slots 4 and 5 when you have nothing useful to put there — don't pad with noise.

Filter-empty states skip the formula and instead pair `"No results for '[query]'"` with a `"Clear filters"` button. Error-state stays on the § 6.11.4 friendly-error contract.

### 6.13 Dark & Light Mode

- **Dark mode is first-class** — separately designed, not inverted. Warm charcoal (`hsl(260 25% 7%)`) base with layered card surfaces.
- **Light mode**: shadows for depth.
- **Dark mode**: NO shadows — elevate by making surfaces lighter than bg + hairline white borders.
- **`enableSystem={true}`** on `ThemeProvider` — respect OS preference by default.
- **No `dark:` Tailwind utilities in components** — use CSS variables (`bg-card`, `text-foreground`). A single class toggle on `<html>` flips the entire theme without re-render cascades.
- **Chart hues stable across themes** — lightness/saturation shift only.
- **Semantic colors re-tuned for dark** — destructive/success/warning/info all have dark-mode-specific HSL.
- **Every UI change verified in both themes** (minimum 2 of the required 4 screenshots).

### 6.14 Responsive — Desktop / Tablet / Mobile

#### 6.14.1 Desktop (≥1280px)

- Use the full width — max content 1440px, don't center a 640px column on a 1920px screen.
- Three-pane layout where sensible: sidebar + list + detail.
- Keyboard-first — Cmd-K palette, `?` for shortcut help, j/k navigation, Esc to close.
- Hover states everywhere (row hover, icon hover, tooltip hover).
- Right-click context menus for power features — not replacements for primary actions.
- Density toggle (compact / default / comfortable) on data-heavy views.
- Resizable panels where it helps (using `resizable` primitive).

#### 6.14.2 Tablet (768–1279px)

- Portrait (~744–834px): sidebar collapses to icon-only, grids go 2-column.
- Landscape (~1024–1366px): sidebar expanded, grids go 3-column, tables stay.
- Apple Pencil / stylus: signature capture, annotations on floor plans.
- Magic Keyboard attached: enable keyboard shortcuts (detect via `pointer: fine`).
- Property inspection flows (photos + forms + signatures) optimized for iPad landscape.
- **Offline-first** for field flows — service worker + IndexedDB cache, mutation queue.

#### 6.14.3 Mobile (<768px)

- **Single column** everywhere.
- **Bottom tab bar** (3–5 items) for primary navigation.
- **FAB** (z-35) for the single most important create action per section.
- **Sticky CTA at bottom** — primary action in a sticky footer bar, not buried.
- **Bottom sheets > modals** — use `ResponsiveDialog` so same API works both.
- **Tables → cards** at `<md`. Always.
- **Pull-to-refresh** on all list views.
- **Swipe gestures** on list rows (archive/delete) — always pair with visible buttons, never gesture-only.
- **Sticky section headers** on long Arabic lists.
- **Safe-area insets** respected: `pb-safe-bottom`, `pt-safe-top`, `env(safe-area-inset-*)`.
- **Font-size ≥16px** on inputs to prevent iOS Safari focus-zoom.
- **44×44px minimum touch target** (`h-11 w-11`).
- **Haptics** on primary actions where supported.

#### 6.14.4 Cross-Device Feature Parity

| Action frequency | Device coverage |
|---|---|
| Daily hot actions (80%) | Desktop + Tablet + Mobile full support |
| Weekly workflows (15%) | Desktop + Tablet full; Mobile read-only if needed |
| Admin / bulk ops (5%) | Desktop only acceptable — show "Open on desktop" nudge on mobile |

Never break on mobile — redirect gracefully.

### 6.15 RTL / Arabic-First (Hard Rule)

**Mimaric is Saudi-targeted. Arabic RTL is the default. LTR is secondary.**

- `<html dir="rtl" lang="ar">` on first load. Switch dynamically via `LanguageProvider`.
- Every feature, component, layout, and flow works in RTL **first**, then LTR.
- Arabic must feel **native, not translated**. Native-speaker review required.

#### 6.15.1 Logical CSS Properties (mandatory)

| ✅ Use | ❌ Don't use |
|---|---|
| `margin-inline-start` / `ms-*` | `margin-left` / `ml-*` |
| `padding-inline-end` / `pe-*` | `padding-right` / `pr-*` |
| `border-inline-start` | `border-left` |
| `inset-inline-start` / `start-*` | `left` / `left-*` |
| `text-align: start` | `text-align: left` |

Tailwind v4 logical utilities: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `border-s-`, `border-e-`.

#### 6.15.2 What Mirrors vs. Doesn't

**Mirrors:** layout direction, nav order, progress bars, breadcrumbs, directional chevrons/arrows, caret position, calendars.

**Does NOT mirror:** numbers (0–9 always LTR), media controls, clocks, logos, phone numbers, emails, URLs, code blocks, charts' time axis.

#### 6.15.3 Number/Date/Currency in Bilingual UI

| Item | Rule |
|---|---|
| Numbers | Western digits (0–9), tabular-nums, LTR-wrapped in Arabic context |
| Currency SAR | `Intl.NumberFormat("ar-SA"/"en-SA", { currency: "SAR" })`. Display: `1,250.00 ر.س` (AR) / `SAR 1,250.00` (EN) |
| Dates | Gregorian primary + Hijri in tooltip; per-user toggle in settings |
| Phone | `+966 5X XXX XXXX`, always LTR |
| Percentage | `25%` both languages |
| Contract/Invoice IDs | Mono font, LTR |

Use `Intl.DateTimeFormat(locale, { calendar: "islamic" })` for Hijri. See `apps/web/lib/hijri.ts`.

#### 6.15.4 Directional Icon Pattern

Build once, use everywhere:
```tsx
// packages/ui/src/components/DirectionalIcon.tsx
export function DirectionalIcon({ icon: Icon, className, ...rest }) {
  return <Icon className={cn("icon-directional", className)} {...rest} />;
}
```
Globals.css already has `[dir="rtl"] .icon-directional { transform: scaleX(-1); }`. Use `<DirectionalIcon icon={ChevronRight} />` for every directional arrow/chevron.

### 6.16 Motion & Animation

```css
--motion-fast:    150ms;
--motion-base:    250ms;
--motion-slow:    400ms;
--motion-stagger: 60ms;

--ease-out:    cubic-bezier(0.0, 0.0, 0.2, 1);
--ease-in:     cubic-bezier(0.4, 0.0, 1.0, 1.0);
--ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

**Defaults:**
- Hover: 150ms ease-out.
- Press: 100ms (transform only).
- Modal/sheet entrance: 250–400ms ease-out with scale + translateY.
- KPI card stagger: 60ms between cards, 250ms each (fade-up).
- Toast slide-in: 250ms ease-out.

**Always respect `prefers-reduced-motion`:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration:  0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 6.17 Accessibility (WCAG 2.2 AA)

**Non-negotiables:**
- Color contrast ≥ 4.5:1 body, ≥ 3:1 large text / icons.
- `:focus-visible` ring on every interactive element — 2px at `--ring`, 2px offset.
- Keyboard nav: every action via Tab / Enter / Esc / arrows.
- `aria-label` on every icon-only button.
- Every input has an associated `<label>` — `placeholder` is NOT a label.
- ARIA live regions for async notifications (toasts, banners).
- `prefers-reduced-motion` respected.
- Skip-to-content link at top of app.
- `lang="ar"` + `dir="rtl"` on Arabic content for screen readers.

**CI checks:**
- `axe-core` via `@axe-core/react` in dev mode.
- Lighthouse accessibility score ≥ 95 on all dashboard routes in both themes.

**Manual checks per PR:**
- Full Tab-through of changed routes without a mouse.
- Screen reader pass on changed components (VoiceOver on Mac, NVDA on Windows).

### 6.18 Logo Usage

#### 6.18.1 Logo System

The Mimaric logo is a **3D isometric design** with four locked elements:
1. **Logo mark** — three 3D isometric buildings forming stylized "M"; outer two in navy `#182840`, center clad in green PCB circuit pattern `#107840` → `#20A050` with white dot nodes.
2. **English wordmark** — "MIMARIC" large bold navy uppercase.
3. **Arabic wordmark** — "ميماريك" large bold navy.
4. **Tagline** — "SAUDI PROPTECH • AUTOMATION & MANAGEMENT" small light-weight full-width.

**Conceptual DNA:** navy buildings = physical real estate; green PCB = digital automation layer; together = Saudi PropTech.

#### 6.18.2 Logo Variants

| Variant | File | Background |
|---|---|---|
| Primary (transparent) | `Mimaric_Official_Logo_transparent.png` (1890×921) | White / `#F8F9FA` / any light surface |
| Dark-bg splash | `Mimaric_Official_Logo.png` (2000×2000) | Pure black / dark navy splash screens only |
| Mark-only | Crop to mark area | Favicon, collapsed sidebar, app icon |

> Vector files (SVG/AI/EPS) are pending designer delivery. Until then, always use PNG at native resolution.

#### 6.18.3 Clear Space & Minimum Size

- Clear space = height of "M" in MIMARIC wordmark, on all four sides. No text or graphic may enter.
- Digital minimum: 200px wide (full logo), 32px wide (mark-only).
- Print minimum: 50mm wide (full logo), 12mm wide (mark-only).

#### 6.18.4 Logo Do's and Don'ts

**✅ Do:**
- Use transparent variant on all light backgrounds.
- Use dark-bg variant on black splash screens only.
- Maintain minimum clear space.
- Use highest-resolution PNG — never upscale.
- Use mark-only crop for favicon / collapsed sidebar.

**❌ Don't:**
- Stretch/distort — always maintain 1890:921 aspect ratio.
- Recolor any element (navy buildings, green circuit, dark wordmark stay fixed).
- Add drop shadows, glows, outlines, filters.
- Place on colored backgrounds other than white or pure black.
- Rotate, tilt, or skew.
- Separate the four locked elements (except for mark-only variant).
- Place over busy backgrounds (photos, gradients).
- Display below 200px on screen.
- Recreate the 3D mark in CSS, SVG, or code.

#### 6.18.5 Logo Size Reference

| Context | Variant | Width |
|---|---|---|
| Login brand panel | dark | 240px |
| Login form panel | light | 160px |
| Sidebar expanded | dark | 140px |
| Sidebar collapsed | mark-only | 36px |
| Top navigation bar | light | 120px |
| Mobile top bar | light | 100px |
| Splash / loading | dark | 200px |
| Email header | light | 180px |
| Favicon | mark crop | 32px |
| Apple touch icon | mark crop | 180px |

#### 6.18.6 Reusable `<MimaricLogo>` Component

```tsx
// packages/ui/src/components/MimaricLogo.tsx
import Image from "next/image";

export function MimaricLogo({
  variant = "light",
  width = 160,
  className = "",
}: { variant?: "light" | "dark"; width?: number; className?: string }) {
  const src =
    variant === "dark"
      ? "/assets/brand/Mimaric_Official_Logo.png"
      : "/assets/brand/Mimaric_Official_Logo_transparent.png";
  const height = Math.round(width * (921 / 1890));
  return (
    <Image
      src={src}
      alt="Mimaric — Saudi PropTech, Automation & Management | ميماريك"
      width={width}
      height={height}
      priority
      className={className}
    />
  );
}
```

Use `next/image` for automatic WebP/AVIF conversion. Preserve transparent channel.

#### 6.18.7 Asset Placement

```
apps/web/public/assets/brand/
├── Mimaric_Official_Logo_transparent.png   ← primary
├── Mimaric_Official_Logo.png               ← dark bg / splash
└── mimaric-favicon.png                     ← 32×32 mark crop
```

### 6.19 Saudi-Specific Inputs (to build)

These primitives live in `packages/ui/src/components/saudi/`:

| Component | Spec |
|---|---|
| `<NationalIdInput>` | 10 digits, must start with 1 or 2, format display `1XXX XXX XXX`. Validate checksum per Absher rules. |
| `<CRInput>` | 10 digits (Commercial Registration). |
| `<SaudiPhoneInput>` | Auto-format `+966 5X XXX XXXX`. Accept raw 05XXXXXXXX. Store E.164. |
| `<SARAmount>` | Currency input — thousands separator, 2 decimals, suffix ر.س in AR / SAR in EN. |
| `<HijriDatePicker>` | Dual-calendar picker, defaults to Gregorian, Hijri toggle per-user setting. |
| `<AddressPicker>` | Region → City → District cascade, populated from Balady district list. |

All use bilingual labels, native Arabic/English placeholders, full RTL, and server-side validation.

---

## 7. Release Process (After Every Implementation)
- After completing any implementation task: commit, update CHANGELOG.md, push to GitHub, verify CI passes.
- Tag releases with semantic versioning (major.minor.patch).
- Create GitHub release with release notes summarizing changes.
- Never leave uncommitted work at the end of a task session.

### 7.1 Release Notes Discipline (Hard Rule)
- **Every tagged version MUST have a matching GitHub release** at `https://github.com/GhamdiOmar/Mimaric/releases/tag/<vX.Y.Z>`. A tag without a published release is a failure.
- **CHANGELOG.md is the source; the GitHub release mirrors it.** Update `CHANGELOG.md` as part of the same commit that bumps the version — never after the fact.
- **When the merge that ships a release lands on `main`:**
  1. Tag the merge commit: `git tag -a vX.Y.Z <sha> -m "vX.Y.Z — <headline>"` then `git push origin vX.Y.Z`.
  2. Create (or edit) the release: `gh release create vX.Y.Z --title "..." --notes-file <path> --latest` (or `gh release edit vX.Y.Z --notes-file <path>` if the tag/release already exists).
  3. Release notes derive from the matching `CHANGELOG.md` section, reformatted for GitHub: headline paragraph, grouped headline changes, deferred items, upgrade notes, and a `compare` link to the previous tag.
- **Every subsequent commit that is user-visible under a released version** (hotfix, follow-up a11y fix, copy change) — update the release notes for that version via `gh release edit` the same day. Don't let the published notes drift from reality.
- **Patch-level bumps (`vX.Y.Z+1`)** — a new tag + new release, not an edit of the previous one. Edits are only for corrections to the notes of a version whose scope hasn't changed.
- **No "Generated with Claude Code" or Co-Authored-By lines** in release notes or commit messages (§ 1).
- **Compare link convention:** every release body ends with `**Full diff:** https://github.com/GhamdiOmar/Mimaric/compare/<prev-tag>...<this-tag>`.

---

## 8. Access Model — Tenant vs System (Hard Rule)

Mimaric is a B2B SaaS. **Two distinct user universes must never share surfaces, permissions, or data.**

### 8.1 The Two Tiers

| Tier | Roles | Purpose | Binds to an Organization? |
|---|---|---|---|
| **System (platform staff)** | `SYSTEM_ADMIN`, `SYSTEM_SUPPORT` | Operate the Mimaric product — manage tenants, billing, support, SEO, platform-wide health | **No.** `organizationId = null`. They are never members of a tenant org. |
| **Tenant (customer users)** | `ADMIN`, `MANAGER`, `AGENT`, `LEASING`, `FINANCE`, `TECHNICIAN`, `USER` | Run a single real-estate org's day-to-day — properties, CRM, deals, contracts, payments, maintenance | **Yes.** `organizationId` required at seed/signup. |

### 8.2 What Each Tier Can See

**System users (SYSTEM_ADMIN / SYSTEM_SUPPORT)** — see ONLY platform surfaces:
- `/dashboard/admin` — platform KPIs (orgs, MRR, active users, platform health)
- `/dashboard/admin/tickets` — cross-tenant support tickets
- `/dashboard/admin/seo` — marketing site SEO
- `/dashboard/admin/coupons`, `/dashboard/admin/subscriptions` — billing/plans control
- `/dashboard/more` — shared "more" menu (audience-filtered)
- `/dashboard/notifications` — their own notifications (shared audience)

**System users MUST NOT see:** `/dashboard`, `/dashboard/units`, `/dashboard/crm`, `/dashboard/deals`, `/dashboard/contracts`, `/dashboard/payments`, `/dashboard/maintenance`, `/dashboard/leasing`, `/dashboard/finance`, `/dashboard/reports`, `/dashboard/documents`, `/dashboard/help`, `/dashboard/billing` (tenant subscription page), `/dashboard/settings` (tenant org + team settings), or any tenant-scoped data. They also MUST NOT be offered tenant create-actions in Cmd-K (`New customer`, `New deal`, `New contract`, etc.). Layer 2 middleware (`authorized` in `apps/web/auth.config.ts`) redirects system users to `/dashboard/admin` when they hit any non-allowlisted `/dashboard/**` path.

> **Planned follow-up:** a dedicated platform-billing surface and a system-user account/profile page are not yet built. Until they ship, `/dashboard/billing` and `/dashboard/settings` are tenant-only — the Layer 2 redirect sends system users back to `/dashboard/admin`.

**Tenant users** — see their **own org's** tenant surfaces per role permissions (see § 6.9.2 dashboards + `lib/permissions.ts`). They MUST NOT see any `/dashboard/admin/*` route or platform-level KPIs.

### 8.3 Enforcement (layered — all three required)

1. **Navigation filter** — `navItems` in `apps/web/components/shell/nav-items.ts` uses `audience: "tenant" | "platform"`. Sidebar / More / Cmd-K all filter on `isSystemRole(userRole)` before rendering. **Quick-action shortcuts must filter by audience too, not just permission.**
2. **Route guard** — every `/dashboard/admin/**` route enforces `isSystemRole` server-side; every tenant route (`/dashboard/crm`, `/dashboard/units`, …) rejects when `isSystemRole(userRole)` is true. Guard in the route-level `layout.tsx` or at the top of `page.tsx`.
3. **Server-action guard** — every tenant server action requires a non-null `organizationId` on the session; every platform action requires `isSystemRole`. Permission check alone is insufficient — `SYSTEM_ADMIN` has all permissions by role, so audience check is mandatory.

### 8.4 Permissions ≠ Audience

`SYSTEM_ADMIN` is seeded with `ALL_PERMISSIONS` (including `crm:read`, `properties:read`, etc.). This is intentional — platform staff need full permissions inside admin-scoped support tooling. **Therefore, permission alone NEVER gates tenant vs platform.** Always check `audience` or `isSystemRole` in addition to `hasPermission`.

### 8.5 Common Leak Patterns (watch for these in review)

- Cmd-K "Quick actions" (`New customer`, `New deal`, …) filtered by permission only — leaks to SYSTEM_ADMIN.
- Dashboard widgets linking to tenant routes without audience check.
- Breadcrumbs or "recent items" surfacing tenant records in an admin session.
- `revalidatePath("/dashboard/<renamed>")` after the route is deleted — causes confusing stale-data bugs.
- Seed file giving `SYSTEM_ADMIN` / `SYSTEM_SUPPORT` an `organizationId` — every system user seeded for tests must have `organizationId: null`.

---

## 9. Test Credentials (Seed Data — Local/Dev Only)

**Default password for all users is `mimaric2026`** (set at `packages/db/prisma/seed.ts`), except where noted. Never commit real user credentials.

### 9.1 System (Platform) Users

| Email | Role | Password | Use |
|---|---|---|---|
| `system@mimaric.sa` | `SYSTEM_ADMIN` | `mimaric2026` | Full platform admin — `/dashboard/admin/*`, billing, org management |
| `support@mimaric.sa` | `SYSTEM_SUPPORT` | `mimaric2026` | Support tier — cross-tenant ticket management |
| `dev_admin@mimaric.sa` | `SYSTEM_SUPPORT` | `mimaric2026` | Secondary support account |

### 9.2 Tenant Users (org: Mimaric test org)

| Email | Role | Password | Use |
|---|---|---|---|
| `admin@mimaric.sa` | `ADMIN` | `mimaric2026` | Org owner — full tenant access |
| `pm@mimaric.sa` | `MANAGER` | `mimaric2026` | Property manager |
| `sales_mgr@mimaric.sa` | `MANAGER` | `mimaric2026` | Sales manager |
| `property_mgr@mimaric.sa` | `MANAGER` | `mimaric2026` | Property manager |
| `fatima@mimaric.sa` | `MANAGER` | `finance2026` | Finance manager (distinct pw) |
| `ahmed@mimaric.sa` | `AGENT` | `sales2026` | Sales agent (distinct pw) |
| `khalid@mimaric.sa` | `TECHNICIAN` | `sales2026` | Maintenance tech (distinct pw) |
| `buyer@mimaric.sa` | `USER` | `mimaric2026` | End-user / buyer persona |
| `tenant@mimaric.sa` | `USER` | `mimaric2026` | End-user / tenant persona |
| `user@mimaric.sa` | `USER` | `mimaric2026` | Generic user |

### 9.3 How to Test Access Separation

When verifying access-control work:
1. Log in as `system@mimaric.sa` → confirm sidebar/More/Cmd-K show ONLY admin routes (no properties, units, CRM, deals, contracts, payments, maintenance).
2. Log in as `admin@mimaric.sa` → confirm sidebar/More/Cmd-K show ONLY tenant routes (no `/dashboard/admin/*`).
3. Attempt direct URL access (e.g., system user to `/dashboard/crm`, tenant user to `/dashboard/admin`) — both must redirect or 403.
4. Re-seed via `pnpm --filter @repo/db prisma db seed` if credentials drift from this table.

---

*Last consolidated: 2026-04-17. When this file and `packages/ui/src/globals.css` diverge, reconcile — don't duplicate.*
