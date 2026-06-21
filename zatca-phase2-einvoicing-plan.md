# Mimarek — ZATCA Phase-2 E-Invoicing (Program: SaaS Billing + Tenant Config + Tenant Issuance)

> **Status:** v3 — hardened after a 7-agent code-grounded + ZATCA-cited review of v2 (v2 scored 7.2/10:
> "sound, factually well-grounded, but not execution-ready"). Canonical copy at
> `~/.claude/plans/build-zatca-phase-2-e-invoicing-splendid-spindle.md`; mirror at repo root
> `zatca-phase2-einvoicing-plan.md` (the two copies are identical). **R1 approved for execution
> (2026-06-20); R2–R5 planned-only.** Multi-release PROGRAM (tracks A → B → C, then R5 production), each
> release through its own §3.9 gate.

### Review changelog (v2 → v3) — the 7 blockers + design/process fixes
1. **db-push safety (BLOCKER).** Every new column on a populated live table is now explicitly nullable or
   `@default` (§4 NOT-NULL-abort hazard). `customerKind CustomerKind? @default(INDIVIDUAL)`,
   `Invoice.documentType ZatcaDocumentType? @default(TAX_INVOICE)`, all D18 buyer fields nullable,
   `Organization.logoUrl String?`, `Notification.organizationId String?` (safe NOT-NULL→NULL widening).
2. **D18 buyer-PII decision (BLOCKER).** `vatNumber`/`crNumber`/`companyNameAr/En` are **plaintext, non-unique**
   business identifiers (mirror `Organization.vatNumber`), written through the canonical
   `app/actions/customers.ts` path so the §4 `no-restricted-syntax` guard isn't tripped. NOT encrypted.
3. **Permission-array audience plumbing (HIGH/§8.4).** ROUTE_GUARDS alone is insufficient — `zatca:admin`
   must be added to `SYSTEM_ONLY_PERMISSIONS` and `zatca:config` to `TENANT_SCOPED_PERMISSIONS`, else tenant
   ADMIN silently inherits `zatca:admin` (`ADMIN = ALL.filter(!SYSTEM_ONLY)`, permissions.ts:214). Guard-
   coverage test added.
4. **Standard-invoice QR is ZATCA-returned, not self-generated (HIGH / the one real domain error).** Standard
   QR (and tag 9, the ZATCA cryptographic stamp) is parsed from the **cleared XML returned by ZATCA**; only
   simplified/B2C QR is self-generated at issuance. Pill tied strictly to `zatcaStatus === CLEARED`.
5. **Platform notifications (HIGH).** The "system-org sentinel" doesn't work (system users have
   `organizationId = null`; `Notification.organizationId` was required). Decision: make it **nullable** + add
   `notifyPlatformStaff()` targeting `role IN system-roles AND organizationId IS NULL`.
6. **Reporting trigger (HIGH).** The app is **not deployed**, so a `vercel.json` cron never fires. Decision:
   **operator-triggered sweep** ("Run reporting sweep" action) + a **"stuck-reporting > 12h" alarm** on the
   admin surface; a `CRON_SECRET`-guarded endpoint is still built. A real scheduler is an **R5 precondition**.
7. **Plan is partly already built (HIGH).** `ZatcaStatus` enum (incl. `REPORTED`), `Invoice.zatca*` fields,
   `getZatcaClearanceRate` (gates `billing:admin`), and a rendered "ZATCA Clearance" admin KPI ALL EXIST. An
   "existing scaffold inventory" is added to §5.3; the reporting metric **augments** the existing tile.
8. **Status enums.** Keep `ZatcaClearanceOutcome` but as the **per-attempt `ZatcaClearanceLog.outcome`**;
   **reuse the existing `ZatcaStatus`** for `TenantDocument.zatcaStatus` (the document lifecycle field). No
   overlap.
9. **RLS path + implicit-M2M.** Correct path is `packages/db/scripts/generate-rls.ts` (auto-generated; CI
   `rls:check`). Branches modeled as an **explicit `ZatcaBranch` model with an FK** (auto-covered), not an
   implicit Prisma M2M.
10. **Engine env.** `ZATCA_MASTER_KEY` → `turbo.json` `globalEnv` **and** CI job-level env if any build/test
    reads it (§4 "CI needs env vars at job level").
11. **Design-system tokenization.** The locked mockup is ported to `ZatcaDocument.tsx` emitting
    `hsl(var(--token))` brand colors (mockup navy `#032833` ≠ `--primary-deep` `#03283A`); print-only tints
    become namespaced `--zatca-print-*`. **IBM Plex Mono must be loaded** (it isn't today). **Dedicated
    portrait export path** (existing `exportToPDF` is landscape + injects its own header). Printed doc =
    light-only print surface, exempt from §6.13 dark-mode; preview rendered on a white card regardless of theme.
12. **6-document compliance set.** Golden vectors + PCSID compliance checks cover all 6 types (standard
    invoice/credit/debit + simplified invoice/credit/debit), not 3.
13. **Verification env binding + citations.** §3.9 walks run against local `next build && next start`
    (`scripts/verify-all.mjs`), not a deployed preview; live-DB `db push`/RLS/ALTER touches the single shared
    Supabase DB. Drifted citation paths/lines corrected throughout.

### Carried from v1 → v2 (still in force)
D19 dedicated `TenantDocument`; D22 retry-vs-resubmit split; money-movement hook matrix; D20 canonical = signed
XML + PDF/A-3-with-XML; D18 buyer routing by VAT-registration + completeness + txn type; D7 dedicated ZATCA
secret helper; explicit permissions/guards; notifications + KPI split; configurable + line-level tax mapping;
R5 production go-live; **PDF document template LOCKED** (`zatca-mockup/invoice.html`, approved 2026-06-20);
manager-mode execution model.

## 1. Context (Problem Statement)

ZATCA Phase-2 ("Fatoora") is effectively mandatory for all VAT-registered Saudi businesses — **Wave 24 =
prior-year VAT-subject revenue > SAR 375,000 in 2022/2023/2024, integrate by 30 Jun 2026** (zatca.gov.sa).
Deferred on Mimarek's backlog since v4.16; now built in-house (TS), not bought — middleware prices
per-EGS ≈ per-tenant and puts a third party in the legal compliance path.

**Three seller contexts, one shared engine:**
- **Track A — Mimarek as seller (SaaS billing):** ZATCA on the existing subscription `Invoice` (Mimarek →
  tenant orgs). Pure B2B = Standard/CLEARANCE. The proving ground (`Invoice` already has the `zatca*` scaffold).
- **Track B — Tenant config:** each tenant onboards its own EGS + tax identity/branches/invoice types/tax mapping.
- **Track C — Tenant issuance:** tenants issue real ZATCA invoices to THEIR customers — B2B **clearance** +
  B2C **simplified/24h reporting** + non-VAT receipts.

> ### ⚠ CRITICAL SCOPE FINDING (confirm with a tax advisor before go-live)
> **ZATCA e-invoicing applies only to TAXABLE (standard-rated 15%) supplies.**
>
> | Tenant transaction | VAT treatment | ZATCA e-invoice? |
> |---|---|---|
> | **Commercial lease** (OFFICE/RETAIL/WAREHOUSE) | 15% standard | **YES** — standard (B2B) / simplified (B2C) |
> | **Management / brokerage / service fees** | 15% standard | **YES** — standard / simplified |
> | **PARKING** | configurable (often ancillary 15%) | **per-config** |
> | **Residential lease** (APARTMENT/VILLA) | Exempt | **NO** (plain receipt, VATEX-SA-30) |
> | **Property sale** | Exempt → 5% RETT (separate platform) | **NO** (plain receipt; RETT filed separately) |
> | **Refundable deposit** | Outside VAT until forfeited | **NO** (receipt; invoice only if forfeited) |
>
> So Track C's e-invoice work = **commercial-lease rent + 15% service/fee charges**. Everything else =
> non-VAT receipt. VAT regs exempt real-estate ownership transfer + residential lease/license; commercial
> lease is NOT in that exemption bucket. This is the single biggest scoping fact in the program. *(7-agent
> review verified every row of this table against KSA VAT Regulations Art. 30 + ZATCA real-estate guidance,
> and confirmed VATEX-SA-30 as the correct residential-lease exemption code.)*

**Build target = ZATCA Sandbox** (open, no account, dummy OTP, free) for all build tracks; **R5** is the
production cutover. **Note:** ZATCA states **SDK success is NOT ZATCA approval** and does not remove the
taxpayer's compliance responsibility — the Java SDK is our dev oracle, not certification.

## 2. Solution Overview

Pure, deterministic **`@repo/zatca`** (secp256k1 keygen + CSR, UBL 2.1 XML, C14N + invoice hash, XAdES
signing, QR-TLV, the network client) + thin `"use server"` actions owning DB/encryption/auth/mutations.
**Shared infra** (engine, org-scoped `ZatcaEgsUnit`, onboarding actions) reused by all tracks; only
permission/audience + UI differ. Engine implements **both** ZATCA paths: **clearance** (B2B,
synchronous-at-issue) and **reporting** (B2C, ≤24h sweep). A per-EGS `lastIcv`/`lastInvoiceHash`
chain (atomic CAS) orders ICV/PIH and makes transport-retries idempotent.

**Gated by a P0 spike** proving hash/signature/QR/CSR match ZATCA's official Java Fatoora SDK
byte-for-byte. Nothing above the crypto layer ships until the spike is green.

## 3. Decisions Locked

| # | Decision | Choice |
|---|---|---|
| D1 | Plan scope | Full program; P0 gates internally. |
| D2 | Oracle | **ZATCA Java Fatoora SDK** (JDK 11–14). Validation only — **SDK pass ≠ ZATCA approval**. |
| D3 | SaaS discount/VAT bug | **Fix in-scope** (Track A). |
| D4 | Engine home | Pure **`@repo/zatca`** package. |
| D5 | Clearance timing | **Synchronous post-commit** (B2B); reporting = ≤24h **operator-triggered** sweep (B2C, D24). |
| D6 | Access — Track A | `zatca:admin` (SYSTEM_ONLY); `/dashboard/admin/zatca`. |
| D7 | Secrets at rest | **New dedicated ZATCA secret helper** (`encryptZatca()/decryptZatca()` keyed to **`ZATCA_MASTER_KEY`**) — the existing `encrypt()` is hard-wired to `PII_ENCRYPTION_KEY` (`apps/web/lib/encryption.ts`, `getKey()`). **Add `ZATCA_MASTER_KEY` to `turbo.json` `globalEnv` AND the CI job-level env** if any build/test reads it. Mirror `encryption.ts` fail-closed semantics in `decryptZatca()`. |
| D8 | ICV counter | Per-EGS `ZatcaEgsUnit.lastIcv`, advanced in the issue/clear tx (separate from display number, D19). |
| D9 | CSR & C14N libs | Resolved in P0 vs the SDK (`node-forge`/`openssl` CSR; `@peculiar/xadesjs`+`xmldsigjs` + port canonicalization from `Saleh7/php-zatca-xml`; Node `crypto` secp256k1, pin DER vs P1363). |
| D10 | Environment | **Sandbox** build; `ZatcaEnvironment` scaffolds Simulation/Production; cutover = R5 (D23). |
| D11 | Credit/debit notes | In scope; reference original invoice + follow its type; reuse clearance/report pipeline + per-EGS chain. **Both credit AND debit notes for standard AND simplified** (D27 6-sample set). |
| D12 | Buyer-party (SaaS) | Buyer = billed org; map VAT/CR/address; no-VAT + data-gate (§5.6). |
| D13 | Security | Threat model + §3.8 review; dedicated `ZATCA_MASTER_KEY`; explicit Prisma `select` allowlists exclude EGS secret columns from any client DTO; `ZatcaError` carries no payload. |
| D14 | Tenant config (Track B) | `/dashboard/settings/zatca` + tenant `zatca:config`. **Server `page.tsx` with `getTenantPageAccess("zatca:config")`** (the page is not gated by a layout). |
| D15 | Multi-branch EGS | Multiple units per org; unique `[organizationId, environment, egsSerialNumber]`. Branches = **explicit `ZatcaBranch` model with an FK** (D25), not an implicit M2M. |
| D16 | Real-estate tax mapping | **Configurable per org / branch / unit / service-line** (`OrgZatcaTaxConfig`), NOT hard-coded by unit type. **Per-line VAT category** (S/Z/E/O) on every line. Defaults: residential=E (no e-invoice), commercial+fees=S 15%, **PARKING=configurable**, sales=RETT/none. |
| D17 | Tenant issuance (Track C) | In scope, scoped to taxable supplies (commercial lease + 15% fees); B2C simplified/reporting + B2B clearance + non-VAT receipts. |
| **D18** | **Buyer schema + routing + storage** | `Customer` gains `customerKind CustomerKind? @default(INDIVIDUAL)` + `vatNumber String?` **(plaintext, non-unique)** + `crNumber String?` **(plaintext, non-unique)** + `companyNameAr/En String?`. **Storage:** plaintext business identifiers (mirror `Organization.vatNumber`), NOT encrypted; written via the canonical `customers.ts` path so the §4 ESLint guard isn't tripped. **Route by buyer VAT-registration + required-field completeness + txn type — NOT `customerKind` alone:** valid buyer VAT → standard/clearance; individual or no valid VAT → simplified/reporting. **Hard data gate** blocks standard clearance when required buyer fields are missing. |
| **D19** | **Tenant document model + numbering** | Dedicated **`TenantDocument`** model, separate from the global-scoped SaaS `Invoice` (`invoiceNumber` globally unique via `GLOBAL_SEQUENCE_SCOPE`, `app/actions/billing.ts`). Links seller-org + EGS + `Customer` + source charge. **`zatcaStatus` reuses the existing `ZatcaStatus` enum** (lifecycle state). **Display number is per-EGS/seller-scoped** via `SequenceCounter` with `scope = `egs:${egsUnitId}``; **`[egsUnitId, number]` uniqueness is a separate `TenantDocument` DB constraint** (NOT enforced by `SequenceCounter`). **ICV is per-EGS** and independent of the display number. Covers invoice / credit-note / debit-note / receipt via `documentType`. |
| **D20** | **Canonical = signed XML; PDF** | The signed UBL 2.1 XML is the canonical shared/stored document. A **PDF/A-3 with embedded XML is REQUIRED** if the shared/archived artifact is a PDF (raster PDF is NOT compliant for share/store). The html2canvas→jsPDF raster is a **preview / customer-convenience copy only**. PDF/A-3 (server-side `pdfkit`/`pdf-lib` + embedded XML + Arabic font) is a **scheduled work item**. **The human-readable layout is the LOCKED template (`zatca-mockup/invoice.html`, approved 2026-06-20) — port it into `ZatcaDocument.tsx` with tokenized colors + IBM Plex Mono + a dedicated portrait export path (D26); see "Locked document template".** |
| D21 | Non-VAT receipts | In scope (`documentType=RECEIPT`); residential rent / sales / deposits; no QR/XML/clearance; **RETT-platform filing stays OUT.** |
| **D22** | **Retry vs resubmit** | **(a) transport retry** — re-POST the SAME payload (same hash/UUID/ICV) after network uncertainty (idempotent). **(b) Correct-and-resubmit** — a REJECTED standard invoice is re-issued as a **NEW document with new hash, UUID, ICV, timestamp, date**; the rejected doc stays invalid. |
| **D23** | **Production go-live (R5)** | Production CSID, compliance checks (the **6-sample PCSID gate**, D27), cutover runbook, failure-notification, **tax-advisor signoff**, **a real reporting scheduler** (D24). "Sandbox clears" ≠ "legally ready". |
| **D24** | **B2C reporting trigger (NEW)** | The app is **not deployed** → a `vercel.json` cron never fires. **Operator-triggered sweep** ("Run reporting sweep" action on `/dashboard/admin/zatca`) + a **"stuck-reporting > 12h" KPI alarm**. A `CRON_SECRET`-guarded `app/api/cron/zatca-report` endpoint (reusing `isAuthorizedCronRequest`) is still built so a real scheduler can be attached. **A real scheduler is an R5 precondition** before relying on the 24h SLA. |
| **D25** | **Branches as explicit model (NEW)** | `ZatcaBranch` with an `egsUnitId` FK (NOT an implicit Prisma M2M) so RLS auto-covers it via `generate-rls.ts` (which only parses `model` blocks; implicit M2M join tables ship RLS-disabled unless hand-added to `EXTRA_TABLES`). |
| **D26** | **Document component tokenization (NEW)** | `ZatcaDocument.tsx` emits `hsl(var(--token))` for brand colors (teal→`--primary`, navy→`--primary-deep`, status-green→`--success`/`--secondary`, ink→`--foreground`, muted→`--muted-foreground`, line→`--border`, soft→`--muted`). Mockup navy `#032833` is WRONG (token is `#03283A`) — use the token. Print-only tints → namespaced `--zatca-print-*`. **Load IBM Plex Mono** via `next/font/google` + expose `--font-ibm-plex-mono` (currently never loaded). **Dedicated portrait export path** (the existing `exportToPDF` is A4 landscape + injects its own MIMAREK header). Printed doc = **light-only print surface, exempt from §6.13 dark-mode**; on-screen preview rendered on a white card/iframe regardless of app theme. |
| **D27** | **Existing scaffold + 6-sample set (NEW)** | `ZatcaStatus` enum (incl. `REPORTED`), `Invoice.zatca*` fields, `getZatcaClearanceRate` (gates `billing:admin`, excludes REPORTED), and the rendered "ZATCA Clearance" admin KPI ALL EXIST — the reporting-health metric **augments** the existing tile, no double-build. Golden vectors + PCSID compliance cover **all 6 document types** (standard invoice/credit/debit + simplified invoice/credit/debit). |
| **D28** | **QR sourcing split (NEW)** | **Standard/clearance (B2B):** populate `zatcaQrCode` by **parsing the cleared XML returned by ZATCA** — the EGS cannot self-generate tag 9 (ZATCA cryptographic-stamp signature). **Simplified/B2C:** self-generate the TLV QR at issuance. A standard invoice has **no final QR / "Cleared" pill until clearance returns** — pill tied strictly to `zatcaStatus === CLEARED`. |
| **D29** | **Platform notifications (NEW)** | `Notification.organizationId` → **nullable** (safe NOT-NULL→NULL widening); add `notifyPlatformStaff()` targeting `role IN [SYSTEM_ADMIN, SYSTEM_SUPPORT] AND organizationId IS NULL`. Tenant alerts keep `notifyAdmins()`. (The earlier "system-org sentinel" idea fails — system users have `organizationId = null`.) |
| **D30** | **Post-approval lock + platform-mediated reset (NEW — governance)** | Once a tenant's ZATCA onboarding is **approved** (EGS reaches `ACTIVE` — compliance/production CSID issued), the tenant's ZATCA identity + EGS config (VAT, CR, legal name, national address, branches, invoice-type flags, tax mapping) becomes **READ-ONLY for the tenant** — `/dashboard/settings/zatca` (surface #2) renders it locked. **The Business admin CANNOT edit ZATCA-approved data.** To change it, the tenant **raises a support ticket** (existing help/ticket flow) to Platform staff; a Platform admin (`zatca:admin`, SYSTEM_ONLY) then **resets the tenant's ZATCA authentication** on `/dashboard/admin/zatca` (surface #1) — revoke the CSID + move the EGS back to a re-onboard state — after which the tenant re-enters + re-onboards (new CSR → new CSID, new keypair). **Enforced at the server-action layer** (the tenant config action REJECTS edits while EGS = `ACTIVE`, not just the UI — §8.3 layered), and **both the lock-on-approval and the platform reset are `logAuditEvent`-audited**. The `ZatcaEgsStatus` enum carries the lifecycle (e.g. `DRAFT → PENDING → ACTIVE`(locked)` → RESET`). Rationale: a CSID is cryptographically bound to the exact tax identity/EGS it was issued for; silently editing it desyncs the cert from the record. Immutability + a governed, audited reset keeps the certified master record trustworthy (NDMO/data-governance: a certified record is changed only through a controlled workflow). |

## 4. User Stories
- *Platform staff:* onboard Mimarek's EGS; SaaS invoices auto-clear; cancel → credit note.
- *Tenant admin:* connect MY org to ZATCA from settings (OTP → EGS/branches → tax identity + invoice types + tax mapping).
- *Tenant agent:* every money movement I record produces the correct document — commercial-lease rent →
  ZATCA invoice (cleared for valid-VAT companies, reported for individuals); residential rent / sale /
  deposit → non-VAT receipt; a reversal of a cleared invoice → credit note — and none silently skips.
- *Anyone:* view the QR + download the **signed XML** (canonical) and a preview PDF.

## UI Changes — every user-facing surface (at a glance)
All verified light/dark × AR/EN (§3.9); every new page gets a nav link with a verified click-path (§3.1).
**Every new route gets a `ROUTE_GUARDS` entry in the same change (§8.3 F4) — not just a nav seed.**

| # | Surface | Type | Who | What changes |
|---|---|---|---|---|
| 1 | `/dashboard/admin/zatca` | NEW page+nav | Platform (`zatca:admin`, SYSTEM_ONLY) | Track A EGS onboarding, status, clearance log, retry/resubmit, revoke, **"Run reporting sweep" + stuck-reporting alarm (D24)**. Discoverable via a card/link on `/dashboard/admin` (verified click-path), not an assumed tab. |
| 2 | `/dashboard/settings/zatca` | NEW page+link | Tenant admin (`zatca:config`) | Track B config. **SERVER page** calling `getTenantPageAccess("zatca:config")`; **explicit `ROUTE_GUARDS`** (don't inherit `/dashboard/settings` `organization:read`). |
| 3 | `/dashboard/billing/invoices` (detail) | Modified | Tenant | ZATCA badge + **QR** + **Download XML (canonical)** + preview PDF + credit-note link; discount fix. |
| 4 | `/dashboard/admin/payments` | Modified | Platform | ZATCA column + retry/resubmit + cancel→credit-note. §6.6.7 icon-only row actions. |
| 5 | `/dashboard/admin` | Behavior | Platform | **Augment** the existing "ZATCA Clearance" KPI with a separate **reporting-health** metric (REPORTED vs failed vs stuck > 12h). |
| 6 | `/dashboard/settings` | Copy+link | Tenant | Dangling promise → real link to settings/zatca. |
| 7 | Notifications | Modified | Platform + tenant | Alert on REJECTED/ERROR clearance or failed reporting. **Platform alerts via `notifyPlatformStaff()` (D29)**, tenant via `notifyAdmins()`. |
| 8 | `/dashboard/invoices` (Invoices & Receipts) | NEW page+nav | Tenant (`zatca:config`/finance) | Track C documents. **Explicit `ROUTE_GUARDS` entry** (else the nav item renders for all audiences). DataTable + EmptyState + §6.6.7 row actions. |
| 9 | Status badges (`lib/domain-labels.ts`) | New labels | All | Bilingual ZATCA / EGS-status / doc-type / reporting-status. **Added AFTER the Prisma enums land** so the `satisfies Record<Enum>` typing holds. |

## Invoice PDF / Document Generation (BOTH Mimarek subs AND tenant→customer)

**Compliance principle:** the **signed UBL 2.1 XML is the canonical document** that is cleared/reported,
shared, and stored. If a **PDF** is the shared/archived artifact it MUST be **PDF/A-3 with the signed XML
embedded** (ZATCA). The current `apps/web/lib/export.ts` `exportToPDF()` (`html2canvas` scale 2 → PNG → `jsPDF`
**A4 landscape**, injected MIMAREK header) produces a **raster image PDF** — NOT compliant for share/store, and
**not reusable as-is** for the portrait ZATCA document. So:

- **Canonical / share / archive:** the signed XML (download + store `xmlContent`). PDF/A-3-with-XML is the
  compliant PDF form — a **scheduled work item** (server-side `pdfkit`/`pdf-lib`, embedded XML, Arabic font).
- **Preview / customer convenience:** a raster PDF via a **dedicated portrait export path** (NOT the landscape
  `exportToPDF` as-is — parametrize it with orientation + a "document has its own header" flag, or add a thin
  ZATCA wrapper). Labeled a preview; not the legal copy. Carries the **QR** (per D28: stored cleared-XML QR
  for standard, self-generated for simplified), the **bilingual title** ("فاتورة ضريبية"/"Tax Invoice",
  "فاتورة ضريبية مبسطة"/"Simplified Tax Invoice", "سند قبض"/"Receipt"), and the **seller/buyer/VAT blocks** +
  UUID + ISO timestamp + per-line VAT + VATEX-SA-30 on exempt lines. Arabic renders via rasterization.
- **Track A:** seller = Mimarek PropTech Co. (use the existing **`SystemConfig` brand logos**); buyer = the
  tenant org.
- **Track C:** parametrize the document with the seller org → tenant logo (new `Organization.logoUrl`) + name;
  buyer = `Customer` (name/nationalId from `decryptCustomerData`; **`address` is plaintext JSON — read
  directly**); VAT if a valid-VAT COMPANY.
- **Receipts (D21):** raster preview + (if a stored PDF copy is needed) PDF/A-3 without XML/QR; title
  "Receipt"; no clearance.

### Locked document template (approved 2026-06-20) — port with tokenization (D26)
The approved sample **`zatca-mockup/invoice.html`** (+ `zatca-mockup/build_invoice.py`) is the **canonical
design source of truth**. Port it into `apps/web/components/zatca/ZatcaDocument.tsx` rendering the **same
DOM/CSS structure** with real data + per-seller branding — but **emit `hsl(var(--token))` for brand colors**
(D26), not the mockup's raw hex. One template, all document types; fed to both the raster-preview pipeline and
the later server-side PDF/A-3 generator.

**Page & system:** A4 portrait, **RTL Arabic-primary + English secondary**; brand **teal `--primary`
(#00707A)**, **navy `--primary-deep` (#03283A — NOT the mockup's #032833)**; fonts per §6.3 (**Tajawal**
Arabic/UI, **Satoshi** Latin, **IBM Plex Mono** for IDs/numbers — **must be loaded via `next/font`; it is not
today**). All IDs/amounts wrapped LTR + `tabular-nums` (preserve the mockup's `.num`/`.mono` LTR-isolation
verbatim — the one part already §6.3.4-correct).

**Exact structure (top → bottom):** 1. Header (teal bottom rule) — brand mark + seller name / document title
+ status pill (cleared standard / reported simplified / omitted for receipts; pill only when
`zatcaStatus === CLEARED`/`REPORTED`). 2. Seller / Buyer bordered cards (name, VAT mono, CR mono, national
address). 3. Invoice meta (No. / UUID / ICV; issue date ISO +03:00, supply date, currency; notes add the
billing-reference row). 4. Line-items table (navy header, # · Description AR+EN · Qty · Unit price · VAT % ·
VAT amount · Line total; zebra; VATEX-SA-30 on exempt lines). 5. Bottom row — totals box (Taxable, VAT 15%,
teal grand-total band) + **QR card** (per D28; receipts omit). 6. Footer (disclaimer + "مُولّدة عبر منصة
معمارك · Generated by Mimarek"). 7. Watermark "SAMPLE · نموذج" — **preview / non-cleared only**.

**Per-document-type deltas:** title + status pill swap; Simplified/B2C buyer block = name + optional ID;
QR present for invoices/notes, absent for receipts; notes carry the original-invoice reference.
**Per-seller branding** parametrized. **Light-only print surface (D26)** — exempt from §6.13 dark-mode; the
on-screen preview renders on a white card/iframe regardless of app theme.

## 5. Implementation

### 5.0 P0 — Spike (HARD GATE)
Oracle vs Java SDK: byte-identical hash/signature/QR/CSR for **all 6 document types** (standard
invoice/credit/debit + simplified invoice/credit/debit, D27). Commit golden vectors. Exit: all match; libs
locked (D9). Reminder: **SDK pass is validation, not ZATCA approval**.

### 5.1–5.2 `@repo/zatca` scaffold + engine (pure, no DB)
`crypto` / `ubl` (invoice / note / **simplified**) / `xades` / `qr` / `client` (**clearance + reporting**) /
`pipeline`. **QR module:** enumerate TLV tags 1–9 and **annotate which are EGS-generated vs ZATCA-returned per
document type** (D28) — simplified builds all 9 (tag 9 = ECDSA sig over the EGS cryptographic stamp from the
PCSID); **standard tags 6–9 / the stamp come from ZATCA's clearance response**. Golden-vector vitest for all 6
types. `client` maps failures to a typed `ZatcaError` distinguishing **transport-uncertain** (retry same
payload, D22a) from **business-rejected** (resubmit-new, D22b); error messages carry **no payload** (D13).

### 5.3 Shared schema + onboarding (BOTH tracks)
**Existing-scaffold inventory (D27 — do NOT rebuild):** `enum ZatcaStatus` (incl. `REPORTED`),
`Invoice.zatca*` fields (`zatcaStatus/zatcaHash/zatcaQrCode/xmlContent/zatcaSubmittedAt/zatcaClearedAt`),
`getZatcaClearanceRate` (gates `billing:admin`, excludes REPORTED), and the rendered "ZATCA Clearance" admin
KPI ALL exist. New work augments them.

New schema:
- `ZatcaEgsUnit` (org-scoped, multi-branch D15, `lastIcv`/`lastInvoiceHash`, `invoiceTypeFlags`, secrets via
  the **new ZATCA helper** under `ZATCA_MASTER_KEY`; **secret columns excluded from any client DTO via explicit
  Prisma `select`**), `ZatcaClearanceLog` (`outcome ZatcaClearanceOutcome`), **`ZatcaBranch`** (FK to EGS, D25).
- **`TenantDocument`** (D19): seller-org + EGS + `Customer` + source-charge link + `documentType`
  (TAX_INVOICE/SIMPLIFIED/CREDIT_NOTE/DEBIT_NOTE/RECEIPT) + `originalDocumentId` + per-EGS display number +
  the ZATCA fields; **`zatcaStatus ZatcaStatus`** (reuse existing). Display number via `SequenceCounter`
  (`scope = `egs:${egsUnitId}``); **`@@unique([egsUnitId, number])` is a TenantDocument constraint** (not the
  counter).
- **New columns — all nullable / defaulted (populated-table safe, §4):** `Customer`: `customerKind
  CustomerKind? @default(INDIVIDUAL)`, `vatNumber String?` (non-unique), `crNumber String?` (non-unique),
  `companyNameAr/En String?`. `Invoice`: `documentType ZatcaDocumentType? @default(TAX_INVOICE)`,
  `originalInvoiceId String?`. `Organization`: `logoUrl String?`. `Notification`: `organizationId String?`
  (widening, D29).
- New enums: `ZatcaEnvironment`, `ZatcaEgsStatus`, `ZatcaDocumentType`, `ZatcaClearanceOutcome`
  (= per-attempt log outcome; do NOT duplicate `ZatcaStatus`). `CustomerKind` (INDIVIDUAL/COMPANY).
- **`turbo.json` `globalEnv` += `ZATCA_MASTER_KEY`** AND CI job-level env if read at build/test time.
- **DB:** edit `schema.prisma` → `npx turbo run db:generate` → `cd packages/db && npx prisma db push` →
  `npm run rls:generate` (regenerates `2026-06-enable-rls.sql`; CI `rls:check`) → paste the new
  `ALTER TABLE` lines into the **Supabase SQL Editor** on the live DB (double-quoted mixed-case names) →
  verify with `SELECT relname, relrowsecurity FROM pg_class WHERE relname = '<Table>'`. **Before relying on
  deploy, run a PLAIN `prisma db push` (no `--accept-data-loss`) against a prod-like DB** — it self-aborts and
  names every blocker. Onboarding actions audience-guarded (platform vs tenant-org-scoped).

### 5.4–5.6 Track A — SaaS clearance + credit notes + buyer rules
Hook `generateSubscriptionInvoice` post-commit `clearInvoice`; ICV/PIH CAS; `createAdjustmentNote` +
cancel/refund; §5.6 buyer mapping + data gate; **D3 discount fix**. **Retry/resubmit per D22.** **Standard QR
parsed from the cleared-XML response (D28).**

### 5.7 Track B — Tenant config UI (`/dashboard/settings/zatca`)
Tenant `zatca:config` (TENANT_SCOPED), org-scoped, nav link. **SERVER `page.tsx` calling
`getTenantPageAccess("zatca:config")`** (the `settings/` dir has no layout; the edge gate enforces audience,
not permission, for tenant users). **Explicit `ROUTE_GUARDS` entry** (longest-prefix would otherwise inherit
`/dashboard/settings`'s `organization:read`). Sections (Zoho/Wafeq/Qoyod/Rewaa pattern): status → tax identity
(Saudi inputs) → OTP wizard → branches (multi, D15/D25) → invoice-type + tax mapping (D16) → logs. RTL-first,
bilingual, secrets never shown.

**Permission wiring (the §8.4 gate — do in this change):** add `zatca:admin` to `ALL_PERMISSIONS` +
`SYSTEM_ONLY_PERMISSIONS` (+ the `SYSTEM_SUPPORT` explicit list); add `zatca:config` to `ALL_PERMISSIONS` +
`TENANT_SCOPED_PERMISSIONS` (ADMIN inherits via `ALL` minus SYSTEM_ONLY; add to MANAGER/FINANCE as desired).
**Guard-coverage test:** `requirePermission("zatca:admin")` throws for tenant ADMIN; `requirePermission(
"zatca:config")` throws for SYSTEM_ADMIN.

### 5.8 Track C — Tenant issuance + the money-movement hook matrix
**Single classifier `issueDocumentForCharge(charge)`** routes EVERY money movement so none silently skips.
Routing = tax category (per D16 config) × buyer (valid VAT? → clearance, else simplified/reporting; data
gate before standard) × movement kind:

| Code path | Charge | Document |
|---|---|---|
| `app/actions/installments.ts recordPayment()` | single rent payment | commercial lease → **ZATCA invoice** (clear/report); residential → **receipt** |
| `app/actions/installments.ts bulkMarkInstallmentsPaid()` | batch rent | loop each through the classifier — **no skip** |
| `app/actions/installments.ts reverseRentPayment()` | rent reversal/refund | original cleared commercial invoice → **credit note** (chained); receipt → reverse receipt (no ZATCA) |
| `app/actions/payment-plans.ts recordInstallmentPayment()` | sale installment | sale = exempt/RETT → **receipt** |
| sale contract signing / down payment | sale | **receipt** |
| reservation deposit | deposit | **receipt** (invoice only if later forfeited) |
| future 15% service/fee charge (new model) | service fee | **ZATCA invoice** |

- **Buyer PII:** `decryptCustomerData` for name/nationalId; **`Customer.address` is plaintext JSON — read
  directly**. Buyer `vatNumber`/`crNumber` are plaintext (D18).
- **Per-tenant EGS chain:** each tenant org's own `ZatcaEgsUnit` ICV/PIH chain (CAS).
- **Reporting (B2C):** issue immediately with QR+signature; report ≤24h via the **operator-triggered sweep
  (D24)** hitting `app/api/cron/zatca-report` (`CRON_SECRET`-guarded); `TenantDocument.zatcaStatus = REPORTED`
  on success; **stuck-reporting > 12h alarm**.
- **UI:** the Invoices & Receipts page (surface #8) + the PDF changes above.

### 5.9 Ops, Security & Oracle
- EGS-key threat model + dedicated `ZATCA_MASTER_KEY`; **tenant cross-org isolation** re-checked on every
  Track-B/C action (§8); §3.8 security review (no key/secret leak via logs/errors/DTO serialization —
  **explicit Prisma `select` allowlists exclude private key/CSID/OTP from every client DTO; `decryptZatca()`
  fail-closed; `ZatcaError` carries no payload**).
- **Metrics split:** `getZatcaClearanceRate` (`app/actions/admin-analytics/`) counts CLEARED/REJECTED/PENDING
  and **excludes REPORTED** → **augment** with a separate **reporting-health** metric (REPORTED vs
  failed-report vs stuck > 12h) on the existing admin tile (D27).
- **Platform notifications (D29):** `Notification.organizationId` nullable + `notifyPlatformStaff()`
  (`role IN system-roles AND organizationId IS NULL`) for platform ZATCA alerts; `notifyAdmins()` for tenant.
- Java SDK oracle in gitignored `tools/zatca-sdk/`.

### 5.10 Reuse map (corrected paths)
`apps/web/lib/encryption.ts` (pattern only — new ZATCA helper) · `apps/web/lib/pii-crypto.ts`
(`decryptCustomerData`, NOT address) · `apps/web/lib/sequence.ts` (`SequenceCounter`, new `egs:` scope) ·
`apps/web/lib/auth-helpers.ts` (`requirePermission`, `getTenantPageAccess`) · `apps/web/lib/export.ts`
(preview PDF — **portrait wrapper, not as-is**) · `apps/web/lib/domain-labels.ts` ·
`packages/ui/src/components/saudi/` inputs · `@repo/ui` · `apps/web/lib/create-notification.ts`
(`notifyAdmins` + new `notifyPlatformStaff`) · `packages/db/scripts/generate-rls.ts` (`rls:generate`/
`rls:check`) · `apps/web/app/actions/admin-analytics/getZatcaClearanceRate.ts` ·
`apps/web/lib/cron-auth.ts` (`isAuthorizedCronRequest`) · `app/actions/installments.ts` /
`app/actions/payment-plans.ts` hooks.

## 6. Milestones (program — sequential releases)

| Release | Scope | Verify |
|---|---|---|
| **R1 — Engine** | P0 spike (GATE, 6 doc types) → `@repo/zatca` (clearance+reporting+notes) + golden-vector vitest. | SDK byte-match (6 types); build + check-types; **`/mimaric-qa` on the package**. **§3.9 4-theme walk N/A (no UI).** |
| **R2 — Track A** | shared schema/onboarding (incl. all nullable/defaulted columns + `ZATCA_MASTER_KEY` turbo+CI + `TenantDocument`/`ZatcaBranch`) + permission wiring + Mimarek clearance + credit notes + retry/resubmit (D22) + D3 + admin UI + `ZatcaDocument.tsx` (tokenized) + portrait export + security review. | Sandbox SaaS clears (QR from cleared XML) + credit note; resubmit mints new doc; guard test; `/mimaric-qa`; §3.9 (local build). |
| **R3 — Track B** | tenant config UI (server page) + `zatca:config` + explicit guards/nav + multi-branch onboarding + tax mapping. | Tenant onboards in Sandbox; cross-org isolation; guard not inherited; `/mimaric-qa`; §3.9. |
| **R4 — Track C** | buyer schema/routing (D18) + `TenantDocument` + **hook-matrix classifier** + simplified/reporting (operator sweep D24) + receipts + Invoices & Receipts page + tenant PDF branding + metrics augment. | Sandbox: commercial rent → cleared/reported; residential/sale → receipt; reversal → credit note; no path skips; `/mimaric-qa`; security pass; §3.9. |
| **R5 — Production go-live (D23)** | production CSID + **6-sample compliance gate** + cutover runbook + failure-notification + **real reporting scheduler (D24)** + **tax-advisor signoff** + PDF/A-3-with-XML. | Production onboarding; advisor signoff recorded; controlled cutover; cutover-focused QA. |

Each release: build + `/mimaric-qa` (§3.11) + security review + §3.9 4-theme walk (**against local
`next build && next start`, not a deployed preview**; N/A for R1) + commit/CHANGELOG/tag/GitHub release +
**Graphify refresh** (§7). Critical path R1 → R2 → R3 → R4 → R5.

## 7. Execution model — Manager mode (per AGENTS.md §0.2 / §3.2)

Every release is run as a **manager, not an executor**: **decompose → delegate (one focused task per
subagent) → run independent work in parallel → audit every output against the requirement → verify
critical/absence claims by direct Read/Grep (§3.8) → fix substandard output silently → approve.**
Research-first: a read-only research/Explore subagent runs before any non-trivial build step. **The manager
owns correctness — no track is approved on a subagent's report alone.**

**Model selection (§0.2):** **opus** = P0 crypto spike, architecture, security review, adversarial
verification; **sonnet** = standard implementation, server actions, UI components, codegen; **haiku** =
validation, lookups, formatting, label sweeps.

**Standing per-release gates (manager-run):** §3.8 delegate-and-validate · §3.11 `/mimaric-qa` ·
§3.8 adversarial security pass (EGS-key handling + tenant cross-org isolation) · §3.9 preview walk (the
**manager** runs the 4-theme/route screenshots + console check against the local build; subagents do NOT
render UI — §10.4).

**Per-release subagent decomposition:**

| Release | Research (first) | Parallel build subagents (sonnet unless noted) | Sequential gate | Validate / verify (manager) |
|---|---|---|---|---|
| **R1 Engine** | ZATCA spec PDFs + `Saleh7/php-zatca-xml` C14N recipe (opus) | after P0 locks the recipe: `crypto` · `ubl` · `xades` · `qr` · `client` (one per pure module) | **P0 spike is serial + gates everything** (opus) | golden-vector byte-match vs SDK (6 types); manager Reads each module; `/mimaric-qa` on package |
| **R2 Track A** | — | schema+RLS · permission wiring · clearance/retry/resubmit · credit-notes · admin UI · `ZatcaDocument` (tokenized) + portrait export | schema → wiring → UI | build green; guard test; `/mimaric-qa`; security pass; §3.9 |
| **R3 Track B** | UX pattern already researched | tenant config server-page · permission + explicit guards + nav · onboarding actions | permission/guards → UI | cross-org isolation test (manager-verified); `/mimaric-qa`; §3.9 |
| **R4 Track C** | tax-treatment confirm (tax advisor, external) | buyer schema · hook-matrix classifier · reporting sweep · receipts · invoices page · PDF branding | schema + classifier → payment hooks | every-hook-path test (no silent skip); metrics augment; `/mimaric-qa`; security pass; §3.9 |
| **R5 Production** | tax-advisor signoff (external) | cutover runbook · failure-notification · PDF/A-3 generator · scheduler wiring | advisor signoff gates go-live | production onboarding; 6-sample gate; controlled cutover |

## Verification (Testing Decisions)
- **R1 gate:** golden-vector byte-match vs Java SDK for **all 6 doc types**.
- **Units:** PIH/ICV CAS concurrency; **transport-retry idempotency vs resubmit-new-doc** (D22); per-EGS
  display-number uniqueness; clearance+note+reporting; data-gate; **tenant cross-org isolation** (§8);
  buyer-routing (valid-VAT→standard, else simplified; COMPANY-without-VAT blocked); **every hook-matrix
  path emits the right document** (and none skips); tax-treatment gate; **permission guard-coverage** (§8.4);
  **QR sourcing** (standard QR == ZATCA cleared-XML QR, not self-built — D28); **EGS DTO excludes secret
  fields**.
- **Sandbox E2E:** A (clear+credit-note+resubmit), B (onboarding + isolation + guard-not-inherited),
  C (commercial rent → cleared/reported; residential → receipt; reversal → credit note; bulk path covers all).
- **PDF/XML:** XML is the canonical download; preview PDF carries QR + bilingual title + seller/buyer/VAT;
  tenant logo on tenant docs; tokenized colors; IBM Plex Mono renders; AR/EN; **light-only print surface**.
- **§3.9 env:** all walks run against local `next build && next start` (`scripts/verify-all.mjs`).
- **Security review (§5.9) + `/mimaric-qa` (§3.11)** before each release's §3.9 walk.

## Commit & Release
Per §7/§7.1 per release (branch, CHANGELOG in-commit, no AI attribution, build+QA+security+§3.9 green,
PR→CI→merge, **live-DB `db push`+`rls:generate`+Supabase ALTER on the single shared DB — a careful live
write**, tag `vX.Y.0`, `gh release`, **Graphify refresh**). R1 = `v5.1.0`.

## Out of Scope (deferred)
- **RETT filing integration** (the separate ZATCA 5% RETT platform). Receipts for sales are in scope (D21);
  the RETT *filing* is not.
- **Production go-live is R5, not omitted** — placeholdered, not built in R1–R4.
- **A real reporting scheduler** is an R5 precondition (D24); R1–R4 use the operator-triggered sweep.
- **Doc-sync (separate fix):** AGENTS.md §4 RLS "hand-edit" text is stale (the `.sql` is auto-generated by
  `packages/db/scripts/generate-rls.ts`); AGENTS.md §6.3.1 cites a `--font-ibm-plex-mono` CSS var that does
  not exist in code (only `--font-mono`).

## Key Risks
1. **C14N11 byte-exactness** — highest; P0 retires it first. (SDK pass ≠ approval — taxpayer liable.)
2. ECDSA encoding (DER/P1363) + CSR ASN.1 — pinned in P0.
3. PIH ordering (invoices+notes+simplified share one per-EGS chain) — atomic CAS.
4. **EGS key compromise + tenant cross-org leakage** — dedicated key, org-scoped guards, no-leak review,
   secret-excluding DTOs.
5. **Tax-scope correctness** — confirm with a tax advisor.
6. **A money-movement path silently skipping** issuance — the single classifier + the hook-matrix tests.
7. **Reporting SLA (≤24h)** — no live scheduler today (D24); operator-triggered sweep + stuck-reporting alarm
   bridge it until R5 attaches a real scheduler. Monitor stuck-reporting separately from clearance.
8. **PDF non-compliance** — never present the raster PDF as the legal copy; XML (or PDF/A-3-with-XML) is canonical.
9. **Standard-invoice QR** — must come from ZATCA's cleared XML, never self-generated (D28); a self-built
   standard QR fails verification.
