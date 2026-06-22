-- M2 (ZATCA R3) — enforce a SINGLE active tenant EGS per org per environment.
-- The model `@@unique([organizationId, environment, egsSerialNumber])` does NOT stop an
-- org from having two ACTIVE EGS rows with different serials, and `prisma db push` can't
-- express a partial unique index, so it lives here and is applied by hand on every
-- long-lived environment (idempotent, safe to re-run). This is the DB-level backstop for
-- the app-layer single-ACTIVE-EGS guard in `onboardTenantEgs` (D30) — it closes the
-- TOCTOU window where two concurrent onboards both read `existing = null`.
-- (`organizationId IS NOT NULL` so the platform NULL-org EGS is unaffected — that
-- invariant is owned by `zatca_platform_egs_one_active`.)
CREATE UNIQUE INDEX IF NOT EXISTS "zatca_egs_one_active_per_org_env"
  ON public."ZatcaEgsUnit" ("organizationId", "environment")
  WHERE "organizationId" IS NOT NULL AND "status" = 'ACTIVE';
