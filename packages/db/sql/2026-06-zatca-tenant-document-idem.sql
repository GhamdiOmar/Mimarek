-- ZATCA R4a (Track C) — prevent a payment REPLAY from minting a 2nd TenantDocument (L24).
-- The issuance hook keys on `sourceKey` (the same key the RentPayment/PaymentPlanInstallment
-- ledger dedupes on). Prisma can't express a partial-unique on nullable columns, so one
-- partial-unique index per source FK lives here, applied by hand on every long-lived env
-- (idempotent, safe to re-run). A P2002 on insert → re-fetch + return the existing document.
-- CREDIT_NOTE rows are excluded (a reversal legitimately produces a new doc for the same source).
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_document_rent_idem"
  ON public."TenantDocument" ("rentInstallmentId", "sourceKey")
  WHERE "rentInstallmentId" IS NOT NULL AND "sourceKey" IS NOT NULL AND "documentType" <> 'CREDIT_NOTE';

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_document_ppi_idem"
  ON public."TenantDocument" ("paymentPlanInstallmentId", "sourceKey")
  WHERE "paymentPlanInstallmentId" IS NOT NULL AND "sourceKey" IS NOT NULL AND "documentType" <> 'CREDIT_NOTE';

-- H1 — exactly ONE credit note per original document (never double-credit a reversal).
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_document_cn_idem"
  ON public."TenantDocument" ("originalDocumentId")
  WHERE "originalDocumentId" IS NOT NULL AND "documentType" = 'CREDIT_NOTE';
