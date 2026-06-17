"use server";

import { randomUUID } from "crypto";
import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "../../lib/routes";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { checkLimit, FEATURE_KEYS } from "../../lib/entitlements";

/* ────────────────────────────────────────────────────────────────────────────
 * CX-010 — Unit bulk import (validate + commit). No PII. Dedupe key is
 * (organizationId, number). No schema change: `importBatchId` is a runtime UUID
 * stored only in the audit-log metadata.
 * ──────────────────────────────────────────────────────────────────────────── */

const MAX_ROWS = 5000;

const UNIT_TYPES = ["APARTMENT", "VILLA", "OFFICE", "RETAIL", "WAREHOUSE", "PARKING"] as const;

// Module-private — mirrors CreateUnitSchema in units.ts: only `number` + `type`
// are required; numerics coerced from string cells.
const numberFromCell = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), `${label}: قيمة رقمية غير سالبة مطلوبة / ${label} must be a non-negative number`);

const ImportUnitRowSchema = z.object({
  number: z.string().trim().min(1, "رقم الوحدة مطلوب / Unit number is required"),
  type: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => (UNIT_TYPES as readonly string[]).includes(v), `النوع يجب أن يكون أحد: ${UNIT_TYPES.join(", ")} / Type must be one of: ${UNIT_TYPES.join(", ")}`),
  area: numberFromCell("Area"),
  price: numberFromCell("Price"),
  markupPrice: numberFromCell("Selling price"),
  rentalPrice: numberFromCell("Rental price"),
  buildingName: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  city: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
});

export type UnitImportRow = {
  rowNumber: number;
  number?: string;
  type?: string;
  area?: string;
  price?: string;
  markupPrice?: string;
  rentalPrice?: string;
  buildingName?: string;
  city?: string;
};

export type ImportRowError = {
  rowNumber: number;
  messages: string[];
};

export type UnitValidationResult = {
  readyRowNumbers: number[];
  errors: ImportRowError[];
  duplicateRowNumbers: number[];
  totalRows: number;
};

function pick(row: UnitImportRow) {
  return {
    number: row.number?.trim() ?? "",
    type: row.type?.trim() ?? "",
    area: row.area?.trim() ?? "",
    price: row.price?.trim() ?? "",
    markupPrice: row.markupPrice?.trim() ?? "",
    rentalPrice: row.rentalPrice?.trim() ?? "",
    buildingName: row.buildingName?.trim() ?? "",
    city: row.city?.trim() ?? "",
  };
}

/**
 * Validate a batch of unit rows.
 *  - zod field rules per row (mirrors create)
 *  - in-file dedupe by `number`
 *  - DB dedupe via ONE batched `findMany({ where: { organizationId, number: { in } } })`
 */
export async function validateUnitImport(rows: UnitImportRow[]): Promise<UnitValidationResult> {
  const session = await requirePermission("units:write");

  if (!Array.isArray(rows)) throw new Error("No rows to validate.");
  if (rows.length > MAX_ROWS) {
    throw new Error(`Too many rows. The maximum is ${MAX_ROWS} per import.`);
  }

  const errors: ImportRowError[] = [];
  const duplicateRowNumbers: number[] = [];
  const readyRowNumbers: number[] = [];

  type ValidRow = { rowNumber: number; number: string };
  const validRows: ValidRow[] = [];
  const seenInFile = new Map<string, number>(); // number → first rowNumber

  for (const row of rows) {
    const parsed = ImportUnitRowSchema.safeParse(pick(row));
    if (!parsed.success) {
      errors.push({ rowNumber: row.rowNumber, messages: parsed.error.issues.map((i) => i.message) });
      continue;
    }
    const key = parsed.data.number;
    if (seenInFile.has(key)) {
      duplicateRowNumbers.push(row.rowNumber);
      continue;
    }
    seenInFile.set(key, row.rowNumber);
    validRows.push({ rowNumber: row.rowNumber, number: key });
  }

  if (validRows.length > 0) {
    const existing = await db.unit.findMany({
      where: {
        organizationId: session.organizationId,
        number: { in: validRows.map((r) => r.number) },
      },
      select: { number: true },
    });
    const existingNumbers = new Set(existing.map((e) => e.number));
    for (const r of validRows) {
      if (existingNumbers.has(r.number)) duplicateRowNumbers.push(r.rowNumber);
      else readyRowNumbers.push(r.rowNumber);
    }
  }

  return { readyRowNumbers, errors, duplicateRowNumbers, totalRows: rows.length };
}

export type CommitImportResult = {
  imported: number;
  skipped: number;
  importBatchId: string;
};

export async function commitUnitImport(
  rows: UnitImportRow[],
  options?: { skipBadRows?: boolean },
): Promise<CommitImportResult> {
  const session = await requirePermission("units:write");
  const skipBadRows = options?.skipBadRows === true;

  if (!Array.isArray(rows) || rows.length === 0) throw new Error("No rows to import.");
  if (rows.length > MAX_ROWS) {
    throw new Error(`Too many rows. The maximum is ${MAX_ROWS} per import.`);
  }

  const verdict = await validateUnitImport(rows);
  if (!skipBadRows && verdict.errors.length > 0) {
    throw new Error("Some rows have errors. Fix them, or enable “skip bad rows” to import the rest.");
  }

  const readySet = new Set(verdict.readyRowNumbers);
  const toImport = rows.filter((r) => readySet.has(r.rowNumber));
  const skipped = rows.length - toImport.length;
  if (toImport.length === 0) throw new Error("No valid rows to import after validation.");

  // Entitlement check for the whole batch (UNITS_MAX), like createUnit.
  const unitCount = await db.unit.count({ where: { organizationId: session.organizationId } });
  const entitlement = await checkLimit(
    session.organizationId,
    FEATURE_KEYS.UNITS_MAX,
    unitCount + toImport.length - 1,
  );
  if (!entitlement.granted) {
    throw new Error(entitlement.reason ?? "Unit limit reached. Please upgrade your plan to import these units.");
  }

  const importBatchId = randomUUID();

  const data = toImport.map((row) => {
    const parsed = ImportUnitRowSchema.parse(pick(row)); // re-parse → typed + coerced
    return {
      number: parsed.number,
      type: parsed.type as (typeof UNIT_TYPES)[number],
      status: "AVAILABLE" as const,
      area: parsed.area,
      price: parsed.price,
      markupPrice: parsed.markupPrice,
      rentalPrice: parsed.rentalPrice,
      buildingName: parsed.buildingName,
      city: parsed.city,
      organizationId: session.organizationId,
    };
  });

  const result = await db.$transaction(
    async (tx) => {
      return tx.unit.createMany({ data });
    },
    { timeout: 120000, maxWait: 10000 },
  );

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "CREATE",
    resource: "Unit",
    metadata: { bulkImport: true, importBatchId, count: result.count, skipped },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.units);

  return { imported: result.count, skipped, importBatchId };
}
