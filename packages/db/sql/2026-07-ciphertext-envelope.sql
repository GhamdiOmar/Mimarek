-- A1: enforce the v1: ciphertext envelope on Customer PII at the DB layer.
-- PREREQUISITE: run packages/db/scripts/envelope-backfill-pii.ts to completion FIRST,
-- and confirm the verification query below returns 0, or these ALTERs will fail.
-- Idempotent: drops-then-adds each constraint. Mixed-case table name double-quoted.

-- Verify zero unversioned non-null PII remains (must return 0 before adding constraints):
-- SELECT count(*) FROM "Customer"
--   WHERE (phone     IS NOT NULL AND phone      NOT LIKE 'v1:%')
--      OR (email     IS NOT NULL AND email      NOT LIKE 'v1:%')
--      OR ("nationalId" IS NOT NULL AND "nationalId" NOT LIKE 'v1:%');
-- SELECT count(*) FROM "MarketplaceDeedProof"
--   WHERE ("deedNumberEnc"      IS NOT NULL AND "deedNumberEnc"      NOT LIKE 'v1:%')
--      OR ("ownerNationalIdEnc" IS NOT NULL AND "ownerNationalIdEnc" NOT LIKE 'v1:%');
-- SELECT count(*) FROM "SystemConfig"
--   WHERE "smtpPasswordEncrypted" IS NOT NULL AND "smtpPasswordEncrypted" NOT LIKE 'v1:%';

ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS customer_phone_enc_chk;
ALTER TABLE "Customer" ADD  CONSTRAINT customer_phone_enc_chk      CHECK (phone        IS NULL OR phone        LIKE 'v1:%');
ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS customer_email_enc_chk;
ALTER TABLE "Customer" ADD  CONSTRAINT customer_email_enc_chk      CHECK (email        IS NULL OR email        LIKE 'v1:%');
ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS customer_nationalid_enc_chk;
ALTER TABLE "Customer" ADD  CONSTRAINT customer_nationalid_enc_chk CHECK ("nationalId" IS NULL OR "nationalId" LIKE 'v1:%');
-- NOTE: Organization.managerInfo is a JSON column; a column-level CHECK can't validate a JSON sub-field,
-- so its envelope is enforced only at the write path + A2 read-path telemetry (documented exception).

-- MarketplaceDeedProof PII (deedNumberEnc, ownerNationalIdEnc) — no hash columns.
ALTER TABLE "MarketplaceDeedProof" DROP CONSTRAINT IF EXISTS deedproof_deednumber_enc_chk;
ALTER TABLE "MarketplaceDeedProof" ADD  CONSTRAINT deedproof_deednumber_enc_chk      CHECK ("deedNumberEnc"      IS NULL OR "deedNumberEnc"      LIKE 'v1:%');
ALTER TABLE "MarketplaceDeedProof" DROP CONSTRAINT IF EXISTS deedproof_ownernationalid_enc_chk;
ALTER TABLE "MarketplaceDeedProof" ADD  CONSTRAINT deedproof_ownernationalid_enc_chk CHECK ("ownerNationalIdEnc" IS NULL OR "ownerNationalIdEnc" LIKE 'v1:%');

-- SystemConfig SMTP secret (smtpPasswordEncrypted) — no hash column.
ALTER TABLE "SystemConfig" DROP CONSTRAINT IF EXISTS systemconfig_smtppw_enc_chk;
ALTER TABLE "SystemConfig" ADD  CONSTRAINT systemconfig_smtppw_enc_chk CHECK ("smtpPasswordEncrypted" IS NULL OR "smtpPasswordEncrypted" LIKE 'v1:%');
