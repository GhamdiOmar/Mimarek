"use client";

import * as React from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  CopyMinus,
  X,
  ArrowRight,
  FileText,
} from "lucide-react";
import {
  Button,
  IconButton,
  Badge,
  ResponsiveDialog,
  DataTable,
  EmptyState,
  Switch,
  SelectField,
  DirectionalIcon,
  type ColumnDef,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { useLanguage } from "../LanguageProvider";
import { sanitizeError } from "../../lib/error-sanitizer";
import {
  type ImportConfig,
  autoMatchColumns,
  tt,
} from "./import-config";
import {
  parseCsv,
  readFileAsText,
  readFileAsBase64,
  downloadTemplate,
  type ParsedSheet,
} from "./import-client";
import { parseXlsxImport } from "../../app/actions/import-parse";

/* ── Server-action contracts the wizard is bound to (one set per import type) ── */

export type ImportRowError = { rowNumber: number; messages: string[] };
export type ValidationResult = {
  readyRowNumbers: number[];
  errors: ImportRowError[];
  duplicateRowNumbers: number[];
  totalRows: number;
};
export type CommitResult = { imported: number; skipped: number; importBatchId: string };

export interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ImportConfig;
  /** Permission gate for the xlsx parse server action. */
  parsePermission: "customers:write" | "units:write";
  /** Bound validate action (re-runs server-side rules + dedupe). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onValidate: (rows: any[]) => Promise<ValidationResult>;
  /** Bound commit action. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCommit: (rows: any[], options?: { skipBadRows?: boolean }) => Promise<CommitResult>;
  /** Called after a successful import so the parent can refresh its list. */
  onImported?: (result: CommitResult) => void;
}

type Step = 0 | 1 | 2 | 3 | 4;

type MappedRow = {
  rowNumber: number;
  [key: string]: string | number;
};

/**
 * A mapped row decorated with its per-row validation verdict for the preview grid.
 * Not a `MappedRow &` intersection: `MappedRow`'s `[key: string]: string | number`
 * index signature would force `__messages: string[]` to also be `string | number`.
 * The index signature here admits every value actually stored in a preview row.
 */
type PreviewRow = {
  rowNumber: number;
  __status: "ok" | "error" | "duplicate";
  __messages: string[];
  [key: string]: string | number | string[];
};

const NUMBER_FMT_DIR = "ltr"; // phone/id/number cells flow LTR even in RTL.

export function ImportWizard({
  open,
  onOpenChange,
  config,
  parsePermission,
  onValidate,
  onCommit,
  onImported,
}: ImportWizardProps) {
  const { lang, dir } = useLanguage();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const [step, setStep] = React.useState<Step>(0);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Upload + parse
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState<ParsedSheet | null>(null);
  const [dragActive, setDragActive] = React.useState(false);

  // Mapping: fieldKey → sourceHeader
  const [mapping, setMapping] = React.useState<Record<string, string | undefined>>({});

  // Validation
  const [verdict, setVerdict] = React.useState<ValidationResult | null>(null);
  const [skipBadRows, setSkipBadRows] = React.useState(false);

  // Result
  const [result, setResult] = React.useState<CommitResult | null>(null);

  const requiredFields = React.useMemo(
    () => config.fields.filter((f) => f.required),
    [config],
  );

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setStep(0);
    setError(null);
    setBusy(false);
    setFileName(null);
    setSheet(null);
    setMapping({});
    setVerdict(null);
    setSkipBadRows(false);
    setResult(null);
    setDragActive(false);
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  // ── Step 0: download template ──
  async function handleDownloadTemplate() {
    try {
      await downloadTemplate(config, lang);
    } catch (e) {
      setError(sanitizeError(e, lang));
    }
  }

  // ── Step 1: file selection (drag-drop or click) ──
  async function handleFile(file: File) {
    setError(null);
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "csv" && ext !== "xlsx") {
      setError(T("نوع الملف غير مدعوم. اختر ملف ‎.csv أو ‎.xlsx.", "Unsupported file type. Choose a .csv or .xlsx file."));
      return;
    }
    if (file.size > config.maxFileBytes) {
      const mb = Math.round(config.maxFileBytes / (1024 * 1024));
      setError(T(`الملف كبير جداً. الحد الأقصى ${mb} ميجابايت.`, `File is too large. The maximum size is ${mb} MB.`));
      return;
    }

    setBusy(true);
    try {
      let parsed: ParsedSheet;
      if (ext === "csv") {
        const text = await readFileAsText(file);
        parsed = parseCsv(text);
      } else {
        const base64 = await readFileAsBase64(file);
        parsed = await parseXlsxImport(base64, parsePermission);
      }

      if (!parsed.headers.length || !parsed.rows.length) {
        setError(T("الملف فارغ أو لا يحتوي على صفوف بيانات.", "The file is empty or has no data rows."));
        setBusy(false);
        return;
      }
      if (parsed.rows.length > config.maxRows) {
        setError(
          T(
            `عدد الصفوف ${parsed.rows.length} يتجاوز الحد الأقصى ${config.maxRows}. قسّم الملف وحاول مجدداً.`,
            `${parsed.rows.length} rows exceed the maximum of ${config.maxRows}. Split the file and try again.`,
          ),
        );
        setBusy(false);
        return;
      }

      setFileName(file.name);
      setSheet(parsed);
      setMapping(autoMatchColumns(parsed.headers, config.fields));
      setStep(2);
    } catch (e) {
      setError(sanitizeError(e, lang));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  // ── Step 2 → 3: build mapped rows + validate ──
  const unmappedRequired = React.useMemo(
    () => requiredFields.filter((f) => !mapping[f.key]),
    [requiredFields, mapping],
  );

  function buildMappedRows(): MappedRow[] {
    if (!sheet) return [];
    const headerIndex: Record<string, number> = {};
    sheet.headers.forEach((h, idx) => {
      headerIndex[h] = idx;
    });
    return sheet.rows.map((cells, i) => {
      const row: MappedRow = { rowNumber: i + 1 };
      for (const field of config.fields) {
        const src = mapping[field.key];
        if (src !== undefined && headerIndex[src] !== undefined) {
          row[field.key] = cells[headerIndex[src]] ?? "";
        }
      }
      return row;
    });
  }

  async function handleValidate() {
    setError(null);
    setBusy(true);
    try {
      const rows = buildMappedRows();
      const v = await onValidate(rows);
      setVerdict(v);
      setStep(3);
    } catch (e) {
      setError(sanitizeError(e, lang));
    } finally {
      setBusy(false);
    }
  }

  // ── Step 3 → 4: commit ──
  const blockingErrors = verdict?.errors.length ?? 0;
  const canImport = verdict
    ? verdict.readyRowNumbers.length > 0 && (skipBadRows || blockingErrors === 0)
    : false;

  async function handleImport() {
    setError(null);
    setBusy(true);
    try {
      const rows = buildMappedRows();
      const res = await onCommit(rows, { skipBadRows });
      setResult(res);
      setStep(4);
      onImported?.(res);
    } catch (e) {
      setError(sanitizeError(e, lang));
    } finally {
      setBusy(false);
    }
  }

  // ── Preview grid (Step 3) ──
  const previewRows = React.useMemo<PreviewRow[]>(() => {
    if (!sheet || !verdict) return [];
    const errorMap = new Map<number, string[]>();
    for (const e of verdict.errors) errorMap.set(e.rowNumber, e.messages);
    const dupSet = new Set(verdict.duplicateRowNumbers);
    return buildMappedRows().map((row) => {
      const rn = row.rowNumber as number;
      const status: "ok" | "error" | "duplicate" = errorMap.has(rn)
        ? "error"
        : dupSet.has(rn)
          ? "duplicate"
          : "ok";
      return { ...row, __status: status, __messages: errorMap.get(rn) ?? [] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, verdict, mapping, config]);

  const previewColumns = React.useMemo<ColumnDef<PreviewRow>[]>(() => {
    const fieldCols: ColumnDef<PreviewRow>[] = config.fields
      .filter((f) => mapping[f.key])
      .map((f) => ({
        accessorKey: f.key,
        header: tt(f.label, lang),
        enableSorting: false,
        cell: ({ row }) => {
          const numericish = ["phone", "nationalId", "number", "price", "markupPrice", "rentalPrice", "area"].includes(f.key);
          return (
            <span
              dir={numericish ? NUMBER_FMT_DIR : undefined}
              className={cn("truncate", numericish && "tabular-nums")}
            >
              {String(row.original[f.key] ?? "—") || "—"}
            </span>
          );
        },
      }));

    const statusCol: ColumnDef<PreviewRow> = {
      id: "__status",
      header: T("الحالة", "Status"),
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original.__status;
        const msgs = row.original.__messages;
        if (s === "ok") {
          return (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {T("جاهز", "Ready")}
            </Badge>
          );
        }
        if (s === "duplicate") {
          return (
            <Badge variant="warning" className="gap-1">
              <CopyMinus className="h-3 w-3" aria-hidden="true" />
              {T("مكرر", "Duplicate")}
            </Badge>
          );
        }
        return (
          <div className="space-y-1">
            <Badge variant="error" className="gap-1">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              {T("خطأ", "Error")}
            </Badge>
            {msgs.length > 0 && (
              <ul className="text-[11px] text-destructive leading-snug list-disc ps-4">
                {msgs.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        );
      },
    };

    return [statusCol, ...fieldCols];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, mapping, lang]);

  // ── Step header ──
  const steps = [
    T("المتطلبات", "Requirements"),
    T("رفع الملف", "Upload"),
    T("ربط الأعمدة", "Map columns"),
    T("المعاينة", "Preview"),
    T("النتيجة", "Result"),
  ];

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleClose}
      title={tt(config.title, lang)}
      description={tt(config.description, lang)}
      contentClassName="sm:max-w-3xl"
    >
      <div dir={dir} className="space-y-4">
        {/* Stepper */}
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {steps.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-success/15 text-success-strong"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : i + 1}
                </span>
                <span className={cn(active ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
                {i < steps.length - 1 && (
                  <DirectionalIcon icon={ArrowRight} className="h-3 w-3 text-muted-foreground/50" />
                )}
              </li>
            );
          })}
        </ol>

        {/* Error banner */}
        {error && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
            <IconButton
              icon={X}
              aria-label={T("إغلاق", "Close")}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive/70 hover:text-destructive"
              onClick={() => setError(null)}
            />
          </div>
        )}

        {/* ── STEP 0: Requirements + Template ── */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {T("المتطلبات قبل الاستيراد", "Before you import")}
              </h3>
              <ul className="space-y-2 text-sm">
                {config.fields.map((f) => (
                  <li key={f.key} className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        f.required
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {f.required ? T("مطلوب", "Required") : T("اختياري", "Optional")}
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">{tt(f.label, lang)}</span>
                      {f.hint && (
                        <span className="block text-xs text-muted-foreground" dir={dir}>
                          {tt(f.hint, lang)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-1 gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:grid-cols-3">
                <span>
                  {T("الحد الأقصى للصفوف", "Max rows")}:{" "}
                  <strong className="text-foreground tabular-nums" dir={NUMBER_FMT_DIR}>
                    {config.maxRows.toLocaleString("en-US")}
                  </strong>
                </span>
                <span>
                  {T("حجم الملف", "File size")}:{" "}
                  <strong className="text-foreground tabular-nums" dir={NUMBER_FMT_DIR}>
                    {Math.round(config.maxFileBytes / (1024 * 1024))} MB
                  </strong>
                </span>
                <span>
                  {T("الأنواع المقبولة", "Accepted")}:{" "}
                  <strong className="text-foreground" dir={NUMBER_FMT_DIR}>
                    .csv · .xlsx
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                style={{ display: "inline-flex" }}
                className="gap-2"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-4 w-4" />
                {T("تنزيل القالب", "Download template")}
              </Button>
              <Button
                style={{ display: "inline-flex" }}
                className="gap-2"
                onClick={() => setStep(1)}
              >
                {T("التالي", "Next")}
                <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Upload ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors",
                dragActive ? "border-primary bg-primary/5" : "border-border bg-muted/10",
              )}
            >
              <UploadCloud className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">
                {T("اسحب الملف هنا أو", "Drag a file here, or")}
              </p>
              <Button
                variant="outline"
                style={{ display: "inline-flex" }}
                className="mt-3 gap-2"
                onClick={() => fileInputRef.current?.click()}
                loading={busy}
                loadingText={T("جارٍ القراءة…", "Reading…")}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {T("اختر ملفاً", "Choose a file")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = ""; // allow re-selecting the same file
                }}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                {T("الأنواع المقبولة: ‎.csv · .xlsx", "Accepted: .csv · .xlsx")}
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" style={{ display: "inline-flex" }} onClick={() => setStep(0)}>
                {T("رجوع", "Back")}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Map columns ── */}
        {step === 2 && sheet && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" aria-hidden="true" />
              <span className="truncate">{fileName}</span>
              <Badge variant="default" className="tabular-nums" >
                <span dir={NUMBER_FMT_DIR}>{sheet.rows.length}</span> {T("صف", "rows")}
              </Badge>
            </div>

            <div className="space-y-2">
              {config.fields.map((f) => {
                const missing = f.required && !mapping[f.key];
                return (
                  <div
                    key={f.key}
                    className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-[1fr_auto_1fr]"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground">{tt(f.label, lang)}</span>
                      {f.required && <span className="text-destructive"> *</span>}
                      {f.hint && (
                        <span className="block truncate text-xs text-muted-foreground">{tt(f.hint, lang)}</span>
                      )}
                    </div>
                    <DirectionalIcon
                      icon={ArrowRight}
                      className="hidden h-4 w-4 text-muted-foreground sm:block justify-self-center"
                      aria-hidden="true"
                    />
                    <SelectField
                      value={mapping[f.key] ?? ""}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [f.key]: e.target.value || undefined }))
                      }
                      aria-label={T(`ربط عمود ${tt(f.label, "ar")}`, `Map column for ${tt(f.label, "en")}`)}
                      className={missing ? "border-destructive/60" : undefined}
                    >
                      <option value="">{T("— غير مربوط —", "— Not mapped —")}</option>
                      {sheet.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                );
              })}
            </div>

            {unmappedRequired.length > 0 && (
              <p className="text-xs text-destructive">
                {T("اربط كل الحقول المطلوبة للمتابعة:", "Map every required field to continue:")}{" "}
                {unmappedRequired.map((f) => tt(f.label, lang)).join("، ")}
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" style={{ display: "inline-flex" }} onClick={() => setStep(1)}>
                {T("رجوع", "Back")}
              </Button>
              <Button
                style={{ display: "inline-flex" }}
                className="gap-2"
                disabled={unmappedRequired.length > 0 || busy}
                loading={busy}
                loadingText={T("جارٍ التحقق…", "Validating…")}
                onClick={handleValidate}
              >
                {T("تحقّق ومعاينة", "Validate & preview")}
                <DirectionalIcon icon={ArrowRight} className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Validate-preview ── */}
        {step === 3 && verdict && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                <span dir={NUMBER_FMT_DIR} className="tabular-nums">{verdict.readyRowNumbers.length}</span>{" "}
                {T("جاهز", "ready")}
              </Badge>
              <Badge variant="error" className="gap-1">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                <span dir={NUMBER_FMT_DIR} className="tabular-nums">{verdict.errors.length}</span>{" "}
                {T("خطأ", "errors")}
              </Badge>
              <Badge variant="warning" className="gap-1">
                <CopyMinus className="h-3 w-3" aria-hidden="true" />
                <span dir={NUMBER_FMT_DIR} className="tabular-nums">{verdict.duplicateRowNumbers.length}</span>{" "}
                {T("مكرر", "duplicates")}
              </Badge>
            </div>

            {verdict.duplicateRowNumbers.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {T(
                  "الصفوف المكررة (موجودة مسبقاً أو متكررة في الملف) سيتم تخطّيها تلقائياً.",
                  "Duplicate rows (already in your data or repeated in the file) are skipped automatically.",
                )}
              </p>
            )}

            <div className="max-h-[42vh] overflow-auto">
              <DataTable
                columns={previewColumns}
                data={previewRows}
                locale={lang}
                pagination
                pageSize={10}
                getRowId={(r) => String(r.rowNumber)}
                rowClassName={(r) =>
                  r.__status === "error"
                    ? "bg-destructive/5"
                    : r.__status === "duplicate"
                      ? "bg-warning/5"
                      : undefined
                }
                emptyTitle={T("لا توجد صفوف", "No rows")}
              />
            </div>

            {/* Skip-bad-rows opt-in (default OFF = strict all-or-nothing) */}
            {blockingErrors > 0 && (
              <label className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <Switch
                  checked={skipBadRows}
                  onCheckedChange={(v) => setSkipBadRows(!!v)}
                  aria-label={T("تخطّي الصفوف الخاطئة واستيراد الباقي", "Skip bad rows and import the rest")}
                />
                <span className="text-sm text-foreground">
                  {T("تخطّي الصفوف الخاطئة واستيراد الباقي", "Skip bad rows and import the rest")}
                  <span className="block text-xs text-muted-foreground">
                    {T(
                      "بدون هذا الخيار، أي خطأ يمنع الاستيراد بالكامل.",
                      "Without this, any error blocks the whole import (all-or-nothing).",
                    )}
                  </span>
                </span>
              </label>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" style={{ display: "inline-flex" }} onClick={() => setStep(2)}>
                {T("رجوع", "Back")}
              </Button>
              <Button
                style={{ display: "inline-flex" }}
                className="gap-2"
                disabled={!canImport || busy}
                loading={busy}
                loadingText={T("جارٍ الاستيراد…", "Importing…")}
                onClick={handleImport}
              >
                <UploadCloud className="h-4 w-4" />
                {T(
                  `استيراد ${verdict.readyRowNumbers.length}`,
                  `Import ${verdict.readyRowNumbers.length}`,
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Result ── */}
        {step === 4 && result && (
          <EmptyState
            variant="first-time"
            icon={<CheckCircle2 className="h-12 w-12" />}
            title={T("تم الاستيراد", "Import complete")}
            description={T(
              `تم استيراد ${result.imported}، وتخطّي ${result.skipped}.`,
              `${result.imported} imported, ${result.skipped} skipped.`,
            )}
            action={
              <Button style={{ display: "inline-flex" }} onClick={() => handleClose(false)}>
                {T("تم", "Done")}
              </Button>
            }
            secondaryAction={
              <Button variant="ghost" style={{ display: "inline-flex" }} onClick={reset}>
                {T("استيراد ملف آخر", "Import another file")}
              </Button>
            }
          />
        )}
      </div>
    </ResponsiveDialog>
  );
}
