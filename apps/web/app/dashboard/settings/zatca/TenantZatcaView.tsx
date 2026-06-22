"use client";

import * as React from "react";
import {
  ArrowLeft,
  GitBranch,
  MapPin,
  Pencil,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AddressPicker,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  DirectionalIcon,
  EmptyState,
  IconButton,
  Input,
  ResponsiveDialog,
  SelectField,
  Switch,
  type ColumnDef,
} from "@repo/ui";
import { PageHeader } from "@repo/ui/components/PageHeader";
import { useLanguage } from "../../../../components/LanguageProvider";
import {
  ZATCA_EGS_STATUS_LABEL,
  ZATCA_EGS_STATUS_VARIANT,
  ZATCA_CLEARANCE_OUTCOME_LABEL,
  ZATCA_CLEARANCE_OUTCOME_VARIANT,
  VAT_CATEGORY_LABEL,
  ZATCA_CHARGE_TYPE_LABEL,
  UNIT_TYPE_LABEL,
} from "../../../../lib/domain-labels";
import type { getTenantEgsSummary } from "../../../actions/zatca/tenant-onboarding";
import type { getTenantTaxConfig, getTenantBranches } from "../../../actions/zatca/tenant-config";
import { onboardTenantEgs } from "../../../actions/zatca/tenant-onboarding";
import {
  createTenantBranch,
  updateTenantBranch,
  deleteTenantBranch,
  saveTenantTaxConfig,
} from "../../../actions/zatca/tenant-config";
import { createSupportTicket } from "../../../actions/support-tickets";
import type { SaudiAddress } from "@repo/ui";

// ─── Prop types (derived from server action return types) ─────────────────────

type Summary = Awaited<ReturnType<typeof getTenantEgsSummary>>;
type TaxConfig = Awaited<ReturnType<typeof getTenantTaxConfig>>;
type BranchesList = Awaited<ReturnType<typeof getTenantBranches>>;

type ClearanceLog = Summary["logs"][number];
type TaxRow = TaxConfig["configs"][number];
type Branch = BranchesList[number];

interface TenantZatcaViewProps {
  summary: Summary;
  taxConfig: TaxConfig;
  branches: BranchesList;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(value: string | Date | null | undefined, lang: "ar" | "en"): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | Date | null | undefined, lang: "ar" | "en"): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "—";
  const a = addr as Record<string, unknown>;
  const parts = [a.buildingNumber, a.streetName, a.district, a.city, a.postalCode]
    .filter((v) => typeof v === "string" && v.trim())
    .map(String);
  return parts.length > 0 ? parts.join(", ") : "—";
}

// ─── Branch form dialog ───────────────────────────────────────────────────────

interface BranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Branch | null;
  onSave: (data: {
    name: string;
    nameEn: string;
    locationCode: string;
    locationAddress: SaudiAddress | null;
  }) => void;
  isPending: boolean;
  lang: "ar" | "en";
  t: (ar: string, en: string) => string;
}

function BranchDialog({ open, onOpenChange, initial, onSave, isPending, lang, t }: BranchDialogProps) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [nameEn, setNameEn] = React.useState(initial?.nameEn ?? "");
  const [locationCode, setLocationCode] = React.useState(initial?.locationCode ?? "");
  const [address, setAddress] = React.useState<SaudiAddress | null>(
    (initial?.locationAddress as SaudiAddress | null) ?? null,
  );
  const [nameError, setNameError] = React.useState(false);

  // Reset when the dialog opens / changes target — pre-populate from `initial`
  // (including the stored address, so editing a branch doesn't wipe its location).
  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setNameEn(initial?.nameEn ?? "");
      setLocationCode(initial?.locationCode ?? "");
      setAddress((initial?.locationAddress as SaudiAddress | null) ?? null);
      setNameError(false);
    }
  }, [open, initial]);

  const handleSave = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    onSave({ name: name.trim(), nameEn: nameEn.trim(), locationCode: locationCode.trim(), locationAddress: address });
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? t("تعديل الفرع", "Edit Branch") : t("إضافة فرع", "Add Branch")}
      description={t(
        "بيانات الفرع الخاصة بك ضمن نظام فاتورة.",
        "Branch metadata under the Fatoora e-invoicing system.",
      )}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} style={{ display: "inline-flex" }}>
            {t("إلغاء", "Cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isPending} style={{ display: "inline-flex" }}>
            {isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ", "Save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <label htmlFor="branch-name-ar" className="block text-xs font-semibold text-foreground">
            {t("اسم الفرع (عربي) *", "Branch name (Arabic) *")}
          </label>
          <Input
            id="branch-name-ar"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(false); }}
            dir="rtl"
            aria-invalid={nameError}
            placeholder={t("الفرع الرئيسي", "Main Branch")}
          />
          {nameError && (
            <p className="text-xs text-destructive">{t("اسم الفرع مطلوب.", "Branch name is required.")}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="branch-name-en" className="block text-xs font-semibold text-foreground">
            {t("اسم الفرع (إنجليزي)", "Branch name (English)")}
          </label>
          <Input id="branch-name-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" placeholder="Main Branch" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="branch-location-code" className="block text-xs font-semibold text-foreground">
            {t("رمز الموقع", "Location code")}
          </label>
          <Input
            id="branch-location-code"
            value={locationCode}
            onChange={(e) => setLocationCode(e.target.value)}
            dir="ltr"
            placeholder="BR-001"
            className="font-mono"
          />
          <p className="text-[11px] text-muted-foreground">{t("اختياري — معرّف داخلي للفرع.", "Optional — internal branch identifier.")}</p>
        </div>
        {/* AddressPicker is a compound control with its own internal field labels,
            so this is a section heading (not a <label>) — avoids an orphan label. */}
        <fieldset className="space-y-1.5">
          <legend className="block text-xs font-semibold text-foreground">{t("موقع الفرع", "Branch location")}</legend>
          <AddressPicker value={address ?? undefined} onChange={setAddress} locale={lang} showDistrict />
        </fieldset>
      </div>
    </ResponsiveDialog>
  );
}

// ─── Reset-request dialog ──────────────────────────────────────────────────────

interface ResetRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  t: (ar: string, en: string) => string;
}

function ResetRequestDialog({ open, onOpenChange, onConfirm, isPending, t }: ResetRequestDialogProps) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("طلب إعادة الربط", "Request ZATCA reset")}
      description={t(
        "سيُرسل طلب دعم لمعمارك لإعادة ضبط شهادة زاتكا.",
        "A support request will be sent to Mimarek to reset your ZATCA certificate.",
      )}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} style={{ display: "inline-flex" }}>
            {t("إلغاء", "Cancel")}
          </Button>
          <Button variant="secondary" onClick={onConfirm} disabled={isPending} style={{ display: "inline-flex" }}>
            {isPending ? t("جارٍ الإرسال…", "Sending…") : t("إرسال الطلب", "Send request")}
          </Button>
        </div>
      }
    >
      <p className="py-2 text-sm text-muted-foreground">
        {t(
          "سيتواصل فريق دعم معمارك معك خلال يوم عمل لإتمام إعادة الضبط.",
          "Mimarek support will reach out within one business day to complete the reset.",
        )}
      </p>
    </ResponsiveDialog>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function TenantZatcaView({ summary, taxConfig, branches }: TenantZatcaViewProps) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  // Separate transitions so an in-flight onboard doesn't disable the branch/tax
  // controls (and vice versa). Reset-request shares the onboard transition.
  const [onboardPending, startOnboard] = React.useTransition();
  const [branchPending, startBranch] = React.useTransition();
  const [taxPending, startTax] = React.useTransition();

  const { egs, org, logs } = summary;
  const isActive = egs != null && egs.status === "ACTIVE";

  // ── Onboard form state ─────────────────────────────────────────────────────
  const [vatNumber, setVatNumber] = React.useState((org?.vatNumber ?? "").toString());
  const [otp, setOtp] = React.useState("123456");
  const [formError, setFormError] = React.useState<string | null>(null);
  const vatValid = /^\d{15}$/.test(vatNumber);

  const onOnboardSubmit = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError(null);
      if (!vatValid) {
        setFormError(t("رقم ضريبة القيمة المضافة يجب أن يتكوّن من 15 رقمًا.", "The VAT number must be exactly 15 digits."));
        return;
      }
      startOnboard(async () => {
        try {
          await onboardTenantEgs({ vatNumber: vatNumber.trim(), otp: otp.trim() || undefined });
          toast.success(t("تم الربط بنجاح.", "Connected to ZATCA successfully."));
          router.refresh();
        } catch (err) {
          const message = err instanceof Error ? err.message : t("تعذّر الربط. حاول مرة أخرى.", "Connection failed. Please try again.");
          setFormError(message);
          toast.error(message);
        }
      });
    },
    [vatNumber, otp, vatValid, t, router],
  );

  // ── Reset-request dialog ───────────────────────────────────────────────────
  const [resetOpen, setResetOpen] = React.useState(false);

  const onRequestReset = React.useCallback(() => {
    startOnboard(async () => {
      try {
        await createSupportTicket({
          subject: t("طلب إعادة ضبط شهادة زاتكا", "ZATCA EGS reset request"),
          description: t(
            "تطلب المؤسسة إعادة ضبط شهادة زاتكا (EGS) لإتمام إعادة التهيئة.",
            "The organization requests a ZATCA EGS certificate reset in order to re-onboard.",
          ),
          category: "TECHNICAL_SUPPORT",
        });
        setResetOpen(false);
        toast.success(t("تم إرسال طلبك. سيتواصل فريق الدعم معك قريبًا.", "Your request has been sent. Support will contact you soon."));
      } catch (err) {
        const message = err instanceof Error ? err.message : t("تعذّر إرسال الطلب. حاول مرة أخرى.", "Failed to send the request. Please try again.");
        toast.error(message);
      }
    });
  }, [t]);

  // ── Branch dialog state ────────────────────────────────────────────────────
  const [branchDialogOpen, setBranchDialogOpen] = React.useState(false);
  const [editingBranch, setEditingBranch] = React.useState<Branch | null>(null);
  const [deletingBranchId, setDeletingBranchId] = React.useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);

  const openAddBranch = () => { setEditingBranch(null); setBranchDialogOpen(true); };
  const openEditBranch = (b: Branch) => { setEditingBranch(b); setBranchDialogOpen(true); };

  const onBranchSave = React.useCallback(
    (data: { name: string; nameEn: string; locationCode: string; locationAddress: SaudiAddress | null }) => {
      startBranch(async () => {
        try {
          const input = {
            name: data.name,
            nameEn: data.nameEn || undefined,
            locationCode: data.locationCode || undefined,
            locationAddress: data.locationAddress as Record<string, unknown> | null,
          };
          if (editingBranch) {
            await updateTenantBranch(editingBranch.id, input);
            toast.success(t("تم تعديل الفرع.", "Branch updated."));
          } else {
            await createTenantBranch(input);
            toast.success(t("تم إضافة الفرع.", "Branch added."));
          }
          setBranchDialogOpen(false);
          router.refresh();
        } catch (err) {
          const message = err instanceof Error ? err.message : t("تعذّر حفظ الفرع.", "Failed to save branch.");
          toast.error(message);
        }
      });
    },
    [editingBranch, t, router],
  );

  const onBranchDelete = React.useCallback((id: string) => {
    setDeletingBranchId(id);
    setDeleteConfirmOpen(true);
  }, []);

  const onBranchDeleteConfirm = React.useCallback(() => {
    if (!deletingBranchId) return;
    startBranch(async () => {
      try {
        await deleteTenantBranch(deletingBranchId);
        toast.success(t("تم حذف الفرع.", "Branch deleted."));
        setDeleteConfirmOpen(false);
        setDeletingBranchId(null);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : t("تعذّر حذف الفرع.", "Failed to delete branch.");
        toast.error(message);
      }
    });
  }, [deletingBranchId, t, router]);

  // ── Tax mapping state ──────────────────────────────────────────────────────
  const [taxRows, setTaxRows] = React.useState<TaxRow[]>(taxConfig.configs);

  const onSaveTaxConfig = React.useCallback(() => {
    startTax(async () => {
      try {
        await saveTenantTaxConfig(
          taxRows.map((r) => ({
            unitType: r.unitType,
            chargeType: r.chargeType,
            vatCategory: r.vatCategory,
            vatRate: r.vatRate,
            eInvoiceEnabled: r.eInvoiceEnabled,
          })),
        );
        toast.success(t("تم حفظ إعدادات الضريبة.", "Tax mapping saved."));
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : t("تعذّر حفظ الإعدادات.", "Failed to save settings.");
        toast.error(message);
      }
    });
  }, [taxRows, t, router]);

  // ── Branch table columns ───────────────────────────────────────────────────
  const branchColumns = React.useMemo<ColumnDef<Branch>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("الاسم", "Name"),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {lang === "ar" ? row.original.name : (row.original.nameEn || row.original.name)}
            {row.original.nameEn && lang === "ar" && (
              <span className="ms-2 text-xs text-muted-foreground" dir="ltr">{row.original.nameEn}</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "locationCode",
        header: t("الرمز", "Code"),
        enableSorting: false,
        cell: ({ row }) => (
          <span dir="ltr" className="font-mono text-xs text-muted-foreground">{row.original.locationCode ?? "—"}</span>
        ),
      },
      {
        accessorKey: "isActive",
        header: t("الحالة", "Status"),
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "success" : "default"} size="sm">
            {row.original.isActive ? t("نشط", "Active") : t("غير نشط", "Inactive")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton icon={Pencil} aria-label={t("تعديل", "Edit")} variant="ghost" onClick={() => openEditBranch(row.original)} />
            <IconButton icon={Trash2} aria-label={t("حذف", "Delete")} variant="ghost" className="text-destructive" onClick={() => onBranchDelete(row.original.id)} />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is derived from `lang`
    [lang],
  );

  // ── Clearance log table columns ────────────────────────────────────────────
  const logColumns = React.useMemo<ColumnDef<ClearanceLog>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: t("التاريخ", "Date"),
        enableSorting: true,
        enableHiding: false,
        cell: ({ row }) => <span className="text-muted-foreground text-xs">{formatDateTime(row.original.createdAt, lang)}</span>,
      },
      {
        accessorKey: "outcome",
        header: t("النتيجة", "Outcome"),
        enableSorting: true,
        cell: ({ row }) => {
          const label = ZATCA_CLEARANCE_OUTCOME_LABEL[row.original.outcome];
          const variant = ZATCA_CLEARANCE_OUTCOME_VARIANT[row.original.outcome] ?? "default";
          return <Badge variant={variant} size="sm">{label ? t(label.ar, label.en) : row.original.outcome}</Badge>;
        },
      },
      {
        accessorKey: "icv",
        header: t("العدّاد", "ICV"),
        enableSorting: true,
        meta: { numeric: true },
        cell: ({ row }) => (
          <span dir="ltr" className="font-mono text-xs tabular-nums text-foreground">{row.original.icv ?? "—"}</span>
        ),
      },
      {
        id: "zatcaCodes",
        header: t("رموز زاتكا", "ZATCA codes"),
        enableSorting: false,
        cell: ({ row }) => {
          const codes = row.original.zatcaCodes ?? [];
          return <span dir="ltr" className="font-mono text-xs text-muted-foreground">{codes.length > 0 ? codes.join(", ") : "—"}</span>;
        },
      },
      {
        accessorKey: "message",
        header: t("الرسالة", "Message"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[280px] truncate text-xs text-muted-foreground" title={row.original.message ?? undefined}>
            {row.original.message ?? "—"}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is derived from `lang`
    [lang],
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Back link */}
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <DirectionalIcon icon={ArrowLeft} className="h-4 w-4" />
        {t("الإعدادات", "Settings")}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <ReceiptText className="h-7 w-7" />
        </div>
        <PageHeader
          className="flex-1"
          title={t("الربط بنظام فاتورة الضريبي", "ZATCA E-Invoicing")}
          description={t(
            "اربط مؤسستك بنظام الفوترة الإلكترونية (فاتورة) من زاتكا",
            "Connect your organization to ZATCA Phase-2 e-invoicing (Fatoora)",
          )}
        />
      </div>

      {/* ─── EGS connection card ─────────────────────────────────────────── */}
      {isActive && egs ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
                {t("جهاز إصدار الفواتير", "Electronic Generation Solution")}
              </CardTitle>
              {(() => {
                const label = ZATCA_EGS_STATUS_LABEL[egs.status];
                const variant = ZATCA_EGS_STATUS_VARIANT[egs.status] ?? "default";
                return <Badge variant={variant} size="sm">{label ? t(label.ar, label.en) : egs.status}</Badge>;
              })()}
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t("رقم ضريبة القيمة المضافة", "VAT number")}</dt>
                <dd dir="ltr" className="mt-0.5 font-mono text-sm tabular-nums text-foreground">{egs.vatNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("الرقم التسلسلي", "Serial number")}</dt>
                <dd dir="ltr" className="mt-0.5 break-all font-mono text-xs text-foreground">{egs.egsSerialNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("البيئة", "Environment")}</dt>
                <dd className="mt-0.5 text-sm text-foreground">{egs.environment}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("آخر عدّاد فاتورة", "Last ICV")}</dt>
                <dd dir="ltr" className="mt-0.5 font-mono text-sm tabular-nums text-foreground">{egs.lastIcv ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("تاريخ التهيئة", "Onboarded")}</dt>
                <dd className="mt-0.5 text-sm text-foreground">{formatDate(egs.onboardedAt, lang)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("الاسم النظامي", "Legal name")}</dt>
                <dd className="mt-0.5 text-sm text-foreground">
                  {lang === "ar" ? egs.legalNameAr || egs.legalNameEn : egs.legalNameEn || egs.legalNameAr}
                </dd>
              </div>
              {egs.crNumber && (
                <div>
                  <dt className="text-xs text-muted-foreground">{t("السجل التجاري", "CR number")}</dt>
                  <dd dir="ltr" className="mt-0.5 font-mono text-sm tabular-nums text-foreground">{egs.crNumber}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {t(
                "ربط زاتكا مفعّل ومقفل. للتعديل تواصل مع الدعم.",
                "Your ZATCA connection is active and locked. Contact support to make changes.",
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-border pt-4">
              <Button variant="secondary" onClick={() => setResetOpen(true)} disabled={onboardPending} style={{ display: "inline-flex" }} className="gap-2">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t("طلب إعادة الربط", "Request reset")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t("ربط مؤسستك بزاتكا", "Connect your organization to ZATCA")}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Read-only org identity block */}
            {org && (
              <div className="mb-6 rounded-md border border-border bg-muted/40 p-4">
                <p className="mb-3 text-xs font-semibold text-foreground">{t("بيانات المنشأة (من إعدادات المؤسسة)", "Organization identity (from settings)")}</p>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
                  {(org.nameArabic || org.nameEnglish || org.name) && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{t("الاسم النظامي", "Legal name")}</dt>
                      <dd className="text-foreground">
                        {lang === "ar" ? org.nameArabic || org.nameEnglish || org.name : org.nameEnglish || org.nameArabic || org.name}
                      </dd>
                    </div>
                  )}
                  {org.crNumber && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{t("السجل التجاري", "CR")}</dt>
                      <dd dir="ltr" className="font-mono tabular-nums text-foreground">{String(org.crNumber)}</dd>
                    </div>
                  )}
                  {org.nationalAddress && (
                    <div className="flex justify-between gap-2 sm:col-span-2">
                      <dt className="shrink-0 text-muted-foreground">{t("العنوان الوطني", "National address")}</dt>
                      <dd dir="ltr" className="text-end text-foreground">{formatAddress(org.nationalAddress)}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {t(
                    "تُؤخذ بيانات المنشأة من إعدادات المؤسسة — أدخل رقم ضريبة القيمة المضافة فقط.",
                    "Your company details come from organization settings — enter only your VAT number.",
                  )}
                </p>
              </div>
            )}

            {/* Onboard form */}
            <form onSubmit={onOnboardSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="tenant-zatca-vat" className="block text-xs font-semibold text-foreground">{t("رقم ضريبة القيمة المضافة *", "VAT number *")}</label>
                  <Input
                    id="tenant-zatca-vat"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={15}
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value.replace(/\D/g, "").slice(0, 15))}
                    aria-invalid={vatNumber.length > 0 && !vatValid}
                    className="font-mono tabular-nums"
                    placeholder="300000000000003"
                  />
                  <p className="text-[11px] text-muted-foreground">{t("15 رقمًا.", "15 digits.")}</p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="tenant-zatca-otp" className="block text-xs font-semibold text-foreground">{t("رمز التحقق (اختياري)", "OTP (optional)")}</label>
                  <Input
                    id="tenant-zatca-otp"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="font-mono tabular-nums"
                    placeholder="123456"
                  />
                  <p className="text-[11px] text-muted-foreground">{t("البيئة التجريبية لا تتحقق من الرمز.", "Sandbox does not validate the OTP.")}</p>
                </div>
              </div>

              {formError && (
                <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">{formError}</p>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={onboardPending || !vatValid} style={{ display: "inline-flex" }} className="gap-2">
                  {onboardPending ? t("جارٍ الربط…", "Connecting…") : t("ربط مع زاتكا", "Connect to ZATCA")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── Branches card (D15) ─────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("الفروع", "Branches")}</h2>
          {isActive && (
            <Button size="sm" onClick={openAddBranch} disabled={branchPending} style={{ display: "inline-flex" }} className="gap-2">
              <GitBranch className="h-4 w-4" aria-hidden="true" />
              {t("إضافة فرع", "Add branch")}
            </Button>
          )}
        </div>

        <Card className="overflow-hidden">
          {!isActive ? (
            <div className="p-6">
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{t("اربط مؤسستك بزاتكا أولاً لإضافة الفروع.", "Connect to ZATCA first to add branches.")}</span>
              </div>
            </div>
          ) : branches.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<GitBranch className="h-12 w-12" aria-hidden="true" />}
                title={t("لا توجد فروع بعد", "No branches yet")}
                description={t("أضف فروع مؤسستك لتتبع فواتير كل موقع بشكل منفصل.", "Add your organization branches to track invoices per location.")}
                action={
                  <Button onClick={openAddBranch} style={{ display: "inline-flex" }}>{t("إضافة فرع", "Add branch")}</Button>
                }
              />
            </div>
          ) : (
            <DataTable
              columns={branchColumns}
              data={branches}
              locale={lang === "ar" ? "ar" : "en"}
              pagination
              pageSize={10}
              getRowId={(r) => r.id}
              emptyTitle={t("لا توجد فروع", "No branches")}
              emptyDescription={t("لم يتم إضافة أي فروع بعد.", "No branches have been added yet.")}
            />
          )}
        </Card>
      </section>

      {/* ─── Tax mapping card (D16) ──────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("إعداد الضريبة", "Tax mapping")}</h2>
        <Card>
          <CardContent className="pt-6">
            {taxConfig.isDefault && (
              <div className="mb-4 rounded-md border border-info bg-info/10 px-3 py-2 text-xs text-info-strong">
                {t("هذه قيم مقترحة — راجعها ثم احفظها.", "These are recommended defaults — review and save them.")}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 text-start font-medium">{t("نوع الوحدة", "Unit type")}</th>
                    <th className="pb-2 text-start font-medium">{t("نوع الرسوم", "Charge type")}</th>
                    <th className="pb-2 text-start font-medium">{t("فئة الضريبة", "VAT category")}</th>
                    <th className="pb-2 text-start font-medium">{t("النسبة", "Rate")}</th>
                    <th className="pb-2 text-center font-medium">{t("فاتورة إلكترونية", "E-invoice")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {taxRows.map((row, idx) => {
                    const unitLabel = row.unitType ? UNIT_TYPE_LABEL[row.unitType] : null;
                    const chargeLabel = row.chargeType ? ZATCA_CHARGE_TYPE_LABEL[row.chargeType] : null;
                    return (
                      <tr key={`${row.unitType ?? "null"}-${row.chargeType ?? "null"}-${idx}`} className="hover:bg-muted/20">
                        <td className="py-2.5 pe-4 text-foreground">{unitLabel ? t(unitLabel.ar, unitLabel.en) : t("جميع الأنواع", "All unit types")}</td>
                        <td className="py-2.5 pe-4 text-foreground">{chargeLabel ? t(chargeLabel.ar, chargeLabel.en) : "—"}</td>
                        <td className="py-2.5 pe-4">
                          <SelectField
                            className="h-8 w-auto min-w-[150px] text-xs"
                            value={row.vatCategory}
                            onChange={(e) => {
                              const next = [...taxRows];
                              next[idx] = { ...row, vatCategory: e.target.value as TaxRow["vatCategory"] };
                              setTaxRows(next);
                            }}
                            aria-label={t("فئة الضريبة", "VAT category")}
                          >
                            {(["STANDARD", "ZERO", "EXEMPT", "OUT_OF_SCOPE"] as const).map((cat) => {
                              const lbl = VAT_CATEGORY_LABEL[cat];
                              return <option key={cat} value={cat}>{lbl ? t(lbl.ar, lbl.en) : cat}</option>;
                            })}
                          </SelectField>
                        </td>
                        <td className="py-2.5 pe-4" dir="ltr">
                          <Input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={row.vatRate ?? ""}
                            onChange={(e) => {
                              const next = [...taxRows];
                              const raw = e.target.value;
                              next[idx] = { ...row, vatRate: raw === "" ? null : parseFloat(raw) };
                              setTaxRows(next);
                            }}
                            className="w-20 font-mono tabular-nums"
                            placeholder="0.15"
                            aria-label={t("نسبة الضريبة", "VAT rate")}
                          />
                        </td>
                        <td className="py-2.5 text-center">
                          <Switch
                            checked={row.eInvoiceEnabled}
                            onCheckedChange={(checked) => {
                              const next = [...taxRows];
                              next[idx] = { ...row, eInvoiceEnabled: checked };
                              setTaxRows(next);
                            }}
                            aria-label={t("تفعيل الفاتورة الإلكترونية", "Enable e-invoice")}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end border-t border-border pt-4">
              <Button onClick={onSaveTaxConfig} disabled={taxPending} style={{ display: "inline-flex" }}>
                {taxPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ إعداد الضريبة", "Save tax mapping")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ─── Clearance log ───────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("سجل الاعتماد", "Clearance log")}</h2>
        <Card className="overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ReceiptText className="h-12 w-12" aria-hidden="true" />}
                title={t("لا توجد محاولات اعتماد بعد", "No clearance attempts yet")}
                description={t(
                  "ستظهر هنا كل محاولة اعتماد لفاتورة بمجرد إرسالها إلى هيئة الزكاة والضريبة والجمارك.",
                  "Every invoice clearance attempt appears here once sent to ZATCA.",
                )}
              />
            </div>
          ) : (
            <DataTable
              columns={logColumns}
              data={logs}
              locale={lang === "ar" ? "ar" : "en"}
              pagination
              pageSize={10}
              getRowId={(r) => r.id}
              emptyTitle={t("لا توجد محاولات اعتماد بعد", "No clearance attempts yet")}
              emptyDescription={t("ستظهر هنا كل محاولة اعتماد.", "Every clearance attempt appears here.")}
            />
          )}
        </Card>
      </section>

      {/* ─── Dialogs ─────────────────────────────────────────────────────── */}
      <BranchDialog
        open={branchDialogOpen}
        onOpenChange={setBranchDialogOpen}
        initial={editingBranch}
        onSave={onBranchSave}
        isPending={branchPending}
        lang={lang}
        t={t}
      />

      <ResponsiveDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t("حذف الفرع", "Delete branch")}
        description={t("سيتم حذف الفرع نهائيًا. هذا الإجراء لا يمكن التراجع عنه.", "The branch will be permanently deleted. This action cannot be undone.")}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={branchPending} style={{ display: "inline-flex" }}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button variant="destructive" onClick={onBranchDeleteConfirm} disabled={branchPending} style={{ display: "inline-flex" }} className="gap-2">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {branchPending ? t("جارٍ الحذف…", "Deleting…") : t("حذف", "Delete")}
            </Button>
          </div>
        }
      >
        <p className="py-2 text-sm text-muted-foreground">{t("لا يمكن التراجع عن هذا الإجراء.", "This action cannot be undone.")}</p>
      </ResponsiveDialog>

      <ResetRequestDialog open={resetOpen} onOpenChange={setResetOpen} onConfirm={onRequestReset} isPending={onboardPending} t={t} />
    </div>
  );
}
