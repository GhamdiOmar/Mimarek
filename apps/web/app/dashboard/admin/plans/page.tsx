"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import * as React from "react";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Save,
  CircleDollarSign,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button, Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, ResponsiveDialog, DirectionalIcon } from "@repo/ui";
import Link from "next/link";
import { adminGetAllPlans, adminUpsertPlan } from "../../../actions/billing";

// ─── Types ──────────────────────────────────────────────────────────────────

type PlanEntitlement = {
  id: string;
  planId: string;
  featureKey: string;
  type: "BOOLEAN" | "LIMIT" | "METERED";
  value: string;
};

type Plan = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  priceMonthly: number | string;
  priceAnnual: number | string;
  trialDays: number;
  isPublic: boolean;
  isDefault: boolean;
  sortOrder: number;
  features: unknown;
  entitlements: PlanEntitlement[];
  createdAt: string;
  updatedAt: string;
};

type FormData = {
  id?: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  priceMonthly: string;
  priceAnnual: string;
  trialDays: string;
  isPublic: boolean;
  sortOrder: string;
};

const emptyForm: FormData = {
  slug: "",
  nameEn: "",
  nameAr: "",
  descriptionEn: "",
  descriptionAr: "",
  priceMonthly: "0",
  priceAnnual: "0",
  trialDays: "14",
  isPublic: true,
  sortOrder: "0",
};

// ─── Translations ───────────────────────────────────────────────────────────

const translations = {
  ar: {
    backToAdmin: "العودة للوحة الإدارة",
    title: "إدارة الخطط",
    subtitle: "إنشاء وتعديل خطط الاشتراك والأسعار",
    addPlan: "إضافة خطة جديدة",
    planName: "اسم الخطة",
    slug: "المعرّف (Slug)",
    monthlyPrice: "السعر الشهري",
    annualPrice: "السعر السنوي",
    trialDays: "أيام التجربة",
    status: "الحالة",
    actions: "إجراءات",
    public: "منشورة",
    draft: "مسودة",
    edit: "تعديل",
    editPlan: "تعديل الخطة",
    createPlan: "إنشاء خطة جديدة",
    nameEn: "الاسم (إنجليزي)",
    nameAr: "الاسم (عربي)",
    descriptionEn: "الوصف (إنجليزي)",
    descriptionAr: "الوصف (عربي)",
    isPublic: "منشورة للعملاء",
    sortOrder: "ترتيب العرض",
    save: "حفظ",
    cancel: "إلغاء",
    saving: "جاري الحفظ...",
    loading: "جاري التحميل...",
    noPlans: "لا توجد خطط بعد",
    noPlansDesc: "ابدأ بإنشاء أول خطة اشتراك",
    sar: "ر.س",
    saveSuccess: "تم حفظ الخطة بنجاح",
    saveError: "حدث خطأ أثناء حفظ الخطة",
    requiredField: "هذا الحقل مطلوب",
    default: "افتراضية",
  },
  en: {
    backToAdmin: "Back to Admin",
    title: "Plan Management",
    subtitle: "Create and manage subscription plans and pricing",
    addPlan: "Add New Plan",
    planName: "Plan Name",
    slug: "Slug",
    monthlyPrice: "Monthly Price",
    annualPrice: "Annual Price",
    trialDays: "Trial Days",
    status: "Status",
    actions: "Actions",
    public: "Public",
    draft: "Draft",
    edit: "Edit",
    editPlan: "Edit Plan",
    createPlan: "Create New Plan",
    nameEn: "Name (English)",
    nameAr: "Name (Arabic)",
    descriptionEn: "Description (English)",
    descriptionAr: "Description (Arabic)",
    isPublic: "Public to Customers",
    sortOrder: "Sort Order",
    save: "Save",
    cancel: "Cancel",
    saving: "Saving...",
    loading: "Loading...",
    noPlans: "No plans yet",
    noPlansDesc: "Start by creating your first subscription plan",
    sar: "SAR",
    saveSuccess: "Plan saved successfully",
    saveError: "Failed to save plan",
    requiredField: "This field is required",
    default: "Default",
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminPlansPage() {
  const { lang } = useLanguage();
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormData>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const t = translations[lang];

  // ── Load plans ────────────────────────────────────────────────────────
  const loadPlans = React.useCallback(async () => {
    try {
      const data = await adminGetAllPlans();
      setPlans(data);
    } catch (error) {
      console.error("Failed to load plans:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await adminGetAllPlans();
        if (active) setPlans(data);
      } catch (error) {
        if (active) console.error("Failed to load plans:", error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // ── Auto-dismiss feedback ─────────────────────────────────────────────
  React.useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // ── Helpers ───────────────────────────────────────────────────────────
  function formatPrice(value: number | string): string {
    const num = Number(value);
    if (isNaN(num)) return "0";
    return num.toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function openCreate() {
    setForm(emptyForm);
    setFeedback(null);
    setModalOpen(true);
  }

  function openEdit(plan: Plan) {
    setForm({
      id: plan.id,
      slug: plan.slug,
      nameEn: plan.nameEn,
      nameAr: plan.nameAr,
      descriptionEn: plan.descriptionEn ?? "",
      descriptionAr: plan.descriptionAr ?? "",
      priceMonthly: String(Number(plan.priceMonthly)),
      priceAnnual: String(Number(plan.priceAnnual)),
      trialDays: String(plan.trialDays),
      isPublic: plan.isPublic,
      sortOrder: String(plan.sortOrder),
    });
    setFeedback(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setForm(emptyForm);
  }

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    // Validate required fields
    if (!form.nameEn.trim() || !form.nameAr.trim() || !form.slug.trim()) {
      setFeedback({ type: "error", message: t.requiredField });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      await adminUpsertPlan({
        id: form.id || undefined,
        slug: form.slug.trim(),
        nameEn: form.nameEn.trim(),
        nameAr: form.nameAr.trim(),
        descriptionEn: form.descriptionEn.trim() || undefined,
        descriptionAr: form.descriptionAr.trim() || undefined,
        priceMonthly: parseFloat(form.priceMonthly) || 0,
        priceAnnual: parseFloat(form.priceAnnual) || 0,
        trialDays: parseInt(form.trialDays, 10) || 0,
        isPublic: form.isPublic,
        sortOrder: parseInt(form.sortOrder, 10) || 0,
      });

      setFeedback({ type: "success", message: t.saveSuccess });
      await loadPlans();

      // Close modal after a brief delay so user sees success
      setTimeout(() => {
        closeModal();
      }, 800);
    } catch (error: any) {
      console.error("Failed to save plan:", error);
      setFeedback({
        type: "error",
        message: error.message || t.saveError,
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Render: Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // ── Render: Page ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Back link */}
      <div>
        <Link
          href="/dashboard/admin"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4 transition-colors"
        >
          <DirectionalIcon icon={ArrowLeft} className="w-4 h-4" />
          {t.backToAdmin}
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={openCreate}
           
          >
            <Plus className="w-4 h-4" />
            <span className="ms-1.5">{t.addPlan}</span>
          </Button>
        </div>
      </div>

      {/* Feedback toast (page-level, shown after modal closes) */}
      {feedback && !modalOpen && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium border ${
            feedback.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Plans table */}
      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CircleDollarSign className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            {t.noPlans}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {t.noPlansDesc}
          </p>
          <Button
            variant="primary"
            onClick={openCreate}
           
          >
            <Plus className="w-4 h-4" />
            <span className="ms-1.5">{t.addPlan}</span>
          </Button>
        </div>
      ) : (
        <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t.planName}
                  </TableHead>
                  <TableHead>
                    {t.slug}
                  </TableHead>
                  <TableHead>
                    {t.monthlyPrice}
                  </TableHead>
                  <TableHead>
                    {t.annualPrice}
                  </TableHead>
                  <TableHead className="text-center">
                    {t.trialDays}
                  </TableHead>
                  <TableHead className="text-center">
                    {t.status}
                  </TableHead>
                  <TableHead className="text-center">
                    {t.actions}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow
                    key={plan.id}
                    className="group"
                  >
                    {/* Plan Name */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-foreground">
                          {plan.nameAr}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {plan.nameEn}
                        </span>
                      </div>
                      {plan.isDefault && (
                        <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          {t.default}
                        </span>
                      )}
                    </TableCell>

                    {/* Slug */}
                    <TableCell>
                      <code className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">
                        {plan.slug}
                      </code>
                    </TableCell>

                    {/* Monthly Price */}
                    <TableCell>
                      <span className="text-sm font-medium text-foreground">
                        {formatPrice(plan.priceMonthly)}
                      </span>
                      <span className="text-xs text-muted-foreground ms-1">
                        {t.sar}
                      </span>
                    </TableCell>

                    {/* Annual Price */}
                    <TableCell>
                      <span className="text-sm font-medium text-foreground">
                        {formatPrice(plan.priceAnnual)}
                      </span>
                      <span className="text-xs text-muted-foreground ms-1">
                        {t.sar}
                      </span>
                    </TableCell>

                    {/* Trial Days */}
                    <TableCell className="text-center">
                      <span className="text-sm text-foreground">
                        {plan.trialDays}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      {plan.isPublic ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          <Eye className="w-3.5 h-3.5" />
                          {t.public}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                          <EyeOff className="w-3.5 h-3.5" />
                          {t.draft}
                        </span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(plan)}

                      >
                        <Pencil className="w-4 h-4" />
                        <span className="ms-1">{t.edit}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </Card>
      )}

      {/* ── Plan Form Modal ──────────────────────────────────────────── */}
      <ResponsiveDialog
        open={modalOpen}
        onOpenChange={(open) => !open && closeModal()}
        title={form.id ? t.editPlan : t.createPlan}
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              size="md"
              onClick={closeModal}
              disabled={saving}
            >
              {t.cancel}
            </Button>
            <Button
              type="submit"
              form="plan-form"
              variant="primary"
              size="md"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  <span className="ms-2">{t.saving}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="ms-1.5">{t.save}</span>
                </>
              )}
            </Button>
          </div>
        }
      >
        <form
          id="plan-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-5"
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          {/* Feedback inside modal */}
          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium border ${
                feedback.type === "success"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              )}
              {feedback.message}
            </div>
          )}

          {/* Row: Name EN / Name AR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldGroup label={t.nameEn} required>
              <input
                type="text"
                value={form.nameEn}
                onChange={(e) => updateField("nameEn", e.target.value)}
                placeholder="e.g. Professional"
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                dir="ltr"
              />
            </FieldGroup>
            <FieldGroup label={t.nameAr} required>
              <input
                type="text"
                value={form.nameAr}
                onChange={(e) => updateField("nameAr", e.target.value)}
                placeholder="مثال: احترافية"
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                dir="rtl"
              />
            </FieldGroup>
          </div>

          {/* Slug */}
          <FieldGroup label={t.slug} required>
            <input
              type="text"
              value={form.slug}
              onChange={(e) =>
                updateField(
                  "slug",
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-+/g, "-")
                )
              }
              placeholder="e.g. professional"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono transition-colors"
              dir="ltr"
            />
          </FieldGroup>

          {/* Row: Description EN / Description AR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldGroup label={t.descriptionEn}>
              <textarea
                value={form.descriptionEn}
                onChange={(e) =>
                  updateField("descriptionEn", e.target.value)
                }
                rows={3}
                placeholder="Brief plan description..."
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-colors"
                dir="ltr"
              />
            </FieldGroup>
            <FieldGroup label={t.descriptionAr}>
              <textarea
                value={form.descriptionAr}
                onChange={(e) =>
                  updateField("descriptionAr", e.target.value)
                }
                rows={3}
                placeholder="وصف مختصر للخطة..."
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-colors"
                dir="rtl"
              />
            </FieldGroup>
          </div>

          {/* Row: Monthly / Annual Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldGroup label={`${t.monthlyPrice} (${t.sar})`}>
              <div className="relative">
                <CircleDollarSign className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.priceMonthly}
                  onChange={(e) =>
                    updateField("priceMonthly", e.target.value)
                  }
                  className="w-full ps-9 pe-3 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  dir="ltr"
                />
              </div>
            </FieldGroup>
            <FieldGroup label={`${t.annualPrice} (${t.sar})`}>
              <div className="relative">
                <CircleDollarSign className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.priceAnnual}
                  onChange={(e) =>
                    updateField("priceAnnual", e.target.value)
                  }
                  className="w-full ps-9 pe-3 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  dir="ltr"
                />
              </div>
            </FieldGroup>
          </div>

          {/* Row: Trial Days / Sort Order */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldGroup label={t.trialDays}>
              <input
                type="number"
                min="0"
                value={form.trialDays}
                onChange={(e) => updateField("trialDays", e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                dir="ltr"
              />
            </FieldGroup>
            <FieldGroup label={t.sortOrder}>
              <div className="relative">
                <ArrowUpDown className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) =>
                    updateField("sortOrder", e.target.value)
                  }
                  className="w-full ps-9 pe-3 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  dir="ltr"
                />
              </div>
            </FieldGroup>
          </div>

          {/* Is Public Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3">
              {form.isPublic ? (
                <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <EyeOff className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t.isPublic}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === "ar"
                    ? "سيتمكن العملاء من رؤية هذه الخطة واختيارها"
                    : "Customers will be able to see and select this plan"}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.isPublic}
              onClick={() => updateField("isPublic", !form.isPublic)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                form.isPublic
                  ? "bg-green-600 dark:bg-green-500"
                  : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  form.isPublic
                    ? lang === "ar"
                      ? "-translate-x-5"
                      : "translate-x-5"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </form>
      </ResponsiveDialog>
    </div>
  );
}

// ─── FieldGroup Component ───────────────────────────────────────────────────

function FieldGroup({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
