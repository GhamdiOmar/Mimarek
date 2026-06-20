# ZATCA Java Fatoora SDK — dev oracle (gitignored)

This folder holds the **ZATCA Java Fatoora SDK**, used as the **oracle** for the P0 spike: our
TypeScript `@repo/zatca` engine must produce **byte-identical** invoice hash / XAdES signature /
QR-TLV / CSR to what this SDK produces, for all 6 document types. The folder contents are
**gitignored** (the SDK is redistributed by ZATCA, not vendored into our repo).

> **SDK pass ≠ ZATCA approval** (plan D2). The SDK validates our output format; it does not
> certify the taxpayer. Production go-live (R5) requires a production CSID + tax-advisor signoff.

## Acquisition (owner: Omar — env setup)

1. **Install a JDK 11–14** (the Fatoora SDK targets this range). Verify: `java -version`.
2. **Download the SDK** from ZATCA's Fatoora developer portal / SDK page
   (https://zatca.gov.sa → E-Invoicing → Developer / Fatoora portal → "SDK"). The current package is
   distributed as a zip (`zatca-einvoicing-sdk-*.zip`). Accept the portal terms; the download is free
   and does not require a paid account.
3. **Unzip into this folder** so the SDK's `bin/`, `Apps/`, and `Lib/` (or equivalent) sit here, e.g.
   `tools/zatca-sdk/zatca-einvoicing-sdk-<version>/`.
4. Confirm the CLI runs: from the SDK's `Apps` dir, `fatoora -version` (Linux/macOS) or the
   `fatoora.bat`/PowerShell equivalent on Windows.

Once the JDK + SDK are present, the P0 spike (`docs/p0-spike-recipe.md` in `@repo/zatca`) can run and
emit the golden vectors we commit.

## Why gitignored

- The SDK is ZATCA's redistributable, not our code — vendoring it bloats the repo and risks
  shipping a stale copy.
- Each dev machine fetches the version it needs. The golden VECTORS the spike produces ARE committed
  (as test fixtures in `@repo/zatca`); the SDK binary that produced them is not.
