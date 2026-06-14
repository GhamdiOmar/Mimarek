"use server";

import { randomUUID } from "crypto";
import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { encryptCustomerData, phoneSearchHash } from "../../lib/pii-crypto";
import { normalizeSaudiPhoneE164 } from "../../lib/phone";

/* ────────────────────────────────────────────────────────────────────────────
 * CX-010 — Customer bulk import (validate + commit).
 *
 * PII contract (AGENTS.md §4): a fresh Customer is ONLY ever created through the
 * canonical encrypt path. This file builds rows via `encryptCustomerData` and
 * writes them with `tx.customer.createMany` — never raw phone/email/nationalId.
 * `customer-import.ts` is whitelisted in the eslint PII guard for exactly this
 * reason. No schema change: `importBatchId` is a runtime UUID stored only in the
 * audit-log metadata, not on the Customer row.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Hard caps mirrored in the wizard's requirements panel (Step 0). */
const MAX_ROWS = 5000;

// Module-private — NOT exported (a "use server" file may only export async fns).
// Per-row validation mirrors CreateCustomerSchema in customers.ts: name + a
// usable phone are required; email/nationalId optional with format rules.
const ImportCustomerRowSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب / Name is required"),
  phone: z
    .string()
    .trim()
    .min(1, "رقم الجوال مطلوب / Phone is required")
    .refine((v) => normalizeSaudiPhoneE164(v) !== null, "رقم جوال سعودي غير صالح — 05XXXXXXXX أو ‎+9665XXXXXXXX / Invalid Saudi phone — use 05XXXXXXXX or +9665XXXXXXXX"),
  email: z
    .string()
    .trim()
    .email("بريد إلكتروني غير صالح / Invalid email")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  nationalId: z
    .string()
    .trim()
    .regex(/^[12]\d{9}$/, "رقم الهوية يجب أن يكون 10 أرقام تبدأ بـ 1 أو 2 / National ID must be 10 digits starting with 1 or 2")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  nameArabic: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  source: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
});

/** A single raw row coming off the client mapper (string-valued cells). */
export type CustomerImportRow = {
  rowNumber: number;
  name?: string;
  phone?: string;
  email?: string;
  nationalId?: string;
  nameArabic?: string;
  source?: string;
};

export type ImportRowError = {
  rowNumber: number;
  messages: string[];
};

export type CustomerValidationResult = {
  /** Rows that pass validation AND are not duplicates — eligible to import. */
  readyRowNumbers: number[];
  /** Blocking per-row validation errors. Import is blocked while any exist. */
  errors: ImportRowError[];
  /** Soft duplicates (in-file or already in DB) — skipped, never blocking. */
  duplicateRowNumbers: number[];
  totalRows: number;
};

/** Sanitize cell strings into the shape the zod schema expects. */
function pick(row: CustomerImportRow) {
  return {
    name: row.name?.trim() ?? "",
    phone: row.phone?.trim() ?? "",
    email: row.email?.trim() ?? "",
    nationalId: row.nationalId?.trim() ?? "",
    nameArabic: row.nameArabic?.trim() ?? "",
    source: row.source?.trim() ?? "",
  };
}

/**
 * Validate a batch of customer rows.
 *  - zod field rules per row (mirrors create)
 *  - in-file dedupe by phoneSearchHash (the SAME normalize-then-hash as write/search)
 *  - DB dedupe via ONE batched `findMany({ where: { organizationId, phoneHash: { in } } })`
 */
export async function validateCustomerImport(
  rows: CustomerImportRow[],
): Promise<CustomerValidationResult> {
  const session = await requirePermission("customers:write");

  if (!Array.isArray(rows)) {
    throw new Error("No rows to validate.");
  }
  if (rows.length > MAX_ROWS) {
    throw new Error(`Too many rows. The maximum is ${MAX_ROWS} per import.`);
  }

  const errors: ImportRowError[] = [];
  const duplicateRowNumbers: number[] = [];
  const readyRowNumbers: number[] = [];

  // Pass 1 — field validation + collect blind-index hashes for valid rows.
  type ValidRow = { rowNumber: number; phoneHash: string };
  const validRows: ValidRow[] = [];
  const seenInFile = new Map<string, number>(); // phoneHash → first rowNumber

  for (const row of rows) {
    const parsed = ImportCustomerRowSchema.safeParse(pick(row));
    if (!parsed.success) {
      errors.push({
        rowNumber: row.rowNumber,
        messages: parsed.error.issues.map((i) => i.message),
      });
      continue;
    }
    // phoneSearchHash mirrors the write path exactly (P1-1 bug class).
    const phoneHash = phoneSearchHash(parsed.data.phone);
    const firstSeen = seenInFile.get(phoneHash);
    if (firstSeen !== undefined) {
      // In-file duplicate phone → soft skip (not a blocking error).
      duplicateRowNumbers.push(row.rowNumber);
      continue;
    }
    seenInFile.set(phoneHash, row.rowNumber);
    validRows.push({ rowNumber: row.rowNumber, phoneHash });
  }

  // Pass 2 — DB dedupe in ONE batched query (never per-row).
  if (validRows.length > 0) {
    const existing = await db.customer.findMany({
      where: {
        organizationId: session.organizationId,
        phoneHash: { in: validRows.map((r) => r.phoneHash) },
      },
      select: { phoneHash: true },
    });
    const existingHashes = new Set(existing.map((e) => e.phoneHash));
    for (const r of validRows) {
      if (r.phoneHash && existingHashes.has(r.phoneHash)) {
        duplicateRowNumbers.push(r.rowNumber);
      } else {
        readyRowNumbers.push(r.rowNumber);
      }
    }
  }

  return {
    readyRowNumbers,
    errors,
    duplicateRowNumbers,
    totalRows: rows.length,
  };
}

export type CommitImportResult = {
  imported: number;
  skipped: number;
  importBatchId: string;
};

/**
 * Commit a customer import.
 *  - all-or-nothing by default; `skipBadRows` re-validates and imports only the
 *    ready rows (duplicates always skipped softly).
 *  - rows are built via `encryptCustomerData` (pre-encrypted) and written with
 *    `tx.customer.createMany` inside one `$transaction` with a bumped timeout.
 *  - exactly one audit event per import.
 */
export async function commitCustomerImport(
  rows: CustomerImportRow[],
  options?: { skipBadRows?: boolean },
): Promise<CommitImportResult> {
  const session = await requirePermission("customers:write");
  const skipBadRows = options?.skipBadRows === true;

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No rows to import.");
  }
  if (rows.length > MAX_ROWS) {
    throw new Error(`Too many rows. The maximum is ${MAX_ROWS} per import.`);
  }

  // Re-validate server-side (never trust the client's earlier verdict) and
  // re-derive the ready set so the commit can't write a row the rules reject.
  const verdict = await validateCustomerImport(rows);

  if (!skipBadRows && verdict.errors.length > 0) {
    throw new Error(
      "Some rows have errors. Fix them, or enable “skip bad rows” to import the rest.",
    );
  }

  const readySet = new Set(verdict.readyRowNumbers);
  const toImport = rows.filter((r) => readySet.has(r.rowNumber));
  const skipped = rows.length - toImport.length;

  if (toImport.length === 0) {
    throw new Error("No valid rows to import after validation.");
  }

  const importBatchId = randomUUID();

  // Build pre-encrypted rows (PII contract) — phone/email/nationalId land
  // AES-256-GCM-encrypted with their blind-index hashes BEFORE the insert.
  const data = toImport.map((row) => {
    const clean = pick(row);
    const enc = encryptCustomerData({
      phone: clean.phone,
      email: clean.email || undefined,
      nationalId: clean.nationalId || undefined,
    });
    return {
      name: clean.name,
      phone: enc.phone,
      email: enc.email || undefined,
      nationalId: enc.nationalId,
      phoneHash: enc.phoneHash,
      emailHash: enc.emailHash,
      nationalIdHash: enc.nationalIdHash,
      nameArabic: clean.nameArabic || undefined,
      source: clean.source || undefined,
      organizationId: session.organizationId,
    };
  });

  // All-or-nothing: one transaction, bumped timeout for large batches.
  const result = await db.$transaction(
    async (tx) => {
      // Pre-encrypted rows via encryptCustomerData (PII contract); this file is
      // the whitelisted bulk creator (eslint exempt-list). See AGENTS.md §4.
      return tx.customer.createMany({ data });
    },
    { timeout: 120000, maxWait: 10000 },
  );

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "CREATE",
    resource: "Customer",
    metadata: { bulkImport: true, importBatchId, count: result.count, skipped },
    organizationId: session.organizationId,
  });

  revalidatePath("/dashboard/crm");

  return { imported: result.count, skipped, importBatchId };
}
