# Mimaric → Mimarek — Full Rebrand Implementation Plan

## Context
The CEO has issued a new corporate identity. The product is renamed **Mimaric → Mimarek**
(Arabic **ميماريك → معمارك**), with a new logo system, a **purple → teal/navy** palette, new
typography (**Satoshi + Tajawal**), and a new positioning line. This is overwhelmingly a UI +
brand-asset + documentation change — there is **no schema/data-model work**. The goal is a single,
clean cut-over release where every user-visible surface (and every internal doc/memory that governs
how we build) reflects Mimarek, verified across the mandatory 4 themes, with the §3.9 release gate
honored in full. The **pre-login landing page gets a full refresh** in the same release — new
screenshots, de-faked social proof, and modernized visuals (see layer **I**).

Source of truth for the new identity: `NewIdentity/Mmarek visual identity guidelines.pdf` (10 pages;
the PDF was exported from iOS Photos so it has no text layer — read by rasterizing to PNG) + the 8
delivered SVGs (`NewIdentity/*.svg`).

**Tooling status (installed this session):** the **`ui-ux-pro-max`** design skill, **Python 3.12**, and
**poppler** are installed. Poppler means the built-in `Read` tool will rasterize PDFs natively after the
next Claude Code restart (the WinRT/PowerShell render is no longer needed). The skill is invocable now,
and has already been run to corroborate the palette (see "Design-skill integration").

---

## Confirmed brand facts (from the PDF + your answers)

| Item | Old (Mimaric) | New (Mimarek) |
|---|---|---|
| Name (EN) | Mimaric | **Mimarek** |
| Name (AR) | ميماريك | **معمارك** |
| Category line | SAUDI PROPTECH • AUTOMATION & MANAGEMENT | **PROPTECH • DATA • REAL ESTATE** |
| Motto | — | **Manage units. Empower real estate.** |
| Secondary lines | — | "Unified data. Intelligent insights." / "Smarter decisions. Better performance." |
| Essence | — | Reliable · Efficient · Empowering |
| Latin font | DM Sans | **Satoshi** (Light/Regular/Medium/Bold) |
| Arabic font | IBM Plex Sans Arabic | **Tajawal** (Light/Regular/Medium/Bold) |
| Brand primary | Purple `#7339AC` | **Teal `#00707A`** |
| Rename scope | — | **Everything** — incl. GitHub repo + local folder |
| Delivery | — | **One release** |

### Color palette (authoritative — PDF p.3, with computed HSL)
| Role | Hex | HSL (approx) | Brand usage | Proportion |
|---|---|---|---|---|
| Deep Navy (foundation) | `#001B2A` | `201 100% 8%` | Headers, structure, dark-mode base, sidebar | 60% |
| Teal (primary action) | `#00707A` | `185 100% 24%` | CTAs, links, icons, focus ring, active nav | 20% |
| Bright Cyan (accent/hover) | `#14C0C0` | `180 81% 42%` | Hover, highlights, data accents | 10% |
| Light Cyan (surface) | `#E6F7F6` | `176 33% 94%` | Backgrounds, card surfaces (light) | 5% |
| Gray Blue (border/muted) | `#A6B2C3` | `215 20% 71%` | Borders, dividers, muted text | 5% |

> Logo-SVG reconciliation: the delivered SVGs encode teal `#008d9a` / navy `#031630` (an earlier
> export, marginally brighter than the PDF palette). **Decision: tokens follow the PDF values; SVGs
> ship as delivered.** Optionally normalize the SVG teal/navy to PDF values for pixel-consistency
> (low priority, flagged at approval).

---

## Design decisions & defaults (recommended — override at approval)

1. **Domain** (you chose "rename everything" but didn't pick one): default **`mimarek.sa`** for web +
   canonical + org site + emails (`admin@mimarek.sa`, …). Replaces both `mimaric.app` (SEO) and
   `mimaric.sa`. Social handles → `@mimarek_sa`.
2. **Repo + folder**: GitHub `GhamdiOmar/Mimaric` → **`GhamdiOmar/Mimarek`**; local
   `…/Projects/Mimaric` → **`…/Projects/Mimarek`**. The Claude memory directory is derived from the
   folder name, so it is **migrated** as an explicit step (copy `C--Users-…-Mimaric` →
   `C--Users-…-Mimarek`) — otherwise memory orphans.
3. **Premium gold accent** (`--accent` `#C4912A`): the new palette has **no gold**. Default: retire
   gold and repurpose `--accent` → **Bright Cyan `#14C0C0`** (the brand's designated highlight).
   Premium-tier surfaces use cyan. (Confirm if you want to keep a distinct premium color.)
4. **Semantic colors stay**: Red=danger, Amber=warning, Green=success, Blue=info are universal
   (AGENTS.md §6.2.8) and are **not** part of the brand change — kept (lightly retuned only if a
   §3.9 contrast check fails on the new surfaces).
5. **Satoshi delivery**: not on Google Fonts → **self-host via `next/font/local`** (download the free
   Satoshi woff2 set from Fontshare into `apps/web/app/fonts/`). Tajawal via `next/font/google`.

---

## The change, by layer

### A. Design tokens — `packages/ui/src/globals.css` (the heart)
Rewrite the brand token block for **both** `:root` (light) and `.dark`. Replace every purple hue
(270/268/265/260/258/256/255/262) with the navy/teal/cyan/gray-blue system. Per the agent audit, the
lines to change include (light) `--primary` 17, `--primary-deep` 18, `--ring` 77, `--sidebar-bg/deep`
80–81, `--sidebar-ring` 94, `--glow-primary` 114, `--chart-4` 129; (dark) `--primary` 136,
`--primary-deep` 137, surfaces 151/154/157/159/162, `--border/input` 187–188, `--ring` 189, sidebar
192–206, glass 209, `--chart-1` 224; plus the **hardcoded** `.dark .btn-primary/secondary`
(389–405) and `.mesh-bg` (585–588) blocks — convert those to `var(--primary)` / new navy.

Proposed core mapping (final HSLs tuned during §3.9 verification):
| Token | Light | Dark |
|---|---|---|
| `--primary` | `185 100% 24%` (Teal) | `183 68% 46%` (brightened teal/cyan for dark) |
| `--primary-deep` | `201 100% 12%` | `201 100% 7%` (Deep Navy base) |
| `--ring` / `--sidebar-ring` / `--glow-primary` | = `--primary` | = `--primary` |
| `--background` | `185 30% 98%` (near-white, faint cyan) | `200 45% 7%` (navy charcoal) |
| `--card` / surfaces | `0 0% 100%` / Light-Cyan tint | navy, one step lighter than bg (§6.13) |
| `--border` / `--input` / `--muted` | gray-blue `215 20% 88–93%` | navy-tinted `200 25% 16–18%` |
| `--accent` | `180 81% 42%` (Bright Cyan) | `180 75% 50%` |
| `--chart-1`/`--chart-4` | teal/cyan (de-purple) | teal/cyan |

Dark mode keeps §6.13 law: no shadows, elevate by lighter navy surfaces + hairline borders.

### B. Typography — `apps/web/app/layout.tsx` (+ tailwind font mapping)
- Remove `DM_Sans` import; add `Tajawal` via `next/font/google` and `Satoshi` via `next/font/local`
  (woff2 in `apps/web/app/fonts/`). Keep the CSS-var pattern: `--font-satoshi`, `--font-tajawal`
  (rename `--font-ibm-plex-arabic`/`--font-dm-sans` consumers in `globals.css`/tailwind config).
- Update AGENTS.md §6.3 type stack + the type-scale weights to Satoshi/Tajawal.

### C. Logo + brand assets
- Replace `apps/web/public/assets/brand/` PNGs with the new SVGs. Add: `primary-light.svg`,
  `primary-dark.svg`, `horizontal-light.svg`, `horizontal-dark.svg`, `icon-light.svg`,
  `icon-dark.svg` (from `NewIdentity/`). Regenerate favicon + `icons/icon-{32,192,512,maskable-512}.png`
  + `apple-touch-icon.png` from the icon mark.
- Rewrite the component: `MimaricLogo.tsx` → **`MimarekLogo.tsx`** (rename file + symbol +
  `MimarekLogoProps`), switch from the single `brightness(0) invert` PNG hack to the proper
  light/dark SVG variants (the brand provides real dark/reverse lockups — §6.18 "Do not alter
  colors"). Update all 12 import sites + the landing `<img>` in `Header.tsx`/`Footer.tsx`.
- `viewport.themeColor` dark in `layout.tsx` → navy `#001B2A`.

### D. User-facing copy (EN + AR) — ~130 strings
Find-and-replace `Mimaric→Mimarek`, `ميماريك→معمارك`, `MIMARIC→MIMAREK`, `معماري→معمارك` (seed
org) across the ~25 files the audit listed: `[locale]/layout.tsx`, `landing/translations.ts`,
`SchemaMarkup.tsx`, all `auth/*` pages, `cookie-policy`, `global-error`, `PortalClient`,
`settings`, `onboarding`, `help` + `lib/help-content.ts`, `admin/email`, `admin/seo`,
`PublishListingDialog`, `lib/export.ts`, `lib/report-pdf.ts`, and **`lib/email-templates.ts` +
`lib/email.ts`** (incl. the purple hex `#7339ac` → `#00707A`). Update taglines to the new lines.
Arabic copy passes through the **saudi-software-arabic-humanizer** skill for the new strings.

### E. Metadata / SEO / config
`layout.tsx` (title/template/OG/Twitter/siteName), `[locale]/layout.tsx`, `manifest.ts`
(name/short_name), `sitemap.ts`, `robots.ts`, `SchemaMarkup` org name+logo+url, admin SEO defaults
(`%s | Mimarek`, schemaOrgName), domain `mimaric.app/.sa → mimarek.sa`, social handles.

### F. Docs (the build-governance layer)
- **AGENTS.md** (design SSOT): §6.1.1 name/legal, §6.2.1 rename "Mimaric Purple" → the teal/navy
  system + new HSL/hex, §6.2.3 accent (gold→cyan decision), §6.3 fonts, §6.18 logo (component name,
  asset filenames, sizes), §7 repo URLs, §8/§9 seed domain. Color descriptors ("purple-deep tinted
  shadows", "Mimaric press state") updated.
- **CLAUDE.md** (root + repo), **README.md**, **CHANGELOG.md** (new rebrand entry — do **not**
  rewrite history; historical entries stay), `future-plans/REMAINING-WORK.md`, `loadtest/README.md`,
  `e2e/BILLING-TEST-PLAN.md`, `cspell.config.json` (add Mimarek/Satoshi/Tajawal), `.gitguardian.yaml`.

### G. Seed / tests / fixtures
`packages/db/prisma/seed.ts` + `seed-demo.ts`: org names (`Mimarek Real Estate Development Co.` /
`شركة معمارك للتطوير العقاري`), 14 `@mimaric.sa` → `@mimarek.sa` emails, URLs. E2E setup/spec creds,
`scripts/*.mjs`, `loadtest/login-and-browse.js`. **Password `mimaric2026`** → default keep (internal)
unless you want `mimarek2026` (touches gitguardian + docs + ~10 test files — easy but noisier).

### H. Memory (after merge)
Update memory files that name the brand (`project_mimaric_scope.md`, `feedback_mimaric_positioning.md`,
`feedback_mimaric_qa_gate.md`, `project_agents_md_sot.md`, `project_not_deployed.md`,
`reference_release_screenshot_verification.md`, the v4 handover, `MEMORY.md` index) + **migrate the
memory directory** to the renamed folder. Add a `project_rebrand_mimarek.md` capturing the cut-over.

### I. Pre-login landing page — full refresh (`apps/web/app/landing/`)
**Verification run (done, read-only):** I viewed the actual assets and audited all 11 sections
(`LandingPage.tsx` → Header, Hero, LogoBar, Stats, Features, HowItWorks, Vision2030, Pricing, FAQ,
FinalCTA, Footer + `SchemaMarkup`). The page is stale on **brand, product scope, AND content
credibility** — not just colors.

**I.1 — Regenerate all 5 product screenshots** (`public/assets/screenshots/{dashboard,finance,
maintenance,rentals,sales}.png`; Hero uses `dashboard.png`, Features uses the rest). Verified the
current ones show: the **old MIMARIC logo + old tagline**, the **purple sidebar/active nav**, an
**empty zero-data "Dummy Admin" state** (0 / 0% / blank charts — looks unfinished), a **dev annotation
baked into the finance page header**, and **removed nav items** (المشاريع/التخطيط/الأراضي =
Projects/Planning/Land, cut in v4.2.5). Recapture *after* the rebrand lands: logged in as a
**seed-demo org with populated data**, new teal/navy theme + Mimarek logo, current nav only, captured
via the §3.9 preview pipeline, then cropped to clean frames.

**I.2 — Remove fabricated content (credibility/legal risk):**
- `LogoBar.tsx:9-22` — fake stats (`500+`, `10,000+`, `50M+`) and fake "client" names rendered as text
  pills (`Al-Ofoq Real Estate`, `Modern Construction`, …). Supply **real** figures/logos or **cut** the
  section until we have them.
- `translations.ts` testimonials (AR 102-113 / EN 301-312) — 3 invented people+companies (names match
  the fake logos), one still literally says "Mimaric". Cut or replace with real, attributable quotes.
- `Hero.tsx:74` "Watch Demo" → wire a real demo/modal or relabel "See features" (today it just scrolls
  to `#features`).
- `Footer.tsx:33-54` company/legal/support links are all `#` no-ops → wire real routes (Help Center
  exists; `/cookie-policy` exists) or hide. `Footer.tsx:129` FAL "pending issuance" — confirm legal copy.

**I.3 — Brand/visual modernization (rides the token swap, layer A):**
- `Hero.tsx:37,41` inline `hsl(270…)` grid pattern → token/teal; `.mesh-bg` purple gradient
  (globals.css 583-589) → teal/navy; hardcoded `font-dm-sans` (`Hero.tsx:54`, `Pricing.tsx:197`) → Satoshi token.
- Logo: replace the raw `<img …/Mimaric_Official_Logo_transparent.png>` in `Header.tsx`/`Footer.tsx`
  with the new Mimarek SVG via a shared `BrandLogo`/`MimarekLogo` — drop the `brightness-0 invert`
  silhouette hack (we now have real light/dark/reverse lockups, §6.18 "do not alter colors").
- Swap raw `<img>` → `next/image` for the logo + hero screenshot.
- `FinalCTA.tsx:10` `from-primary via-primary to-primary` (flat) → a real teal→navy two-stop gradient.

**I.4 — Copy + SEO (folds into layers D/E):** all "Mimaric/ميماريك" landing strings, old tagline
(`translations.ts:196,396`), and `SchemaMarkup.tsx` hardcoded AR FAQs + `mimaric.app` → new brand/domain.

**I.5 — Structure/polish (P2/P3):** add missing section `id`s (HowItWorks/Stats/FAQ/FinalCTA) so nav
anchors resolve; star-rating `aria-label` (`Stats.tsx:63`); optional entry animations using the existing
`fade-in`/`slide-up` keyframes. Verify `Pricing.tsx` tiers (0 / 499 / 1,499 SAR, hardcoded) against the
real plans.

**Landing decisions needed (open items 6-8 below):** real-vs-cut for stats/logos/testimonials; pricing
accuracy; how to source the new screenshots (seed-demo populated org — recommended).

---

## Landmines — do NOT touch
- **`apps/web/lib/encryption.ts:128`** HKDF context `"mimaric/blind-index/v2/"` — changing it
  invalidates **every encrypted PII index** in the live DB. **Left verbatim.**
- **Cookie / storage keys** `mimaric-lang`, `mimaric-consent`, `mimaric.circlemenu.coachmark.v1` —
  live in real browsers. Default: **keep as-is** (internal, invisible). (Optional migration shim:
  read-old→write-new→delete-old; only if you want them renamed.)
- **ESLint plugin namespace** `mimaric/*` (rule names + ~30 `eslint-disable` sites) — pure internal
  tooling. Default: **keep** (rename is high-churn, zero user value).
- **k6 metric names** `mimaric_*` — internal telemetry; keep.
- **CHANGELOG history + `compare/` links** — historical record; keep (GitHub redirects old repo URLs).

---

## Design-skill integration (ui-ux-pro-max) — installed & how it's used
**Status:** installed at `~/.claude/skills/ui-ux-pro-max/`. It is a CLI design-intelligence engine
(`python scripts/search.py "<query>" --design-system | --domain <ux|color|chart|typography> | --stack <s>`),
**not** a code generator — and our identity is already fixed, so it is a **quality lens + validator**,
never the source of the palette.

How it's used:
1. **Corroboration (already run):** its PropTech profile independently returns a **teal** primary
   ("Trust teal + professional blue", `#0F766E`) and a **dark-navy financial-dashboard** pattern with
   green positive indicators — i.e. it *validates* the CEO's teal/navy palette and our "keep
   green=success" decision. Confidence, not new direction.
2. **Per-view design pass (during implementation):** before building each major surface (tokens,
   dashboard, CRM, finance charts, auth) run `search.py --domain ux|chart|color` and apply the
   returned rules. Its chart guidance (Line=trend, Bar=ranking, Recharts) matches AGENTS.md §6.9.4
   and our existing Recharts code; its typography pick (Cinzel/Josefin, a luxury-landing pairing) is
   **overridden** by the brand-mandated Satoshi+Tajawal.
3. **Pre-delivery checklist** (folded into Verification below): focus rings, 4.5:1 contrast, skip
   links, `aria-live`/`role=alert` errors, `prefers-reduced-motion`, ≤2 animations/view, ease-out/in,
   skeletons, responsive 375/768/1024/1440, no-emoji icons, `cursor-pointer` + smooth hover.
4. **Paired with** the in-repo `design:accessibility-review` + `design:design-critique` skills and the
   **mandatory `/mimaric-qa` gate (§3.11)** as the pre-release QA.

**Decision — do NOT `--persist` the skill's `design-system/MASTER.md` into the repo.** AGENTS.md §6 is
the single design SoT (project rule); a parallel MASTER.md would drift. The skill stays a
generator/checklist; AGENTS.md §6 is updated with the new brand and remains authoritative.

**Rejected skill tip:** its checklist says "use `bg-primary`, not `var()` wrapper" — we deliberately
use `hsl(var(--token))` (Tailwind v4 token system, AGENTS.md §6.13). Keep our tokens; ignore that tip.

---

## Execution sequence (manager mode, §3.2)
1. **Branch `rebrand/mimarek`** (commit nothing on `main`). Tooling (`ui-ux-pro-max` + Python +
   poppler) is already installed. Download the Satoshi woff2 set (Fontshare) into `apps/web/app/fonts/`;
   run the skill's `--design-system` + per-domain passes to seed the per-view checklist.
2. **Tokens** (globals.css light+dark) + **fonts** (layout + tailwind) → build green.
3. **Logo component + assets + favicons** → swap SVGs, rename component, fix 12+ call sites.
4. **Copy + metadata + SEO + email templates** (EN/AR, Arabic via humanizer skill).
5. **Docs** (AGENTS.md first — it's the SSOT — then CLAUDE.md/README/CHANGELOG/configs).
6. **Seed/tests/scripts** → domain + names; `npm run build`, `vitest`, e2e green.
7. **`/mimaric-qa`** subagent gate → fix every finding (validate per §3.8) → re-run clean.
8. **§3.9 release gate** (below). Then **repo rename** + **folder rename** + **memory migration** +
   tag/release + **graphify refresh** (§7).

Delegation: Sonnet subagents per layer (tokens, copy-EN, copy-AR+humanizer, docs, seed/tests);
main thread reads every diff + owns build/verify/QA (delegate-and-validate, §3.8).

---

## Verification (§3.4 / §3.9 — mandatory, evidenced in chat)
- `npm run build` green (full prod build, not just typecheck).
- Preview server up; for the top touched routes — **`/auth/login`, `/dashboard`, `/dashboard/crm`,
  landing `/`, `/dashboard/finance` (charts), `/dashboard/admin`** — capture **4 screenshots each**
  (light-LTR, light-RTL, dark-LTR, dark-RTL) showing teal/navy + new logo + new fonts; derive the
  touched-route list from the Graphify graph (god-node `globals.css`/logo radius).
- `preview_console_logs` → zero errors; Tab-through focus ring is teal; mobile 375×812 pass on 3
  routes; email-template render check (purple→teal); claim check: **no purple remains** (grep
  `#7339AC`/`hsl(270`/`text-purple-` = 0 hits) and **no "Mimaric" in user-facing copy**.
- Screenshots posted in chat **before** any tag.
- **ui-ux-pro-max pre-delivery checklist** (per touched view): no-emoji icons; `cursor-pointer` +
  smooth (150–300ms) hover; visible focus ring; light-mode text ≥4.5:1; `prefers-reduced-motion`
  honored; responsive at 375/768/1024/1440; borders visible in **both** themes.
- **Landing `/` specifically:** all 5 screenshots regenerated (new teal/navy + Mimarek logo + populated
  demo data + current nav — no Projects/Planning/Land); **zero fake stats/testimonials/dead CTAs**; logo
  via `next/image`; renders clean in light-LTR/RTL + dark-LTR/RTL.

## Release (§7)
Commit + CHANGELOG entry → PR → CI green → merge → tag `vX.Y.0` + GitHub release (compare link) →
**graphify `/graphify . --update` (mandatory)** → repo rename → folder rename → memory migration.

---

## Open items to confirm at approval
1. Domain = **`mimarek.sa`**? (or `mimarek.app` for web + a separate mail domain)
2. Premium accent: **retire gold → Bright Cyan**? (or keep a distinct premium color)
3. Seed password: keep **`mimaric2026`** or change to `mimarek2026`?
4. Cookie/ESLint-namespace renames: **keep internal** (recommended) or rename with shims?
5. Normalize logo SVG teal/navy to exact PDF values, or ship SVGs as delivered (recommended)?
6. **Landing social proof** — supply **real** client logos + stats + testimonials, or **cut** those
   sections (LogoBar/Stats/testimonials) until we have attributable ones? (Recommended: cut the fake
   ones now; re-add when real.)
7. **Landing screenshots** — regenerate from a **seed-demo populated org** (recommended) so the
   marketing shots show realistic data, not the empty "Dummy Admin" state?
8. **Pricing** — are the hardcoded tiers (0 / 499 / 1,499 SAR) current, or should they be updated /
   sourced from config?
