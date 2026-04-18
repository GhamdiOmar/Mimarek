<div align="center">

# Mimaric — ميماريك

**Saudi-first PropTech SaaS for real estate developers.**

Automate the full property lifecycle — project management, sales, rentals, leasing, and finance — on a platform built for Vision 2030 compliance (ZATCA · Ejar · REGA · Balady · Wafi · Absher).

[![CI](https://github.com/GhamdiOmar/Mimaric/actions/workflows/ci.yml/badge.svg)](https://github.com/GhamdiOmar/Mimaric/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/version-4.0.0-7339AC)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![Arabic](https://img.shields.io/badge/%D8%B9%D8%B1%D8%A8%D9%8A-first-00875A)

</div>

---

## Why Mimaric

Saudi real estate runs on a fragmented stack — Excel sheets for rent rolls, WhatsApp threads for tours, paper contracts for Ejar, and separate tools for ZATCA e-invoicing. Mimaric is one platform that replaces all of them, and it speaks Arabic first.

- **One workspace per developer** — properties, units, customers, deals, contracts, payments, maintenance tickets, and documents, all tenant-isolated by `organizationId`.
- **Saudi-native data model** — customer records aligned with Absher (nationalId, personType, Hijri DOB), organizations aligned with MOC (CR, entityType, legalForm), projects aligned with Balady (parcelNumber, deedNumber, coordinates).
- **Bilingual by design** — every screen, every email, every error message ships in Arabic (RTL) and English (LTR) with native-speaker-reviewed copy.
- **Role-based dashboards** — the CFO doesn't see the same thing as the leasing agent. Five dashboards ship out of the box (Org Owner, Platform Admin, Leasing, Finance, Maintenance), each with one North Star KPI and tiered supporting metrics.

## Who it's for

- **Real estate developers** — track off-plan sales, WAFI escrow, project milestones, and construction-to-handover.
- **Property managers** — run rent rolls, AR aging, lease renewals, and maintenance tickets across entire portfolios.
- **Brokerage / leasing teams** — pipeline, tours, applications, commission tracking, stage-tinted CRM Kanban.
- **Finance teams** — ZATCA e-invoicing, collections, late-fee automation, Hijri/Gregorian dual-calendar reports.

---

## Product surface

| Area | What ships |
|---|---|
| **Projects** | Parcel/deed records, site plans, phases, milestones, WAFI escrow tracking |
| **Properties & Units** | Multi-building portfolio, status flows (available → reserved → sold/rented → maintenance), density-togglable card view |
| **CRM** | Lead pipeline, stage-tinted Kanban, tour scheduling, quick-actions (call · WhatsApp · email), drag-to-stage |
| **Deals** | Offer → negotiation → reservation → closing, per-stage pipeline value |
| **Contracts** | Sale & lease with Hijri date picker, Ejar-ready exports, e-signature slots |
| **Payments** | Installment schedules, AR aging (0–30 / 31–60 / 61–90 / 90+), overdue/paid tone coding |
| **Maintenance** | Tickets, preventive schedules, SLA breach tracking, technician assignment |
| **Documents** | Blueprints, permits, legal documents — categorized vault with storage usage |
| **Reports** | CSV / XLSX / PDF exports from every data-backed surface |
| **Platform admin** | Tenant orgs, subscriptions, coupons, cross-tenant support tickets, SEO settings |

## Access model

Two universes that never share surfaces or data:

- **System users** (`SYSTEM_ADMIN`, `SYSTEM_SUPPORT`) — operate the product itself. `organizationId = null`. See only `/dashboard/admin/*`.
- **Tenant users** (`ADMIN`, `MANAGER`, `AGENT`, `LEASING`, `FINANCE`, `TECHNICIAN`, `USER`) — run their own organization. Bound to a single `organizationId`. See only their org's tenant surfaces.

Separation is enforced in three layers: navigation filter, route guard, and server-action audience gate. See [CLAUDE.md § 8](CLAUDE.md#8-access-model--tenant-vs-system-hard-rule) for the full spec.

---

## Tech stack

| Layer | Choice |
|---|---|
| **Framework** | Next.js 16.1 (App Router, Turbopack, Server Actions) |
| **UI** | React 19 · Tailwind v4 · Radix primitives · `lucide-react` icons · Recharts · TanStack Table v8 |
| **Auth** | NextAuth v5 with Credentials provider, JWT strategy, edge-safe split |
| **Database** | Prisma 7.4 with `@prisma/adapter-pg` → Supabase PostgreSQL |
| **Monorepo** | Turborepo · npm workspaces |
| **Types** | TypeScript 5.9 |
| **Testing** | Playwright E2E · `@axe-core/react` runtime a11y · cspell |
| **i18n** | Bilingual (AR/EN) with RTL/LTR via CSS logical properties |
| **Theming** | CSS-variable tokens · `next-themes` with `enableSystem=true` · WCAG 2.2 AA contrast |

## Repository layout

```
.
├── apps/
│   ├── web/              # Next.js app — dashboards, auth, server actions
│   └── portal/           # Customer-facing portal (WIP)
└── packages/
    ├── db/               # Prisma schema, client, seed, migrations
    ├── ui/               # Design system — primitives + Saudi inputs + KPICard
    ├── types/            # Shared TypeScript types
    ├── eslint-config/    # Shared ESLint config
    └── typescript-config/# Shared tsconfig
```

Design system source of truth: [CLAUDE.md § 6](CLAUDE.md#6-design-system--single-source-of-truth) and [`packages/ui/src/globals.css`](packages/ui/src/globals.css).

---

## Getting started

### Prerequisites

- **Node.js ≥ 18**
- **npm 11** (the repo pins `packageManager` to `npm@11.6.2`)
- A **Supabase PostgreSQL** database (or any Postgres 14+)
- **UploadThing** account for file uploads (optional for local dev without uploads)

### 1. Clone & install

```bash
git clone git@github.com:GhamdiOmar/Mimaric.git
cd Mimaric
npm install
```

### 2. Configure env

```bash
cp .env.example .env.local
# Fill in DATABASE_URL, DIRECT_URL, AUTH_SECRET, UPLOADTHING_*, NEXT_PUBLIC_SUPABASE_*
```

`AUTH_SECRET` can be generated with `openssl rand -base64 32`.

### 3. Push schema & seed

> The DB uses `prisma db push` (no migrations) because of schema drift from initial setup.

```bash
npx turbo run db:generate         # generate Prisma client
cd packages/db
npx prisma db push                # sync schema to database
npx prisma db seed                # seed test users + sample tenant data
cd ../..
```

Default seed password is `mimaric2026`. See [CLAUDE.md § 9](CLAUDE.md#9-test-credentials-seed-data--localdev-only) for the full credentials table.

### 4. Run

```bash
npm run dev                       # starts apps/web on http://localhost:3000
```

Visit [`http://localhost:3000/auth/login`](http://localhost:3000/auth/login) and sign in with one of the seeded accounts:

| Role | Email | Dashboard |
|---|---|---|
| Platform admin | `system@mimaric.sa` | `/dashboard/admin` |
| Org owner | `admin@mimaric.sa` | `/dashboard` |
| Finance | `fatima@mimaric.sa` (pw: `finance2026`) | `/dashboard/finance` |
| Sales agent | `ahmed@mimaric.sa` (pw: `sales2026`) | `/dashboard/leasing` |
| Technician | `khalid@mimaric.sa` (pw: `sales2026`) | `/dashboard/maintenance` |

---

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start all apps in dev mode |
| `npm run build` | Build every workspace |
| `npm run lint` | Lint everything |
| `npm run check-types` | Typecheck everything |
| `npm run format` | Prettier write across `**/*.{ts,tsx,md}` |
| `cd apps/web && npx playwright test` | Run E2E tests |
| `npx cspell "**/*.{ts,tsx,md,mdx,json}"` | Spell-check |

---

## Design system

Mimaric ships a first-class design system — see [CLAUDE.md § 6](CLAUDE.md#6-design-system--single-source-of-truth) for the full 600-line spec. Highlights:

- **Brand** — Mimaric Purple (`hsl(270 50% 45%)`) is the single UI color. Semantic colors only: blue=info · red=danger · amber=warning · green=success · gold=premium tier.
- **Typography** — IBM Plex Sans Arabic + DM Sans + IBM Plex Mono, loaded via `next/font/google` with AR-specific line-height and letter-spacing tuning.
- **KPI anatomy** — 8-field contract (label · value · unit · delta · comparisonPeriod · trend · drill-down href · lastUpdated) with `hero` / `standard` / `utility` tier prop. Each dashboard has **exactly one** hero (the North Star).
- **Empty states** — 5-element formula (icon · title · value statement · primary CTA · optional secondary action + help link) on every data-backed surface.
- **RTL-first** — logical CSS properties throughout (`ms-/me-/ps-/pe-/start-/end-`). Directional icons wrapped in `<DirectionalIcon>`. Numbers always LTR in Arabic context.
- **Dark mode** — separately designed, not inverted. No shadows in dark; elevation via lighter surfaces + hairline borders.
- **Accessibility** — WCAG 2.2 AA baseline, `@axe-core/react` in dev, axe-Playwright on 5 dashboards × 2 themes in CI, Lighthouse a11y ≥ 95.

Saudi-specific input primitives live in [`packages/ui/src/components/saudi/`](packages/ui/src/components/saudi/): `NationalIdInput` (Absher 10-digit + checksum), `CRInput` (commercial registration), `SaudiPhoneInput` (E.164 + AR-friendly display), `SARAmountInput` (thousands + ر.س / SAR suffix), `HijriDatePicker` (dual calendar), `AddressPicker` (Balady region → city cascade).

---

## CI & quality gates

Every push and PR runs:

1. **Build** — `npm run build` across all workspaces
2. **Lint** — ESLint with flat config
3. **Typecheck** — `tsc --noEmit` everywhere
4. **Spell-check** — cspell with domain allowlist
5. **Playwright** — E2E suite (currently warn-only)
6. **Artifact upload** — Playwright report + screenshots

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Project conventions

- **Server Actions, not REST.** All data operations are Next.js Server Actions with `organizationId` scoping.
- **`prisma db push`, not migrations.** Schema is managed in-place; the DB has drift from initial setup.
- **Decimal handling.** Prisma `Decimal` is serialized via `JSON.parse(JSON.stringify(…))` before crossing the Server Action boundary.
- **UI-first principle.** Every feature, CRUD action, and server action must be reachable from a nav link or button — no orphan URLs.
- **Commits.** Single author (Omar Alghamdi). No Co-Authored-By attribution.

Full engineering contract in [CLAUDE.md](CLAUDE.md).

---

## Roadmap highlights

Tracked in [CHANGELOG.md](CHANGELOG.md). Recent + upcoming:

- **v4.0.0** (shipped 2026-04-18) — Design System v2 + Access Model Hardening. [Release notes](https://github.com/GhamdiOmar/Mimaric/releases/tag/v4.0.0).
- **v4.1** (planned) — react-hook-form + zod migration, DB-backed TanStack saved views, full Balady district cascade.
- **v4.2** (planned) — WAFI escrow integration, ZATCA e-invoice submission, SAMA-compliant Moyasar payment gateway.

---

## License

Proprietary — © Mimaric PropTech Co. All rights reserved.

For partnership, licensing, or enterprise enquiries: **omar@mimaric.sa**
