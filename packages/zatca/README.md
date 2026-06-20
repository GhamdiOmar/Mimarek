# @repo/zatca — ZATCA Phase-2 (Fatoora) engine

Pure, deterministic TypeScript engine for Saudi ZATCA Phase-2 e-invoicing: secp256k1 keygen +
CSR, UBL 2.1 XML, C14N + SHA-256 invoice hash, XAdES signing, QR-TLV, and the clearance/reporting
network client. **No DB / encryption-at-rest / auth / mutations** — those live in the `"use server"`
actions in `apps/web` that consume this package (program plan §2).

This is **R1** of the ZATCA program. Full plan: repo root `zatca-phase2-einvoicing-plan.md`
(canonical at `~/.claude/plans/build-zatca-phase-2-e-invoicing-splendid-spindle.md`).

## ⛔ Status: P0 spike PENDING — engine modules deliberately not built yet

Per plan §5.0, this is a **hard gate**:

> Nothing above the crypto layer ships until the P0 spike proves **byte-identical**
> hash / XAdES signature / QR-TLV / CSR against ZATCA's official **Java Fatoora SDK** for **all 6
> document types** (standard + simplified × invoice / credit-note / debit-note). Commit the golden
> vectors. Only then do the `crypto · ubl · xades · qr · client · pipeline` modules get built.

So today this package ships **only shared types** (`src/index.ts`): `ZatcaError` (the D22
retry-vs-resubmit union), `ZatcaEnvironment`, `ZatcaDocumentType`, the QR-TLV tag map + D28 sourcing
rule, and `ZatcaClearanceOutcome`. No crypto/XML/network logic — by design.

### What blocks the spike (environment setup — owner: Omar)

1. **JDK 11–14** installed and on `PATH` (`java -version`). Not present in the current dev env.
2. **ZATCA Java Fatoora SDK** downloaded into `tools/zatca-sdk/` (gitignored). See
   `tools/zatca-sdk/README.md` for the acquisition steps. The SDK is the dev **oracle** — note that
   **SDK pass ≠ ZATCA approval** (plan D2).

Once both are in place, the P0 spike runs against the SDK, golden vectors are committed, and the
module build proceeds.

### The recipe

`docs/p0-spike-recipe.md` holds the citable implementation recipe (C14N transform, invoice-hash
encoding, XAdES + ECDSA DER-vs-P1363, QR-TLV per D28, CSR ASN.1 / onboarding endpoints, candidate
lib pinning, and how to drive the Java SDK as the oracle). It is the single biggest de-risker for
the whole program (Key Risk 1: C14N11 byte-exactness).

## Module map (added post-spike)

| Module | Responsibility |
|---|---|
| `crypto/` | secp256k1 keygen + CSR (lib pinned in P0) |
| `ubl/` | UBL 2.1 builders — invoice · credit/debit note · simplified |
| `xades/` | XAdES enveloped signature + C14N + SHA-256 invoice hash |
| `qr/` | QR-TLV (tags 1–9); standard QR parsed from cleared XML, simplified self-generated (D28) |
| `client/` | clearance (B2B, sync) + reporting (B2C, ≤24h) network client; typed `ZatcaError` |
| `pipeline/` | orchestration threading the per-EGS ICV/PIH chain (atomic CAS owned by the action layer) |

## Verify

- `npm run check-types -w @repo/zatca` — type-checks the package (the only check meaningful pre-spike).
- Golden-vector vitest (added with the spike) is the R1 release gate. There is **no UI** in R1, so
  the §3.9 4-theme preview walk is N/A.
