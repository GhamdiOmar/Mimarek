-- One-time initialization of SequenceCounter from existing document numbers.
-- Run ONCE after `prisma db push` adds the SequenceCounter table, on any environment
-- that already contains Invoices/Contracts (production + any long-lived staging DB).
--
-- WHY: invoice/contract numbering moved from a live count()+1 / max-lookup to an atomic
-- SequenceCounter (future-plans/audit-remediation.md H7). A brand-new counter starts at 1,
-- which would collide with already-issued numbers (e.g. an existing INV-2026-00001). This
-- seeds the counter to MAX(existing) so the next minted number continues the series.
--
-- Idempotent: ON CONFLICT keeps the greatest value, so re-running never lowers a counter.
-- Scope key is the global sentinel '__global__' (see apps/web/lib/sequence.ts) — both numbers
-- are globally unique series, not per-org.

-- Invoices: INV-YYYY-NNNNN  →  counterType 'INVOICE', year = YYYY, value = MAX(NNNNN)
INSERT INTO "SequenceCounter" ("id", "organizationId", "counterType", "year", "value", "createdAt", "updatedAt")
SELECT
  'sqbf_inv_' || s.yr::text,
  '__global__',
  'INVOICE',
  s.yr,
  MAX(s.seq),
  now(),
  now()
FROM (
  SELECT
    CAST(split_part("invoiceNumber", '-', 2) AS INTEGER) AS yr,
    CAST(split_part("invoiceNumber", '-', 3) AS INTEGER) AS seq
  FROM "Invoice"
  WHERE "invoiceNumber" ~ '^INV-[0-9]{4}-[0-9]+$'
) s
GROUP BY s.yr
ON CONFLICT ("organizationId", "counterType", "year")
  DO UPDATE SET "value" = GREATEST("SequenceCounter"."value", EXCLUDED."value"), "updatedAt" = now();

-- Contracts: <ORG4>-<TYPE>-YYYY-NNNN  →  counterType 'CONTRACT_<TYPE>', year = YYYY, value = MAX(NNNN)
INSERT INTO "SequenceCounter" ("id", "organizationId", "counterType", "year", "value", "createdAt", "updatedAt")
SELECT
  'sqbf_ct_' || s.ctype || '_' || s.yr::text,
  '__global__',
  'CONTRACT_' || s.ctype,
  s.yr,
  MAX(s.seq),
  now(),
  now()
FROM (
  SELECT
    split_part("contractNumber", '-', 2) AS ctype,
    CAST(split_part("contractNumber", '-', 3) AS INTEGER) AS yr,
    CAST(split_part("contractNumber", '-', 4) AS INTEGER) AS seq
  FROM "Contract"
  WHERE "contractNumber" ~ '^[A-Z0-9]{4}-[A-Z]+-[0-9]{4}-[0-9]+$'
) s
GROUP BY s.ctype, s.yr
ON CONFLICT ("organizationId", "counterType", "year")
  DO UPDATE SET "value" = GREATEST("SequenceCounter"."value", EXCLUDED."value"), "updatedAt" = now();
