-- M1 (ZATCA R2) — enforce a SINGLE active platform EGS per environment.
-- The model `@@unique([organizationId, environment, egsSerialNumber])` is NULL-distinct
-- for platform rows (organizationId IS NULL), so it cannot stop two ACTIVE platform EGS
-- rows. `prisma db push` can't express a partial unique index, so it lives here and is
-- applied by hand on every long-lived environment (idempotent, safe to re-run).
CREATE UNIQUE INDEX IF NOT EXISTS "zatca_platform_egs_one_active"
  ON public."ZatcaEgsUnit" ("environment")
  WHERE "organizationId" IS NULL AND "status" = 'ACTIVE';
