/**
 * CX-010 — config-driven import wizard.
 *
 * One `ImportConfig` per import type (customers, units) drives the SAME 5-step
 * wizard component. A config declares the target fields (with bilingual header
 * aliases, format hints, required flag), the caps, and the bound server actions.
 *
 * Pure module (NOT "use server") — safe to import in client + server code.
 */

import type { Lang } from "../../lib/error-sanitizer";

/** A target field the wizard can map an uploaded column onto. */
export interface ImportFieldDef {
  /** Stable key written back onto the row object handed to the server action. */
  key: string;
  /** Column header label shown in the UI + used in the generated template. */
  label: { ar: string; en: string };
  /** Whether a source column MUST be mapped to this field before import. */
  required: boolean;
  /** One-line format hint (Step 0 requirements + map step helper). */
  hint?: { ar: string; en: string };
  /**
   * Header strings that should auto-match this field. Includes the EN + AR
   * labels plus common aliases. Matching is case/whitespace/diacritic-insensitive.
   */
  aliases: string[];
  /** Example value used in the downloadable template's example row. */
  example: string;
}

export interface ImportConfig {
  /** Stable id — also the audit resource hint. */
  type: "customers" | "units";
  /** Wizard + entry-point titles. */
  title: { ar: string; en: string };
  /** One-line description under the title. */
  description: { ar: string; en: string };
  fields: ImportFieldDef[];
  /** Hard caps surfaced in Step 0 and enforced on upload. */
  maxRows: number;
  maxFileBytes: number;
  /** Help deep-link anchor for the EmptyState helpLink. */
  helpHref?: string;
}

const COMMON_CAPS = {
  maxRows: 5000,
  maxFileBytes: 10 * 1024 * 1024, // 10 MB
};

export const CUSTOMER_IMPORT_CONFIG: ImportConfig = {
  type: "customers",
  title: { ar: "استيراد العملاء", en: "Import customers" },
  description: {
    ar: "استورد جهات اتصال متعددة من ملف CSV أو Excel.",
    en: "Bring in many contacts at once from a CSV or Excel file.",
  },
  helpHref: "/dashboard/help#crm",
  ...COMMON_CAPS,
  fields: [
    {
      key: "name",
      label: { ar: "الاسم", en: "Name" },
      required: true,
      aliases: ["name", "full name", "الاسم", "الاسم الكامل", "اسم العميل", "customer name"],
      example: "Ahmed Al-Saud",
    },
    {
      key: "phone",
      label: { ar: "الجوال", en: "Phone" },
      required: true,
      hint: {
        ar: "صيغة الجوال: 05XXXXXXXX أو ‎+9665XXXXXXXX",
        en: "Phone format: 05XXXXXXXX or +9665XXXXXXXX",
      },
      aliases: ["phone", "mobile", "phone number", "الجوال", "رقم الجوال", "الهاتف", "جوال"],
      example: "0551234567",
    },
    {
      key: "email",
      label: { ar: "البريد الإلكتروني", en: "Email" },
      required: false,
      hint: { ar: "اختياري — بريد إلكتروني صحيح", en: "Optional — a valid email address" },
      aliases: ["email", "e-mail", "البريد", "البريد الإلكتروني", "الإيميل"],
      example: "ahmed@example.com",
    },
    {
      key: "nationalId",
      label: { ar: "الهوية الوطنية", en: "National ID" },
      required: false,
      hint: {
        ar: "اختياري — 10 أرقام تبدأ بـ 1 أو 2",
        en: "Optional — 10 digits starting with 1 or 2",
      },
      aliases: ["national id", "nationalid", "id", "iqama", "الهوية", "الهوية الوطنية", "رقم الهوية"],
      example: "1012345678",
    },
    {
      key: "nameArabic",
      label: { ar: "الاسم بالعربية", en: "Arabic name" },
      required: false,
      aliases: ["arabic name", "name arabic", "الاسم بالعربية", "الاسم العربي"],
      example: "أحمد آل سعود",
    },
    {
      key: "source",
      label: { ar: "المصدر", en: "Source" },
      required: false,
      aliases: ["source", "lead source", "المصدر", "مصدر العميل"],
      example: "REFERRAL",
    },
  ],
};

export const UNIT_IMPORT_CONFIG: ImportConfig = {
  type: "units",
  title: { ar: "استيراد الوحدات", en: "Import units" },
  description: {
    ar: "استورد وحدات متعددة من ملف CSV أو Excel.",
    en: "Bring in many units at once from a CSV or Excel file.",
  },
  helpHref: "/dashboard/help#units",
  ...COMMON_CAPS,
  fields: [
    {
      key: "number",
      label: { ar: "رقم الوحدة", en: "Unit number" },
      required: true,
      aliases: ["number", "unit number", "unit #", "unit", "رقم الوحدة", "رقم", "الوحدة"],
      example: "A-101",
    },
    {
      key: "type",
      label: { ar: "النوع", en: "Type" },
      required: true,
      hint: {
        ar: "أحد: APARTMENT · VILLA · OFFICE · RETAIL · WAREHOUSE · PARKING",
        en: "One of: APARTMENT · VILLA · OFFICE · RETAIL · WAREHOUSE · PARKING",
      },
      aliases: ["type", "unit type", "النوع", "نوع الوحدة"],
      example: "APARTMENT",
    },
    {
      key: "area",
      label: { ar: "المساحة", en: "Area (m²)" },
      required: false,
      hint: { ar: "اختياري — رقم بالأرقام اللاتينية", en: "Optional — a number (Western digits)" },
      aliases: ["area", "size", "المساحة", "م2", "متر"],
      example: "120",
    },
    {
      key: "price",
      label: { ar: "سعر التكلفة", en: "Cost price" },
      required: false,
      aliases: ["price", "cost", "cost price", "السعر", "سعر التكلفة"],
      example: "750000",
    },
    {
      key: "markupPrice",
      label: { ar: "سعر البيع", en: "Selling price" },
      required: false,
      aliases: ["markup price", "selling price", "sale price", "سعر البيع"],
      example: "850000",
    },
    {
      key: "rentalPrice",
      label: { ar: "سعر الإيجار", en: "Rental price" },
      required: false,
      aliases: ["rental price", "rent", "سعر الإيجار", "الإيجار"],
      example: "45000",
    },
    {
      key: "buildingName",
      label: { ar: "اسم المبنى", en: "Building name" },
      required: false,
      aliases: ["building", "building name", "المبنى", "اسم المبنى"],
      example: "Olaya Tower",
    },
    {
      key: "city",
      label: { ar: "المدينة", en: "City" },
      required: false,
      aliases: ["city", "المدينة"],
      example: "Riyadh",
    },
  ],
};

/* ── Header normalization + auto-match ──────────────────────────────────────── */

/**
 * Normalize a header for matching: lowercase, trim, collapse whitespace, strip
 * Arabic diacritics + tatweel, and remove punctuation that varies between files.
 */
export function normalizeHeader(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    // strip Arabic diacritics (harakat) + tatweel
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[._\-#/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Auto-match uploaded headers to config fields. Returns a map of
 * fieldKey → sourceHeader (or undefined when no confident match).
 */
export function autoMatchColumns(
  headers: string[],
  fields: ImportFieldDef[],
): Record<string, string | undefined> {
  const normHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const usedHeaders = new Set<string>();
  const result: Record<string, string | undefined> = {};

  for (const field of fields) {
    const aliasNorms = new Set(field.aliases.map(normalizeHeader));
    const match = normHeaders.find((h) => !usedHeaders.has(h.raw) && aliasNorms.has(h.norm));
    if (match) {
      result[field.key] = match.raw;
      usedHeaders.add(match.raw);
    } else {
      result[field.key] = undefined;
    }
  }
  return result;
}

export const importConfigFor = (type: "customers" | "units"): ImportConfig =>
  type === "customers" ? CUSTOMER_IMPORT_CONFIG : UNIT_IMPORT_CONFIG;

export const tt = (pair: { ar: string; en: string }, lang: Lang) => pair[lang];
