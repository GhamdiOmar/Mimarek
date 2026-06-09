import type { Prisma } from "@repo/db";

/**
 * Sentinel scope for document numbers that are GLOBALLY unique (no per-org
 * partition in their format / unique constraint).
 *
 * Both `Invoice.invoiceNumber` (`INV-YYYY-NNNNN`, global `@unique`, single issuing
 * entity = the Mimaric platform) and `Contract.contractNumber` (global `@unique`;
 * its 4-char org prefix can repeat across orgs, so the numeric tail must be globally
 * monotonic) require a single shared sequence — NOT a per-org one. Using the real
 * `organizationId` here would let two orgs both mint `INV-YYYY-00001` and collide on
 * the global unique index. This matches the pre-existing global-count semantics.
 */
export const GLOBAL_SEQUENCE_SCOPE = "__global__";

/**
 * Atomically increment-or-create a sequence counter keyed by
 * (scope, counterType, year) and return the new value.
 *
 * `scope` is normally `GLOBAL_SEQUENCE_SCOPE` for globally-unique document numbers,
 * or a real `organizationId` when a number is genuinely partitioned per org.
 *
 * MUST be called inside an existing Prisma `$transaction` (interactive-tx form)
 * so the sequence bump and the entity create are committed together or rolled
 * back together.
 *
 * Uses a single SQL statement so concurrent callers can't read the same value:
 *   INSERT ... ON CONFLICT DO UPDATE SET value = value + 1 RETURNING value
 *
 * The `id` is generated in JS (cuid-style random hex) rather than relying on
 * `gen_random_uuid()` to avoid a pgcrypto extension dependency.
 */
export async function getNextSequenceValue(
  tx: Prisma.TransactionClient,
  scope: string,
  counterType: string,
  year: number,
): Promise<number> {
  // Generate a random id in JS — avoids requiring the pgcrypto extension
  // for gen_random_uuid() while still producing a globally unique string.
  const id = `sq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "SequenceCounter" ("id", "organizationId", "counterType", "year", "value", "createdAt", "updatedAt")
    VALUES (
      ${id},
      ${scope},
      ${counterType},
      ${year},
      1,
      now(),
      now()
    )
    ON CONFLICT ("organizationId", "counterType", "year")
    DO UPDATE
      SET "value"     = "SequenceCounter"."value" + 1,
          "updatedAt" = now()
    RETURNING "value"`;

  const value = rows[0]?.value;
  if (value === undefined || value === null) {
    throw new Error(`sequence: no value returned for ${counterType}/${year}`);
  }
  // Postgres returns BIGINT/numeric for integer arithmetic results; coerce to JS number.
  return Number(value);
}
