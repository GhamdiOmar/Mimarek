# ZATCA Java Fatoora SDK — dev oracle (gitignored)

This folder holds the **ZATCA Java Fatoora SDK**, used as the **oracle** for the P0 spike: our
TypeScript `@repo/zatca` engine must produce **byte-identical** invoice hash / XAdES signature /
QR-TLV / CSR to what this SDK produces, for all 6 document types. The SDK contents are **gitignored**
(redistributed by ZATCA, fetched per-machine); only this README is tracked.

> **SDK pass ≠ ZATCA approval** (plan D2). The SDK validates output format; it does not certify the
> taxpayer. Production go-live (R5) requires a production CSID + tax-advisor signoff.

## ✅ INSTALLED & VERIFIED — 2026-06-21

- **JDK:** Eclipse Temurin **11.0.31** (portable, no admin) at `~/.jdks/jdk-11.0.31+11` (machine-local,
  not in the repo). Any JDK 11–14 works.
- **SDK:** **`zatca-envoice-sdk-203`** (ZATCA E-Invoice Java SDK **v3.0.8**), downloaded from the official
  ZATCA source and extracted here → `tools/zatca-sdk/zatca-envoice-sdk-203/`.
- **Verified:** the CLI runs on the JDK (`-help` prints the v3.0.8 banner + usage). Oracle is functional;
  the P0 spike is **unblocked**.

### How it's laid out (`zatca-envoice-sdk-203/`)
- `Apps/cli-3.0.8-jar-with-dependencies.jar` — the CLI (the thing we invoke).
- `Apps/fatoora` (+ `fatoora.ba_`) — launcher; reads `Apps/global.json` (`version` 3.0.8, `certPassword`
  `123456789`) and calls `java -jar`.
- `Configuration/` (`config.json`, `defaults.json`), `Data/` (`Schemas` UBL2.1 xsd, `Rules` schematrons,
  `Certificates`, `PIH`, `Input`), `Readme/readme.pdf`.
- `install.sh` regenerates `Configuration/config.json` with **machine-absolute** paths (run it from the SDK
  root before commands that need the schemas/certs, e.g. `-validate`/`-sign`).

### Invoke directly (bypasses the launcher; what the spike uses)
```bash
JAVA="$HOME/.jdks/jdk-11.0.31+11/bin/java.exe"   # any JDK 11–14
JAR="tools/zatca-sdk/zatca-envoice-sdk-203/Apps/cli-3.0.8-jar-with-dependencies.jar"
"$JAVA" -Djdk.module.illegalAccess=deny -Djdk.sunec.disableNative=false \
  -jar "$JAR" --globalVersion 3.0.8 -certpassword 123456789 -help
# real use: -invoice <xml> -generateHash | -sign -signedInvoice <out> | -qr | -validate | -csr ...
```
For `-validate`/`-sign`/`-generateHash` against a sample, first run `install.sh` from the SDK root (or set
`SDK_CONFIG` to a `config.json` with absolute paths) and use the samples under `Data/Input`.

## Re-acquire on another machine
1. Install a JDK 11–14 (`java -version`). Portable Temurin zip via the Adoptium API needs no admin:
   `https://api.adoptium.net/v3/binary/latest/11/ga/windows/x64/jdk/hotspot/normal/eclipse`.
2. Download the SDK from ZATCA's Download-SDK page (Compliance & Enablement Toolbox) — accessible without
   registration: `https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/ComplianceEnablementToolbox/Pages/DownloadSDK.aspx`
   (the share link redirects to `zatca-envoice-sdk-203.zip`; a curl needs a cookie jar + browser UA to carry
   the anonymous-share token).
3. Unzip into this folder so `zatca-envoice-sdk-203/` sits here. Verify with the `-help` command above.

## Why gitignored
The SDK is ZATCA's redistributable, not our code — vendoring bloats the repo and risks a stale copy. Each
machine fetches its own. The golden VECTORS the spike produces ARE committed (test fixtures in `@repo/zatca`);
the SDK binary that produced them is not.
