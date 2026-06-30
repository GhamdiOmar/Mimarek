"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  X,
  Search,
  Link2,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  Button,
  IconButton,
  Input,
  Field,
  SelectField,
  HijriDatePicker,
  NationalIdInput,
  SaudiPhoneInput,
  SARAmountInput,
  AddressPicker,
  type SaudiAddress,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { createCustomer } from "../../actions/customers";
import { addCustomerInterest } from "../../actions/customer-interests";
import { trackEvent, AnalyticsEvent } from "../../../lib/analytics";
import { sanitizeError } from "../../../lib/error-sanitizer";
import { useUnsavedChanges } from "../../../hooks/useUnsavedChanges";
import { PIPELINE_STAGES, SOURCE_LABELS } from "./crm-config";

// ─── Shared CRM DTOs (serialized + masked payloads as they reach the modal) ──

type AvailableUnit = {
  id: string;
  number?: string | null;
  type?: string | null;
  city?: string | null;
  buildingName?: string | null;
  rentalPrice?: number | string | null;
  markupPrice?: number | string | null;
  price?: number | string | null;
  [key: string]: unknown;
};

type TeamMember = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  [key: string]: unknown;
};

// Masked + serialized customer row as returned by getCustomers / createCustomer.
// Structurally matches CrmView's CrmCustomer so the created record flows back
// into CrmView's customers state without a cross-module type clash.
type CrmCustomer = {
  id: string;
  name: string;
  nameArabic?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  status: string;
  lostReason?: string | null;
  agentId?: string | null;
  budget?: number | string | null;
  propertyTypeInterest?: string | null;
  nationality?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  dateOfBirth?: string | Date | null;
  agent?: { id?: string; name?: string | null; email?: string | null } | null;
  contactPhoneE164?: string | null;
  [key: string]: unknown;
};

// ─── Property-linking helpers (moved with the modal — close over `lang`) ─────

function getUnitPrice(unit: AvailableUnit, intent: "BUY" | "RENT" | null) {
  if (intent === "RENT") return unit.rentalPrice ?? null;
  return unit.markupPrice ?? unit.price ?? null;
}

export function AddCustomerModal({
  open,
  onClose,
  pageAvailableUnits,
  teamMembers,
  lang,
  initialStatus = "NEW",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  pageAvailableUnits: AvailableUnit[];
  teamMembers: TeamMember[];
  lang: "ar" | "en";
  /** Preselects the pipeline stage (Kanban per-column "Add" passes the column key). */
  initialStatus?: string;
  onCreated: (created: CrmCustomer) => void;
}) {
  // budget → bilingual budget-comparison tag (depends on `lang`)
  const getBudgetTag = React.useCallback(
    (unitPrice: number | string | null | undefined, budget: string) => {
      const b = Number(budget);
      if (!unitPrice || !b || b <= 0) return null;
      const ratio = Number(unitPrice) / b;
      if (ratio > 1.05)
        return {
          label: lang === "ar" ? "فوق الميزانية" : "Over Budget",
          color: "text-destructive bg-destructive/10",
        };
      if (ratio >= 0.9)
        return {
          label: lang === "ar" ? "ضمن الميزانية" : "On Budget",
          color: "text-success-strong bg-success/10",
        };
      return {
        label: lang === "ar" ? "أقل من الميزانية" : "Under Budget",
        color: "text-info-strong bg-info/10",
      };
    },
    [lang],
  );

  // ── Zod schema (built per-render so messages use current lang) ────────
  const schema = React.useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, lang === "ar" ? "الاسم مطلوب." : "Name is required."),
        phone: z
          .string()
          .min(1, lang === "ar" ? "رقم الجوال مطلوب." : "Phone is required."),
        nameArabic: z.string().optional(),
        email: z.string().optional(),
        source: z.string().optional(),
        status: z.string().optional(),
        budget: z.number().nullable().optional(),
        agentId: z.string().optional(),
        nationalId: z.string().optional(),
        personType: z.string().optional(),
        gender: z.string().optional(),
        nationality: z.string().optional(),
        maritalStatus: z.string().optional(),
        dateOfBirth: z.string().optional(),
        // ZATCA Track C buyer party (D18)
        customerKind: z.string().optional(),
        vatNumber: z.string().optional(),
        crNumber: z.string().optional(),
        companyNameAr: z.string().optional(),
        companyNameEn: z.string().optional(),
        // National address — required for a B2B cleared tax invoice (D18 data gate).
        address: z.any().optional(),
      }),
    [lang],
  );

  type FormValues = z.infer<typeof schema>;

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      phone: "",
      nameArabic: "",
      email: "",
      source: "",
      status: "NEW",
      budget: null,
      agentId: "",
      nationalId: "",
      personType: "",
      gender: "",
      nationality: "",
      maritalStatus: "",
      dateOfBirth: "",
      customerKind: "",
      vatNumber: "",
      crNumber: "",
      companyNameAr: "",
      companyNameEn: "",
      address: undefined,
    },
  });

  useUnsavedChanges(formState.isDirty);

  // ── Property-linking aux state (local — not RHF fields) ───────────────
  const [unitSearch, setUnitSearch] = React.useState("");
  const [selectedUnit, setSelectedUnit] = React.useState<AvailableUnit | null>(null);
  const [intent, setIntent] = React.useState<"BUY" | "RENT" | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const budget = watch("budget");
  const customerKind = watch("customerKind");

  // Reset form + aux state every time the modal opens, so each trigger site
  // (the 3 desktop call-sites + the Kanban per-column add) gets a clean form.
  React.useEffect(() => {
    if (open) {
      reset({
        name: "",
        phone: "",
        nameArabic: "",
        email: "",
        source: "",
        status: initialStatus,
        budget: null,
        agentId: "",
        nationalId: "",
        personType: "",
        gender: "",
        nationality: "",
        maritalStatus: "",
        dateOfBirth: "",
        customerKind: "",
        vatNumber: "",
        crNumber: "",
        companyNameAr: "",
        companyNameEn: "",
        address: undefined,
      });
      setUnitSearch("");
      setSelectedUnit(null);
      setIntent(null);
      setSubmitting(false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredUnits = React.useMemo(() => {
    if (!unitSearch.trim()) return [];
    const q = unitSearch.toLowerCase().trim();
    return pageAvailableUnits
      .filter(
        (u) =>
          u.number?.toLowerCase().includes(q) ||
          u.city?.toLowerCase().includes(q) ||
          u.type?.toLowerCase().includes(q) ||
          u.buildingName?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [unitSearch, pageAvailableUnits]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await createCustomer({
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        nationalId: values.nationalId || undefined,
        nameArabic: values.nameArabic || undefined,
        source: values.source || undefined,
        status: values.status || undefined,
        personType: values.personType || undefined,
        gender: values.gender || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        nationality: values.nationality || undefined,
        maritalStatus: values.maritalStatus || undefined,
        budget: values.budget != null ? Number(values.budget) : undefined,
        agentId: values.agentId || undefined,
        customerKind: values.customerKind || undefined,
        vatNumber: values.vatNumber || undefined,
        crNumber: values.crNumber || undefined,
        companyNameAr: values.companyNameAr || undefined,
        companyNameEn: values.companyNameEn || undefined,
        address: values.address || undefined,
      });

      // Link property interest if a unit + intent was selected
      if (selectedUnit && intent) {
        await addCustomerInterest(created.id, selectedUnit.id, intent);
      }

      trackEvent(AnalyticsEvent.CustomerCreated, { source: values.source || "manual" });
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      // CX-003: friendly bilingual copy (maps plan-limit/entitlement throws to
      // native AR/EN; collapses any technical leak) instead of raw err.message.
      setError(sanitizeError(err, lang));
    } finally {
      setSubmitting(false);
    }
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        className="bg-card w-full max-w-lg rounded-xl shadow-2xl border border-border animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">
            {lang === "ar" ? "إضافة عميل جديد" : "Add New Customer"}
          </h2>
          <IconButton
            icon={X}
            aria-label={lang === "ar" ? "إغلاق" : "Close"}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          />
        </div>

        <form id="add-customer-form" onSubmit={onSubmit}>
          <div className="p-6 space-y-4">
            {/* Required fields legend */}
            <p className="text-xs text-muted-foreground">
              {lang === "ar" ? "الحقول المطلوبة معلّمة بـ *" : "Required fields marked with *"}
            </p>

            {/* Required + core fields */}
            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="name"
                control={control}
                render={({ field, fieldState }) => (
                  <Field
                    label={lang === "ar" ? "الاسم الكامل" : "Full Name"}
                    required
                    error={fieldState.error?.message}
                    className="col-span-2"
                  >
                    {(f) => (
                      <Input
                        {...f}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder={lang === "ar" ? "الاسم بالكامل" : "Full name"}
                        autoFocus
                      />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="nameArabic"
                control={control}
                render={({ field, fieldState }) => (
                  <Field
                    label={lang === "ar" ? "الاسم بالعربية" : "Arabic Name"}
                    error={fieldState.error?.message}
                  >
                    {(f) => (
                      <Input
                        {...f}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="الاسم بالعربية"
                      />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="phone"
                control={control}
                render={({ field, fieldState }) => (
                  <Field
                    label={lang === "ar" ? "رقم الجوال" : "Phone"}
                    required
                    error={fieldState.error?.message}
                  >
                    {() => (
                      <SaudiPhoneInput
                        value={field.value ?? ""}
                        onChange={(e164) => field.onChange(e164)}
                        onBlur={field.onBlur}
                        placeholder="+966 5x xxx xxxx"
                      />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="email"
                control={control}
                render={({ field, fieldState }) => (
                  <Field
                    label={lang === "ar" ? "البريد الإلكتروني" : "Email"}
                    error={fieldState.error?.message}
                  >
                    {(f) => (
                      <Input
                        {...f}
                        type="email"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="email@example.com"
                        dir="ltr"
                      />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="source"
                control={control}
                render={({ field }) => (
                  <SelectField
                    label={lang === "ar" ? "المصدر" : "Source"}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  >
                    <option value="">{lang === "ar" ? "اختر المصدر" : "Select source"}</option>
                    {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label[lang]}
                      </option>
                    ))}
                  </SelectField>
                )}
              />

              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <SelectField
                    label={lang === "ar" ? "الحالة" : "Status"}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label[lang]}
                      </option>
                    ))}
                  </SelectField>
                )}
              />

              {/* CRM fields: Budget */}
              <Controller
                name="budget"
                control={control}
                render={({ field, fieldState }) => (
                  <Field
                    label={lang === "ar" ? "الميزانية (ريال)" : "Budget (SAR)"}
                    error={fieldState.error?.message}
                  >
                    {() => (
                      <SARAmountInput
                        value={field.value ?? null}
                        onChange={(n) => field.onChange(n)}
                        onBlur={field.onBlur}
                        placeholder={lang === "ar" ? "مثال: 500000" : "e.g. 500000"}
                        locale={lang}
                      />
                    )}
                  </Field>
                )}
              />

              {/* ── Link Property (Optional) ── */}
              <div className="col-span-2 space-y-2 pt-1">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  {lang === "ar" ? "ربط عقار (اختياري)" : "Link Property (Optional)"}
                </label>

                {/* Selected unit pill */}
                {selectedUnit ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {selectedUnit.number}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{selectedUnit.type}</span>
                      {selectedUnit.city && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{selectedUnit.city}</span>
                        </>
                      )}
                      {intent && (
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            intent === "BUY"
                              ? "bg-info/15 text-info-strong"
                              : "bg-primary/15 text-primary",
                          )}
                        >
                          {intent === "BUY"
                            ? lang === "ar"
                              ? "شراء"
                              : "BUY"
                            : lang === "ar"
                              ? "إيجار"
                              : "RENT"}
                        </span>
                      )}
                    </div>
                    <IconButton
                      icon={X}
                      aria-label={lang === "ar" ? "إزالة" : "Remove"}
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => {
                        setSelectedUnit(null);
                        setIntent(null);
                        setUnitSearch("");
                      }}
                    />
                  </div>
                ) : (
                  <>
                    {/* Search input */}
                    <div className="relative">
                      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        aria-label={
                          lang === "ar"
                            ? "ابحث برقم الوحدة أو المدينة"
                            : "Search by unit number or city"
                        }
                        value={unitSearch}
                        onChange={(e) => setUnitSearch(e.target.value)}
                        placeholder={
                          lang === "ar"
                            ? "ابحث برقم الوحدة أو المدينة..."
                            : "Search by unit number or city..."
                        }
                        className="ps-9 text-sm"
                      />
                    </div>

                    {/* Results list */}
                    {unitSearch.trim() ? (
                      filteredUnits.length > 0 ? (
                        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-48 overflow-y-auto">
                          {filteredUnits.map((unit) => {
                            const price = getUnitPrice(unit, intent);
                            const tag = getBudgetTag(
                              price,
                              budget == null ? "" : String(budget),
                            );
                            return (
                              <Button
                                key={unit.id}
                                type="button"
                                variant="ghost"
                                size="sm"
                                style={{ display: "flex", width: "100%" }}
                                className="items-center justify-between gap-3 px-3 py-2.5 text-start h-auto rounded-none"
                                onClick={() => {
                                  setSelectedUnit(unit);
                                  setUnitSearch("");
                                }}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 text-sm">
                                  <span className="font-medium text-foreground truncate">
                                    {unit.number}
                                  </span>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="text-muted-foreground text-xs">{unit.type}</span>
                                  {unit.city && (
                                    <>
                                      <span className="text-muted-foreground">·</span>
                                      <span className="text-muted-foreground text-xs truncate">
                                        {unit.city}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {price && (
                                    <span
                                      className="text-xs font-mono text-muted-foreground"
                                      dir="ltr"
                                    >
                                      {Number(price).toLocaleString(
                                        lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA",
                                      )}{" "}
                                      {lang === "ar" ? "ر.س" : "SAR"}
                                    </span>
                                  )}
                                  {tag && (
                                    <span
                                      className={cn(
                                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                        tag.color,
                                      )}
                                    >
                                      {tag.label}
                                    </span>
                                  )}
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          {lang === "ar" ? "لا توجد وحدات مطابقة للبحث" : "No units match your search"}
                        </p>
                      )
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 px-1">
                        <Search className="h-3.5 w-3.5 shrink-0" />
                        {lang === "ar"
                          ? "ابدأ البحث للعثور على وحدات متاحة"
                          : "Search to find available units"}
                      </div>
                    )}
                  </>
                )}

                {/* Intent selection — shown after unit is selected */}
                {selectedUnit && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      {lang === "ar" ? "نوع الاهتمام" : "Interest Type"}
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={intent === "BUY" ? "primary" : "outline"}
                        size="sm"
                        style={{ display: "inline-flex", flex: 1 }}
                        className={cn(
                          "py-2 text-sm h-auto justify-center",
                          intent === "BUY"
                            ? "bg-info text-info-foreground border-info hover:bg-info/90"
                            : "",
                        )}
                        onClick={() => setIntent("BUY")}
                      >
                        {lang === "ar" ? "شراء" : "Buy"}
                      </Button>
                      <Button
                        type="button"
                        variant={intent === "RENT" ? "primary" : "outline"}
                        size="sm"
                        style={{ display: "inline-flex", flex: 1 }}
                        className="py-2 text-sm h-auto justify-center"
                        onClick={() => setIntent("RENT")}
                      >
                        {lang === "ar" ? "إيجار" : "Rent"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Agent Assignment */}
              {teamMembers.length > 0 && (
                <Controller
                  name="agentId"
                  control={control}
                  render={({ field }) => (
                    <SelectField
                      label={lang === "ar" ? "تعيين المسؤول" : "Assign Agent"}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      wrapperClassName="col-span-2"
                    >
                      <option value="">{lang === "ar" ? "غير معين" : "Unassigned"}</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name ?? m.email}
                        </option>
                      ))}
                    </SelectField>
                  )}
                />
              )}
            </div>

            {/* Optional Absher fields */}
            <details className="group">
              <summary className="cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2 py-1">
                {/* Disclosure caret (rotates to open), not a nav arrow — do not wrap in DirectionalIcon */}
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                {lang === "ar" ? "بيانات إضافية (أبشر)" : "Additional Details (Absher)"}
              </summary>
              <div className="pt-3 grid grid-cols-2 gap-4">
                <Controller
                  name="nationalId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      label={lang === "ar" ? "رقم الهوية" : "National ID"}
                      error={fieldState.error?.message}
                    >
                      {() => (
                        <NationalIdInput
                          value={field.value ?? ""}
                          onChange={(raw) => field.onChange(raw)}
                          placeholder="10x xxx xxxx"
                        />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="personType"
                  control={control}
                  render={({ field }) => (
                    <SelectField
                      label={lang === "ar" ? "نوع الشخص" : "Person Type"}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    >
                      <option value="">—</option>
                      <option value="INDIVIDUAL">{lang === "ar" ? "فرد" : "Individual"}</option>
                      <option value="COMPANY">{lang === "ar" ? "شركة" : "Company"}</option>
                    </SelectField>
                  )}
                />
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <SelectField
                      label={lang === "ar" ? "الجنس" : "Gender"}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    >
                      <option value="">—</option>
                      <option value="MALE">{lang === "ar" ? "ذكر" : "Male"}</option>
                      <option value="FEMALE">{lang === "ar" ? "أنثى" : "Female"}</option>
                    </SelectField>
                  )}
                />
                <Controller
                  name="nationality"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      label={lang === "ar" ? "الجنسية" : "Nationality"}
                      error={fieldState.error?.message}
                    >
                      {(f) => (
                        <Input
                          {...f}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder={lang === "ar" ? "سعودي" : "Saudi"}
                        />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="maritalStatus"
                  control={control}
                  render={({ field }) => (
                    <SelectField
                      label={lang === "ar" ? "الحالة الاجتماعية" : "Marital Status"}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    >
                      <option value="">—</option>
                      <option value="SINGLE">{lang === "ar" ? "أعزب" : "Single"}</option>
                      <option value="MARRIED">{lang === "ar" ? "متزوج" : "Married"}</option>
                      <option value="DIVORCED">{lang === "ar" ? "مطلق" : "Divorced"}</option>
                      <option value="WIDOWED">{lang === "ar" ? "أرمل" : "Widowed"}</option>
                    </SelectField>
                  )}
                />
                <Controller
                  name="dateOfBirth"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      label={lang === "ar" ? "تاريخ الميلاد" : "Date of Birth"}
                      error={fieldState.error?.message}
                    >
                      {(f) => (
                        <HijriDatePicker
                          id={f.id}
                          locale={lang}
                          value={field.value ? new Date(field.value) : null}
                          onChange={(d) => field.onChange(d ? d.toISOString().slice(0, 10) : "")}
                        />
                      )}
                    </Field>
                  )}
                />
              </div>
            </details>

            {/* ZATCA e-invoicing buyer party (R4 Track C — D18). A COMPANY with a complete
                VAT + CR + national address gets a cleared B2B tax invoice; otherwise simplified. */}
            <details className="group">
              <summary className="cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2 py-1">
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                {lang === "ar" ? "الفوترة الإلكترونية (زاتكا)" : "E-Invoicing (ZATCA)"}
              </summary>
              <div className="pt-3 grid grid-cols-2 gap-4">
                <Controller
                  name="customerKind"
                  control={control}
                  render={({ field }) => (
                    <SelectField
                      label={lang === "ar" ? "نوع المشتري" : "Buyer type"}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      wrapperClassName="col-span-2"
                    >
                      <option value="">—</option>
                      <option value="INDIVIDUAL">{lang === "ar" ? "فرد" : "Individual"}</option>
                      <option value="COMPANY">{lang === "ar" ? "منشأة" : "Company"}</option>
                    </SelectField>
                  )}
                />
                {customerKind === "COMPANY" && (
                  <>
                    <Controller
                      name="vatNumber"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field label={lang === "ar" ? "الرقم الضريبي" : "VAT number"} error={fieldState.error?.message}>
                          {(f) => (
                            <Input
                              {...f}
                              dir="ltr"
                              inputMode="numeric"
                              maxLength={15}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 15))}
                              onBlur={field.onBlur}
                              placeholder="3XXXXXXXXXXXXX3"
                              className="font-mono tabular-nums"
                            />
                          )}
                        </Field>
                      )}
                    />
                    <Controller
                      name="crNumber"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field label={lang === "ar" ? "السجل التجاري" : "CR number"} error={fieldState.error?.message}>
                          {(f) => (
                            <Input
                              {...f}
                              dir="ltr"
                              inputMode="numeric"
                              maxLength={10}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
                              onBlur={field.onBlur}
                              placeholder="1010XXXXXX"
                              className="font-mono tabular-nums"
                            />
                          )}
                        </Field>
                      )}
                    />
                    <Controller
                      name="companyNameEn"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field label={lang === "ar" ? "اسم المنشأة (إنجليزي)" : "Company name (English)"} error={fieldState.error?.message}>
                          {(f) => (
                            <Input {...f} dir="ltr" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} placeholder="Company Co." />
                          )}
                        </Field>
                      )}
                    />
                    <Controller
                      name="companyNameAr"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Field label={lang === "ar" ? "اسم المنشأة (عربي)" : "Company name (Arabic)"} error={fieldState.error?.message}>
                          {(f) => (
                            <Input {...f} dir="rtl" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} placeholder="شركة" />
                          )}
                        </Field>
                      )}
                    />
                    <Controller
                      name="address"
                      control={control}
                      render={({ field }) => (
                        <div className="col-span-2 space-y-1.5">
                          <label className="block text-xs font-semibold text-foreground">
                            {lang === "ar" ? "العنوان الوطني" : "National address"}
                          </label>
                          <AddressPicker
                            value={(field.value as SaudiAddress | undefined) ?? undefined}
                            onChange={field.onChange}
                            locale={lang}
                            showDistrict
                          />
                        </div>
                      )}
                    />
                    <p className="col-span-2 text-[11px] text-muted-foreground">
                      {lang === "ar"
                        ? "أكمل الرقم الضريبي والسجل التجاري والعنوان الوطني لإصدار فاتورة ضريبية معتمدة؛ وإلا تُصدر فاتورة مبسطة."
                        : "Complete the VAT, CR and national address for a cleared tax invoice; otherwise a simplified invoice is issued."}
                    </p>
                  </>
                )}
              </div>
            </details>

            {/* Inline error */}
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-6">
            <Button
              type="button"
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={onClose}
              disabled={submitting}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              form="add-customer-form"
              disabled={submitting}
              style={{ display: "inline-flex" }}
              className="gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ar" ? "حفظ جهة الاتصال" : "Save Contact"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
