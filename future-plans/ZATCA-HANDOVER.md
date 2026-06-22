# Mimarek ZATCA Phase-2 E-Invoicing — Developer Handover

> **Status:** R1 + R2 shipped and live-CLEARED against the ZATCA sandbox. You are picking up at **R3 (Track B — tenant config)**.
> **Authoritative sources (in priority order):** `CHANGELOG.md` → `zatca-phase2-einvoicing-plan.md` (the canonical plan) → the code. **Do NOT trust `future-plans/REMAINING-WORK.md` for ZATCA** — it is stale (dated 2026-06-19, predates R1/R2 shipping; still lists ZATCA as "not started / blocked").

---

## 1. TL;DR & Current State

**What ZATCA Phase-2 ("Fatoora") is.** Saudi Arabia's mandatory e-invoicing regime for VAT-registered sellers. Phase-2 ("Integration") requires that taxable invoices be cryptographically signed (XAdES), carry a TLV QR, and be either **cleared** (B2B / standard — submitted to ZATCA *before* issuance, ZATCA stamps and returns it) or **reported** (B2C / simplified — submitted within ≤24h after issuance). Mimarek built this **in-house** rather than buying it.

**What's shipped:**

| Release | Version | Scope | State |
|---|---|---|---|
| **R1** | v5.1.0 (2026-06-22) | Pure `@repo/zatca` crypto/XML/QR engine + network client (compliance/clearance/reporting + `ZatcaError` taxonomy) | ✅ SHIPPED, live-CLEARED |
| **R2** | v5.2.0 (2026-06-22) | Track A — Mimarek's **own SaaS subscription invoices** cleared through ZATCA (platform EGS, ICV/PIH chain, admin UI) | ✅ SHIPPED, live-CLEARED |
| **R2 polish** | v5.2.1 (2026-06-22) | UX-only: natural Arabic label, VAT-only onboarding form (`PLATFORM_SELLER`), RTL bidi fix. **No schema/data/logic change.** | ✅ SHIPPED |

All three were **verified live end-to-end against the ZATCA SANDBOX**: `generateCsr` → compliance CSID → **production CSID** → build → sign → `clearInvoice` → **CLEARED**, with the QR parsed back out of ZATCA's cleared XML. 65 engine unit tests + 1 `ZATCA_LIVE`-gated live test (skipped in CI).

**Where you pick up: R3 (Track B).** A tenant-facing config surface at `/dashboard/settings/zatca` so each customer org can onboard its **own** EGS. None of it is built yet — the schema (`ZatcaEgsUnit.organizationId` nullable, `zatca:config` permission) already *supports* it, but there is no `settings/zatca` directory and no tenant onboarding flow.

> **⚠ Which environment is actually wired: SANDBOX, and ONLY SANDBOX.** The whole shipped app path hardcodes `environment: 'SANDBOX'` — `getActivePlatformEgs` (`lib/zatca-server.ts:54-58`), `onboardPlatformEgs` (`onboarding.ts:57,82`), and the clearance reads (`zatca-clearance.ts:78,94`) all pass the literal string. The `SIMULATION` and `PRODUCTION` base URLs **exist** in the engine (`client.ts:31-32`) but **no app code ever reaches them.** Threading an `environment` parameter through these hardcoded sites is concrete, non-obvious R3/R5 work — there is no toggle today. Do not assume the env is config-driven; it is not.

---

## 2. Release Map

| Release | Track | One-liner |
|---|---|---|
| **R1** ✅ | — | Pure `@repo/zatca` engine (hash/qr/cert/xades/crypto/ubl) + network `client.ts`. |
| **R2** ✅ | A (Mimarek-as-seller) | Clear Mimarek's own subscription invoices: platform EGS (`organizationId = NULL`), ICV/PIH chain, `/dashboard/admin/zatca`. |
| **R3** ⬜ | B (tenant config) | Tenant org onboards its own EGS at `/dashboard/settings/zatca` (VAT-only entry, reuses the org CR profile); OTP wizard, multi-branch, invoice-type/tax mapping. |
| **R4** ⬜ | C (tenant issuance) | `issueDocumentForCharge()` classifier routes every money movement → e-invoice or receipt; B2C reporting sweep; `/dashboard/invoices`. Lands `TenantDocument`, `ZatcaBranch`, `Customer` buyer columns. |
| **R5** ⬜ | Production | Production CSID (proven once in sandbox), 6-sample compliance gate, real scheduler, **external tax-advisor signoff**, PDF/A-3-with-embedded-XML. "Sandbox clears ≠ legally ready." |

Critical path is strictly sequential R1→R2→R3→R4→R5. Each release runs its own §3.9 4-theme walk + `/mimaric-qa` gate + Graphify refresh.

---

## 3. The `@repo/zatca` Engine

**Location:** `packages/zatca/src/`. **What it is:** a pure, deterministic ZATCA Phase-2 issuance engine. **No DB, no auth, no encryption-at-rest, no mutations** — all of that lives in the `apps/web` server-action layer (§4). The package depends on **only** `@xmldom/xmldom` + `xml-crypto` (`packages/zatca/package.json:16-19`).

**The pipeline (memorize this):**

```
structured data
  → buildInvoice()          (ubl.ts)   — data → unsigned UBL 2.1 XML
  → signInvoice()           (xades.ts) — injects UBLExtensions / QR / Signature
  → computeInvoiceHash(SIGNED)  (hash.ts) — ⚠ hash the SIGNED doc, not the build output
  → createZatcaClient().clearInvoice / reportInvoice   (client.ts)
```

Everything is re-exported from `index.ts` (`packages/zatca/src/index.ts:24-41,120-131`).

### Module map

| Module | Responsibility |
|---|---|
| `index.ts` | Barrel + shared types: `ZatcaError` (D22 taxonomy), `ZatcaEnvironment`/`DocumentType`/`QrTag` enums, `ZatcaClearanceOutcome`. Re-exports every module via `.js` specifiers. |
| `ubl.ts` | `buildInvoice` — structured data → unsigned UBL 2.1 XML. **Standard-rated (S, 15%) only.** |
| `hash.ts` | `computeInvoiceHash` — strip 3 signing artifacts → inclusive C14N → `base64(raw sha256)`. |
| `qr.ts` | `encodeQrTlv`/`decodeQrTlv` (single-byte-length TLV) + `deterministicQrTags` (tags 1–6). |
| `cert.ts` | `computeCertHash` — `base64(hex(sha256(base64-cert-STRING)))`. |
| `xades.ts` | `signInvoice` — XAdES signer, two-pass assemble, ECDSA-sign the invoice hash. |
| `crypto.ts` | `generateCsr` — secp256k1 keygen + hand-rolled DER PKCS#10. |
| `client.ts` | `createZatcaClient` — fetch wrapper for compliance/clearance/reporting. |

> **⚠ `cbc:UUID` is caller-supplied — the engine never generates it.** `buildInvoice` treats the document UUID as an input it copies into `cbc:UUID` (the client also passes it through, `client.ts:60-62`), and the clearance payload sends `invoice.uuid` (`zatca-clearance.ts:148`). **Nothing in the engine or the R2 app layer mints a UUID** — the platform-EGS path currently relies on `Invoice.uuid` already being populated upstream. **When you wire R4 tenant issuance, every document MUST get its own stable, persisted, per-document UUID** (a v4 UUID generated once at document creation and stored on the row — NOT regenerated on retry, NOT shared across documents). The UUID is part of what ZATCA chains/dedupes on; a reused or regenerated UUID on a retry is a correctness bug. See §9/R4: minting + persisting `TenantDocument.uuid` is part of the issuance hook.

---

### 3.1 CRYPTO LANDMINE CHEAT-SHEET (the highest-value content in this doc)

These are the things that took real debugging against the live API to get right. **Every one of them is verified at the cited line and re-confirmed by an independent verification pass.** (Line citations are *navigation aids* — a few are approximate, off by 1–5 lines from drift; the surrounding symbol name is the load-bearing anchor, not the exact line number.) If you touch the signer or the UBL builder, re-read this.

#### ⚠ LANDMINE 1 — The invoice hash is over the **SIGNED** document, never the unsigned UBL.

`computeInvoiceHash(signedXml)` must run on the **final assembled/signed XML**, not on `buildInvoice`'s raw output. `signInvoice`'s injection of `UBLExtensions`/`QR`/`Signature` adds inter-element whitespace, so ZATCA recomputes the hash from the signed document it receives. If you hash the build output, the embedded hash diverges and the **live API returns `invalid-invoice-hash`**.

- `hash.ts:22-26` doc-comment mandates signed-doc input.
- `hash.ts:42-58` `stripSigningArtifacts` removes exactly three elements before C14N: `ext:UBLExtensions`, `cac:Signature`, `cac:AdditionalDocumentReference[cbc:ID='QR']`.
- `hash.ts:28-39` inclusive C14N (`xml-crypto` `C14nCanonicalization`) → `createHash('sha256').digest('base64')`.

> **Historical note:** the earlier claim "buildInvoice → sign → -validate PASSED" was *over-stated* — it only ever ran on a hand-authored golden, never on `buildInvoice` output through a real hash check, and the offline SDK missed it. R1 fixed this with the two-pass assemble (below).

#### ⚠ LANDMINE 2 — Two-pass `assemble` in the signer.

`signInvoice` builds a **skeleton** (empty signature/QR regions), hashes *that*, then refills the excluded regions with the real signature artifacts. This is what guarantees `embedded hash == QR tag 6 == ZATCA's recompute`.

- `xades.ts:200-215` `assemble()` — and it **hard-fails** if the UBL is missing the `<cbc:ProfileID>` anchor (line ~205) or the `<cac:AccountingSupplierParty>` anchor (line ~210-212). Any future UBL change must preserve these anchors.
- `xades.ts:222-223` `skeleton = assemble('','')` → `computeInvoiceHash(skeleton)`.

#### ⚠ LANDMINE 3 — `SignatureValue` signs the **invoice-hash bytes**, NOT `c14n(SignedInfo)`.

ZATCA's `SignatureValue` is `ECDSA-sign('sha256', invoiceHashBinary)` where `invoiceHashBinary = Buffer.from(invoiceDigest, 'base64')`. This is **non-standard XML-DSig** and is the single most counter-intuitive fact in the engine.

- `xades.ts:223-225` — `cryptoSign('sha256', invoiceHashBinary, privateKey)`.
- `xades.test.ts:42-45` verifies the signature against `computeInvoiceHash(signed)`.
- **⚠ STALE DOC WARNING:** `packages/zatca/docs/p0-spike-recipe.md:93-95` (§7) says SignatureValue signs `c14n(SignedInfo)`. **That text is wrong/stale.** The code is authoritative and `-validate`/live-verified. Do not trust the recipe doc on this point.

#### Digest conventions (two different ones — do not mix them up)

| Digest | Convention | Where |
|---|---|---|
| **Invoice hash** | `base64(raw sha256(canonical body))` | `hash.ts:28-39` |
| **Cert digest** (`xades:CertDigest`) | `base64( hex( sha256( base64-cert-STRING ) ) )` — hashes the **base64 text inside `<ds:X509Certificate>`** (whitespace stripped), **NOT** the decoded DER | `cert.ts:13-17` |
| **SignedProperties digest** | `base64(hex(sha256(...)))` (same hex-then-base64 form as cert) | emitted from one verbatim template in `xades.ts` |

`computeCertHash` byte-matches the SDK's `CertDigest` (`cert.test.ts:16-23`).

#### QR — TLV tags

`deterministicQrTags` emits **only tags 1–6** (seller name, VAT number, timestamp `${issueDate}T${issueTime}Z`, `TaxInclusiveAmount`, doc-level `TaxAmount`, invoice hash) — `qr.ts:49-77`. Tags 7 (signature), 8 (SPKI DER public key), 9 (cert signature, **simplified-only**) are appended by `signInvoice` (`xades.ts:237-244`). `encodeQrTlv` is single-byte length → each value must be ≤255 bytes (`qr.ts:16-23`).

> **⚠ Two different "tag 9" stories — do not conflate them.**
> 1. **Self-generated SIMPLIFIED/B2C QR:** `signInvoice` appends tag 9 (the cert signature) from the cert at issuance (`xades.ts:244`), simplified-only. The EGS controls these bytes.
> 2. **Standard/B2B CLEARED QR:** the standard invoice has **no self-generated final QR.** After clearance, the engine extracts ZATCA's QR *verbatim* from the cleared XML (`parseQrFromClearedXml`, §4.5). That is **ZATCA's own re-stamped QR** — whatever tags ZATCA chose to embed. The engine does **not** generate, govern, or verify its tag contents; it copies the base64 blob through. **Do not assume the cleared QR "includes tag 9" — that is an assumption about ZATCA's output, not something our code controls.** A standard invoice has **no final QR / no "Cleared" pill until clearance returns**; the pill is tied strictly to `zatcaStatus === CLEARED`.

#### UBL scope & type codes

`ubl.ts` is **standard-rated supplies only** (category `S`, 15% VAT — commercial lease + 15% fees). Type codes: invoice = **388**, credit-note = **381**, debit-note = **383** (`ubl.ts:68`). Name flag = `'0100000'` standard / `'0200000'` simplified (`ubl.ts:148`). Credit/debit notes require `billingReferenceId` (→ `cac:BillingReference`) and a `reason` (→ `InstructionNote`) (`ubl.ts:157-163`). VAT is computed **per line** (`round2`) then summed (`ubl.ts:117-119,153-154`).

#### CSR generation (`crypto.ts`)

`generateCsr` uses Node `secp256k1` (`generateKeyPairSync('ec', { namedCurve: 'secp256k1' })`) + a **hand-rolled DER PKCS#10 encoder** — `openssl`/`forge`/WebCrypto are not options because **secp256k1 is absent from WebCrypto and forge**.

- Subject DN order: **C, OU, O, CN** (`crypto.ts:104-109`).
- SAN `directoryName` carries EGS serial / VAT / invoice-type / location / industry (`crypto.ts:114-122`).
- MS template-name extension OID `1.3.6.1.4.1.311.20.2` switches `TSTZATCA` / `PREZATCA` / `ZATCA` by environment (`crypto.ts:62,85-89`).
- Self-signed `SHA256withECDSA` (`crypto.ts:129-130`).
- **No offline oracle exists** (the SDK has no validate-CSR command). Correctness is *structural* (matches `keytool` vs SDK `-csr` output) and was **proven only when the live compliance endpoint accepted it** during onboarding.

> **⚠ ZATCA-mandated EGS-identity string formats (an R3 tenant-config implementer MUST replicate these).** The CSR subject DN and SAN are not free-form — ZATCA dictates specific token formats that the platform-EGS onboarding hardcodes today and that R3 must regenerate **per tenant org**:
> - **`commonName`** = `TST-886431145-${vatNumber}` for the sandbox/test environment (`onboarding.ts:66`). The `TST-886431145-` prefix is the ZATCA test-CSID convention; production uses the env-appropriate prefix. Build it from the org's VAT, not a literal.
> - **`egsSerialNumber`** (goes into the SAN) follows ZATCA's `1-<solutionName>|2-<modelOrVersion>|3-<uuid>` three-segment structure (the `SANDBOX_BASE_SERIAL` constant supplies the `1-...|2-...` prefix and segment 3 is a per-unit UUID). Each tenant EGS needs its **own** segment-3 UUID; do not reuse the platform serial.
>
> When you generalize `onboardPlatformEgs` into the per-org tenant flow, these two strings (plus the SAN VAT/invoice-type/location/industry fields) are the identity surface you must derive from the tenant org's profile. Copying the platform constants verbatim onboards every tenant under Mimarek's identity — a correctness/compliance bug.

#### Network client (`client.ts`) — D22 / D13

- **Auth:** HTTP Basic `base64(binarySecurityToken:secret)` with the token used **verbatim** — it is already base64 from the CSID response and must **not** be re-encoded (`client.ts:135-137`). Compliance endpoint uses the OTP header (no `Authorization`); production/clearance/reporting use Basic auth.
- **Timeout:** 30s via `AbortController` (`client.ts:36,269-270`).
- **Clearance** sends `Clearance-Status: 1`; **reporting** sends `0` (`client.ts:350,363`).
- **`ZatcaError` taxonomy (D22)** — three `kind`s:
  - `transport` — outcome uncertain (timeout/gateway) → **re-POST the SAME payload**, `isRetryable: true`.
  - `business` — ZATCA rejected → **resubmit as a NEW document** (e.g. a credit note); never reuse the ICV.
  - `config` — local misconfiguration → **never sent**, rethrow.
- **HTTP classify map:** `429/413/5xx → transport`, `401/403 → config`, other `4xx → business` (`client.ts:200-211`). **A 2xx body can still be a business rejection** (`NOT_CLEARED`/`NOT_REPORTED` or `errorMessages`) — `client.ts:223-230`.
- **D13:** error messages carry **no payload and no key material** — verified the transport messages contain only timeout/gateway text (`client.ts:280-287`, mandate at `index.ts:89`).
- **Base URLs:** SANDBOX `client.ts:30`, SIMULATION/PRODUCTION `client.ts:31-32`. **Only SANDBOX is reached by app code today** (see §1 — the env is hardcoded everywhere upstream).

#### NodeNext / build resolution (engine side)

The package is NodeNext (`module`/`moduleResolution: NodeNext` in `packages/typescript-config/base.json`) and uses **`.js` extension specifiers in TS source** (e.g. `import … from './hash.js'`). For Next to bundle the re-export chain, `apps/web/next.config.js` sets `webpack` `resolve.extensionAlias { '.js': ['.ts','.tsx','.js'] }`. **This is why the app build is pinned to `--webpack` — see §7.** `packages/zatca/package.json:5` points `main` at `src/index.ts` (zero-build).

#### Test gates

- **hash / cert** — full byte-match against the Java Fatoora SDK across all 6 doc types via committed golden fixtures (`test/golden/<type>/{input,signed}.xml + hash.txt + qr.txt`). The hash test asserts byte-match on **both** `input.xml` and `signed.xml` (both strip to the same canonical body) — `hash.test.ts:11-31`, `cert.test.ts:16-23`.
- **qr** — a **codec round-trip** (decode→encode of the SDK's 9-tag QR is byte-identical) **plus** a tags-1–6 derivation match against the SDK. *Note:* it is **not** a full self-generated 9-tag byte-match — by design (D28) the engine cannot self-produce tag 9 for standard docs. (The shorthand "qr byte-matches" slightly overstates this — the precise gate is round-trip + tags 1–6.)
- **xades** — gated by deterministic self-consistency + ECDSA verify, **not** byte-match (ECDSA random-`k` + `SigningTime` make the output non-deterministic) — `xades.test.ts:42-66`.
- **client** — 1 live SANDBOX end-to-end test, `ZATCA_LIVE=1`-gated, `describe.skip` by default (`client.live.test.ts:21-24`).

---

## 4. R2 Track-A App Layer

This is the server-action/orchestration tier that wraps the engine to clear **Mimarek's own SaaS subscription invoices**. Mimarek is the seller; the buyer is the tenant org.

### 4.1 Platform EGS — `organizationId = NULL`

The platform seller is modelled as a single `ZatcaEgsUnit` row with **`organizationId = NULL`** (one per environment; currently SANDBOX only). `getActivePlatformEgs()` queries `{ organizationId: null, environment, status: ACTIVE }` (`lib/zatca-server.ts:54-60`) — and `environment` is the **hardcoded** `'SANDBOX'` string (`:54-58`), not a parameter.

> **⚠ The "one platform EGS per environment" rule is enforced in app code only** (`onboardPlatformEgs` refuses to clobber an `ACTIVE` row). `NULL` `organizationId` rows are NULL-distinct, so no Prisma `@@unique` covers it. A **partial unique index** (`packages/db/sql/2026-06-zatca-platform-egs-unique.sql`, index `zatca_platform_egs_one_active`) backs the invariant at the DB level — it must be applied manually to the live DB (see §6). The `schema.prisma:2024` comment still calls this "a later refinement" — that comment is stale; the index exists.

### 4.2 The full flow (`lib/zatca-clearance.ts`)

`clearSubscriptionInvoiceInternal`:

1. **Reserve ICV + read PIH** inside a `db.$transaction` with raw `SELECT lastIcv, lastInvoiceHash FROM "ZatcaEgsUnit" WHERE id=.. FOR UPDATE` (H1 fix — atomic). The `FOR UPDATE` tx spans roughly `zatca-clearance.ts:111-142` (CPU-bound build/sign + chain advance).
2. `buildSubscriptionInvoiceInput` → `buildInvoice` → `signInvoice` → `computeInvoiceHash(SIGNED)`.
3. **Advance the chain** — `UPDATE` `lastIcv`/`lastInvoiceHash`; write `zatcaStatus = PENDING` + `xmlContent`.
4. **Transaction commits.**
5. **Submit to ZATCA** — *outside* the tx (the submit call is at ~`zatca-clearance.ts:150-153`).
6. `parseQrFromClearedXml` → persist outcome on the `Invoice` + a `ZatcaClearanceLog`.

> **⚠ The `FOR UPDATE` lock spans only the CPU-bound build+sign, and is RELEASED before the HTTP submit.** The ICV is consumed and the chain advances *even if the network submit then fails.* Recovery for a `transport` error is a re-POST of the **SAME stored bytes** (`xmlContent`/`zatcaHash`, **no new ICV**). A `business` REJECT leaves the ICV consumed in the chain — correct per ZATCA: correct-and-resubmit as a **new credit note**, never reuse the ICV.

> **⚠ `clearSubscriptionInvoiceInternal` is UNGUARDED BY DESIGN — every caller must guard at the call site.** The file header explicitly states "UNGUARDED — every caller guards." It is reachable from **two** paths today: (a) the `zatca:admin` actions (`clearance.ts` → `clearInvoiceNow`, guarded `requirePermission('zatca:admin')`), and (b) `billing.ts`'s `generateSubscriptionInvoice` under `billing:write`. **There is no guard inside the function** — it trusts the caller. **If you add a third caller (e.g. an R3/R4 issuance path), you MUST add the permission/audience guard at YOUR call site** — do not assume the internal helper protects you. This is the same `lib/server/*` un-exported-helper pattern enforced by `guard-coverage.test.ts`; the area map flags "confirm no other unguarded caller path exists" as an open question, so audit callers when you touch this.

### 4.3 Secret-at-rest — z1 envelope + `ZATCA_MASTER_KEY`

`lib/zatca-crypto.ts` encrypts every EGS secret as **`z1:iv:authTag:ciphertext`** (AES-256-GCM, 12-byte IV, 16-byte tag) keyed off `process.env.ZATCA_MASTER_KEY` (hex). `decryptZatca` is **fail-CLOSED**: a non-`z1:` value or a GCM auth failure **throws** — there is no legacy-plaintext passthrough. This is a **distinct trust domain** from `PII_ENCRYPTION_KEY` (`lib/zatca-crypto.ts:13-65`).

### 4.4 `EGS_PUBLIC_SELECT` (D13)

A Prisma `select` allow-list (`lib/zatca-server.ts:33-51`) that **omits all 8 secret columns** (`privateKeyPem`, `csrPem`, compliance/production token+secret, `certificateBase64`) **plus** `lastInvoiceHash` (PIH) and `nationalAddress`. `onboardPlatformEgs` + `getPlatformEgsSummary` read **only** through it, so no key material is ever serialized to a client. The raw readers (`getActivePlatformEgs`/`getPlatformEgs`) return full rows but are **server-only** and never serialized.

### 4.5 Signing context, GENESIS_PIH, credit notes, QR parse

- **`getEgsSigningContext`** prefers the **PRODUCTION** CSID, falls back to **COMPLIANCE**; decrypts `privateKeyPem` + token/secret + `certificateBase64` (or decodes `binarySecurityToken` base64 once if `certificateBase64` is absent) — `lib/zatca-server.ts:79-95`.
- **`GENESIS_PIH`** = `base64(hex(sha256('0')))` — seeds the first document's PIH (`lib/zatca-server.ts:24-26`; `pih = lastInvoiceHash ?? GENESIS_PIH` at `zatca-clearance.ts:117`).
- **`invoice.uuid`** is sent verbatim in the clearance payload (`zatca-clearance.ts:148`) — see §3's UUID-provenance note: the engine never mints it, so the upstream `Invoice.uuid` must already be a stable per-document UUID.
- **Credit notes (D11/D22b)** — `createCreditNoteInternal` requires the original to be `CLEARED`, creates a `CREDIT_NOTE` Invoice (`CN-YYYY-NNNNN` via `GLOBAL_SEQUENCE_SCOPE`, `originalInvoiceId` set, **money fields copied VERBATIM — positive amounts, type code 381, NO sign-flip**), then clears it; emits `docType=credit-note` + `billingReferenceId=original.invoiceNumber` + `reason=notes` (`zatca-clearance.ts:192-224`, `zatca-server.ts:124-128,168-182`). **⚠ See L23 — negating the amounts is the obvious-but-WRONG instinct; do not "fix" this.**
- **`parseQrFromClearedXml` (D28)** — regex-extracts the base64 QR from ZATCA's cleared XML (`cbc:ID QR` then `cbc:EmbeddedDocumentBinaryObject`) because the EGS cannot self-generate tag 9 for standard invoices. The value returned is **ZATCA's re-stamped QR verbatim** (§3.1 — the engine does not govern its tag contents). `decodeQrTlv` is a best-effort guard only; the raw value is returned even if decode throws. Stored on `invoice.zatcaQrCode` (`zatca-server.ts:194-211`).

### 4.6 `PLATFORM_SELLER` (v5.2.1)

`lib/zatca-platform-config.ts:13-26` holds Mimarek's fixed tax identity (legal names, CR, `industryCategory`, `invoiceTypeFlags`, national address). Onboarding defaults **everything but the VAT** from it (+ optional OTP default `123456`), so the admin form is **VAT-only**; explicit inputs still override. The seller identity is rendered **read-only** in the admin view (`ZatcaAdminView.tsx:347-377`).

> **⚠ The sandbox CR (`1010010000`) and national address are PLACEHOLDERS, marked `TODO(R5)`.** They flow into the CSR (`organizationName`/`locationAddress`) and the cleared invoice's seller party. Shipping to production unchanged produces **non-compliant documents.** Replace with Mimarek's real registered values before R5 go-live (`zatca-platform-config.ts:9-26`).

### 4.7 Clearance is best-effort (do not assume a returned invoice cleared)

`generateSubscriptionInvoice` calls `clearSubscriptionInvoiceInternal` in a `try/catch` that **only `console.error`s**, then returns the invoice (`billing.ts:356-365`). A `REJECTED`/`TRANSPORT_ERROR` invoice **still returns successfully** to the org user. The only signals are `invoice.zatcaStatus` + the `ZatcaClearanceLog` + a platform-staff notification. A no-EGS path returns `{ outcome: 'SKIPPED' }` early (`zatca-clearance.ts:78-79`).

**Endpoint choice by credential tier:** `productionToken` present → `client.clearInvoice`; else `client.checkComplianceInvoice` (compliance fallback). The Invoice lifecycle collapses to `REPORTED` or `CLEARED` — `CLEARED_WITH_WARNINGS` is flattened to `CLEARED` on the Invoice and preserved only in the `ZatcaClearanceLog` (`zatca-clearance.ts:151-167`).

### 4.8 Two guarded entry points + admin UI

- `app/actions/zatca/onboarding.ts` — `onboardPlatformEgs` (CSR → compliance CSID → prod CSID (non-fatal) → encrypt-store → `ACTIVE`), `getPlatformEgsSummary`, `resetPlatformEgs` (D30, wipes secrets → `RESET`). Returns only `EGS_PUBLIC_SELECT`. **`zatca:admin` / SYSTEM_ONLY.** Note `onboardPlatformEgs` hardcodes `environment: 'SANDBOX'` (`:57,82`).
- `app/actions/zatca/clearance.ts` — thin guarded+audited `clearInvoiceNow` (derives `isRetry`), `createInvoiceCreditNote`. **`zatca:admin`.**
- `app/dashboard/admin/zatca/{page.tsx,ZatcaAdminView.tsx}` — system-only Server Component + client admin UI.

> **⚠ `components/zatca/ZatcaDocument.tsx` (D26, the A4 human-readable tax document) is built but ORPHANED — no page imports it.** Per AGENTS.md §3.1 (UI-First) this is a discoverability gap: a cleared invoice currently has no user-facing rendered document. Its QR slot expects a raster data-URI but is fed ZATCA TLV base64, so it always renders the dashed placeholder + raw TLV caption (no `qrcode` dep installed). Wiring it + a real scannable QR is deferred to R4.

---

## 5. Access Model & Security (§8)

Mimarek is B2B SaaS with two user universes that never share surfaces (§8). ZATCA splits cleanly across them.

### 5.1 Two permissions, two audiences

| Permission | Audience | Held by | Surface |
|---|---|---|---|
| `zatca:admin` | **SYSTEM_ONLY** (platform staff) | `SYSTEM_ADMIN`, `SYSTEM_SUPPORT` | `/dashboard/admin/zatca` (platform EGS) |
| `zatca:config` | **TENANT_SCOPED** | tenant `ADMIN` (via filter) + `FINANCE` | `/dashboard/settings/zatca` (R3, tenant EGS) |

### 5.2 The structural proof: a tenant ADMIN can NEVER hold `zatca:admin`

```
ADMIN = ALL_PERMISSIONS.filter(p => !SYSTEM_ONLY_PERMISSIONS.includes(p))   // permissions.ts:226
zatca:admin ∈ SYSTEM_ONLY_PERMISSIONS                                       // permissions.ts:148
⇒ zatca:admin ∉ ADMIN
```

Asserted directly (no session mocking) by `__tests__/zatca-permissions.test.ts:14-28`. Both `SYSTEM_ADMIN` (via `ALL_PERMISSIONS`, `permissions.ts:201`) and `SYSTEM_SUPPORT` (explicit grant, `permissions.ts:221`) hold it. `zatca:config` ∈ `TENANT_SCOPED` (`permissions.ts:186`), granted to `FINANCE` (`permissions.ts:297`).

### 5.3 Three-layer enforcement for `/dashboard/admin/zatca`

1. **Layer 2 (edge gate)** — `ROUTE_GUARDS` SSOT entry `{ permission: 'zatca:admin', audience: 'platform' }` (`route-guards.ts:88`), consumed by `audienceForPath` (longest-prefix) in `auth.config.ts:89-97`, which redirects system/tenant users off mismatched paths.
2. **Layer (page/segment)** — both `app/dashboard/admin/zatca/page.tsx:15` and `app/dashboard/admin/layout.tsx:4` `await requireSystem()` (defense-in-depth; redirects tenants to `/dashboard`).
3. **Layer 3 (action guard)** — `requirePermission('zatca:admin')` in every `onboarding.ts`/`clearance.ts` action.

**The runtime backstop** — `requirePermission` (`auth-helpers.ts:129-142`) throws `Forbidden` if a `TENANT_SCOPED` permission is invoked by a system role, OR a `SYSTEM_ONLY` permission by a non-system role, OR a tenant-scoped permission with no `organizationId`. This is why permission alone is never sufficient — `SYSTEM_ADMIN` technically holds `zatca:config` via `ALL_PERMISSIONS`, but the Layer-3 rule rejects it.

**`guard-coverage.test.ts` (QA-SEC-01)** is an AST gate: every exported async fn in a `"use server"` `app/actions/**` file must call a guard helper or be `GUARD_EXEMPT`. There is no zatca entry in `GUARD_EXEMPT`, so the zatca actions are transitively required to be guarded — and they are. **Note this gate covers `app/actions/**` only — it does NOT cover the `lib/*` internal helpers like `clearSubscriptionInvoiceInternal`, which is why those rely on caller-side guarding (§4.2).**

### 5.4 D13 secret handling (recap)

Secrets never leave the server in plaintext or as ciphertext: `EGS_PUBLIC_SELECT` excludes them from every client DTO (§4.4), `decryptZatca` is fail-closed (§4.3), and `ZatcaClearanceLog.zatcaCodes`/`message` are explicitly sanitized to carry no payload or key material (`schema.prisma:2041-2042`).

---

## 6. Schema / DB / RLS

### 6.1 Models (`packages/db/prisma/schema.prisma`)

**`ZatcaEgsUnit` (1988-2028)** — the EGS credential/chain-state row.
- `organizationId String?` (1990) — **`NULL` = platform-seller EGS (Track A); non-null = tenant EGS (Track B/R3, not yet wired)**.
- Chain state: `lastIcv Int @default(0)` (2005), `lastInvoiceHash` = PIH (2006).
- 8 encrypted secret columns (2008-2015): `privateKeyPem`, `csrPem`, `complianceRequestId`, `complianceToken`, `complianceSecret`, `productionToken`, `productionSecret`, `certificateBase64`.

**`ZatcaClearanceLog` (2031-2047)** — per-attempt audit row. FK `egsUnitId → ZatcaEgsUnit` `onDelete: Cascade` (2034); `outcome ZatcaClearanceOutcome` (2037); `zatcaCodes String[]` + `message String?` sanitized (D13, 2041-2042); `documentId String?` is a **pre-stub** "wired in R4" (2036 — the future `TenantDocument` FK).

> **⚠ Three reserved-but-UNUSED columns on `ZatcaClearanceLog` (schema promises attempt-tracking the code does NOT deliver).** The schema declares `attempt Int @default(1)`, `requestUuid`, and `icv Int?` (`schema.prisma:2038-2040`) — but:
> - `attempt` is **never incremented**: `writeLog` (`zatca-clearance.ts:42-44`) always writes the default `1`, even on a retry. There is no per-document attempt counter today.
> - `requestUuid` is **never written** by any code path.
> - `icv` exists on the log but the authoritative ICV lives on `ZatcaEgsUnit.lastIcv`.
>
> A dev reading the schema will reasonably expect attempt history; it is not populated in R2. Treat these three columns as **reserved scaffolding for R4/R5** — if you need real attempt-tracking (e.g. for the recovery runbook below), you must wire `writeLog` to compute and write them; do not assume the data is there.

### 6.2 Enums (1168-1206)

- `ZatcaEnvironment` — `SANDBOX` / `SIMULATION` / `PRODUCTION`.
- `ZatcaEgsStatus` — `DRAFT` / `PENDING` / `ACTIVE` / `RESET` (**ACTIVE is locked per D30**).
- `ZatcaDocumentType` — `TAX_INVOICE` / `SIMPLIFIED` / `CREDIT_NOTE` / `DEBIT_NOTE` / `RECEIPT`.
- `ZatcaClearanceOutcome` — `CLEARED` / `CLEARED_WITH_WARNINGS` / `REPORTED` / `REJECTED` / `TRANSPORT_ERROR`.
- **Pre-existing** `ZatcaStatus` (`NOT_APPLICABLE`/`PENDING`/`CLEARED`/`REPORTED`/`REJECTED`) is the **Invoice lifecycle** field — distinct from the per-attempt outcome above.

### 6.3 Columns on existing models

- `Invoice` (1393-1397): `documentType ZatcaDocumentType? @default(TAX_INVOICE)`, `originalInvoiceId String?` (self-relation `InvoiceAdjustments`, set on notes), `clearedXml String?` (QR parsed from here, D28).
- **⚠ `Invoice.zatcaHash` schema comment says "Previous invoice hash (for chaining)" but the code stores the CURRENT signed-doc hash** (`zatca-clearance.ts:133,139`). The PIH chain lives on `ZatcaEgsUnit.lastInvoiceHash` (`zatca-clearance.ts:135`), **not** on each `Invoice.zatcaHash`. The "Base64 encoded QR" comment is on `zatcaQrCode` (1388), not `zatcaHash`. Don't wire the chain off the Invoice row. (The misleading comment is at `schema.prisma:1387` — verified.)
- `Notification.organizationId String?` (954, D29) — so platform-staff alerts with no org can be targeted via `notifyPlatformStaff()`.
- `Organization.logoUrl String?` (19) — Track C seller branding (R4).

### 6.4 RLS coverage contract (AGENTS.md §4)

Both new tables are RLS-listed in `packages/db/sql/2026-06-enable-rls.sql:102-103` with **double-quoted mixed-case identifiers** (`public."ZatcaEgsUnit"`, `public."ZatcaClearanceLog"`).

- **Strategy = `ENABLE` (not `FORCE`) with NO policy.** The owner `postgres` role (Prisma + `@prisma/adapter-pg`) bypasses RLS so the app works; the anon/PostgREST surface is denied. The resulting `rls_enabled_no_policy` advisor INFO **is the intended firewall** — **never "fix" it with a permissive `USING(true)` policy** (that re-opens the PostgREST door), and never use `FORCE` (routes the owner through nonexistent policies, breaks every query). `2026-06-enable-rls.sql:14-33`.
- **⚠ Mixed-case Prisma table names MUST be double-quoted in raw SQL.** Unquoted folds to lowercase → `42P01: relation does not exist`, and worse, `ALTER TABLE IF EXISTS` then **silently no-ops** ("Success", RLS never enabled).
- **The RLS file is now script-generated** (`scripts/generate-rls.ts`, header lines 40-43, with a CI `--check` drift gate). AGENTS.md §4 still describes it as hand-edited — **doc drift, the script is the SoT.** When R4 adds `TenantDocument`/`ZatcaBranch`, run `npm run rls:generate` and paste the new `ALTER TABLE` lines into the live Supabase SQL Editor in the same change. (`ZatcaBranch` is deliberately an explicit FK model, **not** an implicit Prisma M2M, so `generate-rls.ts` auto-covers it — D25.)

### 6.5 Manual SQL owed on the live DB

The **only** owed manual step from R2 is the **platform-EGS partial unique index** (`packages/db/sql/2026-06-zatca-platform-egs-unique.sql`) — `CREATE UNIQUE INDEX ... ON "ZatcaEgsUnit" ("environment") WHERE organizationId IS NULL AND status = 'ACTIVE'`. Not expressible via `prisma db push`. Project memory says it was applied to the live DB during R2 — **verify before relying on it**: `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('ZatcaEgsUnit','ZatcaClearanceLog');` (expect `t`) and `\d` the index.

---

## 7. Build / Run / Test / Gates

**Package manager: npm (npm@11.6.2), NOT pnpm** (`package.json:21`).

### 7.1 Commands

| Task | Command |
|---|---|
| Build (all) | `npm run build` → `turbo run build` |
| Dev (app) | `next dev --webpack` (pinned, `apps/web/package.json:7`) |
| Prod build (app) | `next build --webpack` (pinned, `apps/web/package.json:8`) |
| Prod server (for §3.9) | `next start` (`apps/web/package.json:14`) |
| Unit tests | `npx turbo run test:unit` → vitest (`turbo.json:19`) |
| Re-seed | `npx tsx prisma/seed.ts` (from `packages/db`) |

> **⚠ BUILD LANDMINE — `--webpack` is mandatory; turbopack CANNOT bundle `@repo/zatca`.** The NodeNext `.js`→`.ts` specifiers resolve only via the `webpack` `extensionAlias` hook in `apps/web/next.config.js:8-15`. Both dev and build scripts are pinned `--webpack`. **Do not "modernize" to turbopack** — the build will fail to resolve the engine.

### 7.2 The live ZATCA cycle

`packages/zatca/test/client.live.test.ts` is `ZATCA_LIVE=1`-gated and `describe.skip` by default (`:21-24`). It exercises the real SANDBOX cycle (dummy OTP `123456`, `:46`; comment confirms `Verified 2026-06-22 SUCCESS:CLEARED`, `:83`). **CI never runs it.** To run locally: set `ZATCA_LIVE=1` and the env vars below; supply env via `node --env-file=.env.local` for scripts.

### 7.3 Required env vars

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, **`ZATCA_MASTER_KEY`** (hex). All four are in `turbo.json` `globalEnv` (`:4`) and the CI job env (`ci.yml:29-34`). Also relevant downstream: `PII_ENCRYPTION_KEY` (separate trust domain), `CRON_SECRET` (cron auth).

### 7.4 tsx / ESM gotchas (scripts only — NOT committed code)

When writing one-off `tsx` scripts against this monorepo:
- `import "server-only"` is **unresolvable** in a bare tsx context → in scripts, use `import * as NS from '@repo/zatca'` + `(NS.default ?? NS).x`. **The committed `zatca-server.ts:1` correctly keeps the plain `import "server-only"`** — this workaround is script-only, never commit it.
- Workspace named-export detection can fail → namespace-import form as above.
- Supply env with `node --env-file=.env.local`.

### 7.5 CI facts (`.github/workflows/ci.yml`)

- Uses `prisma db push --accept-data-loss` on an **ephemeral 0-row Postgres 16** (`:15,:60`) — **NOT** `prisma migrate`.
- Runs `turbo run test:unit` (`:78`) — `@repo/zatca` is now wired into this (it was previously unrun by CI; **lesson: add `test:unit` to any new package**).
- Sets `ZATCA_MASTER_KEY`. **Never** runs the live ZATCA cycle, **never** renders the UI.
- **⚠ CI cannot catch a populated-table `db push` abort.** A new `NOT NULL` column without a `@default` passes the 0-row CI but **aborts a prod `db push`** (AGENTS.md §4). Every new column on a populated live table MUST be nullable or `@default`. (R4's `Customer` buyer columns are already specified this way — `customerKind CustomerKind? @default(INDIVIDUAL)`, all D18 fields nullable.)

### 7.6 Release gates (mandatory, in order)

1. **§3.4 / §3.8** — read every diff, `npm run build` green locally.
2. **§3.11 — `/mimaric-qa`** subagent QA gate; triage and fix every finding, re-run until clean.
3. **§3.9 — preview gate.** Start a local prod build (`next build --webpack && next start`), walk every touched route with 4 screenshots each (light-LTR, light-RTL, dark-LTR, dark-RTL), `preview_console_logs` = 0 errors, keyboard Tab-through, mobile 375×812 pass. **R1 was N/A (no UI); R2/R3/R4 are not.** Post screenshots in chat *before* the tag command.
4. **§7 — release.** Commit → update `CHANGELOG.md` (same commit) → tag `vX.Y.Z` → push → `gh release create` → verify CI green → **`/graphify . --update`** (mandatory, never "optional").

---

## 8. Live Sandbox & Ops Facts

- **Endpoint:** `gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal` (SANDBOX). The literal SANDBOX URL is defined in `packages/zatca/src/client.ts:30` (reached via `createZatcaClient({ environment: 'SANDBOX' })`). The SIMULATION/PRODUCTION URLs (`client.ts:31-32`) are defined but **never reached by app code** (env is hardcoded SANDBOX everywhere — §1).
- **Dummy OTP:** `123456`.
- **Verified live:** full cycle = `SUCCESS: CLEARED`; `generateCsr()` output accepted by the live compliance endpoint; production CSID issued.
- **No deployment.** Mimarek lives only on Omar's laptop + GitHub — no Vercel, no public domain. **"Prod" = the local checkout vs the one shared Supabase DB** (`xddpafkejhjcbflbdvof`). A `vercel.json` cron cannot fire (nothing is deployed) — this is why R5 needs a real scheduler. Be careful with live writes; Claude runs the manual DB/SQL steps.
- **The shared Supabase DB currently has NO real data → force-reset is OK** (Omar confirmed this session). This is the only reason `--force-reset`/aggressive `db push` is acceptable right now; revisit before any real tenant data lands.

### 8.1 Recovery runbook — REJECTED / TRANSPORT_ERROR in (sandbox) production

When an invoice lands `REJECTED` or `TRANSPORT_ERROR`, clearance was best-effort (§4.7) — the org user already got a "successful" invoice, and a **platform-staff notification** fired (D29). Here is what an on-call dev actually does. **The recovery action depends entirely on the `ZatcaError.kind` recorded on the `ZatcaClearanceLog`:**

| Outcome on the Invoice / log | What it means | Recovery action |
|---|---|---|
| **`TRANSPORT_ERROR`** (`kind: transport`) | The submit didn't get a definitive answer (timeout / 429 / 413 / 5xx). The ICV is already consumed and the signed bytes are persisted on the Invoice (`xmlContent`/`zatcaHash`). | **Retry — re-POST the SAME stored bytes.** In `/dashboard/admin/zatca`, use the per-invoice **Retry** action (`clearInvoiceNow` with `isRetry` derived). This re-submits the identical payload with **no new ICV and no re-sign** — exactly the correct transport-retry semantics. Safe to repeat. |
| **`REJECTED`** (`kind: business`) | ZATCA actively rejected the document (validation/business rule). The ICV is consumed and **cannot be reused.** A plain retry will fail identically. | **Do NOT retry. Correct-and-resubmit as a NEW document** — issue a **credit note** against the (now-cleared-or-failed) original via the admin **Create credit note** action (`createInvoiceCreditNote` → `createCreditNoteInternal`), then issue a corrected fresh invoice. Read the rejection codes on the `ZatcaClearanceLog.zatcaCodes`/`message` (sanitized, no key material) to know what to fix. |
| **`SKIPPED`** | No ACTIVE platform EGS for the environment. | Not a failure to recover — onboard/activate the platform EGS first (`onboardPlatformEgs`), then re-run generation. |

**Where to click:** everything is on `/dashboard/admin/zatca` (system-only, `zatca:admin`). The `ZatcaAdminView` surfaces the EGS status, the per-invoice clearance state, and the per-attempt `ZatcaClearanceLog` entries. **Triage rule of thumb:** `transport` → button says retry-same-bytes; `business` → button says credit-note-and-reissue. Never hand-edit the ICV/PIH chain on `ZatcaEgsUnit` to "fix" a failure — the chain is append-only by design.

> **⚠ Attempt history is thin in R2.** Because `ZatcaClearanceLog.attempt` is never incremented (§6.1), you cannot rely on the log to tell you *how many* times an invoice was retried — each row reads `attempt = 1`. Count rows per invoice instead, or wire real attempt-tracking if R4 needs it.

### Test credentials (seed; `mimaric2026` is the default password — intentionally unchanged)

| Email | Role | Audience | Notes |
|---|---|---|---|
| `system@mimarek.sa` | `SYSTEM_ADMIN` | platform | holds `zatca:admin`; `/dashboard/admin/zatca` |
| `support@mimarek.sa` | `SYSTEM_SUPPORT` | platform | holds `zatca:admin` |
| `dev_admin@mimarek.sa` | `SYSTEM_SUPPORT` | platform | `organizationId: null` |
| `admin@mimarek.sa` | `ADMIN` | tenant | holds `zatca:config` (R3), never `zatca:admin` |
| `fatima@mimarek.sa` | `MANAGER` (Finance) | tenant | pw `finance2026` |

System users are seeded with `organizationId: null` (`seed.ts:175-176`). Re-seed: `npx tsx prisma/seed.ts`.

---

## 9. What's Next — R3 / R4 / R5

### Tax-scope rule (the single biggest scoping fact — read before R4)

ZATCA e-invoicing applies **only to taxable standard-rated-15% supplies** (`zatca-phase2-einvoicing-plan.md:74-90`):

| Charge | Treatment |
|---|---|
| **Commercial lease** (OFFICE / RETAIL / WAREHOUSE) | **E-invoice** (cleared/reported) |
| **Management / brokerage / service fees** (15%) | **E-invoice** (PARKING per-config) |
| Residential lease | **Plain receipt** — exempt, code `VATEX-SA-30` |
| Property sale | **Plain receipt** — exempt → 5% RETT filed on a *separate* platform |
| Refundable deposit | **Plain receipt** — outside VAT until forfeited |

So Track C e-invoice work = **commercial-lease rent + 15% fees only**. Everything else is a receipt.

> **⚠ D3 "SaaS discount/VAT bug" is a CONFIRMED FALSE POSITIVE.** VAT-on-net is KSA-correct (a discount is a taxable-base allowance). **`coupons.ts` is unchanged — do NOT "fix" it to VAT-on-gross.** Code proof: `coupons.ts:110-112` computes `vatAmount = (subtotal - discountAmount) * vatRate`. The plan's D3 row still literally reads "Fix in-scope (Track A)" — that row is superseded; re-flagged only for the R5 tax-advisor review, not as code work.

---

### R3 — Track B (tenant config)

**Goal:** each tenant org onboards its **own** EGS (`ZatcaEgsUnit` with non-null `organizationId`).

- **Create:** `apps/web/app/dashboard/settings/zatca/{page.tsx, *View.tsx}` — a **Server** page gated by `getTenantPageAccess('zatca:config')`.
- **Add a ROUTE_GUARDS entry** for `/dashboard/settings/zatca` in `route-guards.ts` — **explicit, must NOT inherit `/dashboard/settings`'s `organization:read`** (give it `{ permission: 'zatca:config', audience: 'tenant' }`).
- **Reuse the org CR profile** so a tenant ADMIN supplies **only the VAT** (mirror the v5.2.1 platform pattern, but per-org instead of `PLATFORM_SELLER`).
- **Replicate the ZATCA EGS-identity string formats per org** (§3.1 CSR note): derive `commonName` (`TST-…-${vatNumber}` in sandbox / env-prefix in prod), the `1-…|2-…|3-<uuid>` `egsSerialNumber` with a **fresh per-org segment-3 UUID**, and the SAN VAT/invoice-type/location/industry from the tenant profile. **Do not copy the platform constants verbatim** — that onboards every tenant under Mimarek's identity.
- **Thread an `environment` parameter** instead of the hardcoded `'SANDBOX'` (§1) if R3 needs to onboard tenants against SIMULATION/PRODUCTION — the engine URLs exist, the app plumbing does not.
- **Sections (plan §5.7, lines 268-280):** status → tax identity (Saudi inputs from `packages/ui/src/components/saudi/`) → OTP wizard → multi-branch onboarding (D15/D25) → invoice-type + tax mapping (D16) → logs.
- **Reuse:** the entire engine + `lib/zatca-crypto.ts` (z1 envelope) + `lib/zatca-server.ts` helpers + `EGS_PUBLIC_SELECT` are already there — the onboarding action logic is largely a per-org generalization of `onboardPlatformEgs`. **When you add the tenant clearance call path, guard it at YOUR call site (§4.2) — `clearSubscriptionInvoiceInternal` and its siblings are unguarded by design.**
- **Nothing exists yet** — `apps/web/app/dashboard/settings/zatca/` is empty.

### R4 — Track C (tenant issuance)

**Goal:** tenants issue real documents for their own charges.

- **The classifier:** a single `issueDocumentForCharge(charge)` hook that routes **every** money movement (no path silently skips) — commercial lease + 15% fees → ZATCA e-invoice; residential/sale/deposit → receipt. Wire it across installments/payment-plans actions (plan §5.8 hook-matrix, lines 282-303).
- **Per-document UUID minting (§3 UUID note):** the issuance hook must generate a **stable v4 UUID per document, persist it on `TenantDocument.uuid`, and pass it through to `buildInvoice`/the clearance payload** — generated once, never regenerated on retry, never shared across documents. The engine does not mint it for you.
- **B2C reporting sweep:** the real `client.reportInvoice` sweep behind the operator-triggered endpoint (D24). The scaffold already exists as an **authenticated NO-OP** at `apps/web/app/api/cron/zatca-report/route.ts` (returns `{ swept: 0 }`, zero DB I/O) — fill it in.
- **UI:** the Invoices & Receipts page `/dashboard/invoices` (does not exist yet); wire `ZatcaDocument.tsx` into it + add a real scannable QR (install `qrcode`).
- **NEW schema (none of this exists yet — verified absent):**
  - `TenantDocument` model (D19) — including a non-null `uuid` column (the per-document UUID above).
  - `ZatcaBranch` model (D25 — **explicit `egsUnitId` FK, NOT implicit M2M**, so `generate-rls.ts` auto-covers it).
  - `Customer` buyer columns: `customerKind`, `vatNumber`, `crNumber`, `companyNameAr`, `companyNameEn` + `CustomerKind` enum (D18). **All nullable / `@default(INDIVIDUAL)`** — `Customer` is a populated live table.
  - Wire `ZatcaClearanceLog.documentId` to `TenantDocument` (pre-stubbed at `schema.prisma:2036`); consider wiring the reserved `attempt`/`requestUuid`/`icv` columns (§6.1) if real attempt-tracking is needed.
  - **Add the new tables to `generate-rls.ts` + paste `ALTER TABLE` into Supabase in the same change.**

### R5 — Production go-live (D23)

**"Sandbox clears ≠ legally ready."** Checklist:

- [ ] **Thread `environment` through to PRODUCTION** — today every app site hardcodes `'SANDBOX'` (§1); the production base URL exists in `client.ts:32` but is unreachable from app code.
- [ ] **Production CSID** against the production environment (proven *once* in sandbox during R2 — a controlled production cutover has not run).
- [ ] **6-sample PCSID compliance gate (D27)** — all 6 doc types (standard + simplified × invoice/credit/debit) must pass.
- [ ] **Real reporting scheduler** (D24) — precondition before relying on the ≤24h B2C SLA (no `vercel.json` cron works; app isn't deployed).
- [ ] **Replace the `PLATFORM_SELLER` sandbox CR (`1010010000`) + national address** with Mimarek's real registered values (`zatca-platform-config.ts`, `TODO(R5)`).
- [ ] **External TAX-ADVISOR SIGNOFF** — the entire tax-scope table + the D3 VAT-on-net finding are 7-agent-verified against KSA VAT regs but **NOT** yet confirmed by a real tax advisor.
- [ ] **PDF/A-3-with-embedded-XML** generator (the `html2canvas` raster PDF is preview-only, never the legal copy).
- [ ] Cutover runbook + failure-notification.
- **Permanently out of scope:** RETT 5% filing (separate ZATCA platform; sale *receipts* are in scope, RETT filing is not).

---

## 10. Landmine Cheat-Sheet (grep this)

| # | Domain | Landmine | Rule | Evidence |
|---|---|---|---|---|
| L1 | engine | Invoice hash over the **SIGNED** doc, not unsigned UBL | `computeInvoiceHash(signedXml)`; raw-input hash → live `invalid-invoice-hash` | `hash.ts:22-26` |
| L2 | engine | Two-pass `assemble` (skeleton→hash→refill); hard-fails on missing ProfileID/AccountingSupplierParty anchors | preserve both anchors on any UBL/signer change | `xades.ts:200-215,222-223` |
| L3 | engine | `SignatureValue` = ECDSA-sign the **invoice-hash bytes**, NOT `c14n(SignedInfo)` | recipe doc §7 is STALE/wrong | `xades.ts:223-225` |
| L4 | engine | Cert digest hashes the **base64 STRING**, returns `base64(hex(sha256))` — not DER, not raw-base64 | distinct from the invoice-hash convention | `cert.ts:13-17` |
| L5 | engine | Basic-auth token used **verbatim** (already base64), not re-encoded | re-encoding → 401 | `client.ts:135-137` |
| L6 | engine | A 2xx body can still be a business rejection (`NOT_CLEARED`/`errorMessages`) | check the body, not just HTTP status | `client.ts:223-230` |
| L7 | engine | CSR has **no offline oracle** (secp256k1 absent from openssl-wasm/forge) | correctness proven only at the live compliance endpoint | `crypto.ts:97-139` |
| L8 | app | Standard/B2B final QR comes from **ZATCA's cleared XML verbatim** — NOT self-generated; the engine does not govern/verify its tag contents (incl. whether tag 9 is present) | "Cleared" pill tied to `zatcaStatus === CLEARED` only; don't assume the cleared-QR tag set | `zatca-server.ts:194-211` (D28) |
| L9 | app | EGS row lock spans build+sign but is **released before the HTTP submit** | ICV consumed even if submit fails → transport-retry re-POSTs SAME bytes (no new ICV) | `zatca-clearance.ts:111-142` (lock), `:150-153` (submit) |
| L10 | app | Clearance is **best-effort** — failure never surfaces to the billing caller | a returned invoice ≠ cleared; check `zatcaStatus` + log; see §8.1 recovery runbook | `billing.ts:356-365` |
| L11 | app | `Invoice.zatcaHash` comment says "Previous hash" but stores the **current** signed-doc hash; PIH chain lives on `ZatcaEgsUnit.lastInvoiceHash` | don't wire the chain off the Invoice row | `schema.prisma:1387` vs `zatca-clearance.ts:133,135` |
| L12 | app | `PLATFORM_SELLER` CR `1010010000` + national address are **sandbox placeholders** (`TODO(R5)`) | flow into CSR + seller party → non-compliant in prod | `zatca-platform-config.ts:9-26` |
| L13 | app | `ZatcaDocument.tsx` is **orphaned** (no page imports it); QR slot renders placeholder | wire it + real `qrcode` in R4 | `components/zatca/ZatcaDocument.tsx` |
| L14 | build | Build/dev pinned `--webpack`; **turbopack cannot bundle `@repo/zatca`** | NodeNext `.js`→`.ts` needs `extensionAlias` | `next.config.js:8-15` |
| L15 | tsx | `import "server-only"` unresolvable in tsx; named-export detection fails | scripts only: `import * as NS` + `(NS.default ?? NS).x`; env via `node --env-file` — **never commit** | `zatca-server.ts:1` (correct committed form) |
| L16 | DB | New `NOT NULL`-no-default column passes 0-row CI but **aborts prod `db push`** | every new column on a populated table nullable/`@default` | AGENTS.md §4 |
| L17 | RLS | Unquoted mixed-case table name in raw SQL **silently no-ops** `ALTER TABLE IF EXISTS` | always `public."ZatcaEgsUnit"` (double-quoted) | `2026-06-enable-rls.sql:102-103` |
| L18 | RLS | `rls_enabled_no_policy` INFO **is the firewall** | never add `USING(true)`; never `FORCE` | `2026-06-enable-rls.sql:14-33` |
| L19 | tax | D3 "discount/VAT bug" is a **FALSE POSITIVE** | VAT-on-net is KSA-correct; do NOT change `coupons.ts` | `coupons.ts:110-112` |
| L20 | docs | `future-plans/REMAINING-WORK.md` is **STALE** for ZATCA (says "blocked/not started") | trust `CHANGELOG.md` + the plan; R1/R2 shipped | `REMAINING-WORK.md:30` |
| L21 | docs | `schema.prisma:2024` calls the partial unique index "a later refinement" but it's **implemented** | see `2026-06-zatca-platform-egs-unique.sql` | `schema.prisma:2024` |
| L22 | docs | `p0-spike-recipe.md:93-95` SignatureValue text is stale (see L3); AGENTS.md §4 RLS "hand-edit" text is stale (now `generate-rls.ts`) | code + `generate-rls.ts` are SoT | — |
| L23 | app | Credit note copies money fields **VERBATIM — positive amounts, code 381, NO sign-flip** | negating the amounts is the obvious-but-WRONG instinct; ZATCA expects positive CN amounts + `billingReferenceId` + type 381 — do NOT "fix" it | `zatca-server.ts:124-128,168-182`, `zatca-clearance.ts:192-224` |
| L24 | app | `cbc:UUID` is **caller-supplied** — engine never mints it; R2 relies on upstream `Invoice.uuid` | R4 must mint + persist a stable per-document UUID (once, never on retry, never shared) | `client.ts:60-62`, `zatca-clearance.ts:148` |
| L25 | env | Whole app path **hardcodes `'SANDBOX'`**; SIMULATION/PRODUCTION URLs exist but are **unreachable** from app code | R3/R5 must thread an `environment` param through the hardcoded sites | `zatca-server.ts:54-58`, `onboarding.ts:57,82`, `zatca-clearance.ts:78,94` vs `client.ts:31-32` |
| L26 | app | `clearSubscriptionInvoiceInternal` is **UNGUARDED by design** ("every caller guards"); reachable from `zatca:admin` actions AND `billing.ts` (`billing:write`) | a third caller MUST guard at its own call site; `guard-coverage.test.ts` covers `app/actions/**` only, not `lib/*` | `zatca-clearance.ts` (file header), `billing.ts:356-365`, `clearance.ts` |
| L27 | DB | `ZatcaClearanceLog.attempt`/`requestUuid`/`icv` are declared but **never populated** (`attempt` always `1`, `requestUuid` never written) | don't expect attempt history in R2; count log rows; wire `writeLog` if R4 needs real tracking | `schema.prisma:2038-2040` vs `zatca-clearance.ts:42-44` |

---

## 11. File Map

### Canonical docs
- `zatca-phase2-einvoicing-plan.md` — **the canonical plan (v3)**: 5-release structure, 30 locked decisions (D1–D30), tax-scope table, UI surface map, per-release subagent decomposition. (Mirror: `~/.claude/plans/build-zatca-phase-2-e-invoicing-splendid-spindle.md`.)
- `CHANGELOG.md` — **authoritative shipped record**: `[5.1.0]` R1, `[5.2.0]` R2, `[5.2.1]` polish. Each "Deferred" block enumerates R3/R4/R5.
- `future-plans/REMAINING-WORK.md` — ⚠ **STALE for ZATCA**, do not trust.
- `packages/zatca/docs/p0-spike-recipe.md` — implementation recipe + SDK-oracle invocation. ⚠ §7 SignatureValue text is stale.

### Engine — `packages/zatca/`
- `src/index.ts` — barrel + `ZatcaError`/enums/`ZatcaClearanceOutcome`.
- `src/ubl.ts` — `buildInvoice` (standard-rated S/15%, codes 388/381/383; `cbc:UUID` from caller-supplied input).
- `src/hash.ts` — `computeInvoiceHash` (over signed doc).
- `src/qr.ts` — TLV codec + `deterministicQrTags` (tags 1–6).
- `src/cert.ts` — `computeCertHash`.
- `src/xades.ts` — `signInvoice` (two-pass assemble, signs invoice-hash bytes, appends tag 9 simplified-only).
- `src/crypto.ts` — `generateCsr` (secp256k1 + hand-rolled PKCS#10; ZATCA EGS-identity DN/SAN formats).
- `src/client.ts` — `createZatcaClient` (compliance/clearance/reporting; SANDBOX URL `:30`, SIM/PROD `:31-32` unreached; `uuid` pass-through `:60-62`).
- `test/golden/<type>/` — 6 doc-type SDK-oracle fixtures.
- `test/{hash,qr,cert,xades}.test.ts` — byte-match / self-consistency gates.
- `test/client.live.test.ts` — `ZATCA_LIVE`-gated live cycle (OTP `123456`).

### App layer — `apps/web/`
- `lib/zatca-crypto.ts` — z1 AES-256-GCM envelope (`ZATCA_MASTER_KEY`, fail-closed).
- `lib/zatca-server.ts` — `EGS_PUBLIC_SELECT` (D13), `getEgsSigningContext`, `GENESIS_PIH`, `buildSubscriptionInvoiceInput`, `parseQrFromClearedXml` (D28); `getActivePlatformEgs` hardcodes `'SANDBOX'` (`:54-58`).
- `lib/zatca-clearance.ts` — `clearSubscriptionInvoiceInternal` (ICV/PIH FOR UPDATE tx, D22 branches; **UNGUARDED — caller guards**) + `createCreditNoteInternal` (D11/D22b; verbatim positive amounts, no sign-flip) + `writeLog` (always `attempt=1`).
- `lib/zatca-platform-config.ts` — `PLATFORM_SELLER` (CR/address are `TODO(R5)` placeholders).
- `lib/permissions.ts` — `zatca:admin` (SYSTEM_ONLY), `zatca:config` (TENANT_SCOPED/FINANCE), `isSystemRole`.
- `lib/route-guards.ts` — `ROUTE_GUARDS` SSOT + `audienceForPath`.
- `lib/auth-helpers.ts` — `requirePermission` (Layer-3 backstop, 129-142) + `requireSystem`.
- `lib/domain-labels.ts` — bilingual ZATCA enum label/badge maps (`satisfies Record<Enum>`, 236-294).
- `auth.config.ts` — Layer-2 edge gate.
- `app/actions/zatca/onboarding.ts` — onboard / summary / reset (D30); `zatca:admin`; hardcodes `'SANDBOX'` (`:57,82`); EGS-identity `commonName`/serial formats (`:66`).
- `app/actions/zatca/clearance.ts` — `clearInvoiceNow` (derives `isRetry`) / `createInvoiceCreditNote`; `zatca:admin`.
- `app/actions/billing.ts` — `generateSubscriptionInvoice` (best-effort post-commit clearance hook, :360; second unguarded-internal caller under `billing:write`).
- `app/dashboard/admin/zatca/{page.tsx,ZatcaAdminView.tsx}` — system-only admin UI (retry + credit-note recovery actions — §8.1).
- `app/dashboard/admin/layout.tsx` — `requireSystem()` segment guard.
- `app/api/cron/zatca-report/route.ts` — authenticated NO-OP sweep scaffold (real sweep = R4).
- `components/zatca/ZatcaDocument.tsx` — D26 A4 print doc (⚠ orphaned).
- `next.config.js` — `webpack` `extensionAlias .js→.ts` (the reason for `--webpack`).
- `__tests__/zatca-permissions.test.ts` — the tenant-ADMIN-never-holds-`zatca:admin` proof.
- `__tests__/guard-coverage.test.ts` — QA-SEC-01 AST guard gate (covers `app/actions/**` only).

### DB — `packages/db/`
- `prisma/schema.prisma` — `ZatcaEgsUnit` (1988-2028), `ZatcaClearanceLog` (2031-2047; `attempt`/`requestUuid`/`icv` reserved-unused 2038-2040), 4 enums (1168-1206), Invoice columns (1393-1397; misleading `zatcaHash` comment 1387), `Notification.organizationId` (954), `Organization.logoUrl` (19).
- `sql/2026-06-enable-rls.sql` — RLS enable-no-policy firewall (ZATCA tables 102-103); **script-generated** by `scripts/generate-rls.ts`.
- `sql/2026-06-zatca-platform-egs-unique.sql` — **owed manual** partial unique index (one ACTIVE platform EGS per env).
- `prisma/seed.ts` — test users (`mimaric2026`; system users `organizationId: null`).

### CI / config
- `.github/workflows/ci.yml` — `db push --accept-data-loss`, `turbo run test:unit`, `ZATCA_MASTER_KEY` env, no `ZATCA_LIVE`.
- `turbo.json` — `globalEnv` (incl. `ZATCA_MASTER_KEY`), `test:unit` task.
