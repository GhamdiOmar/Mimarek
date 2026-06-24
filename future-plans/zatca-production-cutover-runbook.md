# ZATCA Phase-2 — Production Cutover Runbook

> **Status: NOT YET EXECUTABLE.** As of v5.6.0 the app is **production-capable** (env-threaded,
> legal-copy PDF, gated compliance harness, failure notifications) but production is **blocked**
> on the external prerequisites in §1. This runbook is the procedure to follow **once** those land.
> Setting `ZATCA_ENVIRONMENT=PRODUCTION` before §1 is complete would file **real tax documents**
> against a placeholder identity — do not.

---

## 0. How the environment switch works (so you trust the gate)

- A single env var, **`ZATCA_ENVIRONMENT`**, decides the target for **new** onboardings.
  `lib/zatca-env.ts` `resolveZatcaEnvironment()` is **fail-safe**: it returns `PRODUCTION` (or
  `SIMULATION`) **only on an exact match** — anything else (unset, empty, whitespace, a typo)
  resolves to **`SANDBOX`**. There is no path by which a missing/garbled value routes real
  documents to ZATCA.
- An **already-onboarded EGS keeps clearing against the environment it was onboarded under**
  (`egs.environment`), regardless of the env var. So flipping the var to `PRODUCTION` does **not**
  retro-route existing sandbox EGS rows — those must be **reset + re-onboarded** under production.
- In a non-sandbox environment the sandbox OTP fallback (`123456`) is **rejected** — onboarding
  requires a real, caller-supplied OTP.

---

## 1. Hard prerequisites (ALL required before §3) — external, not code

| # | Prerequisite | Owner | Why it blocks |
|---|---|---|---|
| 1 | **Real `PLATFORM_SELLER` CR + national address** in `apps/web/lib/zatca-platform-config.ts` (replace the sandbox placeholders `crNumber: "1010010000"` + address; `TODO(R5)` markers) | Omar / legal | The CR is filed as Mimarek's tax identity on every cleared platform invoice. A placeholder CR is a compliance error. |
| 2 | **Production CSID onboarded** for Mimarek's verified identity — real OTP, cert cryptographically **VAT-bound** to the seller VAT | Omar / ZATCA portal | R4a hit `certificate-permissions` from a sandbox prod-CSID bound to a VAT ≠ buyer. Clearance only succeeds with a correctly-bound production CSID. |
| 3 | **Licensed KSA tax-advisor signoff** of the tax-treatment table (`lib/zatca-issuance.ts` `defaultTax` + the per-org `OrgZatcaTaxConfig` defaults): commercial-lease 15% YES; residential / sale / refundable-deposit NO; parking per-config | Omar / tax advisor | The VAT scope/category decisions are a regulatory judgment, not a code decision. |
| 4 | **Deployed host + firing scheduler** — the app is local-only today; the `vercel.json` cron (`/api/cron/zatca-report`, every 2h) only fires on a live deployment | Omar / ops | The B2C reporting recovery sweep + the >12h stuck alarm don't run on a schedule until deployed. |
| 5 | **6-sample PCSID harness passes** against the bound production CSID: `ZATCA_LIVE=1 npx vitest run -w @repo/zatca test/compliance-pcsid.live.test.ts` → all 6 SUCCESS | Omar / Claude | ZATCA grants the PCSID only when all six document types clear; this is the go/no-go proof. |

**Do not proceed to §3 until every row above is ✅.**

---

## 2. Pre-cutover staging (recommended — use SIMULATION first)

ZATCA provides a **simulation** environment between sandbox and production. Before production:
1. Set `ZATCA_ENVIRONMENT=SIMULATION` in the deployed host's env.
2. Reset + re-onboard the platform EGS (`/dashboard/admin/zatca` → Reset → Connect) under simulation.
3. Issue a few real-shaped documents; confirm clearance + the legal-copy PDF (embedded XML) + the QR.
4. Run the 6-sample harness against the simulation CSID.

Simulation exercises the full production code path with no legal weight — catch issues here.

---

## 3. Production cutover sequence

1. **Land prerequisite #1** (real CR + address) — code change, ship through the normal release gate.
2. **Set `ZATCA_ENVIRONMENT=PRODUCTION`** in the deployed host's environment (and confirm `turbo.json`
   globalEnv + the host both carry it). Verify `resolveZatcaEnvironment()` returns `PRODUCTION` in a
   one-off check before onboarding anything.
3. **Onboard the platform EGS under production:** `/dashboard/admin/zatca` → Reset (if a sandbox EGS
   exists) → Connect, supplying the **real OTP** from the ZATCA portal. Confirm the new EGS row has
   `environment = PRODUCTION` and an ACTIVE production CSID.
4. **Run the 6-sample harness** (prerequisite #5) against the production CSID → all 6 SUCCESS.
5. **Tenant onboarding:** each tenant resets + re-onboards its own EGS under production at
   `/dashboard/settings/zatca` with its real OTP. (Their sandbox EGS rows stay sandbox-bound and are
   harmless — but issue nothing real until they re-onboard.)
6. **Verify the scheduler** is firing `/api/cron/zatca-report` (check the cron logs after the first
   interval).

---

## 4. Post-cutover verification

- Issue one real commercial-lease rent payment → assert a **CLEARED** `TenantDocument`, the QR parses
  from the cleared XML, and the **legal-copy PDF** downloads with the cleared XML embedded.
- Confirm a B2C (simplified) document **REPORTS** and the reporting health on `/dashboard/admin/zatca`
  shows it.
- Confirm a residential rent / sale records a **RECEIPT** (no e-invoice) per the tax table.
- Confirm platform staff receive the transport/rejection notifications on a forced failure.

## 5. Rollback posture

- The env var is the kill-switch: set `ZATCA_ENVIRONMENT=SANDBOX` (or unset) to stop **new** production
  onboardings. **Already-cleared documents cannot be un-cleared at ZATCA** — clearance is irreversible.
- If clearance starts failing in production, documents park at `PENDING` (not lost); the reporting
  sweep retries them. Investigate gateway health + cert binding before re-issuing.

## 6. Remaining conformance follow-up (not a cutover blocker)

- **Strict PDF/A-3b certification** of the legal copy (`lib/zatca-pdfa.ts`): add an sRGB ICC
  OutputIntent, embedded/subsetted fonts (incl. Arabic vector text), and a **veraPDF** validation gate.
  The current legal copy already embeds the e-invoice XML (the legally-meaningful payload) — strict
  archival conformance is a polish step.

---

*Owner: Omar Alghamdi. This runbook is the operational gate referenced by the §5 external blockers
in the ZATCA program plan. Update it as prerequisites are cleared.*
