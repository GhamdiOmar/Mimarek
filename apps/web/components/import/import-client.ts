/**
 * CX-010 — client-side import helpers: CSV parsing + .xlsx template generation.
 * Pure browser module (uses exceljs + file-saver in the browser bundle).
 */

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ImportConfig } from "./import-config";

export type ParsedSheet = {
  headers: string[];
  rows: string[][];
};

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes (""),
 * embedded commas + newlines, and CRLF/LF line endings. Good enough for the
 * spreadsheet exports users produce from Excel/Sheets/Numbers.
 */
export function parseCsv(text: string): ParsedSheet {
  // Strip a UTF-8 BOM if present (Excel adds one).
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // Consume \r\n as a single break.
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // Flush the trailing field/row (file may not end in newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully-empty rows.
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim().length > 0));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = (nonEmpty[0] ?? []).map((h) => h.trim());
  const dataRows = nonEmpty.slice(1).map((r) => headers.map((_, idx) => (r[idx] ?? "").trim()));
  return { headers, rows: dataRows };
}

/** Read an uploaded File as text (for CSV). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsText(file);
  });
}

/** Read an uploaded File as a base64 string (for sending .xlsx to the server). */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      // result is a data URL: "data:...;base64,XXXX" — strip the prefix.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Generate + download a bilingual .xlsx template for an import type.
 * Header row is frozen and styled; one example row shows the expected format.
 * Header label is "العربية / English" so the auto-matcher hits BOTH languages.
 */
export async function downloadTemplate(config: ImportConfig, lang: "ar" | "en"): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Template", {
    views: [{ rightToLeft: lang === "ar", state: "frozen", ySplit: 1 }],
  });

  const headers = config.fields.map((f) => `${f.label.ar} / ${f.label.en}`);
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell, col) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3E2760" } }; // primary-deep
    cell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getColumn(col).width = Math.max(18, headers[col - 1]!.length + 4);
  });

  // One example row (apostrophe-prefix any leading +/= to keep Excel from
  // treating a phone like "+9665..." as a formula).
  const exampleRow = worksheet.addRow(
    config.fields.map((f) => {
      const v = f.example;
      return /^[=+@-]/.test(v) ? `'${v}` : v;
    }),
  );
  exampleRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 11, color: { argb: "FF888888" }, italic: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `mimaric-${config.type}-template.xlsx`);
}
