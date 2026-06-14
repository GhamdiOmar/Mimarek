"use server";

import ExcelJS from "exceljs";
import { requirePermission } from "../../lib/auth-helpers";

/* ────────────────────────────────────────────────────────────────────────────
 * CX-010 — parse-only server action for .xlsx uploads.
 *
 * ExcelJS is Node-side, so the client sends the file's bytes (base64) and we
 * return the first sheet as { headers, rows } JSON for the client to map/preview.
 * No DB write happens here. CSV is parsed entirely on the client.
 * ──────────────────────────────────────────────────────────────────────────── */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_ROWS = 5000;

export type ParsedSheet = {
  headers: string[];
  /** Each row is a string[] aligned to `headers` by index. */
  rows: string[][];
};

/**
 * Parse the first worksheet of an .xlsx file (sent as base64) into a
 * header row + data rows. Gated by `permission` so a tenant user can't parse
 * a file for a resource they can't write.
 */
export async function parseXlsxImport(
  base64: string,
  permission: "customers:write" | "units:write",
): Promise<ParsedSheet> {
  await requirePermission(permission);

  if (typeof base64 !== "string" || base64.length === 0) {
    throw new Error("No file received. Please choose a file and try again.");
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("File is too large. The maximum size is 10 MB.");
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new Error("Couldn't read the Excel file. Make sure it's a valid .xlsx file.");
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("The workbook has no sheets to import.");
  }

  const cellToString = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      // ExcelJS rich text / hyperlink / formula result shapes.
      if (typeof obj.text === "string") return obj.text;
      if (typeof obj.result !== "undefined") return String(obj.result);
      if (Array.isArray(obj.richText)) {
        return (obj.richText as { text?: string }[]).map((r) => r.text ?? "").join("");
      }
      if (value instanceof Date) return value.toISOString();
    }
    return String(value);
  };

  // First non-empty row = headers.
  let headerRowIndex = 1;
  const maxScan = Math.min(worksheet.rowCount, 20);
  for (let i = 1; i <= maxScan; i++) {
    const row = worksheet.getRow(i);
    const values = (row.values as unknown[]).slice(1).map(cellToString);
    if (values.some((v) => v.trim().length > 0)) {
      headerRowIndex = i;
      break;
    }
  }

  const headerRow = worksheet.getRow(headerRowIndex);
  const headers = (headerRow.values as unknown[]).slice(1).map(cellToString).map((h) => h.trim());

  const rows: string[][] = [];
  for (let i = headerRowIndex + 1; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const cells = (row.values as unknown[]).slice(1).map(cellToString);
    // Align to header width; skip fully-empty rows.
    const aligned = headers.map((_, idx) => (cells[idx] ?? "").trim());
    if (aligned.some((v) => v.length > 0)) {
      rows.push(aligned);
      if (rows.length > MAX_ROWS) {
        throw new Error(`Too many rows. The maximum is ${MAX_ROWS} per import.`);
      }
    }
  }

  return { headers, rows };
}
