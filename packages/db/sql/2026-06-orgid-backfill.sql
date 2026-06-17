-- ─── QA-DB-04/05: denormalized organizationId backfill (v4.28.0 + A4) ──────────
-- Run ONCE after `prisma db push` adds the nullable "organizationId" columns to
-- Lease, Reservation, PaymentPlan, and PaymentPlanInstallment, on any environment
-- that already contains rows (production + any long-lived staging DB). CI's ephemeral
-- DB is empty and does NOT need this.
--
-- ORDER OF OPERATIONS FOR THE A4 NOT-NULL TIGHTENING:
--   1. Push the schema while the four columns are still NULLABLE (the A4 commit ships
--      them NOT-NULL, so for a populated DB do an intermediate push that keeps them
--      nullable — OR run this backfill first against the still-nullable columns and
--      only then push the NOT-NULL + FK schema). A NOT-NULL column with no static
--      default aborts `db push` on a populated table (AGENTS.md §4).
--   2. Run this script (idempotent) to populate every column.
--   3. Verify the AFTER block returns 0 for all four counts.
--   4. Push the NOT-NULL + FK schema (A4). With every row backfilled, the diff is a
--      pure ALTER … SET NOT NULL + ADD FOREIGN KEY — non-destructive.
--
-- WHY THE COLUMNS EXIST: a direct tenant column on these child tables lets their
-- list/AR queries scope by org without joining through Unit / PaymentPlan.
--
-- Transitive joins (each child ← its tenant owner):
--   Lease.organizationId                  ← Unit.organizationId        (via Lease.unitId)
--   Reservation.organizationId            ← Unit.organizationId        (via Reservation.unitId)
--   PaymentPlan.organizationId            ← Unit.organizationId        (via PaymentPlan.contractId → Contract.unitId)
--   PaymentPlanInstallment.organizationId ← PaymentPlan.organizationId (via .paymentPlanId)
--
-- PaymentPlan MUST be backfilled BEFORE PaymentPlanInstallment so the installment
-- step has a non-NULL source to copy (the chain resolves top-down).
--
-- Idempotent: each UPDATE only touches rows where "organizationId" IS NULL, so
-- re-running is a no-op once the backfill is complete. Safe to re-run.
-- Mixed-case Prisma table names are double-quoted (unquoted folds to lowercase → 42P01).

-- ── BEFORE: how many rows still need backfilling (expect > 0 on first run) ──
-- SELECT count(*) AS lease_null            FROM "Lease"                  WHERE "organizationId" IS NULL;
-- SELECT count(*) AS reservation_null      FROM "Reservation"            WHERE "organizationId" IS NULL;
-- SELECT count(*) AS paymentplan_null      FROM "PaymentPlan"            WHERE "organizationId" IS NULL;
-- SELECT count(*) AS ppinstallment_null    FROM "PaymentPlanInstallment" WHERE "organizationId" IS NULL;

BEGIN;

-- 1. Lease ← Unit.organizationId
UPDATE "Lease" AS l
SET "organizationId" = u."organizationId"
FROM "Unit" AS u
WHERE l."unitId" = u."id"
  AND l."organizationId" IS NULL;

-- 2. Reservation ← Unit.organizationId
UPDATE "Reservation" AS r
SET "organizationId" = u."organizationId"
FROM "Unit" AS u
WHERE r."unitId" = u."id"
  AND r."organizationId" IS NULL;

-- 3. PaymentPlan ← Unit.organizationId (via PaymentPlan.contractId → Contract.unitId)
--    Run BEFORE the PaymentPlanInstallment backfill so installments have a source.
UPDATE "PaymentPlan" AS pp
SET "organizationId" = u."organizationId"
FROM "Contract" AS c
JOIN "Unit" AS u ON c."unitId" = u."id"
WHERE pp."contractId" = c."id"
  AND pp."organizationId" IS NULL;

-- 4. PaymentPlanInstallment ← PaymentPlan.organizationId
--    After step 3, every PaymentPlan with a valid contract→unit chain is backfilled,
--    so the `pp."organizationId" IS NOT NULL` guard now only filters orphaned plans
--    (no contract / no unit) — those genuinely have no tenant source and stay NULL.
UPDATE "PaymentPlanInstallment" AS ppi
SET "organizationId" = pp."organizationId"
FROM "PaymentPlan" AS pp
WHERE ppi."paymentPlanId" = pp."id"
  AND ppi."organizationId" IS NULL
  AND pp."organizationId" IS NOT NULL;

COMMIT;

-- ── AFTER: verify zero rows remain before the NOT-NULL push ──
-- SELECT count(*) AS lease_null            FROM "Lease"                  WHERE "organizationId" IS NULL;            -- expect 0
-- SELECT count(*) AS reservation_null      FROM "Reservation"            WHERE "organizationId" IS NULL;            -- expect 0
-- SELECT count(*) AS paymentplan_null      FROM "PaymentPlan"            WHERE "organizationId" IS NULL;            -- expect 0
-- SELECT count(*) AS ppinstallment_null    FROM "PaymentPlanInstallment" WHERE "organizationId" IS NULL;            -- expect 0
--
-- If ANY count is non-zero, do NOT push the NOT-NULL schema — the push will abort.
-- Diagnose the residue first; each is an orphaned row whose owner chain is broken:
--
-- -- Leases whose unit was deleted (FK should prevent this, but verify):
-- SELECT l."id" FROM "Lease" l LEFT JOIN "Unit" u ON l."unitId" = u."id"
--   WHERE l."organizationId" IS NULL;
-- -- Reservations whose unit is missing:
-- SELECT r."id" FROM "Reservation" r LEFT JOIN "Unit" u ON r."unitId" = u."id"
--   WHERE r."organizationId" IS NULL;
-- -- PaymentPlans whose contract or unit is missing (orphaned plan):
-- SELECT pp."id", pp."contractId", c."unitId" FROM "PaymentPlan" pp
--   LEFT JOIN "Contract" c ON pp."contractId" = c."id"
--   LEFT JOIN "Unit" u ON c."unitId" = u."id"
--   WHERE pp."organizationId" IS NULL;
-- -- Installments still NULL because their PaymentPlan is still NULL (fix the plan first):
-- SELECT count(*) AS ppi_null_from_null_plan
--   FROM "PaymentPlanInstallment" ppi JOIN "PaymentPlan" pp ON ppi."paymentPlanId" = pp."id"
--   WHERE ppi."organizationId" IS NULL AND pp."organizationId" IS NULL;
