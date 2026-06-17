-- ─── I2: RentPayment append-only ledger backfill ─────────────────────────────
-- Run ONCE after `prisma db push` creates the "RentPayment" table, on any
-- environment that already contains RentInstallment rows (production + any
-- long-lived staging DB). CI's ephemeral DB is empty and does NOT need this.
--
-- WHAT THIS DOES
--   The RentPayment ledger is the new source of truth: RentInstallment.paidAmount
--   / .status are a CACHE equal to SUM(RentPayment.amount). Existing installments
--   predate the ledger, so we seed ONE synthetic PAYMENT row per installment whose
--   effectivePaid (§4) is > 0, with `amount` equal to that effectivePaid value:
--       effectivePaid = CASE WHEN status='PAID' THEN COALESCE(paidAmount, amount)
--                            ELSE COALESCE(paidAmount, 0) END
--   After the backfill, SUM(RentPayment.amount) per installment == its cached
--   paidAmount, so the appendRentPayment recompute stays exact going forward.
--
--   Step 1 first normalizes the legacy "PAID + paidAmount IS NULL" rows (fully
--   paid before the paidAmount column existed) to paidAmount = amount, so the
--   cache == ledger SUM verification below is an EXACT match (no PAID/null gap).
--
-- IDEMPOTENT
--   Step 2 inserts only for installments that have NO ledger row yet
--   (NOT EXISTS), so re-running is a no-op once seeded. idempotencyKey is the
--   deterministic 'backfill:'||ri."id" — re-running could never duplicate even if
--   the NOT EXISTS guard were removed (the [installmentId, idempotencyKey] unique
--   index would block it).
--
-- Mixed-case Prisma table names are double-quoted (unquoted folds to lowercase → 42P01).
-- Transactional: all-or-nothing.

BEGIN;

-- ── Step 1: normalize legacy PAID rows so the cache == ledger SUM exactly ──
UPDATE "RentInstallment"
SET "paidAmount" = "amount"
WHERE status = 'PAID'
  AND "paidAmount" IS NULL;

-- ── Step 2: seed one synthetic PAYMENT per installment with effectivePaid > 0 ──
INSERT INTO "RentPayment" (
  "id", "installmentId", "leaseId", "amount", "txType",
  "idempotencyKey", "channel", "reference", "notes", "createdById", "createdAt"
)
SELECT
  gen_random_uuid()::text                                   AS "id",
  ri."id"                                                   AS "installmentId",
  ri."leaseId"                                              AS "leaseId",
  CASE WHEN ri.status = 'PAID'
       THEN COALESCE(ri."paidAmount", ri."amount")
       ELSE COALESCE(ri."paidAmount", 0)
  END                                                       AS "amount",
  'PAYMENT'::"RentPaymentType"                              AS "txType",
  'backfill:' || ri."id"                                    AS "idempotencyKey",
  'BACKFILL'                                                AS "channel",
  NULL                                                      AS "reference",
  NULL                                                      AS "notes",
  NULL                                                      AS "createdById",
  COALESCE(ri."paidAt", ri."updatedAt", now())             AS "createdAt"
FROM "RentInstallment" ri
WHERE
  -- only installments that have actually collected something
  (CASE WHEN ri.status = 'PAID'
        THEN COALESCE(ri."paidAmount", ri."amount")
        ELSE COALESCE(ri."paidAmount", 0)
   END) > 0
  -- idempotent: skip any installment that already has a ledger row
  AND NOT EXISTS (
    SELECT 1 FROM "RentPayment" rp WHERE rp."installmentId" = ri."id"
  );

COMMIT;

-- ── VERIFY: cache (paidAmount) must equal the ledger SUM for every installment ──
-- Expect 0 rows. Any row returned is a drift between the cached paidAmount and the
-- summed ledger — investigate before relying on the ledger for that installment.
--
-- SELECT ri."id",
--        COALESCE(ri."paidAmount", 0)            AS cached_paid,
--        COALESCE(SUM(rp."amount"), 0)           AS ledger_sum
-- FROM "RentInstallment" ri
-- LEFT JOIN "RentPayment" rp ON rp."installmentId" = ri."id"
-- GROUP BY ri."id", ri."paidAmount"
-- HAVING ABS(COALESCE(ri."paidAmount", 0) - COALESCE(SUM(rp."amount"), 0)) > 0.005;
