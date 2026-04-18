"use client";

import { useLanguage } from "../../../../components/LanguageProvider";
import { useSession } from "../../../../components/SimpleSessionProvider";
import { isSystemRole } from "../../../../lib/permissions";
import * as React from "react";
import {
  Tag,
  Plus,
  ArrowLeft,
  ArrowRight,
  Percent,
  CircleDollarSign,
  Calendar,
  X,
  CheckCircle2,
  AlertCircle,
  Ticket,
  Users,
  ListChecks,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  Button,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  AppBar,
  DataCard,
  EmptyState,
  FAB,
  Skeleton,
  Badge,
} from "@repo/ui";
import Link from "next/link";
import {
  adminGetCoupons,
  adminCreateCoupon,
  adminToggleCoupon,
} from "../../../actions/coupons";
import { getPlans } from "../../../actions/billing";

// ─── Types ───────────────────────────────────────────────────────────────────

type CouponPlan = {
  id: string;
  slug: string;
  nameEn: string;
};

type Coupon = {
  id: string;
  code: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number | string;
  maxRedemptions: number | null;
  currentUses: number;
  isActive: boolean;
  validFrom: string;
  validUntil: string | null;
  minPurchaseAmount: number | string | null;
  plans: CouponPlan[];
  _count: { redemptions: number };
};

type Plan = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
};

// ─── Translations ────────────────────────────────────────────────────────────

const t = {
  ar: {
    back: "إدارة المنصة",
    title: "إدارة الكوبونات",
    subtitle: "إنشاء وإدارة أكواد الخصم والعروض الترويجية",
    createCoupon: "إنشاء كوبون جديد",
    noCoupons: "لا توجد كوبونات حالياً",
    noCouponsDesc: "قم بإنشاء أول كوبون خصم للمنصة",
    code: "الكود",
    type: "النوع",
    value: "القيمة",
    status: "الحالة",
    redemptions: "الاستخدام",
    validUntil: "صالح حتى",
    plans: "الخطط",
    actions: "الإجراءات",
    active: "نشط",
    inactive: "غير نشط",
    percentage: "نسبة مئوية",
    fixedAmount: "مبلغ ثابت",
    allPlans: "جميع الخطط",
    noExpiry: "بلا انتهاء",
    unlimited: "غير محدود",
    // Modal
    modalTitle: "إنشاء كوبون جديد",
    couponCode: "كود الكوبون",
    couponCodePlaceholder: "مثال: WELCOME50",
    discountType: "نوع الخصم",
    discountValue: "قيمة الخصم",
    maxRedemptions: "الحد الأقصى للاستخدام",
    maxRedemptionsPlaceholder: "اتركه فارغاً لاستخدام غير محدود",
    validFrom: "تاريخ البداية",
    validUntilLabel: "تاريخ الانتهاء",
    validUntilPlaceholder: "اختياري",
    minPurchase: "الحد الأدنى للشراء (ر.س)",
    minPurchasePlaceholder: "اختياري",
    descEn: "الوصف (إنجليزي)",
    descAr: "الوصف (عربي)",
    planRestriction: "تقييد الخطط",
    planRestrictionHelp: "اتركه فارغاً للتطبيق على جميع الخطط",
    save: "حفظ الكوبون",
    saving: "جاري الحفظ...",
    cancel: "إلغاء",
    // Validation
    codeRequired: "كود الكوبون مطلوب",
    valueRequired: "قيمة الخصم مطلوبة",
    valuePercentRange: "النسبة يجب أن تكون بين 1 و 100",
    valuePositive: "القيمة يجب أن تكون أكبر من صفر",
    // Toast
    createSuccess: "تم إنشاء الكوبون بنجاح",
    createError: "فشل إنشاء الكوبون",
    toggleSuccess: "تم تحديث حالة الكوبون",
    toggleError: "فشل تحديث حالة الكوبون",
    sar: "ر.س",
  },
  en: {
    back: "Platform Administration",
    title: "Coupon Management",
    subtitle: "Create and manage discount codes and promotions",
    createCoupon: "Create New Coupon",
    noCoupons: "No coupons yet",
    noCouponsDesc: "Create your first discount coupon for the platform",
    code: "Code",
    type: "Type",
    value: "Value",
    status: "Status",
    redemptions: "Redemptions",
    validUntil: "Valid Until",
    plans: "Plans",
    actions: "Actions",
    active: "Active",
    inactive: "Inactive",
    percentage: "Percentage",
    fixedAmount: "Fixed Amount",
    allPlans: "All Plans",
    noExpiry: "No expiry",
    unlimited: "Unlimited",
    // Modal
    modalTitle: "Create New Coupon",
    couponCode: "Coupon Code",
    couponCodePlaceholder: "e.g. WELCOME50",
    discountType: "Discount Type",
    discountValue: "Discount Value",
    maxRedemptions: "Max Redemptions",
    maxRedemptionsPlaceholder: "Leave empty for unlimited",
    validFrom: "Valid From",
    validUntilLabel: "Valid Until",
    validUntilPlaceholder: "Optional",
    minPurchase: "Min Purchase Amount (SAR)",
    minPurchasePlaceholder: "Optional",
    descEn: "Description (English)",
    descAr: "Description (Arabic)",
    planRestriction: "Plan Restriction",
    planRestrictionHelp: "Leave empty to apply to all plans",
    save: "Save Coupon",
    saving: "Saving...",
    cancel: "Cancel",
    // Validation
    codeRequired: "Coupon code is required",
    valueRequired: "Discount value is required",
    valuePercentRange: "Percentage must be between 1 and 100",
    valuePositive: "Value must be greater than zero",
    // Toast
    createSuccess: "Coupon created successfully",
    createError: "Failed to create coupon",
    toggleSuccess: "Coupon status updated",
    toggleError: "Failed to update coupon status",
    sar: "SAR",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CouponManagementPage() {
  const { lang } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const authorized = isSystemRole(userRole);
  const [mobileSearch, setMobileSearch] = React.useState("");
  const [coupons, setCoupons] = React.useState<Coupon[]>([]);
  const [allPlans, setAllPlans] = React.useState<Plan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // Toast
  const [toast, setToast] = React.useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = React.useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    },
    []
  );

  // Form state
  const [formCode, setFormCode] = React.useState("");
  const [formType, setFormType] = React.useState<"PERCENTAGE" | "FIXED_AMOUNT">(
    "PERCENTAGE"
  );
  const [formValue, setFormValue] = React.useState("");
  const [formMaxRedemptions, setFormMaxRedemptions] = React.useState("");
  const [formValidFrom, setFormValidFrom] = React.useState(
    new Date().toISOString().split("T")[0]!
  );
  const [formValidUntil, setFormValidUntil] = React.useState("");
  const [formMinPurchase, setFormMinPurchase] = React.useState("");
  const [formDescEn, setFormDescEn] = React.useState("");
  const [formDescAr, setFormDescAr] = React.useState("");
  const [formPlanIds, setFormPlanIds] = React.useState<string[]>([]);
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>(
    {}
  );
  const [saving, setSaving] = React.useState(false);

  const labels = t[lang];

  // ── Load data ──────────────────────────────────────────────────────────────

  const fetchData = React.useCallback(async () => {
    try {
      const [couponData, planData] = await Promise.all([
        adminGetCoupons(),
        getPlans(),
      ]);
      setCoupons(couponData as Coupon[]);
      setAllPlans(planData as Plan[]);
    } catch (err) {
      console.error("Failed to load coupon data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [couponData, planData] = await Promise.all([
          adminGetCoupons(),
          getPlans(),
        ]);
        if (active) {
          setCoupons(couponData as Coupon[]);
          setAllPlans(planData as Plan[]);
        }
      } catch (err) {
        if (active) console.error("Failed to load coupon data:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // ── Toggle active/inactive ─────────────────────────────────────────────────

  const handleToggle = async (couponId: string, currentActive: boolean) => {
    setTogglingId(couponId);
    try {
      await adminToggleCoupon(couponId, !currentActive);
      setCoupons((prev) =>
        prev.map((c) =>
          c.id === couponId ? { ...c, isActive: !currentActive } : c
        )
      );
      showToast(labels.toggleSuccess, "success");
    } catch {
      showToast(labels.toggleError, "error");
    } finally {
      setTogglingId(null);
    }
  };

  // ── Form validation ────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formCode.trim()) {
      errors.code = labels.codeRequired;
    }

    const numValue = parseFloat(formValue);
    if (!formValue || isNaN(numValue)) {
      errors.value = labels.valueRequired;
    } else if (formType === "PERCENTAGE" && (numValue < 1 || numValue > 100)) {
      errors.value = labels.valuePercentRange;
    } else if (numValue <= 0) {
      errors.value = labels.valuePositive;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Create coupon ──────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      await adminCreateCoupon({
        code: formCode.toUpperCase().trim(),
        type: formType,
        value: parseFloat(formValue),
        maxRedemptions: formMaxRedemptions
          ? parseInt(formMaxRedemptions, 10)
          : undefined,
        validFrom: new Date(formValidFrom),
        validUntil: formValidUntil ? new Date(formValidUntil) : undefined,
        minPurchaseAmount: formMinPurchase
          ? parseFloat(formMinPurchase)
          : undefined,
        descriptionEn: formDescEn || undefined,
        descriptionAr: formDescAr || undefined,
        planIds: formPlanIds.length > 0 ? formPlanIds : undefined,
      });

      showToast(labels.createSuccess, "success");
      resetForm();
      setShowModal(false);
      fetchData();
    } catch {
      showToast(labels.createError, "error");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormCode("");
    setFormType("PERCENTAGE");
    setFormValue("");
    setFormMaxRedemptions("");
    setFormValidFrom(new Date().toISOString().split("T")[0]!);
    setFormValidUntil("");
    setFormMinPurchase("");
    setFormDescEn("");
    setFormDescAr("");
    setFormPlanIds([]);
    setFormErrors({});
  };

  const togglePlanSelection = (planId: string) => {
    setFormPlanIds((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId]
    );
  };

  // ── Format helpers ─────────────────────────────────────────────────────────

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return labels.noExpiry;
    return new Date(dateStr).toLocaleDateString(
      lang === "ar" ? "ar-SA" : "en-US",
      { year: "numeric", month: "short", day: "numeric" }
    );
  };

  const formatValue = (coupon: Coupon) => {
    const val = Number(coupon.value);
    if (coupon.type === "PERCENTAGE") {
      return `${val}%`;
    }
    return `${val.toLocaleString(lang === "ar" ? "ar-SA" : "en-US")} ${labels.sar}`;
  };

  const formatRedemptions = (coupon: Coupon) => {
    const used = coupon._count.redemptions;
    const max = coupon.maxRedemptions;
    if (!max) return `${used} / ${labels.unlimited}`;
    return `${used} / ${max}`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;

  // ── Mobile helpers ─────────────────────────────────────────────────────────
  const filteredMobileCoupons = mobileSearch.trim()
    ? coupons.filter((c) =>
        c.code.toLowerCase().includes(mobileSearch.trim().toLowerCase()),
      )
    : coupons;

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar title={lang === "ar" ? "الكوبونات" : "Coupons"} lang={lang} />

      {!authorized ? (
        <div className="flex-1 px-4 pt-10">
          <EmptyState
            icon={<ShieldAlert className="h-10 w-10" aria-hidden="true" />}
            title={lang === "ar" ? "غير مصرح" : "Unauthorized"}
            description={
              lang === "ar"
                ? "هذه الصفحة متاحة لفريق المنصة فقط."
                : "This page is available to platform staff only."
            }
          />
        </div>
      ) : (
        <>
          <div className="px-4 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={mobileSearch}
                onChange={(e) => setMobileSearch(e.target.value)}
                placeholder={lang === "ar" ? "بحث بالكود..." : "Search by code..."}
                className="h-11 w-full rounded-md border border-input bg-background ps-9 pe-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="flex-1 px-4 pb-24 pt-3">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : filteredMobileCoupons.length === 0 ? (
              <EmptyState
                icon={<Ticket className="h-10 w-10 text-primary" aria-hidden="true" />}
                title={labels.noCoupons}
                description={labels.noCouponsDesc}
                action={
                  <Button
                    onClick={() => {
                      resetForm();
                      setShowModal(true);
                    }}
                    style={{ display: "inline-flex" }}
                  >
                    <Plus className="h-4 w-4 me-2" />
                    {labels.createCoupon}
                  </Button>
                }
              />
            ) : (
              <div className="rounded-2xl border border-border bg-card px-4">
                {filteredMobileCoupons.map((coupon, idx) => {
                  const isExpired =
                    coupon.validUntil && new Date(coupon.validUntil) < new Date();
                  const isMaxedOut =
                    coupon.maxRedemptions !== null &&
                    coupon.currentUses >= coupon.maxRedemptions;
                  const inactive = !coupon.isActive || isExpired || isMaxedOut;
                  return (
                    <DataCard
                      key={coupon.id}
                      icon={Tag}
                      iconTone="purple"
                      title={<span className="font-mono tracking-wider">{coupon.code}</span>}
                      subtitle={[
                        formatValue(coupon),
                        formatRedemptions(coupon),
                        formatDate(coupon.validUntil),
                      ]}
                      trailing={
                        <Badge
                          variant={inactive ? "default" : "success"}
                          size="sm"
                        >
                          {inactive
                            ? labels.inactive
                            : labels.active}
                        </Badge>
                      }
                      divider={idx !== filteredMobileCoupons.length - 1}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <FAB
            icon={Plus}
            label={labels.createCoupon}
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          />
        </>
      )}
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    {loading ? (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    ) : (
    <div
      className="space-y-6 animate-in fade-in duration-500"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-[18px] w-[18px]" />
          ) : (
            <AlertCircle className="h-[18px] w-[18px]" />
          )}
          {toast.message}
          <button
            onClick={() => setToast(null)}
            className="ms-2 hover:opacity-70"
            aria-label={lang === "ar" ? "إغلاق" : "Dismiss"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Back link + lang toggle */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <BackArrow className="h-4 w-4" />
          {labels.back}
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <Tag className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {labels.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {labels.subtitle}
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
         
        >
          <Plus className="h-[18px] w-[18px] me-2" />
          {labels.createCoupon}
        </Button>
      </div>

      {/* Coupons Table */}
      {coupons.length === 0 ? (
        <EmptyState
          icon={<Ticket className="h-12 w-12" aria-hidden="true" />}
          title={labels.noCoupons}
          description={labels.noCouponsDesc}
          action={
            <Button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              style={{ display: "inline-flex" }}
              className="gap-2"
            >
              <Plus className="h-[18px] w-[18px]" />
              {labels.createCoupon}
            </Button>
          }
          helpHref="/dashboard/help#coupons"
          helpLabel={lang === "ar" ? "تعرّف على كوبونات الخصم" : "Learn about coupons"}
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{labels.code}</TableHead>
                <TableHead>{labels.type}</TableHead>
                <TableHead>{labels.value}</TableHead>
                <TableHead>{labels.status}</TableHead>
                <TableHead>{labels.redemptions}</TableHead>
                <TableHead>{labels.validUntil}</TableHead>
                <TableHead>{labels.plans}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => {
                const isExpired =
                  coupon.validUntil &&
                  new Date(coupon.validUntil) < new Date();
                const isMaxedOut =
                  coupon.maxRedemptions !== null &&
                  coupon.currentUses >= coupon.maxRedemptions;

                return (
                  <TableRow key={coupon.id}>
                    {/* Code */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded text-xs tracking-wider">
                          {coupon.code}
                        </span>
                      </div>
                      {coupon.descriptionEn && lang === "en" && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                          {coupon.descriptionEn}
                        </p>
                      )}
                      {coupon.descriptionAr && lang === "ar" && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                          {coupon.descriptionAr}
                        </p>
                      )}
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {coupon.type === "PERCENTAGE" ? (
                          <Percent className="h-3.5 w-3.5" />
                        ) : (
                          <CircleDollarSign className="h-3.5 w-3.5" />
                        )}
                        {coupon.type === "PERCENTAGE"
                          ? labels.percentage
                          : labels.fixedAmount}
                      </span>
                    </TableCell>

                    {/* Value */}
                    <TableCell className="font-semibold text-foreground">
                      {formatValue(coupon)}
                    </TableCell>

                    {/* Status Toggle */}
                    <TableCell>
                      <button
                        onClick={() =>
                          handleToggle(coupon.id, coupon.isActive)
                        }
                        disabled={togglingId === coupon.id}
                        className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          backgroundColor: coupon.isActive
                            ? "rgb(34 197 94)"
                            : "rgb(156 163 175)",
                        }}
                        role="switch"
                        aria-checked={coupon.isActive}
                        aria-label={
                          coupon.isActive ? labels.active : labels.inactive
                        }
                      >
                        <span
                          className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200"
                          style={{
                            transform: coupon.isActive
                              ? lang === "ar"
                                ? "translateX(-0.25rem)"
                                : "translateX(1.25rem)"
                              : lang === "ar"
                                ? "translateX(-1.25rem)"
                                : "translateX(0.25rem)",
                          }}
                        />
                      </button>
                      <span
                        className={`ms-2 text-xs font-medium ${
                          coupon.isActive
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {coupon.isActive ? labels.active : labels.inactive}
                      </span>
                      {(isExpired || isMaxedOut) && (
                        <span className="ms-1 text-xs text-orange-500 dark:text-orange-400">
                          {isExpired
                            ? lang === "ar"
                              ? "(منتهي)"
                              : "(Expired)"
                            : lang === "ar"
                              ? "(مكتمل)"
                              : "(Maxed)"}
                        </span>
                      )}
                    </TableCell>

                    {/* Redemptions */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>{formatRedemptions(coupon)}</span>
                      </div>
                    </TableCell>

                    {/* Valid Until */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(coupon.validUntil)}</span>
                      </div>
                    </TableCell>

                    {/* Plans */}
                    <TableCell>
                      {coupon.plans.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {labels.allPlans}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {coupon.plans.map((plan) => (
                            <span
                              key={plan.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium"
                            >
                              {plan.nameEn}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ── Create Coupon Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card rounded-xl border border-border shadow-xl mx-4"
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-xl z-10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                  <Tag className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  {labels.modalTitle}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                aria-label={lang === "ar" ? "إغلاق" : "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Row: Code + Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Code */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {labels.couponCode} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) =>
                      setFormCode(e.target.value.toUpperCase().replace(/\s/g, ""))
                    }
                    placeholder={labels.couponCodePlaceholder}
                    className={`w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm font-mono tracking-wider placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      formErrors.code ? "border-red-500" : "border-border"
                    }`}
                  />
                  {formErrors.code && (
                    <p className="text-xs text-red-500 mt-1">
                      {formErrors.code}
                    </p>
                  )}
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {labels.discountType}
                  </label>
                  <select
                    value={formType}
                    onChange={(e) =>
                      setFormType(
                        e.target.value as "PERCENTAGE" | "FIXED_AMOUNT"
                      )
                    }
                    className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="PERCENTAGE">{labels.percentage}</option>
                    <option value="FIXED_AMOUNT">{labels.fixedAmount}</option>
                  </select>
                </div>
              </div>

              {/* Row: Value + Max Redemptions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Value */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {labels.discountValue}{" "}
                    <span className="text-muted-foreground text-xs">
                      ({formType === "PERCENTAGE" ? "%" : labels.sar})
                    </span>{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    min={0}
                    max={formType === "PERCENTAGE" ? 100 : undefined}
                    step={formType === "PERCENTAGE" ? 1 : 0.01}
                    placeholder="0"
                    className={`w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      formErrors.value ? "border-red-500" : "border-border"
                    }`}
                  />
                  {formErrors.value && (
                    <p className="text-xs text-red-500 mt-1">
                      {formErrors.value}
                    </p>
                  )}
                </div>

                {/* Max Redemptions */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {labels.maxRedemptions}
                  </label>
                  <input
                    type="number"
                    value={formMaxRedemptions}
                    onChange={(e) => setFormMaxRedemptions(e.target.value)}
                    min={1}
                    step={1}
                    placeholder={labels.maxRedemptionsPlaceholder}
                    className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Row: Valid From + Valid Until */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {labels.validFrom}
                  </label>
                  <input
                    type="date"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {labels.validUntilLabel}
                  </label>
                  <input
                    type="date"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    placeholder={labels.validUntilPlaceholder}
                    className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Min Purchase */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {labels.minPurchase}
                </label>
                <input
                  type="number"
                  value={formMinPurchase}
                  onChange={(e) => setFormMinPurchase(e.target.value)}
                  min={0}
                  step={0.01}
                  placeholder={labels.minPurchasePlaceholder}
                  className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Descriptions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {labels.descEn}
                  </label>
                  <textarea
                    value={formDescEn}
                    onChange={(e) => setFormDescEn(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {labels.descAr}
                  </label>
                  <textarea
                    value={formDescAr}
                    onChange={(e) => setFormDescAr(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Plan Restriction */}
              {allPlans.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    <ListChecks
                      className="h-4 w-4 inline-block me-1 -mt-0.5"
                    />
                    {labels.planRestriction}
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {labels.planRestrictionHelp}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allPlans.map((plan) => {
                      const isSelected = formPlanIds.includes(plan.id);
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => togglePlanSelection(plan.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            isSelected
                              ? "bg-primary text-white border-primary"
                              : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                          }`}
                        >
                          {isSelected && (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          {lang === "ar" ? plan.nameAr : plan.nameEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl">
              <Button
                variant="secondary"
                onClick={() => setShowModal(false)}
               
              >
                {labels.cancel}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={saving}
               
              >
                {saving ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent me-2" />
                    {labels.saving}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-[18px] w-[18px] me-2" />
                    {labels.save}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    )}
    </div>
    </>
  );
}
