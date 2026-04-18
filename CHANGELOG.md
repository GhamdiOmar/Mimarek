# Changelog — Mimaric PropTech

## [4.0.0] — 2026-04-17 — Design System v2 + Access Model Hardening

**Branch:** `feat/audit-2026-04-mega` (mega-PR, 20 commits).

### Design System v2 (CLAUDE.md § 6 — single source of truth)

- **Foundations:** `DirectionalIcon` wrapper for RTL-aware chevrons/arrows; `ThemeProvider` now respects system preference (`enableSystem=true`); Prisma `UserRole` enum extended with `LEASING` and `FINANCE`; TanStack Table v8 + `@axe-core/react` installed.
- **Primitives:** Saudi input family (`NationalIdInput`, `CRInput`, `SaudiPhoneInput`, `SARAmountInput`, `HijriDatePicker`, `AddressPicker`), harmonized 8-field `KPICard`, `DateRangePicker`, `LastUpdatedAgo`, `EmptyState`.
- **Route-segment hygiene:** every `/dashboard/**` route now has `loading.tsx`, `error.tsx`, and `not-found.tsx`; `global-error.tsx` added.
- **RTL correctness:** logical-CSS sweep across 15 files; `DirectionalIcon` retrofit across 25 call-sites.
- **Role-based dashboards:** `/dashboard/leasing`, `/dashboard/finance`, `/dashboard/maintenance` built; `/dashboard` and `/dashboard/admin` upgraded with `DateRangePicker` + `LastUpdatedAgo`; real trend server actions replace hardcoded sparklines.
- **Tables:** TanStack Table v8 rewrite of `packages/ui/DataTable` (multi-sort, column filter, visibility, density toggle, URL-synced state, bulk actions, mobile cards, a11y caption). Migrated: admin tickets, **CRM List view**.
- **Saudi primitives wired** into CRM/org/contract/payment/admin forms.
- **Cmd-K palette:** global `⌘K`/`Ctrl+K` opens command palette with routes + top-5 create actions (platform users see routes only — no tenant create actions).
- **Accessibility:** `@axe-core/react` in dev mode, skip-to-content link, ARIA labels on icon-only buttons, `:focus-visible` rings on `--ring`.
- **CI guards:** cspell, axe-playwright × 5 dashboards × 2 themes, lhci warn-only baseline.

### Access Model — Tenant vs System (CLAUDE.md § 8)

Layer 1 (nav filter), Layer 2 (route guard), and Layer 3 (server-action audience gate) now all enforce the rule that **platform users (`SYSTEM_ADMIN` / `SYSTEM_SUPPORT`) MUST NOT reach tenant surfaces or data**, and vice versa.

- **Layer 1 fix:** Cmd-K quick actions (new customer / deal / contract / payment / ticket) now hidden for platform users — previously leaked through permission-only filter.
- **Layer 2 fix:** `DashboardClientLayout` redirects platform users from any tenant route (`/dashboard/crm`, `/dashboard/units`, `/dashboard/deals`, …) to `/dashboard/admin`. Symmetric to the existing admin-side guard.
- **Layer 3 fix:** `requirePermission` now rejects the wrong audience based on permission taxonomy — `TENANT_SCOPED_PERMISSIONS` and `SYSTEM_ONLY_PERMISSIONS` lists in `lib/permissions.ts` drive the gate. All 31 tenant action files inherit the fix with zero call-site changes.
- **Docs:** CLAUDE.md §§ 8 (access model) and 9 (test credentials) added as authoritative references.

### Housekeeping

- Dead `/dashboard/properties` route deleted (permanent 308 redirect since v3.0 IA shift) + 10 stale references cleaned up.
- `/dashboard/help` raw tables reviewed — 4 tables deferred with inline rationale (short-lived audit lists + inline review forms don't benefit from TanStack).
- 18 unused files + 3 unused deps removed.

### Deferred (follow-up PRs)

- react-hook-form + zod form adoption.
- DB-backed TanStack saved views (URL-synced state ships this PR).
- Full Balady district cascade (regions+cities now, districts follow-up).
- Prisma `User.organizationId` nullable — system users currently seeded with `organizationId` = mimaric test org because schema forbids null; CLAUDE.md § 8.1 requires null. Schema migration + seed fix tracked separately.
- WAFI escrow / ZATCA invoice KPIs (underlying data not ready).

---

## [3.2.0] — 2026-04-16

### Unified Property Linking in Add Customer Modal

**UX fixes to "Add Customer" modal:**

- **Title fix:** Modal heading changed from "إضافة عميل / عقار جديد" to "إضافة عميل جديد" / "Add New Customer" — no more misleading property reference
- **Button fix:** Header button changed from "إضافة عميل / عقار" to "إضافة عميل" / "Add Customer"
- **Removed:** Vague "نوع العقار المطلوب" (Property Type) text dropdown (APARTMENT/VILLA/etc.) — replaced with real unit linking

**New: Inline Property Linking with Budget Comparison**

- Replaced the vague property type dropdown with a live unit search — same UX as the drawer's "ربط عقار" section
- Search by unit number, city, type, or building name; shows up to 8 matching AVAILABLE/RESERVED units
- After selecting a unit: BUY / RENT intent buttons appear
- Selected unit shown as a pill with intent badge and a clear (×) button
- **Budget comparison badges** appear on each unit row when a budget is entered:
  - Red "فوق الميزانية / Over Budget" — unit price > 105% of budget
  - Green "ضمن الميزانية / On Budget" — unit price within ±10% of budget
  - Blue "أقل من الميزانية / Under Budget" — unit price < 90% of budget
- BUY intent uses `markupPrice`; RENT intent uses `rentalPrice` for comparison
- Linking is fully optional — omitting it creates the customer with no interest record
- On successful create with a unit selected: `addCustomerInterest()` is called automatically → interest appears immediately in the customer drawer's "Interested Properties" section

---

## [3.1.0] — 2026-04-16

### Mimaric v3.1 — Full Prospect-to-Close Cycle

**Strategy:** Link CRM → Properties → Deals → Contracts with automatic status propagation. An agent can now take a lead from "New" to "Converted/Tenant" without manually updating any status.

#### New Feature: CustomerPropertyInterest

- New `CustomerPropertyInterest` model linking Customer ↔ Unit with `PropertyIntent` (BUY/RENT) and `InterestStatus` (ACTIVE/CONVERTED/DROPPED)
- 5 new server actions in `customer-interests.ts`: `addCustomerInterest`, `dropCustomerInterest`, `convertInterestToDeal`, `getCustomerInterests`, `getCustomerInterestsForUnit`
- Guard: unit must be AVAILABLE or RESERVED to link; upsert reactivates DROPPED interests

#### CRM Drawer Enhancements

- **Edit Profile modal**: Edit name (EN + AR), phone, email, source, agent, budget, property type interest — with phone/email encryption preserved
- **Interested Properties section**: Link specific properties to a customer with BUY/RENT intent; status badges (ACTIVE/CONVERTED/DROPPED); "Convert to Deal" and "Drop" actions per interest row
- **Linked Deals & Contracts section**: Shows active reservations and signed contracts directly in the drawer
- **Mark as Lost button**: Added to drawer for customers in RESERVED/CONFIRMED status (not reachable via Kanban drag) — triggers the LOST reason modal and cascades cancellations

#### Properties Drawer Enhancement

- **Interested Customers section**: Lists all customers with ACTIVE interest in a unit, with intent badge (BUY/RENT), agent name, and "View Profile" link to CRM

#### Deals Page: URL Pre-fill

- `?unitId`, `?intent`, `?amount` query params pre-fill the reservation form when navigating from an interest record via "Convert to Deal"

#### Contracts Page: ?dealId Pre-fill

- `?dealId` URL param fetches the linked reservation and pre-fills customer + unit in the new contract modal

#### Status Cascade Fixes

- **Bug fix:** Cancelling/expiring a reservation now reverts customer status → QUALIFIED (was staying RESERVED)
- **Bug fix:** Marking customer LOST now cancels all active reservations → Units revert to AVAILABLE, interests set to DROPPED
- **Bug fix:** DRAFT contracts can now transition directly to SIGNED (DRAFT → SIGNED added to state machine)

#### Customer Edit Bug Fix

- **Bug fix:** After editing a customer profile, the drawer no longer shows encrypted phone ciphertext. Non-PII fields only are merged from server response; PII fields retain the decrypted value from drawer state.

#### Other Fixes

- Role name fix in `create-notification.ts`: COMPANY_ADMIN → ADMIN
- Prisma Decimal serialization fix: `JSON.parse(JSON.stringify())` applied to remaining customer action returns

---

## [3.0.1] — 2026-04-16

### CRM SOP Compliance — 7 Gap Fixes + Serialization Fix

**CRM Pipeline Enhancements:**
- Added CONTACTED and NEGOTIATION stages to the 5-stage pipeline (NEW → CONTACTED → QUALIFIED → VIEWING → NEGOTIATION)
- LOST lead flow: dragging a card to LOST now triggers a required reason selection modal (BUDGET, NO_RESPONSE, COMPETITOR, NO_MATCH, OTHER) before status update
- LOST toggle: separate view for LOST leads via toggle button — keeps active pipeline clean
- Agent assignment: Add Lead form now includes an Agent dropdown populated from team members (ADMIN/MANAGER/AGENT roles)
- Budget & property interest: Add Lead form captures SAR budget and property type preference
- Client preferences section in customer drawer: shows budget, property type, assigned agent, and LOST reason (in red) when applicable
- "Convert to Deal" button in customer drawer: navigates to `/dashboard/deals?customerId=...` for seamless pipeline handoff

**Bug Fix:**
- Fixed Prisma `Decimal` serialization error: `getCustomers()` now wraps results in `JSON.parse(JSON.stringify())` to prevent "Only plain objects can be passed to Client Components" error when `budget` field is present

---

## [3.0.0] — 2026-04-16

### Mimaric v3.0 — Universal Real Estate Operating Core

**Strategy:** Refactor, NOT rebuild. Mimaric pivots from a niche Saudi developer tool to a Universal Real Estate OS serving brokerages, property managers, and developers.

#### What Changed

**New Modules (moved/renamed from buried routes):**
- CRM (`/dashboard/crm`) — full Kanban pipeline with 5 stages, activity timeline, PII toggle, lead management
- Properties (`/dashboard/properties`) — standalone unit portfolio, decoupled from Projects/Buildings
- Deals (`/dashboard/deals`) — reservation pipeline renamed for clarity, linked to CRM + Properties
- Contracts (`/dashboard/contracts`) — merged Sale + Lease contracts in a single tabbed view
- Payments (`/dashboard/payments`) — unified installment tracker (sale + lease), 3 KPI banners
- Dashboard — redesigned with 6 v3.0 KPI cards and 3 activity widgets (Recent Deals, Payment Deadlines, Maintenance Status)

**Architecture Changes:**
- Unit model decoupled: `Unit → Organization` (direct FK) — no longer requires Project/Building hierarchy
- Added `CustomerActivity` model for CRM activity timeline (CALL, EMAIL, MEETING, SITE_VISIT, NOTE, WHATSAPP)
- `CustomerActivityTimeline` client component with log form, delete, RTL-safe layout
- 301 redirects: `/dashboard/units` → `/properties`, `/sales/*` → `/deals`, `/rentals/*` → `/contracts`, `/finance/*` → `/payments`
- Onboarding simplified to 3 steps: Company Info → Add First Property → Done

**Removed (permanently):**
- GIS Platform (8 pages, 6 action files, 5 map components, maplibre-gl/leaflet/turf npm deps)
- Planning OS (full Planning Workspace + Subdivision system)
- Land Acquisition module
- Project Management (14-stage developer lifecycle)
- Wafi / Off-Plan Compliance module (escrow, construction milestones, WafiContract)
- Collections module
- Finance section (collapsed into Payments)

**Permissions & Roles:**
- UserRole reduced from 21 → 7: SYSTEM_ADMIN, SYSTEM_SUPPORT, ADMIN, MANAGER, AGENT, TECHNICIAN, USER
- Permissions reduced from ~162 → ~50, scoped to v3.0 modules
- RBAC matrix updated for all 7 roles

**Scale:**
- Page routes: 60+ → ~22 (-38)
- Server action files: 77 → 39 (-38 deleted, 11 updated)
- Prisma models: ~100 → ~65 (-35)
- npm bundle: ~3MB smaller (maplibre-gl + leaflet + turf removed)

## [2.1.0] — 2026-03-19

### GIS Platform — Full Spatial Intelligence (Phases 1-3)

**Phase 1 — Foundation & Interactive Map**
- MapLibre GL JS map engine (GPU-accelerated, vector tiles, Saudi imagery ready)
- GIS Hub (/dashboard/gis) with project selector, layer panel, feature click
- Sales Map (/dashboard/gis/sales) with plot status coloring and filter pills
- GIS Overview (/dashboard/gis/overview) with KPI dashboard, mini-map, charts
- 6 reusable map components: MapView, Controls, Popup, Legend, LayerPanel, Store

**Phase 2 — Planning Intelligence**
- Land Bank Map (/dashboard/gis/land-bank) with acquisition pipeline and scorecards
- Phase Readiness (/dashboard/gis/phases) with checklist management and readiness scoring

**Phase 3 — Delivery & Operations**
- Construction Progress (/dashboard/gis/construction) with package CRUD and progress tracking
- Handover & Defects (/dashboard/gis/handover) with inspection records and defect management
- Operational Asset Registry (/dashboard/gis/assets) with asset creation, filtering, export

**Infrastructure**
- 5 new Prisma models: PhaseReadinessRule, ConstructionPackage, HandoverRecord, HandoverDefect, OperationalAsset
- 6 server action files with full multi-tenancy (organizationId filtering)
- 3 new permissions: gis:read, gis:write, gis:export across 5 roles
- Cross-module navigation: "View on Map" buttons in Projects, Land, Sales, Planning, Maintenance
- Deep-link support (?project=id) on all 8 GIS pages
- GIS quick action on main Dashboard
- All pages bilingual (Arabic RTL / English LTR)

## [2.0.1] — 2026-03-19

### UI Accessibility & UX Polish
- Add Documents module to sidebar navigation (was unreachable)
- Add delete buttons: Customers, Land parcels (with cascade), Planning workspaces
- Add export buttons: Rentals, Maintenance, Documents, Help/Tickets, Projects, Finance, Land, Planning
- Add onboarding re-entry from Settings page (?mode=edit with pre-filled data)
- Wire all 14 previously non-functional buttons across the application

### Interaction & Feedback Improvements
- Add loading spinners to all async buttons (finance, billing, reservations, settings, planning, help)
- Add form validation with red borders and bilingual error text (maintenance, settings, help, planning)
- Add skeleton loading states (billing, documents)
- Add error state banners with retry buttons (dashboard, finance, billing, reservations)
- Replace all alert()/confirm() with proper Dialog components and inline error displays
- Add focus-visible ring styling to 15 select elements across 5 pages

### Design System Compliance
- Fix PageIntro heading to use semantic h1 tag (global CSS letter-spacing applies)
- Fix KPICard padding to 8pt grid (p-5 → p-6)
- Fix PageIntro badge and actions spacing to 4pt grid
- Replace decorative colors with semantic palette (units, customers, projects, billing)
- Landing Hero/Pricing CTAs now use Button component for proper 4-state support
- Remove redundant inline letterSpacing overrides from auth pages

### Decision Gates Fix
- Add missing standard lifecycle transitions: PLANNING→UNDER_CONSTRUCTION→READY→HANDED_OVER
- Change VALID_TRANSITIONS from single-string to arrays for multi-path support

### Error Messages Overhaul
- Update 283+ error messages across 55 server action files to be user-friendly
- All errors now explain what went wrong and what the user should do next
- Make 7 UI pages show bilingual error messages
- Remove all technical/developer-facing error text from user-visible surfaces

### Documentation
- Capture fresh screenshots for all 18 module pages
- Update Business Documentation, Technical White Paper, and 17 User Guides for v2.0
- Replace embedded screenshots in all DOCX files

---

## [2.0.0] — 2026-03-18

### Premium UI/UX Redesign

Complete redesign as a premium bilingual proptech SaaS platform with production-ready design system.

#### Design System
- Warm charcoal purple palette (hue 260-270) with purple brand accent (`270 55% 62%`)
- IBM Plex Sans Arabic + DM Sans typography with pro header tracking (-3%, 115% line-height)
- Dark-mode-first: layered surfaces, minimal shadows, depth via surface lightness
- Glass morphism hero cards with `backdrop-blur` and subtle white borders
- Consistent 4pt/8pt spacing grid, restrained micro-interactions

#### New UI Components
- `PageIntro` — Glass hero card for major pages
- `KPICard` — Metric card with label, value, subtitle, icon, accent border, trend, loading state
- `FilterBar` — Unified filter toolbar with status tabs and search
- `StatusBadge` — Entity-aware badges (unit, contract, lease, maintenance, customer)
- `FormSection` — Grouped form card with title and description
- `DataTable` — Sortable, filterable data table with pagination

#### Icon Migration
- 100% migration from `@phosphor-icons/react` to `lucide-react` across 90+ files
- Standardized `className="h-N w-N"` sizing pattern, zero Phosphor imports remaining

#### Landing Page
- All 11 components updated to purple brand accent (was green/teal)
- Fresh authenticated dashboard screenshots for Features and Hero sections
- Purple CTAs, trust badges, pricing toggle, Vision 2030 badges

#### Dashboard Pages
- All major pages upgraded with PageIntro glass cards, KPI rows with bilingual subtitles
- Units page: complete redesign with consolidated toolbar, cards/table toggle, status filter pills
- Sales page: KPI cards, module navigation with record counts
- Finance: action buttons, escrow/collection cards, revenue breakdown
- Settings: FormSection cards, TypeScript strict mode fixes
- 20+ pages polished with consistent patterns

#### Button System
- 7 variants with 4 states (default, hover, active/pressed, disabled)
- `active:scale-[0.97]` press feedback, `transition-colors` for performance

#### Token Cleanup
- `text-neutral` → `text-muted-foreground`, `shadow-elevation-*` → `shadow-sm/md/lg`
- Removed `font-primary`, replaced `text-accent` → `text-amber-500`

#### Stats
- 98 files changed, 6,049 insertions, 5,000 deletions
- Build: 0 errors, ~20-35s

---

## [1.3.0] — 2026-03-18

### Added — Saudi RED FRD Gap Closure (Sprint 0–1)

- **6 new RED roles** — APPROVALS_MANAGER, ESCROW_CONTROLLER, COLLECTIONS_OFFICER, HANDOVER_OFFICER, QA_INSPECTOR, VENDOR_CONTRACTOR with scoped permission sets
- **15 new permissions** — `projects:approve`, `inventory:import`, `inventory:release`, `collections:read/write/assign`, `handover:read/write/approve`, `price_approval:read/write/approve`
- **Project governance workflow** — Full approval state machine (DRAFT → PENDING → APPROVED → ACTIVATED) with project code generation (PRJ-{CITY}-{YEAR}-{SEQ}), owner assignment, and readiness flags
- **Readiness validation** — Launch/handover readiness checks: pending approvals, infrastructure, escrow (off-plan), released inventory, buildings with units
- **Project tree view** — Collapsible hierarchy: Project → Phases → Buildings → Units with status badges and unit counts
- **Enhanced audit logging** — `changeSnapshot` (before/after JSON) and `fieldChanges` (auto-computed diff array) on AuditLog model
- **Paginated query helper** — Generic `paginatedQuery()` server action wrapping Prisma findMany + count
- **Pagination controls component** — Page nav with ellipsis, page size selector (10/25/50/100), bilingual labels
- **Unsaved changes guard** — Browser beforeunload + popstate interception with bilingual AlertDialog
- **Auto-save indicator** — 2-second debounced save for DRAFT records with Saving/Saved/Error status
- **Audit trail tab component** — Per-record timeline with field-level diffs, expandable change details

### Added — Approval SLA & Blocking (Sprint 2 partial)

- **Approval follow-up tasks** — ApprovalFollowUp model with task assignment, due dates, status tracking (OPEN → IN_PROGRESS → COMPLETED)
- **Blocking approvals** — `isBlocking` flag + `blockingModule` field on ApprovalSubmission to gate sales/launch/infrastructure
- **SLA tracking** — `expectedResponseDate` on submissions, computed `daysOpen` in detail view

### Added — Inventory & Pricing Enhancements (Sprint 2 partial)

- **Release status** — `ReleaseStatus` enum (NOT_RELEASED, RELEASED, HOLD) on InventoryItem with hold reason/date
- **Minimum sell price** — Floor price enforcement on inventory items
- **Price list versioning** — PriceListVersion model with snapshot, approval workflow (DRAFT → APPROVED → SUPERSEDED)
- **Price change requests** — PriceChangeRequest model with variance calculation, auto-escalation threshold, approval/rejection workflow
- **Bulk inventory import** — CSV import wizard page at `/projects/[id]/inventory/import`

### Added — Sales & Contracting Enhancements (Sprint 3 partial)

- **Payment plans** — PaymentPlan + PaymentPlanInstallment models with down payment, partial payment support, status tracking
- **Reservation guards** — Race condition protection via `$transaction`, duplicate reservation check, release status validation
- **Reservation extensions** — ReservationExtension model with approval workflow and extension count limits
- **Contract templates** — ContractTemplate model with version history and HTML variable interpolation
- **Dual signature tracking** — `buyerSignedAt`, `developerSignedAt`, signature URL fields on Contract
- **Contract financial fields** — `grossAmount`, `discountAmount`, `netAmount` with auto-calculation

### Added — Collections Module (Sprint 4 partial)

- **Collection cases** — CollectionCase model with aging buckets, status workflow (CURRENT → FOLLOW_UP → PROMISE_TO_PAY → ESCALATED → LEGAL → SETTLED)
- **Collection activities** — CollectionActivity model for call/email/SMS/visit/note logging
- **Aging report** — Receivables bucketed by 1-30, 31-60, 61-90, 90+ days
- **Per-contract financial statement** — Ledger view with debit/credit/running balance
- **Collections UI** — `/finance/collections` with aging bucket tabs, status filters, KPI cards, empty state; `/finance/collections/[id]` with activity timeline

### Added — Navigation & UI Wiring

- **Finance page** — Quick-nav cards for Escrow and Collections modules
- **Project detail** — Governance and Project Tree buttons in action bar
- **Inventory tab** — Import CSV button linking to bulk import wizard
- **Pricing tab** — Price Versions and Price Change Requests buttons
- **Contract detail** — Payment Plan button (visible when contract is SIGNED)
- **Breadcrumb labels** — governance, tree, collections, import, change-requests, versions, payment-plan, templates, statement, preview
- **Role display labels** — Arabic/English labels for all 6 new RED roles in sidebar profile

### Changed — Schema

- **UnitStatus** — Added SUSPENDED, WITHDRAWN, HANDED_OVER values
- **UserRole** — Added 6 RED roles to enum
- **AuditLog** — Added `changeSnapshot` (Json?) and `fieldChanges` (Json?) columns
- **Unit** — Added `balconyAreaSqm` (Float?) and `parkingCount` (Int?)
- **Project** — Added `projectCode` (unique), `developerEntityId`, `internalOwnerId`, `financeOwnerId`, `approvalStatus`, `activatedAt`, `plannedLaunchDate`, `plannedCompletionDate`
- **Phase** — Added `phaseCode`, `salesEnabled`, `approvalDependencyId`
- **Building** — Added `towerName`, `blockCode`
- **9 new models** — ApprovalFollowUp, PriceListVersion, PriceChangeRequest, PaymentPlan, PaymentPlanInstallment, ReservationExtension, ContractTemplate, CollectionCase, CollectionActivity

## [1.2.0] — 2026-03-14

### Added — Saudi Ejar Contract Compliance

- **Ejar-compliant lease contracts** — Create lease contracts with mandatory Ejar fields: start/end dates, payment frequency (monthly/quarterly/semi-annual/annual), security deposit (capped at 5% per regulation), auto-renewal toggle, maintenance responsibility (landlord/tenant), and 60-day default notice period
- **Auto-generated installment schedules** — Lease contracts automatically create a linked `Lease` record with installment schedule based on selected payment frequency
- **Contract-lease linking** — Contracts with `type: LEASE` auto-create a linked lease with `leaseId` FK, bidirectional navigation between contract and lease

### Added — Saudi Wafi Off-Plan Sale Compliance

- **Wafi-compliant sale contracts** — Create sale contracts with Wafi fields: expected delivery date, Wafi license reference, and escrow account reference
- **Auto-escrow deposits** — Signing a sale contract auto-deposits the contract amount into the project's escrow account (`BUYER_DEPOSIT` transaction)
- **Auto-escrow reversals** — Voiding a signed contract auto-records a `REVERSAL` transaction in the escrow account

### Added — Contract Lifecycle State Machine

- **Contract status transitions** — Full state machine: `DRAFT → SENT → SIGNED`, with `CANCELLED` from DRAFT/SENT and `VOID` from SIGNED
- **Auto-generated contract numbers** — Unique numbers per type: `SALE-2026-XXXX` and `LEASE-2026-XXXX` with random 4-char suffix
- **Lifecycle side-effects on signing** — Sale contracts: unit → SOLD, customer → CONVERTED. Lease contracts: unit → RENTED, customer → ACTIVE_TENANT, lease → ACTIVE
- **Lifecycle side-effects on cancel/void** — Unit → AVAILABLE, lease → TERMINATED (if linked), escrow reversal (if signed sale)
- **Delete contract** — Hard-delete for DRAFT contracts only, cascades to linked lease and installments

### Added — Contract Detail Page

- **Bilingual party labels** — المؤجر/المستأجر (Landlord/Tenant) for leases, البائع/المشتري (Seller/Buyer) for sales
- **Lease Terms section** — Displays period, payment frequency, security deposit, auto-renewal, maintenance responsibility, and notice period
- **Sale Terms section** — Displays delivery date, Wafi license reference, and escrow account reference
- **Payment Schedule table** — Installment-by-installment view with number, due date, amount, and status (paid/unpaid/overdue)
- **Notes section** with contract notes display
- **Sidebar contract info card** — Contract number, value, Ejar ID placeholder, Wafi/escrow references

### Added — Contracts List Page with Create Modal

- **Full contracts table** — Customer (name + phone), unit (number + building), contract type badge (بيع/إيجار), amount in SAR, Hijri + Gregorian dates, status badge
- **Status filter tabs** — All, Draft, Sent, Signed, Cancelled with counts
- **Create contract modal** — Dynamic form switching between Sale and Lease types, Ejar/Wafi field groups, customer/unit selectors
- **Empty state** with CTA to create first contract

### Added — Contract RBAC Permissions

- **Progressive vs destructive permission split** — `contracts:write` for create/send/sign (Company Admin, Sales Manager, Sales Agent), `contracts:delete` for cancel/void/delete (Company Admin only)
- **SALES_AGENT** granted `contracts:write` — Agents can draft contracts for their leads
- **SALES_MANAGER** granted `leases:read` + `leases:write` — Handle both sale and lease workflows
- **PROPERTY_MANAGER** granted `contracts:read` — Visibility into lease contracts for property management
- **TENANT** granted `contracts:read` — Ejar regulation requires tenant transparency into their own contracts

### Added — Unit-Contract Bridge

- **`getActiveContractForUnit()` server action** — Finds the active contract (DRAFT/SENT/SIGNED) linked to any unit
- **Linked Contract section in unit detail panel** — Shows contract type badge, status badge, customer name, contract number, and "View Contract" navigation button
- **Financial summary in unit detail** — Rent collected, sale revenue, maintenance costs, and net income per unit

### Added — Reservation-to-Contract Flow Enhancement

- **Inventory-source reservations** — New reservation wizard supports "From Inventory" source for off-plan items alongside "From Units"
- **4-step reservation wizard** — Source selection → customer/unit → payment details → confirmation

### Added — Help Center Content Expansion (v1.2.0)

- **14 new FAQ items** — Ejar compliance (1), Wafi compliance (1), contract lifecycle (1), Ejar lease creation (1), Wafi sale creation (1), contract RBAC (1), unit-contract linking (1), lease detail page (1), sale detail page (1), unit financial summary (1), escrow accounts (1), contract permissions RBAC (1), installment tracking update (1), unit status tracking update (1)
- **4 new step-by-step guides** — Create Ejar Lease Contract (8 steps), Create Wafi Sale Contract (8 steps), Manage Contract Lifecycle (7 steps), updated Track Sales Contracts
- **Updated 4 existing items** — Unit management guide, lease creation guide, contracts FAQ, installments FAQ
- Total: 58 FAQs (was 44) and 25 guides (was 21) — comprehensive coverage of all contract workflows

### Fixed

- **Hydration error** — `<Badge>` (renders `<div>`) was nested inside `<p>` tags in unit detail panel, changed to `<div>` wrapper
- **Prisma client stale after schema push** — `npx prisma generate` required after adding Contract–Lease relation fields

### Schema Changes

- Added `contractNumber` (String, unique) to `Contract` model
- Added `leaseId` (String, optional FK) to `Contract` model with 1:1 relation to `Lease`
- Added `paymentFrequency` (PaymentFrequency enum), `securityDeposit` (Decimal), `autoRenewal` (Boolean), `maintenanceResponsibility` (MaintenanceResponsibility enum), `noticePeriodDays` (Int), `deliveryDate` (DateTime), `wafiLicenseRef` (String), `escrowRef` (String), `notes` (String) to `Contract`
- Added `PaymentFrequency` enum: `MONTHLY`, `QUARTERLY`, `SEMI_ANNUAL`, `ANNUAL`
- Added `MaintenanceResponsibility` enum: `LANDLORD`, `TENANT`

---

## [1.1.0] — 2026-03-14

### Added — Planning-to-Execution Lifecycle Bridge

- **Project Lifecycle Stepper** — Visual 14-stage stepper spanning 5 phase groups (Land → Design → Authority → Off-Plan → Execution) with bilingual labels and color-coded progress
- **"Promote to Project" button** — Planning workspaces with approved baseline scenarios can convert directly into active projects
- **"Generate from Plan" button** — Auto-create buildings and units from approved subdivision plots via `generateBuildingsFromPlots()`
- **"Convert Sold to Units" button** — Transform sold off-plan inventory items into delivered Unit records with contracts via `convertInventoryToUnits()`
- **Linked Workspace Detection** — Land and project detail pages detect existing planning workspaces and show "Continue Planning" / "View Planning" instead of duplicating

### Added — Project Financials (P&L)

- **Financials tab** on project detail — Total Costs, Total Revenue, Net P&L summary cards
- **Cost breakdown** — Land acquisition cost, development/infrastructure costs, maintenance costs
- **Revenue breakdown** — Sale revenue from signed contracts, rental income, off-plan sold inventory value
- **`getProjectFinancials()` server action** — Aggregates financial data across land, infrastructure, contracts, installments, maintenance, and inventory

### Added — Decision Gate & Compliance Enforcement

- **Compliance gate for scenario approval** — Blocks approval if any `ComplianceResult` has `result: "FAIL"` with descriptive error
- **Decision gate routing** — Project status transitions now route through `requestStageTransition()` instead of direct updates
- **Post-handover maintenance setup** — On transition to `HANDED_OVER`, auto-creates 5 default preventive maintenance plans (HVAC, Plumbing, Electrical, Fire Safety, General) for every unit

### Added — Landing Page

- **11-section bilingual marketing page** — Header, Hero, LogoBar, Features, Vision 2030, HowItWorks, Stats, Pricing, FAQ, FinalCTA, Footer
- **Glass morphism hero** with animated trust badges (Vision 2030, Balady, ZATCA, Wafi), mesh gradient background, and architectural SVG pattern
- **Tabbed feature showcase** — 5 tabs (Projects, Sales, Rentals, Maintenance, Finance) with checklists and screenshots
- **3-tier pricing display** — Starter (free), Professional (SAR 499/mo), Enterprise (SAR 1,499/mo) with annual toggle
- **100+ bilingual translation keys** covering all landing page content

### Added — Glass Morphism Design System

- **CSS custom properties** — Glass backgrounds, borders, blur levels (light/standard/heavy) with dark mode overrides
- **Gradient mesh** (`mesh-bg`) with radial gradients for hero/dark sections
- **Glass utilities** (`.glass`, `.glass-heavy`) with backdrop-filter blur, borders, and shadows
- **Elevation system** (`--elevation-1/2/3`) replacing flat shadows
- **Glow effects** (`--glow-green`, `--glow-gold`) for accent highlights
- **New animations** — `float`, `pulse-glow`, `gradient-shift`, `mesh-drift`
- **Shadow utilities** added to Tailwind config — `glass`, `glass-hover`, `elevation-1/2/3`, `glow-green`, `glow-gold`

### Added — Auth Page Redesign

- Brand panel uses `mesh-bg` gradient with architectural SVG pattern overlay
- Floating gradient mesh blobs with animation
- Form cards use glass styling (`rounded-2xl border bg-card/80 backdrop-blur-sm`)
- ThemeToggle added to login and register pages
- Error messages styled with `bg-destructive/5`

### Added — New Server Actions

- `inventory-handoff.ts` — `convertInventoryToUnits()` for off-plan to delivery conversion
- `plot-conversion.ts` — `generateBuildingsFromPlots()` for subdivision-to-building generation
- `post-handover.ts` — `setupPostHandoverMaintenance()` for auto-creating preventive plans
- `finance.ts` — `getProjectFinancials()` for project-level P&L aggregation
- `projects.ts` — `uploadDocumentVersion()` for document version management
- `planning-workspaces.ts` — `getLinkedWorkspaces()` for workspace detection
- `contracts.ts` — Auto-post to escrow on sale contract signing

### Added — E2E Testing

- **Planning Page Object Model** — Methods for workspace list, detail, map, scenarios, compliance, and feasibility tabs
- **16 Playwright test cases** — 7 workspace list tests + 9 workspace detail tests
- **E2E seed script** (`scripts/e2e-seed.ts`) — Full 17-phase lifecycle simulation with land, planning, subdivision, buildings, units, CRM, contracts, leases, construction, handover, and maintenance

### Added — Document Management Enhancements

- Category filter dropdown with funnel icon
- Version column with expandable version history
- Upload new version inline per document row
- 4 new document categories: GIS, CAD, Planning, Permit

### Changed — UI Improvements

- **Dashboard layout** — Sidebar gradient background, active nav inset glow, glass topbar
- **KPI Cards** — Backdrop blur, semi-transparent background, hover lift effect
- **All 5 chart components** — Colors aligned to HSL design tokens, glass-styled tooltips, reduced grid opacity
- **Dialog component** — Fixed positioning with `translate: "-50% -50%"` style attribute
- **MimaricLogo** — Added `width: auto, height: auto` to prevent layout shift
- **Dashboard spacing** — Increased from `space-y-8` to `space-y-10`

### Fixed

- Leaflet map double-mount in React strict mode (check `_leaflet_id`, cleanup old instance)
- `createLandParcel()` passing empty strings instead of `undefined` for optional fields
- Map z-index stacking with `isolate` class on container

### Schema Changes

- Added `GIS`, `CAD`, `PLANNING`, `PERMIT` to `DocCategory` enum

### Seed Data

- 3 SaaS plans with 11 entitlements each (Starter/Professional/Enterprise)
- Active subscriptions for main and dummy organizations

---

## [1.0.0] — 2026-03-10

### Added — SaaS Commercialization Layer

- **Subscription plans** — 3-tier system (Lite/Professional/Enterprise) with monthly and annual billing, entitlement-based feature gating, and free trial support
- **Coupon system** — Percentage and fixed-amount discount codes with max redemptions, expiry dates, and real-time validation on the plans page
- **Invoice management** — Auto-generated invoices with subtotal, 15% VAT calculation, status tracking (Draft → Issued → Paid → Overdue), and download capability
- **Payment tracking** — Payment method storage, grace period handling for past-due subscriptions, and billing cycle management (monthly/quarterly/semi-annual/annual)
- **Platform admin panel** — 4-section admin hub: Plans Management, Subscriptions monitoring, Coupons CRUD, and Invoices & Payments overview with revenue totals
- **Billing permissions** — `billing:read`, `billing:write`, `billing:admin` permissions with role-based access control

### Added — Wafi Compliance & Escrow

- **Wafi project page** — Off-plan compliance tracking with license management, milestone certification by engineering consultants, and escrow fund monitoring
- **Escrow accounts** — Fund tracking for off-plan sales with deposit/withdrawal logging and balance monitoring
- **Engineering Consultant role** — New `ENGINEERING_CONSULTANT` role for independent milestone certification per Wafi requirements
- **System Support role** — New `SYSTEM_SUPPORT` role for platform operations and ticket management

### Added — Centralized Language System

- `LanguageProvider` context with localStorage persistence and hydration-safe initialization
- Removed ~25 per-page duplicate language toggles — single unified toggle in the topbar
- Fixed hydration mismatch (`dir="rtl"` server vs `dir="ltr"` client) by deferring localStorage read to useEffect

### Added — Dark Mode Polish

- Button CSS overrides for Tailwind v4 monorepo (`.dark .btn-primary` / `.dark .btn-secondary`) — green primary, muted secondary in dark mode
- Chart dark mode colors via shared `useChartTheme` hook across all 4 dashboard charts
- Popover/dropdown solid backgrounds in dark mode (eliminates transparency/readability issues)

### Added — User Profile Popover

- Functional profile menu in the topbar showing user name, role, organization, and email
- Quick-link navigation to Settings, Security, and Help
- Sign Out action accessible from profile popover
- Removed duplicate user info section from sidebar bottom
- Profile button visible on all screen sizes (mobile + desktop)

### Added — Help Center Content Expansion

- **12 new FAQs**: Land Management (2), Document Vault (1), Billing & Subscription (3), Rental Payments (1), Sales Contracts (1), Site Logs (1), Onboarding (2), Platform Administration (1)
- **7 new step-by-step guides**: Add & Manage Land Parcels, Upload & Manage Documents, Track Sales Contracts, Record Rental Payments, Manage Subscription & Billing, Add Site Logs, Complete Account Setup
- Total: 38 FAQs (was 26) and 19 guides (was 12) — ~95% platform coverage (was ~65%)
- Corrected role count from 11 to 13 in FAQ, fixed team management button text

### Added — UI Components

- New shared components in `@repo/ui`: Dialog, EmptyState, KPICard, Popover, Select, Skeleton, Tabs, Toast
- Usage guides section redesigned with numbered badges, accordion expand, and chevron rotation

### Schema Changes

- New models: `Subscription`, `SubscriptionPlan`, `PlanEntitlement`, `Invoice`, `InvoiceItem`, `PaymentMethod`, `Coupon`, `CouponRedemption`, `WafiLicense`, `EscrowAccount`, `EscrowTransaction`, `MilestoneVerification`, `EtmamRequest`
- New enums: `SubscriptionStatus`, `BillingCycle`, `InvoiceStatus`, `PlanTier`, `CouponType`
- New roles: `SYSTEM_SUPPORT`, `ENGINEERING_CONSULTANT` added to `UserRole` enum (13 total roles)

### Fixed

- Hydration mismatch from localStorage language read during SSR
- Build error from orphaned `setLang` references after language centralization
- Tailwind v4 `dark:` utility classes not generating CSS in monorepo package source files
- Unit selection indicator changed from bottom-left circle to top-right checkbox style
- Button text unreadable in dark mode (primary and secondary variants)

---

## [0.9.0] — 2026-03-09

### Added — Dark Mode / Light Mode

- Full dark/light theme system using `next-themes` with CSS custom properties
- `ThemeProvider` and `ThemeToggle` (Sun/Moon) components with hydration-safe mounting
- Restructured `globals.css` with `:root` / `.dark` variable layers and `@custom-variant dark`
- Sidebar stays navy in both themes via fixed `--sidebar-bg` / `--sidebar-deep` tokens
- Replaced ~225 hardcoded `bg-white` across 38+ files with theme-aware `bg-card`
- Dark palette: deep navy backgrounds (`216 55% 9%`), muted borders, adjusted accent colors

### Added — Off-Plan Development System (Stages 7–12)

- **14-tab project detail page**: Feasibility, Concept Plans, Constraints, Approvals, Subdivision, Infrastructure, Inventory, Pricing, Launch Waves, Launch Readiness, Map, Sales Tracking, Analytics, Decision Gates
- **Inventory management**: Full CRUD with 9 product types (VILLA, APARTMENT, TOWNHOUSE, LAND_PLOT, COMMERCIAL, DUPLEX, PENTHOUSE, STUDIO, OTHER), status workflow (UNRELEASED → AVAILABLE → RESERVED → SOLD), and bulk operations
- **Pricing engine**: Rules-based pricing with percentage/fixed adjustments, premium/discount modes, rule priority, and active/inactive toggling
- **Launch waves**: Wave planning, launching, and closing with sequential wave numbering
- **Launch readiness checklist**: 6-point validation (subdivision, approvals, infrastructure ≥70%, inventory, pricing, waves)
- **Reservation from inventory**: "From Inventory" flow in existing reservation page with project → wave → item selection cascade
- **4 modal dialogs**: Add Inventory Item, Add Pricing Rule, Create Launch Wave, Subdivision Plan
- **3 analytics charts**: Pricing Distribution (bar), Sales Funnel (funnel), Wave Performance (composed) — all Recharts

### Added — Cross-Module Off-Plan Awareness

- **Units page**: New "مخزون على الخارطة" (Off-Plan Inventory) tab with 5 KPI cards, searchable/filterable inventory table, and project filter
- **Sales page**: "مسار مبيعات على الخارطة" pipeline section with Pipeline Value, Reserved Value, Sold Value, and Conversion Rate
- **Finance page**: "إيرادات على الخارطة" revenue section with 4-column KPI grid and progress bar
- **Reports**: Development Pipeline report enriched with per-project inventory counts and pipeline values; Pricing Analysis report enriched with per-status value breakdown

### Added — Notification Triggers

- `LAUNCH_READINESS_COMPLETE` — all 6 readiness checks pass (30-day dedup)
- `WAVE_LAUNCHED` — wave status changes to LAUNCHED
- `INVENTORY_MILESTONE_25/50/75/100` — inventory conversion milestones (30-day dedup)
- `INVENTORY_LOW` — less than 10% inventory available in a project (30-day dedup)

### Added — E2E Test Suites

- Playwright test suites: access control, analytics, dashboard, launch readiness, off-plan modals, reports, reservations
- Role-based auth setup files for admin, PM, sales, and tech roles
- Page object models for project detail and dashboard pages

### Schema Changes

- New models: `ConceptPlan`, `RegulatoryConstraint`, `ApprovalSubmission`, `SubdivisionPlan`, `InfrastructureReadiness`, `InventoryItem`, `PricingRule`, `LaunchWave`, `DecisionGate`
- New enums: `InventoryStatus`, `ProductType`, `WaveStatus`, `GateStatus`, `GateType`
- Extended `Reservation` with optional `inventoryItemId` relation
- Extended `Notification` with `titleEn` and `messageEn` for bilingual notifications

### New Server Actions (12 files)

- `analytics.ts`, `approvals.ts`, `concept-plans.ts`, `constraints.ts`, `decision-gates.ts`, `feasibility.ts`, `infrastructure.ts`, `inventory.ts`, `launch.ts`, `launch-waves.ts`, `pricing.ts`, `subdivision.ts`

### Fixed

- Subdivision detail page language toggle was non-functional (`[lang]` → `[lang, setLang]`)
- Added bilingual error messages and RTL `dir` attribute to subdivision detail

---

## [0.8.0] — 2026-03-08

### Added — Registration & Organization Management
- **Individual/Company Registration** — Account type toggle (فرد/شركة) wired to backend; company name used as org name, individual gets personal workspace
- **Auto-Login on Registration** — New users are signed in immediately and redirected to onboarding wizard (no manual login required)
- **SUPER_ADMIN Role for Org Creators** — First user in an organization gets full admin permissions instead of USER role
- **Onboarding Wizard** — 4-step post-registration flow: organization path choice, business identity (CR/VAT/entity type), contact & location, team invitations. Every step is skippable.
- **CR-Based Organization Discovery** — Individual users can search for existing organizations by Commercial Registration number. Found → join request with masked org name. Not found → option to register business with that CR.
- **Join Request System** — Users request to join organizations, admins review/approve/decline from Help Center admin panel. On approval, user moves to target org as USER role with JWT refresh.
- **Token-Based Team Invitations** — Email-based invitations with 7-day expiry, secure token links, role assignment. Replaces password-based invite flow.
- **Invitation Acceptance Page** — `/auth/invite/[token]` — shows org name, role, inviter; new user creates account and auto-joins organization.
- **Help Center** — Searchable FAQ (6 categories, bilingual), guides, support ticket system with threaded messages, permission request workflow, admin panel for managing tickets/join requests/permissions.
- **Support Ticket System** — Users create tickets with categories, admins respond with threaded messages, status tracking (open → in progress → resolved → closed).
- **Permission Request System** — Users request role upgrades, admins review and approve/decline with notifications.
- **Notification Helpers** — `createNotification()` and `notifyAdmins()` utilities for system-wide notification delivery.
- **Password Reveal Toggle** — Show/hide password button on login, register, and invitation acceptance pages.
- **Enter Key Login** — Pressing Enter on the login form submits credentials.

### Changed
- **Password Policy** — Minimum length reduced from 15 to 10 characters (NIST-compliant, common password blocklist and contextual checks remain)
- **Registration Page** — Sends `accountType` to backend, auto-redirects on success instead of showing "registered" message
- **Login Page** — Removed `?registered=true` query param handling (replaced by auto-login)
- **Auth Config** — JWT callback now supports `trigger === "update"` with session parameter for real-time token refresh after onboarding/org changes
- **Dashboard Layout** — Sidebar shows organization name (fetched via lightweight `getOrgName()` that requires only authentication, not `organization:read` permission)
- **Permissions** — Added `invitations:read`, `invitations:write` to ALL_PERMISSIONS matrix
- **Seed Data** — All seed users have `onboardingCompleted: true` and `accountType: "company"` to skip onboarding

### Schema Changes
- **User Model** — Added `accountType` (individual/company), `onboardingCompleted` (boolean), `invitedBy`, `invitedVia` fields
- **Invitation Model** — New model with token-based flow, email, role, organization, expiry, status tracking
- **JoinRequest Model** — New model for CR-based org join requests with status machine (PENDING → APPROVED/DECLINED/EXPIRED/CANCELLED)
- **InvitationStatus Enum** — PENDING, ACCEPTED, EXPIRED, REVOKED
- **JoinRequestStatus Enum** — PENDING, APPROVED, DECLINED, EXPIRED, CANCELLED
- **Organization** — Added `invitations` and `joinRequests` relations
- **Help Models** — SupportTicket, SupportTicketMessage, PermissionRequest models with full CRUD

### Fixed
- Stale JWT after onboarding completion causing infinite redirect loop (now uses `useSession().update()` + `window.location.href`)
- SALES_AGENT users crashing on dashboard due to missing `organization:read` permission (sidebar now uses lightweight `getOrgName()`)
- Registration password validation rejecting passwords containing email substrings correctly

---

## [0.7.0] — 2026-03-08

### Changed
- Button component: ghost variant now has visible `bg-muted/40` background; secondary hover upgraded with shadow lift and `-translate-y-0.5`
- Color-coded hover accents on all action buttons (green for Excel/export, red for PDF/delete, amber for PII toggle)
- Dashboard layout: added `min-w-0` and `overflow-x-hidden` to prevent horizontal scroll in RTL views
- Customers page: compact toolbar with `sm` buttons and shortened labels for RTL fit
- Maintenance detail: per-status colored transition buttons with hover lift effects
- Reports page: export buttons with green/red hover accents
- Land page: View button upgraded from ghost to secondary with green hover
- Contracts page: View button upgraded from ghost to secondary with green hover
- Reservations page: Cancel button with red hover accent
- Projects detail: Delete buttons with red hover accent
- Preventive maintenance: Delete button with red hover accent
- README.md rewritten with full business value, expanded module coverage, design system documentation

### Fixed
- LandPipelineChart Arabic labels overlapping bars (foreignObject HTML rendering)
- Customer page horizontal scroll in full-screen RTL view (min-w-0 on main flex item)
- Chart text unreadable due to similar color shades between labels and backgrounds

---

## [0.6.0] — 2026-03-07

### Added — Comprehensive Maintenance Module (CMMS)
- **Full CRUD** — Create, read, update, and delete maintenance requests with modal forms
- **Status Workflow** — Enforced transitions (OPEN → ASSIGNED → IN_PROGRESS → ON_HOLD → RESOLVED → CLOSED) with validation
- **SLA Tracking** — Auto-computed due dates by priority (URGENT: 2h, HIGH: 24h, MEDIUM: 72h, LOW: 168h)
- **10 Maintenance Categories** — HVAC, Plumbing, Electrical, Structural, Fire Safety, Elevator, Cleaning, Landscaping, Pest Control, General (bilingual AR/EN)
- **5 KPI Dashboard Cards** — Open, Assigned, In Progress, Overdue, Completed This Month
- **Filter Toolbar** — Search by title, filter by status/priority/category
- **Detail Page** — Full work order view with status transition buttons, cost tracking, labor hours, assignment management
- **Preventive Maintenance Plans** — CRUD for recurring schedules (Daily to Annual), auto-generate work orders, toggle active/paused
- **Unit-Maintenance Linking** — Unit detail modal shows maintenance requests with status badges
- **Project-Maintenance Linking** — New "الصيانة" tab on project detail page with KPI summary
- **Assignable Users** — Assign to TECHNICIAN/PROPERTY_MANAGER/PROJECT_MANAGER roles

### Added — Land & Project Enhancements
- **Land Map Integration** — Interactive Leaflet map picker on creation, read-only map on detail page
- **Import Acquired Land into Projects** — Auto-fill project form from acquired land parcels
- **Arabic Unit Labels** — Types (شقة, فيلا, مكتب, etc.) and statuses (متاح, محجوز, مباع, etc.)
- **Unit Detail Modal** — Expand unit card to see info + maintenance requests
- **5 Arabic Sample Lands** — Seed data with real Riyadh coordinates

### Schema Changes
- Added `MaintenanceCategory` enum (10 categories), `RecurrenceType` enum (7 types)
- Added `ASSIGNED`, `ON_HOLD` to `MaintenanceStatus`
- Enhanced `MaintenanceRequest` with category, scheduledDate, dueDate, completedAt, costs, laborHours, notes, preventive link
- New `PreventiveMaintenancePlan` model with recurrence scheduling, scope, cost estimation

## [0.5.0] — 2026-03-07

### Added
- Dashboard analytics with LandPipelineChart, ProjectStatusChart, and MaintenanceCostTrendChart (Recharts + foreignObject for Arabic SVG rendering)
- SAR currency formatting component (`SARAmount`) with Hala font and bilingual display
- Reports module with Excel/PDF export, date range filtering, and 5 report types (occupancy, financial, maintenance, lease, customer)
- Hijri/Gregorian dual date display across all modules
- Notification bell with unread count and mark-all-read functionality
- Site construction logs with timestamped entries per project

---

## [0.4.0] — 2026-03-07

### Added — PDPL & NCA Compliance
- **Role-Based Permission System** — Centralized `permissions.ts` with 30+ granular permissions (`customers:read`, `customers:read_pii`, `customers:export`, `audit:read`, etc.) mapped to 8 user roles
- **PII Encryption at Rest** — AES-256-GCM encryption for national IDs, phone numbers, and emails in the Customer model; SHA-256 hash columns for exact-match search on encrypted fields
- **PII Masking UI** — Customer page masks sensitive data by default; authorized users can toggle visibility with Show/Hide PII button
- **Audit Trail** — `AuditLog` model tracking all data access, PII reads, exports, logins, and modifications with user, IP, and timestamp; dedicated audit log viewer at `/dashboard/settings/audit`
- **NIST SP 800-63B Password Policy** — Minimum length enforcement, common password blocklist, contextual checks (no username/email in password), real-time bilingual strength hints
- **Login Rate Limiting** — Progressive throttling: 30s after 5 failures, 5min after 10, 15min after 20
- **Self-Registration** — `/auth/register` page with password policy enforcement and automatic org creation
- **Password Recovery** — `/auth/forgot-password` and `/auth/reset-password` pages with time-limited tokens
- **Change Password** — `/dashboard/settings/security` page for authenticated password changes
- **Password Strength Hint Component** — Reusable bilingual `PasswordStrengthHint` component used across registration, reset, invite, and change password flows
- **User Preferences** — `preferences` JSON field on User model; configurable default landing page via Settings dropdown
- **Landing Page Selector** — Settings page dropdown to choose default post-login destination from 10 allowed pages
- **Navigation Filtering** — Sidebar links filtered by role permissions (e.g., Technicians only see Maintenance and Units)
- **Permission Badges** — Team page shows visual role capability badges (PII Access, Export, Finance)

### Changed
- Default post-login redirect changed from `/dashboard/units` to `/dashboard`
- Login action reads user's preferred landing page from preferences before redirect
- All server actions now use centralized `requirePermission()` instead of manual role checks
- Customer server actions encrypt PII on write, decrypt on read, mask based on caller's permissions
- Organization actions encrypt/decrypt manager national ID
- CI workflow updated with `PII_ENCRYPTION_KEY` env var for build compatibility

### Security
- Server-side PII masking as defense-in-depth (non-PII roles receive pre-masked data)
- Audit logging for all `READ_PII` and `EXPORT` events per PDPL Article 32
- `PasswordResetToken` model with 1-hour expiry and single-use enforcement
- bcrypt cost factor 12 for all password hashing

## [0.3.0] — 2026-03-07

### Added
- **Customers Hub** (`/dashboard/sales/customers`) — Unified Kanban and List views replacing former Leads page
- **Rentals New Lease Modal** — Added "Add New Customer" button and popup to create customers on-the-fly
- **Projects page** (`/dashboard/projects`) — Card grid with progress tracking
- **Sales hub page** (`/dashboard/sales`) — Links to Customers, Reservations, Contracts
- **Rentals hub page** (`/dashboard/rentals`) — Links to New Lease, Rent Collection
- **Finance page** (`/dashboard/finance`) — Revenue KPIs, ZATCA placeholder
- **Maintenance page** (`/dashboard/maintenance`) — Service request table with status badges
- **Reports page** (`/dashboard/reports`) — Downloadable report cards
- All sidebar navigation items now route to working pages (was 404 for 6 routes)

### Fixed
- Stabilized `NextAuth` beta type inference portability issues (TS2742).
- Addressed `useSearchParams` un-suspended bailout issue in reservation creation prerendering phase.
- **Build Error**: Register page syntax error in `backgroundImage` SVG data URL (line 23)
- **Build Error**: Stray markdown ` ```typescript ` tag at top of `register/page.tsx`
- **Build Error**: NextAuth v5 TS inference issue in `auth.ts` suppressed and strictly typed
- **Runtime Error**: Missing `Plus` icon import in Unit Matrix page
- **Runtime Error**: Missing `MimaricLogo` import in Contract page
- **Bug**: Login button was not clickable (no `onClick` handler)
- **Bug**: JSX whitespace `< ShieldCheck>` in Team page
- **Bug**: "Add Customer" inline logic in Sales Kanban columns fixed
- **Branding**: Last 2 "AntiGravity" references in Register terms text → "Mimaric"
- **Branding**: Contract signature "AntiGravity CEO" → "Mimaric CEO"
- **Branding**: "AG" avatar initials in Leads Kanban → "M"
- **UI**: Globally modernized Buttons; pure white text on dark backgrounds, `whitespace-nowrap`, and premium design tokens.

### Changed
- Refactored Prisma Schema: `Lead` model and `LeadStatus` renamed globally to `Customer` and `CustomerStatus`.
- Codebase-wide refactor replacing "Leads" logic with "Customers".
- Login button now redirects to `/dashboard/units` for testing.
- Test credentials enabled in `auth.ts`: `admin@mimaric.sa` / `mimaric2026`.

## [0.2.0] — 2026-03-06

### Added
- Mimaric brand integration (logo, colors, typography)
- MimaricLogo component with dark/light variants
- Dashboard layout with collapsible sidebar
- KPI dashboard overview
- Lead management with Kanban and list views
- Reservation wizard (4-step flow)
- Sales contract template (bilingual)
- Lease creation wizard
- Rent collection table
- Organization settings (CR/VAT)
- Team management with roles
- Document vault
- Project creation wizard
- Unit matrix with mass editing

## [0.1.0] — 2026-03-06

### Added
- Initial project scaffolding
- Monorepo structure (Turborepo)
- Next.js 16 app with Turbopack
- Prisma 7 schema
- NextAuth v5 configuration
- Shared UI package (`@repo/ui`)
