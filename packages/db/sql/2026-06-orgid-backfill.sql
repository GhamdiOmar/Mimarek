-- ─── QA-DB-04: denormalized organizationId backfill (v4.28.0) ──────────────────
-- Run ONCE after `prisma db push` adds the nullable "organizationId" columns to
-- Lease, Reservation, and PaymentPlanInstallment, on any environment that already
-- contains rows (production + any long-lived staging DB). CI's ephemeral DB is empty
-- and does NOT need this.
--
-- WHY: v4.28.0 added a direct tenant column to these three child tables so their
-- list/AR queries no longer pay a join through Unit / PaymentPlan to scope by org.
-- The column shipped NULLABLE (a new NOT-NULL column with no static default aborts
-- `db push` on a populated table — AGENTS.md §4). This script backfills each via its
-- transitive owner; the NOT-NULL tightening is a deferred post-backfill follow-up
-- (see 2026-06-v4.28-manual-steps.md step 5).
--
-- Transitive joins:
--   Lease.organizationId                  ← Unit.organizationId        (via Lease.unitId)
--   Reservation.organizationId            ← Unit.organizationId        (via Reservation.unitId)
--   PaymentPlanInstallment.organizationId ← PaymentPlan.organizationId (via .paymentPlanId)
--
-- Idempotent: each UPDATE only touches rows where "organizationId" IS NULL, so
-- re-running is a no-op once the backfill is complete. Safe to re-run.
-- Mixed-case Prisma table names are double-quoted (unquoted folds to lowercase → 42P01).

-- ── BEFORE: how many rows still need backfilling (expect > 0 on first run) ──
-- SELECT count(*) AS lease_null            FROM "Lease"                  WHERE "organizationId" IS NULL;
-- SELECT count(*) AS reservation_null      FROM "Reservation"            WHERE "organizationId" IS NULL;
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

-- 3. PaymentPlanInstallment ← PaymentPlan.organizationId
--    NOTE: PaymentPlan.organizationId is itself nullable and may be NULL for some
--    historical plans. Those installments stay NULL here (no source value to copy) —
--    backfill PaymentPlan.organizationId first if any remain NULL after this run.
UPDATE "PaymentPlanInstallment" AS ppi
SET "organizationId" = pp."organizationId"
FROM "PaymentPlan" AS pp
WHERE ppi."paymentPlanId" = pp."id"
  AND ppi."organizationId" IS NULL
  AND pp."organizationId" IS NOT NULL;

COMMIT;

-- ── AFTER: verify zero (or only legitimately-source-NULL) rows remain ──
-- SELECT count(*) AS lease_null            FROM "Lease"                  WHERE "organizationId" IS NULL;            -- expect 0
-- SELECT count(*) AS reservation_null      FROM "Reservation"            WHERE "organizationId" IS NULL;            -- expect 0
-- SELECT count(*) AS ppinstallment_null    FROM "PaymentPlanInstallment" WHERE "organizationId" IS NULL;            -- expect 0, or = count of installments whose PaymentPlan.organizationId is NULL
-- -- Diagnose any remaining PPI nulls (these need PaymentPlan.organizationId backfilled first):
-- SELECT count(*) AS ppi_null_from_null_plan
--   FROM "PaymentPlanInstallment" ppi JOIN "PaymentPlan" pp ON ppi."paymentPlanId" = pp."id"
--   WHERE ppi."organizationId" IS NULL AND pp."organizationId" IS NULL;
