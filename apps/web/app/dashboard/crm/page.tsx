"use client";

import { useLanguage } from "../../../components/LanguageProvider";
import * as React from "react";
import {
  Users,
  Plus,
  Loader2,
  X,
  Search,
  Trash2,
  Eye,
  FileDown,
  UserPlus,
  TrendingUp,
  Star,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Calendar,
  Activity,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  Pencil,
  Link2,
  CheckCircle2,
  XCircle,
  Filter,
  Handshake,
  Building2,
  User,
  ExternalLink,
} from "lucide-react";
import {
  Button,
  Badge,
  Input,
  Card,
  PageIntro,
  KPICard,
  ResponsiveDialog,
  AppBar,
  MobileTabs,
  MobileKanban,
  DataCard,
  CustomerCard,
  QuickActionRail,
  ActivityTimeline,
  BottomSheet,
  FAB,
  DirectionalIcon,
  NationalIdInput,
  SaudiPhoneInput,
  DataTable,
  type ColumnDef,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import {
  getCustomers,
  createCustomer,
  deleteCustomer,
  updateCustomerStatus,
  updateCustomer,
  getCustomerUnitAssignments,
} from "../../actions/customers";
import { getTeamMembers } from "../../actions/team";
import { usePermissions } from "../../../hooks/usePermissions";
import CustomerActivityTimeline from "../../../components/CustomerActivityTimeline";
import {
  getCustomerInterests,
  addCustomerInterest,
  dropCustomerInterest,
  convertInterestToDeal,
  getAvailableUnitsForInterest,
} from "../../actions/customer-interests";

// ─── Pipeline Stage Config ────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  {
    key: "NEW",
    label: { ar: "جديد", en: "New Lead" },
    color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
    dotColor: "bg-blue-500",
  },
  {
    key: "CONTACTED",
    label: { ar: "تم التواصل", en: "Contacted" },
    color: "bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800",
    dotColor: "bg-violet-500",
  },
  {
    key: "QUALIFIED",
    label: { ar: "مؤهل", en: "Qualified" },
    color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800",
    dotColor: "bg-amber-500",
  },
  {
    key: "VIEWING",
    label: { ar: "معاينة", en: "Viewing" },
    color: "bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800",
    dotColor: "bg-orange-500",
  },
  {
    key: "NEGOTIATION",
    label: { ar: "تفاوض", en: "Negotiation" },
    color: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800",
    dotColor: "bg-green-500",
  },
];

// Per-stage hue for Kanban column tinting. Kept as raw HSL so we can mix into
// the card surface via color-mix() without fighting Tailwind's class-generation.
const STAGE_HUES: Record<string, string> = {
  NEW: "hsl(220 15% 60%)", // neutral
  CONTACTED: "hsl(210 65% 55%)", // blue
  INTERESTED: "hsl(270 50% 60%)", // purple
  QUALIFIED: "hsl(270 50% 50%)", // purple-deep
  VIEWING: "hsl(40 55% 55%)", // gold
  NEGOTIATION: "hsl(40 60% 50%)", // darker gold
  RESERVED: "hsl(158 50% 45%)", // green
  CONVERTED: "hsl(158 55% 35%)", // deep green
  LOST: "hsl(0 65% 55%)", // red
};

// Legacy statuses not shown in kanban but valid for filter/display
const ALL_STATUS_CONFIGS = [
  ...PIPELINE_STAGES,
  {
    key: "INTERESTED",
    label: { ar: "مهتم", en: "Interested" },
    color: "bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800",
    dotColor: "bg-violet-500",
  },
  {
    key: "RESERVED",
    label: { ar: "محجوز", en: "Reserved" },
    color: "bg-teal-500/10 text-teal-600 border-teal-200 dark:border-teal-800",
    dotColor: "bg-teal-500",
  },
  {
    key: "CONVERTED",
    label: { ar: "تم التحويل", en: "Converted" },
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800",
    dotColor: "bg-emerald-500",
  },
  {
    key: "LOST",
    label: { ar: "خسارة", en: "Lost" },
    color: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800",
    dotColor: "bg-red-500",
  },
  {
    key: "ACTIVE_TENANT",
    label: { ar: "مستأجر نشط", en: "Active Tenant" },
    color: "bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800",
    dotColor: "bg-cyan-500",
  },
  {
    key: "PAST_TENANT",
    label: { ar: "مستأجر سابق", en: "Past Tenant" },
    color: "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800",
    dotColor: "bg-slate-500",
  },
];

const LOST_REASONS = [
  { key: "BUDGET", label: { ar: "الميزانية غير مناسبة", en: "Budget mismatch" } },
  { key: "NO_RESPONSE", label: { ar: "لا يوجد رد", en: "No response" } },
  { key: "COMPETITOR", label: { ar: "اختار منافساً", en: "Chose competitor" } },
  { key: "NO_MATCH", label: { ar: "لا يوجد عقار مناسب", en: "No suitable property" } },
  { key: "OTHER", label: { ar: "سبب آخر", en: "Other reason" } },
];

const PROPERTY_TYPES = [
  { key: "APARTMENT", label: { ar: "شقة", en: "Apartment" } },
  { key: "VILLA", label: { ar: "فيلا", en: "Villa" } },
  { key: "OFFICE", label: { ar: "مكتب", en: "Office" } },
  { key: "RETAIL", label: { ar: "تجاري", en: "Retail" } },
  { key: "WAREHOUSE", label: { ar: "مستودع", en: "Warehouse" } },
  { key: "LAND", label: { ar: "أرض", en: "Land" } },
];

const SOURCE_LABELS: Record<string, { ar: string; en: string }> = {
  REFERRAL: { ar: "إحالة", en: "Referral" },
  WALK_IN: { ar: "زيارة مباشرة", en: "Walk-in" },
  ONLINE: { ar: "إنترنت", en: "Online" },
  EXHIBITION: { ar: "معرض", en: "Exhibition" },
  COLD_CALL: { ar: "اتصال بارد", en: "Cold Call" },
  SOCIAL_MEDIA: { ar: "وسائل التواصل", en: "Social Media" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_STATUS_CONFIG = ALL_STATUS_CONFIGS[0]!;

function getStatusConfig(key: string) {
  return ALL_STATUS_CONFIGS.find((s) => s.key === key) ?? DEFAULT_STATUS_CONFIG;
}

function maskPhone(phone: string) {
  if (!phone || phone === "•••••••••••") return "•••••••••••";
  return phone.slice(0, 3) + "•••" + phone.slice(-3);
}

function formatSAR(amount: number | string | null | undefined, locale: string) {
  if (!amount) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(num);
}

// ─── Customer Profile Drawer ──────────────────────────────────────────────────

function CustomerDrawer({
  customer,
  onClose,
  onCustomerUpdated,
  onMarkLost,
  lang,
  teamMembers,
  assignments,
}: {
  customer: any;
  onClose: () => void;
  onCustomerUpdated: (updated: any) => void;
  onMarkLost?: (customerId: string, customerName: string) => void;
  lang: "ar" | "en";
  teamMembers: any[];
  assignments: any[];
}) {
  const statusCfg = getStatusConfig(customer.status);

  // ── Feature A: Edit modal state ──
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    name: customer.name ?? "",
    nameArabic: customer.nameArabic ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    source: customer.source ?? "",
    agentId: customer.agentId ?? customer.agent?.id ?? "",
    budget: customer.budget ? String(customer.budget) : "",
    propertyTypeInterest: customer.propertyTypeInterest ?? "",
  });
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editSuccess, setEditSuccess] = React.useState(false);

  // ── Feature B: Interests state ──
  const [interests, setInterests] = React.useState<any[]>([]);
  const [loadingInterests, setLoadingInterests] = React.useState(false);
  const [showLinkModal, setShowLinkModal] = React.useState(false);
  const [availableUnits, setAvailableUnits] = React.useState<any[]>([]);
  const [loadingUnits, setLoadingUnits] = React.useState(false);
  const [linkUnitSearch, setLinkUnitSearch] = React.useState("");
  const [linkSelectedUnit, setLinkSelectedUnit] = React.useState<any | null>(null);
  const [linkIntent, setLinkIntent] = React.useState<"BUY" | "RENT" | "">("");
  const [savingLink, setSavingLink] = React.useState(false);
  const [linkError, setLinkError] = React.useState<string | null>(null);

  const [showDropConfirm, setShowDropConfirm] = React.useState(false);
  const [droppingInterest, setDroppingInterest] = React.useState<any | null>(null);
  const [droppingLoading, setDroppingLoading] = React.useState(false);

  const [showConvertDealModal, setShowConvertDealModal] = React.useState(false);
  const [convertingInterest, setConvertingInterest] = React.useState<any | null>(null);
  const [convertAmount, setConvertAmount] = React.useState("");
  const [convertExpiry, setConvertExpiry] = React.useState("");
  const [savingConvert, setSavingConvert] = React.useState(false);
  const [convertError, setConvertError] = React.useState<string | null>(null);

  const [drawerToast, setDrawerToast] = React.useState<string | null>(null);

  // Load interests when drawer opens
  React.useEffect(() => {
    loadInterests(customer.id);
  }, [customer.id]);

  async function loadInterests(customerId: string) {
    setLoadingInterests(true);
    try {
      const data = await getCustomerInterests(customerId);
      setInterests(data);
    } catch {
      // silent — non-critical section
    } finally {
      setLoadingInterests(false);
    }
  }

  function showToast(msg: string) {
    setDrawerToast(msg);
    setTimeout(() => setDrawerToast(null), 3000);
  }

  function handleConvertToDeal() {
    const params = new URLSearchParams({ customerId: customer.id, customerName: customer.name });
    window.location.href = `/dashboard/deals?${params.toString()}`;
  }

  // ── Feature A: Edit submit ──
  async function handleEditSubmit() {
    if (!editForm.name.trim()) {
      setEditError(lang === "ar" ? "الاسم حقل مطلوب." : "Name is required.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await updateCustomer(customer.id, {
        name: editForm.name,
        nameArabic: editForm.nameArabic || undefined,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        source: editForm.source || undefined,
        agentId: editForm.agentId || undefined,
        budget: editForm.budget ? Number(editForm.budget) : undefined,
        propertyTypeInterest: editForm.propertyTypeInterest || undefined,
      });
      // Only merge non-PII fields from server response to avoid showing encrypted ciphertext.
      // PII fields (phone, email, nationalId) stay from the current decrypted customer state.
      onCustomerUpdated({
        ...customer,
        name: updated.name,
        nameArabic: updated.nameArabic,
        source: updated.source,
        agentId: updated.agentId,
        agent: updated.agent,
        budget: updated.budget,
        propertyTypeInterest: updated.propertyTypeInterest,
      });
      setEditSuccess(true);
      showToast(lang === "ar" ? "تم تحديث الملف الشخصي بنجاح" : "Profile updated successfully");
      setTimeout(() => {
        setShowEditModal(false);
        setEditSuccess(false);
      }, 800);
    } catch (err: any) {
      const msg = err?.message ?? "";
      const isFriendly = msg.length < 200 && !msg.includes("Prisma") && !msg.includes("Invalid `") && !msg.includes("invocation");
      setEditError(
        isFriendly && msg
          ? msg
          : lang === "ar"
            ? "تعذّر حفظ التغييرات. يرجى التحقق من البيانات والمحاولة مجدداً."
            : "Failed to save changes. Please check the details and try again."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Feature B: Link property ──
  async function openLinkModal() {
    setShowLinkModal(true);
    setLinkUnitSearch("");
    setLinkSelectedUnit(null);
    setLinkIntent("");
    setLinkError(null);
    setLoadingUnits(true);
    try {
      const units = await getAvailableUnitsForInterest();
      setAvailableUnits(units);
    } catch {
      setLinkError(
        lang === "ar"
          ? "تعذّر تحميل العقارات المتاحة. يرجى المحاولة مجدداً."
          : "Failed to load available properties. Please try again."
      );
    } finally {
      setLoadingUnits(false);
    }
  }

  const filteredUnits = React.useMemo(() => {
    const q = linkUnitSearch.trim().toLowerCase();
    if (!q) return availableUnits;
    return availableUnits.filter(
      (u) =>
        u.number?.toLowerCase().includes(q) ||
        u.city?.toLowerCase().includes(q) ||
        u.type?.toLowerCase().includes(q) ||
        u.buildingName?.toLowerCase().includes(q)
    );
  }, [availableUnits, linkUnitSearch]);

  async function handleConfirmLink() {
    if (!linkSelectedUnit || !linkIntent) return;
    setSavingLink(true);
    setLinkError(null);
    try {
      await addCustomerInterest(customer.id, linkSelectedUnit.id, linkIntent as "BUY" | "RENT");
      await loadInterests(customer.id);
      setShowLinkModal(false);
      showToast(lang === "ar" ? "تم ربط العقار بنجاح" : "Property linked successfully");
    } catch (err: any) {
      const msg = err?.message ?? "";
      const isFriendly = msg.length < 200 && !msg.includes("Prisma") && !msg.includes("Invalid `");
      setLinkError(
        isFriendly && msg
          ? msg
          : lang === "ar"
            ? "تعذّر ربط العقار. يرجى المحاولة مجدداً."
            : "Failed to link property. Please try again."
      );
    } finally {
      setSavingLink(false);
    }
  }

  async function handleDropInterest() {
    if (!droppingInterest) return;
    setDroppingLoading(true);
    try {
      await dropCustomerInterest(droppingInterest.id);
      await loadInterests(customer.id);
      setShowDropConfirm(false);
      setDroppingInterest(null);
      showToast(lang === "ar" ? "تم إسقاط الاهتمام" : "Interest dropped");
    } catch (err: any) {
      const msg = err?.message ?? "";
      const isFriendly = msg.length < 200 && !msg.includes("Prisma");
      showToast(
        isFriendly && msg
          ? msg
          : lang === "ar"
            ? "تعذّر إسقاط الاهتمام. يرجى المحاولة مجدداً."
            : "Failed to drop interest. Please try again."
      );
    } finally {
      setDroppingLoading(false);
    }
  }

  function openConvertModal(interest: any) {
    setConvertingInterest(interest);
    const defaultAmount =
      interest.intent === "RENT"
        ? interest.unit?.rentalPrice
        : interest.unit?.markupPrice;
    setConvertAmount(defaultAmount ? String(defaultAmount) : "");
    setConvertExpiry("");
    setConvertError(null);
    setShowConvertDealModal(true);
  }

  async function handleConvertInterest() {
    if (!convertingInterest || !convertAmount || !convertExpiry) {
      setConvertError(
        lang === "ar"
          ? "يرجى تحديد المبلغ وتاريخ الانتهاء."
          : "Please enter the amount and expiry date."
      );
      return;
    }
    setSavingConvert(true);
    setConvertError(null);
    try {
      await convertInterestToDeal(convertingInterest.id, {
        amount: Number(convertAmount),
        expiresAt: new Date(convertExpiry),
      });
      setShowConvertDealModal(false);
      showToast(lang === "ar" ? "تم إنشاء الصفقة بنجاح" : "Deal created successfully");
      setTimeout(() => {
        window.location.href = "/dashboard/deals";
      }, 1200);
    } catch (err: any) {
      const msg = err?.message ?? "";
      const isFriendly = msg.length < 200 && !msg.includes("Prisma") && !msg.includes("Invalid `");
      setConvertError(
        isFriendly && msg
          ? msg
          : lang === "ar"
            ? "تعذّر إنشاء الصفقة. يرجى المحاولة مجدداً."
            : "Failed to create deal. Please try again."
      );
    } finally {
      setSavingConvert(false);
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 bottom-0 z-[100] w-full max-w-md bg-card border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 end-0 border-s"
        )}
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-none">
                {customer.name}
              </h2>
              {customer.nameArabic && customer.nameArabic !== customer.name && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {customer.nameArabic}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Feature A: Edit Profile button */}
            <button
              onClick={() => {
                setEditForm({
                  name: customer.name ?? "",
                  nameArabic: customer.nameArabic ?? "",
                  phone: customer.phone ?? "",
                  email: customer.email ?? "",
                  source: customer.source ?? "",
                  agentId: customer.agentId ?? customer.agent?.id ?? "",
                  budget: customer.budget ? String(customer.budget) : "",
                  propertyTypeInterest: customer.propertyTypeInterest ?? "",
                });
                setEditError(null);
                setEditSuccess(false);
                setShowEditModal(true);
              }}
              className="h-8 px-3 rounded-lg border border-border flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              title={lang === "ar" ? "تعديل الملف" : "Edit Profile"}
            >
              <Pencil className="h-3.5 w-3.5" />
              {lang === "ar" ? "تعديل" : "Edit"}
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              aria-label={lang === "ar" ? "إغلاق" : "Close"}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Toast */}
        {drawerToast && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs font-medium animate-in fade-in duration-200">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {drawerToast}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Mobile quick action rail — call / WhatsApp / email */}
          {(customer.phone || customer.email) && (
            <div className="md:hidden">
              <QuickActionRail
                actions={[
                  ...(customer.phone
                    ? [
                        {
                          key: "call",
                          label: lang === "ar" ? "اتصال" : "Call",
                          icon: Phone,
                          href: `tel:${customer.phone}`,
                          tone: "primary" as const,
                        },
                        {
                          key: "wa",
                          label: lang === "ar" ? "واتساب" : "WhatsApp",
                          icon: MessageCircle,
                          href: `https://wa.me/${String(customer.phone).replace(/[^\d]/g, "")}`,
                          tone: "success" as const,
                          external: true,
                        },
                      ]
                    : []),
                  ...(customer.email
                    ? [
                        {
                          key: "mail",
                          label: lang === "ar" ? "إيميل" : "Email",
                          icon: Mail,
                          href: `mailto:${customer.email}`,
                          tone: "info" as const,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          )}

          {/* Status + Convert to Deal */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border",
                statusCfg.color
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dotColor)} />
              {statusCfg.label[lang]}
            </span>
            {customer.source && SOURCE_LABELS[customer.source] && (
              <span className="text-xs text-muted-foreground border border-border rounded-full px-2.5 py-1">
                {(SOURCE_LABELS[customer.source] as { ar: string; en: string })[lang]}
              </span>
            )}
            <div className="ms-auto flex items-center gap-2">
              {!["LOST", "CONVERTED", "ACTIVE_TENANT"].includes(customer.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  style={{ display: "inline-flex" }}
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => onMarkLost?.(customer.id, customer.name)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {lang === "ar" ? "تحديد كخسارة" : "Mark as Lost"}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                style={{ display: "inline-flex" }}
                className="gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
                onClick={handleConvertToDeal}
              >
                <DirectionalIcon icon={ArrowRight} className="h-3.5 w-3.5" />
                {lang === "ar" ? "تحويل لصفقة" : "Convert to Deal"}
              </Button>
            </div>
          </div>

          {/* Budget + Property Interest */}
          {(customer.budget || customer.propertyTypeInterest) && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {lang === "ar" ? "تفضيلات العميل" : "Client Preferences"}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {customer.budget && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      {lang === "ar" ? "الميزانية" : "Budget"}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {Number(customer.budget).toLocaleString(lang === "ar" ? "ar-SA" : "en-SA")} {lang === "ar" ? "ريال" : "SAR"}
                    </p>
                  </div>
                )}
                {customer.propertyTypeInterest && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      {lang === "ar" ? "نوع العقار" : "Property Type"}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {PROPERTY_TYPES.find(pt => pt.key === customer.propertyTypeInterest)?.label[lang] ?? customer.propertyTypeInterest}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lost Reason */}
          {customer.status === "LOST" && customer.lostReason && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-red-700 dark:text-red-300">
                  {lang === "ar" ? "سبب الخسارة" : "Lost Reason"}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  {LOST_REASONS.find(r => r.key === customer.lostReason)?.label[lang] ?? customer.lostReason}
                </p>
              </div>
            </div>
          )}

          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {lang === "ar" ? "معلومات التواصل" : "Contact Information"}
            </h3>
            <div className="space-y-2">
              {customer.phone && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {customer.phone}
                  </span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {customer.email}
                  </span>
                </div>
              )}
              {customer.nationality && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {customer.nationality}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Personal Details */}
          {(customer.gender || customer.dateOfBirth || customer.maritalStatus) && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {lang === "ar" ? "البيانات الشخصية" : "Personal Details"}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {customer.gender && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      {lang === "ar" ? "الجنس" : "Gender"}
                    </p>
                    <p className="text-sm font-semibold text-foreground capitalize">
                      {customer.gender === "MALE"
                        ? lang === "ar" ? "ذكر" : "Male"
                        : lang === "ar" ? "أنثى" : "Female"}
                    </p>
                  </div>
                )}
                {customer.maritalStatus && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      {lang === "ar" ? "الحالة الاجتماعية" : "Marital Status"}
                    </p>
                    <p className="text-sm font-semibold text-foreground capitalize">
                      {customer.maritalStatus}
                    </p>
                  </div>
                )}
                {customer.dateOfBirth && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/50 col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      {lang === "ar" ? "تاريخ الميلاد" : "Date of Birth"}
                    </p>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {new Date(customer.dateOfBirth).toLocaleDateString(
                        lang === "ar" ? "ar-SA" : "en-SA"
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" />
              {lang === "ar" ? "سجل النشاط" : "Activity Timeline"}
            </h3>
            <CustomerActivityTimeline customerId={customer.id} />
          </div>

          {/* ── Feature B: Interested Properties ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5" />
                {lang === "ar" ? "الاهتمامات / Interested Properties" : "Interested Properties / الاهتمامات"}
              </h3>
              <button
                onClick={openLinkModal}
                className="flex items-center gap-1 text-[10px] font-semibold text-primary border border-primary/30 rounded-md px-2 py-1 hover:bg-primary/5 transition-colors"
                style={{ display: "inline-flex" }}
              >
                <Plus className="h-3 w-3" />
                {lang === "ar" ? "ربط عقار" : "Link Property"}
              </button>
            </div>

            {loadingInterests ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : interests.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                {lang === "ar"
                  ? "لا توجد اهتمامات مرتبطة / No properties linked yet"
                  : "No properties linked yet / لا توجد اهتمامات مرتبطة"}
              </p>
            ) : (
              <div className="space-y-2">
                {interests.map((interest) => {
                  const price =
                    interest.intent === "RENT"
                      ? interest.unit?.rentalPrice
                      : interest.unit?.markupPrice;
                  return (
                    <div
                      key={interest.id}
                      className="p-3 rounded-lg border border-border/50 bg-muted/10 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-foreground bg-muted/40 px-2 py-0.5 rounded">
                              {interest.unit?.number ?? "—"}
                            </span>
                            <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                              {PROPERTY_TYPES.find(pt => pt.key === interest.unit?.type)?.label[lang] ?? interest.unit?.type ?? "—"}
                            </span>
                            {interest.unit?.city && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {interest.unit.city}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {price && (
                              <span className="text-xs font-semibold text-foreground">
                                {formatSAR(price, lang)}
                              </span>
                            )}
                            <span
                              className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                                interest.intent === "BUY"
                                  ? "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800"
                                  : "bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800"
                              )}
                            >
                              {interest.intent === "BUY"
                                ? lang === "ar" ? "شراء" : "Buy"
                                : lang === "ar" ? "إيجار" : "Rent"}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                                interest.status === "ACTIVE"
                                  ? "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800"
                                  : interest.status === "CONVERTED"
                                    ? "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800"
                                    : "bg-slate-500/10 text-slate-500 border-slate-200 dark:border-slate-700"
                              )}
                            >
                              {interest.status === "ACTIVE"
                                ? lang === "ar" ? "نشط" : "Active"
                                : interest.status === "CONVERTED"
                                  ? lang === "ar" ? "محوّل" : "Converted"
                                  : lang === "ar" ? "مُسقط" : "Dropped"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions — only for ACTIVE interests */}
                      {interest.status === "ACTIVE" && (
                        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                          <button
                            onClick={() => openConvertModal(interest)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-white bg-primary rounded px-2 py-1 hover:bg-primary/90 transition-colors"
                            style={{ display: "inline-flex" }}
                          >
                            <DirectionalIcon icon={ArrowRight} className="h-3 w-3" />
                            {lang === "ar" ? "تحويل لصفقة" : "Convert to Deal"}
                          </button>
                          <button
                            onClick={() => {
                              setDroppingInterest(interest);
                              setShowDropConfirm(true);
                            }}
                            className="flex items-center gap-1 text-[10px] font-semibold text-destructive border border-destructive/30 rounded px-2 py-1 hover:bg-destructive/5 transition-colors"
                            style={{ display: "inline-flex" }}
                          >
                            <Trash2 className="h-3 w-3" />
                            {lang === "ar" ? "إسقاط" : "Drop"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Feature C: Deals & Contracts ── */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {lang === "ar" ? "الصفقات والعقود / Deals & Contracts" : "Deals & Contracts / الصفقات والعقود"}
            </h3>

            {assignments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                {lang === "ar"
                  ? "لا توجد صفقات أو عقود نشطة"
                  : "No active deals or contracts"}
              </p>
            ) : (
              <div className="space-y-2">
                {assignments.map((item: any, idx: number) => {
                  const isReservation = item.type === "reservation";
                  const isLease = item.type === "lease";
                  const href = isReservation ? "/dashboard/deals" : "/dashboard/contracts";
                  const typeLabel = isReservation
                    ? lang === "ar" ? "حجز" : "Reservation"
                    : isLease
                      ? lang === "ar" ? "إيجار" : "Lease"
                      : lang === "ar" ? "بيع" : "Sale";

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border/50 bg-muted/10"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-foreground">
                            {item.unitNumber ?? item.unitId}
                          </span>
                          <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                            {typeLabel}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {item.building}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                              item.status === "CONFIRMED" || item.status === "SIGNED" || item.status === "ACTIVE"
                                ? "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800"
                                : "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800"
                            )}
                          >
                            {item.status}
                          </span>
                        </div>
                      </div>
                      <a
                        href={href}
                        className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline underline-offset-2 shrink-0"
                      >
                        {lang === "ar" ? "عرض" : "View"}
                        <DirectionalIcon icon={ChevronRight} className="h-3 w-3" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button
            variant="secondary"
            style={{ display: "inline-flex" }}
            className="w-full"
            onClick={onClose}
          >
            {lang === "ar" ? "إغلاق" : "Close"}
          </Button>
        </div>
      </div>

      {/* ── Feature A: Edit Profile Modal ── */}
      <ResponsiveDialog
        open={showEditModal}
        onOpenChange={(open) => { if (!open) setShowEditModal(false); }}
        title={lang === "ar" ? "تعديل الملف الشخصي" : "Edit Profile"}
        description={
          lang === "ar"
            ? `تعديل بيانات ${customer.name}`
            : `Update details for ${customer.name}`
        }
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => setShowEditModal(false)}
              disabled={savingEdit}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              form="crm-edit-profile-form"
              style={{ display: "inline-flex" }}
              className="gap-2"
              disabled={savingEdit}
            >
              {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ar" ? "حفظ التغييرات" : "Save Changes"}
            </Button>
          </div>
        }
      >
        <form
          id="crm-edit-profile-form"
          dir={lang === "ar" ? "rtl" : "ltr"}
          onSubmit={(e) => {
            e.preventDefault();
            handleEditSubmit();
          }}
        >
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                {lang === "ar" ? "الاسم الكامل *" : "Full Name *"}
              </label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder={lang === "ar" ? "الاسم بالكامل" : "Full name"}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                {lang === "ar" ? "الاسم بالعربية" : "Arabic Name"}
              </label>
              <Input
                value={editForm.nameArabic}
                onChange={(e) => setEditForm({ ...editForm, nameArabic: e.target.value })}
                placeholder="الاسم بالعربية"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                {lang === "ar" ? "رقم الجوال" : "Phone"}
              </label>
              <SaudiPhoneInput
                value={editForm.phone}
                onChange={(e164) => setEditForm({ ...editForm, phone: e164 })}
                placeholder="+966 5x xxx xxxx"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                {lang === "ar" ? "البريد الإلكتروني" : "Email"}
              </label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="email@example.com"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                {lang === "ar" ? "المصدر" : "Source"}
              </label>
              <select
                value={editForm.source}
                onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{lang === "ar" ? "اختر المصدر" : "Select source"}</option>
                {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label[lang]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                {lang === "ar" ? "الميزانية (ريال)" : "Budget (SAR)"}
              </label>
              <Input
                type="number"
                value={editForm.budget}
                onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                placeholder={lang === "ar" ? "مثال: 500000" : "e.g. 500000"}
                dir="ltr"
                min="0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                {lang === "ar" ? "نوع العقار المطلوب" : "Property Interest"}
              </label>
              <select
                value={editForm.propertyTypeInterest}
                onChange={(e) => setEditForm({ ...editForm, propertyTypeInterest: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{lang === "ar" ? "اختر النوع" : "Select type"}</option>
                {PROPERTY_TYPES.map((pt) => (
                  <option key={pt.key} value={pt.key}>{pt.label[lang]}</option>
                ))}
              </select>
            </div>
            {teamMembers.length > 0 && (
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-bold text-muted-foreground">
                  {lang === "ar" ? "المسؤول" : "Agent"}
                </label>
                <select
                  value={editForm.agentId}
                  onChange={(e) => setEditForm({ ...editForm, agentId: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{lang === "ar" ? "غير معين" : "Unassigned"}</option>
                  {teamMembers.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {editError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {editError}
            </p>
          )}
          {editSuccess && (
            <p className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {lang === "ar" ? "تم الحفظ بنجاح" : "Saved successfully"}
            </p>
          )}
        </form>
      </ResponsiveDialog>

      {/* ── Feature B: Link Property Modal ── */}
      <ResponsiveDialog
        open={showLinkModal}
        onOpenChange={(open) => { if (!open) setShowLinkModal(false); }}
        title={lang === "ar" ? "ربط عقار / Link Property" : "Link Property / ربط عقار"}
        description={
          lang === "ar"
            ? "اختر عقاراً متاحاً وحدد نية العميل (شراء أو إيجار)"
            : "Select an available property and set the client's intent (buy or rent)"
        }
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => setShowLinkModal(false)}
              disabled={savingLink}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              style={{ display: "inline-flex" }}
              className="gap-2"
              onClick={handleConfirmLink}
              disabled={!linkSelectedUnit || !linkIntent || savingLink}
            >
              {savingLink && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ar" ? "ربط العقار" : "Link Property"}
            </Button>
          </div>
        }
      >
        <div dir={lang === "ar" ? "rtl" : "ltr"} className="space-y-4 py-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={linkUnitSearch}
                onChange={(e) => setLinkUnitSearch(e.target.value)}
                placeholder={lang === "ar" ? "ابحث برقم الوحدة أو المدينة..." : "Search by unit number or city..."}
                className="w-full h-10 bg-background border border-input rounded-lg ps-10 pe-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </div>

            {/* Unit list */}
            {loadingUnits ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUnits.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {lang === "ar" ? "لا توجد وحدات متاحة" : "No available units found"}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border rounded-lg p-2">
                {filteredUnits.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => {
                      setLinkSelectedUnit(unit);
                      setLinkIntent("");
                    }}
                    className={cn(
                      "w-full text-start p-2.5 rounded-lg border transition-colors",
                      linkSelectedUnit?.id === unit.id
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-muted/30"
                    )}
                    style={{ display: "block" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground">{unit.number}</span>
                        <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          {PROPERTY_TYPES.find(pt => pt.key === unit.type)?.label[lang] ?? unit.type}
                        </span>
                        {unit.city && (
                          <span className="text-[10px] text-muted-foreground">{unit.city}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground text-end shrink-0">
                        {unit.markupPrice && <div>{formatSAR(unit.markupPrice, lang)}</div>}
                        {unit.rentalPrice && <div className="text-violet-600">{formatSAR(unit.rentalPrice, lang)}/{lang === "ar" ? "شهر" : "mo"}</div>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Intent selection — shown after unit is selected */}
            {linkSelectedUnit && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground">
                  {lang === "ar" ? "نية العميل" : "Client Intent"}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLinkIntent("BUY")}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors",
                      linkIntent === "BUY"
                        ? "border-blue-400/50 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                        : "border-border text-muted-foreground hover:bg-muted/30"
                    )}
                    style={{ display: "inline-flex", justifyContent: "center" }}
                  >
                    {lang === "ar" ? "شراء" : "Buy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkIntent("RENT")}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors",
                      linkIntent === "RENT"
                        ? "border-violet-400/50 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                        : "border-border text-muted-foreground hover:bg-muted/30"
                    )}
                    style={{ display: "inline-flex", justifyContent: "center" }}
                  >
                    {lang === "ar" ? "إيجار" : "Rent"}
                  </button>
                </div>
              </div>
            )}

            {linkError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {linkError}
              </p>
            )}
        </div>
      </ResponsiveDialog>

      {/* ── Feature B: Drop Interest Confirm ── */}
      <ResponsiveDialog
        open={showDropConfirm}
        onOpenChange={(open) => { if (!open) setShowDropConfirm(false); }}
        title={lang === "ar" ? "إسقاط الاهتمام" : "Drop Interest"}
        description={
          lang === "ar"
            ? "هل تريد إسقاط هذا الاهتمام؟ / Drop this interest?"
            : "Drop this interest? / هل تريد إسقاط هذا الاهتمام؟"
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => setShowDropConfirm(false)}
              disabled={droppingLoading}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="danger"
              style={{ display: "inline-flex" }}
              className="gap-2"
              onClick={handleDropInterest}
              disabled={droppingLoading}
            >
              {droppingLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ar" ? "إسقاط" : "Drop"}
            </Button>
          </div>
        }
      >
        {null}
      </ResponsiveDialog>

      {/* ── Feature B: Convert to Deal Modal ── */}
      <ResponsiveDialog
        open={showConvertDealModal}
        onOpenChange={(open) => { if (!open) setShowConvertDealModal(false); }}
        title={lang === "ar" ? "تحويل لصفقة / Convert to Deal" : "Convert to Deal / تحويل لصفقة"}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => setShowConvertDealModal(false)}
              disabled={savingConvert}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              form="crm-convert-deal-form"
              style={{ display: "inline-flex" }}
              className="gap-2"
              disabled={!convertAmount || !convertExpiry || savingConvert}
            >
              {savingConvert && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ar" ? "إنشاء الصفقة" : "Create Deal"}
            </Button>
          </div>
        }
      >
        <form
          id="crm-convert-deal-form"
          dir={lang === "ar" ? "rtl" : "ltr"}
          onSubmit={(e) => {
            e.preventDefault();
            handleConvertInterest();
          }}
        >
          {convertingInterest && (
            <p className="text-sm text-muted-foreground mb-2">
              {lang === "ar" ? "وحدة: " : "Unit: "}
              <strong>{convertingInterest.unit?.number}</strong>
              {convertingInterest.unit?.city ? ` — ${convertingInterest.unit.city}` : ""}
            </p>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                {lang === "ar" ? "المبلغ (ريال)" : "Amount (SAR)"}
              </label>
              <Input
                type="number"
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                placeholder={lang === "ar" ? "أدخل المبلغ" : "Enter amount"}
                dir="ltr"
                min="0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">
                {lang === "ar" ? "تاريخ انتهاء الحجز *" : "Reservation Expiry Date *"}
              </label>
              <Input
                type="date"
                value={convertExpiry}
                onChange={(e) => setConvertExpiry(e.target.value)}
                min={todayStr}
              />
            </div>

            {convertError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {convertError}
              </p>
            )}
          </div>
        </form>
      </ResponsiveDialog>
    </>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({
  customer,
  lang,
  showPii,
  onDragStart,
  onViewProfile,
  onDelete,
  canDelete,
}: {
  customer: any;
  lang: "ar" | "en";
  showPii: boolean;
  onDragStart: (e: React.DragEvent, customerId: string) => void;
  onViewProfile: (customer: any) => void;
  onDelete: (customer: any) => void;
  canDelete: boolean;
}) {
  // Quick-action contact targets. Only render actions whose data exists.
  const rawPhone = typeof customer.phone === "string" ? customer.phone : "";
  const phoneDigits = rawPhone.replace(/\D/g, "");
  const hasPhone = phoneDigits.length > 0 && rawPhone !== "•••••••••••";
  const email = typeof customer.email === "string" ? customer.email : "";
  const hasEmail = email.length > 0 && email !== "•••••••••••";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, customer.id)}
      className="group relative bg-card border border-border rounded-xl p-4 cursor-grab active:cursor-grabbing hover:border-primary/20 hover:shadow-sm transition-all"
    >
      {/* Name + actions */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">
            {customer.name}
          </p>
          {customer.nameArabic && customer.nameArabic !== customer.name && (
            <p className="text-[11px] text-muted-foreground truncate">
              {customer.nameArabic}
            </p>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onViewProfile(customer)}
            className="h-6 w-6 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
            title={lang === "ar" ? "عرض الملف" : "View Profile"}
          >
            <Eye className="h-3 w-3" />
          </button>
          {canDelete && (
            <button
              onClick={() => onDelete(customer)}
              className="h-6 w-6 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
              title={lang === "ar" ? "حذف" : "Delete"}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-1.5">
        {customer.phone && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate font-mono">
              {showPii ? customer.phone : maskPhone(customer.phone)}
            </span>
          </div>
        )}
        {customer.budget && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Star className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {Number(customer.budget).toLocaleString(lang === "ar" ? "ar-SA" : "en-SA")} {lang === "ar" ? "ر.س" : "SAR"}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
        {customer.source && SOURCE_LABELS[customer.source] && (
          <span className="text-[10px] text-muted-foreground">
            {(SOURCE_LABELS[customer.source] as { ar: string; en: string })[lang]}
          </span>
        )}
        <button
          onClick={() => onViewProfile(customer)}
          className="ms-auto flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline underline-offset-2 transition-colors"
        >
          {lang === "ar" ? "عرض الملف" : "View Profile"}
          <DirectionalIcon icon={ChevronRight} className="h-3 w-3" />
        </button>
      </div>

      {/* Hover quick-actions — revealed on card hover only */}
      <div
        className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {hasPhone && (
          <a
            href={`tel:${rawPhone}`}
            aria-label={lang === "ar" ? "اتصال هاتفي" : "Call phone"}
            title={lang === "ar" ? "اتصال" : "Call"}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
        {hasPhone && (
          <a
            href={`https://wa.me/${phoneDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={lang === "ar" ? "فتح واتساب" : "Open WhatsApp"}
            title={lang === "ar" ? "واتساب" : "WhatsApp"}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}
        {hasEmail && (
          <a
            href={`mailto:${email}`}
            aria-label={lang === "ar" ? "إرسال بريد إلكتروني" : "Send email"}
            title={lang === "ar" ? "بريد إلكتروني" : "Email"}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          type="button"
          onClick={() => onViewProfile(customer)}
          aria-label={lang === "ar" ? "فتح الملف الشخصي" : "Open profile"}
          title={lang === "ar" ? "فتح الملف" : "Open profile"}
          className="ms-auto h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          style={{ display: "inline-flex" }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const EMPTY_NEW_CUSTOMER = {
  name: "",
  phone: "",
  email: "",
  nationalId: "",
  nameArabic: "",
  source: "",
  status: "NEW",
  personType: "",
  gender: "",
  dateOfBirth: "",
  nationality: "",
  maritalStatus: "",
  budget: "",
  propertyTypeInterest: "",
  agentId: "",
};

export default function CRMPage() {
  const { lang } = useLanguage();
  const { can } = usePermissions();

  const [customers, setCustomers] = React.useState<any[]>([]);
  const [teamMembers, setTeamMembers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"kanban" | "list">("kanban");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [showLost, setShowLost] = React.useState(false);
  const [showPii, setShowPii] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Add modal
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newCustomer, setNewCustomer] = React.useState(EMPTY_NEW_CUSTOMER);

  // Add modal — property linking
  const [pageAvailableUnits, setPageAvailableUnits] = React.useState<any[]>([]);
  const [newCustUnitSearch, setNewCustUnitSearch] = React.useState("");
  const [newCustSelectedUnit, setNewCustSelectedUnit] = React.useState<any | null>(null);
  const [newCustIntent, setNewCustIntent] = React.useState<"BUY" | "RENT" | null>(null);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<any>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Profile drawer
  const [drawerCustomer, setDrawerCustomer] = React.useState<any>(null);
  const [drawerAssignments, setDrawerAssignments] = React.useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = React.useState(false);

  // Lost reason modal (triggered when dropping into LOST)
  const [showLostModal, setShowLostModal] = React.useState(false);
  const [lostTarget, setLostTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [lostReason, setLostReason] = React.useState("");
  const [savingLost, setSavingLost] = React.useState(false);

  // Drag state
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = React.useState<string | null>(null);

  // Mobile-only UI state (reuses desktop state for search/statusFilter/showLost)
  const [mobileTab, setMobileTab] = React.useState<"pipeline" | "leads" | "customers">("pipeline");
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  const canWrite = can("crm:write") || can("customers:write");
  const canDelete = can("crm:delete") || can("customers:delete");
  const canExport = can("crm:export") || can("customers:export");
  const hasPiiAccess = can("customers:read_pii");

  // ─── Load ───────────────────────────────────────────────────────────────────

  React.useEffect(() => {
    loadData();
  }, []);

  // Load assignments when drawer customer changes
  React.useEffect(() => {
    if (drawerCustomer) {
      loadAssignments(drawerCustomer.id);
    } else {
      setDrawerAssignments([]);
    }
  }, [drawerCustomer?.id]);

  async function loadAssignments(customerId: string) {
    setLoadingAssignments(true);
    try {
      const data = await getCustomerUnitAssignments(customerId);
      setDrawerAssignments(data);
    } catch {
      // silent
    } finally {
      setLoadingAssignments(false);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const [data, members, units] = await Promise.all([getCustomers(), getTeamMembers(), getAvailableUnitsForInterest()]);
      setCustomers(data);
      setTeamMembers(members.filter((m: any) => ["ADMIN", "MANAGER", "AGENT"].includes(m.role)));
      setPageAvailableUnits(units);
    } catch {
      setError(
        lang === "ar"
          ? "تعذّر تحميل بيانات العملاء. يرجى المحاولة مجدداً."
          : "Failed to load CRM data. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // ─── Filtered ───────────────────────────────────────────────────────────────

  const filteredCustomers = React.useMemo(() => {
    return customers.filter((c) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.nameArabic?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q);
      const matchStatus = !statusFilter || c.status === statusFilter;
      const matchLost = showLost ? c.status === "LOST" : c.status !== "LOST";
      return matchSearch && matchStatus && (statusFilter ? true : matchLost);
    });
  }, [customers, search, statusFilter, showLost]);

  // ─── Add modal: unit search + budget comparison ─────────────────────────────

  const newCustFilteredUnits = React.useMemo(() => {
    if (!newCustUnitSearch.trim()) return [];
    const q = newCustUnitSearch.toLowerCase().trim();
    return pageAvailableUnits.filter((u) =>
      u.number?.toLowerCase().includes(q) ||
      u.city?.toLowerCase().includes(q) ||
      u.type?.toLowerCase().includes(q) ||
      u.buildingName?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [newCustUnitSearch, pageAvailableUnits]);

  function getBudgetTag(unitPrice: number | null | undefined, budget: string, intent: "BUY" | "RENT" | null) {
    const b = Number(budget);
    if (!unitPrice || !b || b <= 0) return null;
    const ratio = unitPrice / b;
    if (ratio > 1.05) return {
      label: lang === "ar" ? "فوق الميزانية" : "Over Budget",
      color: "text-destructive bg-destructive/10 dark:bg-destructive/20",
    };
    if (ratio >= 0.9) return {
      label: lang === "ar" ? "ضمن الميزانية" : "On Budget",
      color: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30",
    };
    return {
      label: lang === "ar" ? "أقل من الميزانية" : "Under Budget",
      color: "text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30",
    };
  }

  function getUnitPrice(unit: any, intent: "BUY" | "RENT" | null) {
    if (intent === "RENT") return unit.rentalPrice ?? null;
    return unit.markupPrice ?? unit.price ?? null;
  }

  // ─── KPIs ───────────────────────────────────────────────────────────────────

  const kpis = React.useMemo(
    () => ({
      total: customers.filter((c) => c.status !== "LOST").length,
      newLeads: customers.filter((c) => c.status === "NEW").length,
      inProgress: customers.filter((c) =>
        ["CONTACTED", "QUALIFIED", "VIEWING", "NEGOTIATION"].includes(c.status)
      ).length,
      lost: customers.filter((c) => c.status === "LOST").length,
    }),
    [customers]
  );

  // ─── Mobile-only derivations ─────────────────────────────────────────────
  // Declared here (before the `if (loading)` early-return) so hook order is stable.
  const mobileLeads = React.useMemo(
    () =>
      filteredCustomers.filter((c) =>
        ["NEW", "CONTACTED", "QUALIFIED", "VIEWING", "NEGOTIATION", "INTERESTED"].includes(c.status),
      ),
    [filteredCustomers],
  );
  const mobileCustomers = React.useMemo(
    () =>
      filteredCustomers.filter((c) =>
        ["CONVERTED", "RESERVED", "ACTIVE_TENANT", "PAST_TENANT"].includes(c.status),
      ),
    [filteredCustomers],
  );

  // ─── List-view columns (TanStack DataTable) ────────────────────────────────

  const listColumns = React.useMemo<ColumnDef<any, unknown>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: lang === "ar" ? "الاسم" : "Name",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div>
              <p className="font-semibold text-foreground">{c.name}</p>
              {c.nameArabic && c.nameArabic !== c.name && (
                <p className="text-xs text-muted-foreground">{c.nameArabic}</p>
              )}
            </div>
          );
        },
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: lang === "ar" ? "الهاتف" : "Phone",
        cell: ({ row }) => (
          <span className="font-mono text-sm text-muted-foreground">
            {showPii ? row.original.phone : maskPhone(row.original.phone)}
          </span>
        ),
      },
      {
        id: "budget",
        accessorKey: "budget",
        header: lang === "ar" ? "الميزانية" : "Budget",
        sortingFn: (a, b) => Number(a.original.budget ?? 0) - Number(b.original.budget ?? 0),
        cell: ({ row }) => {
          const b = row.original.budget;
          return (
            <span className="text-sm text-muted-foreground">
              {b
                ? `${Number(b).toLocaleString(lang === "ar" ? "ar-SA" : "en-SA")} ${lang === "ar" ? "ر.س" : "SAR"}`
                : "—"}
            </span>
          );
        },
        meta: { numeric: true },
      },
      {
        id: "status",
        accessorKey: "status",
        header: lang === "ar" ? "الحالة" : "Status",
        cell: ({ row }) => {
          const statusCfg = getStatusConfig(row.original.status);
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                statusCfg.color,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dotColor)} />
              {statusCfg.label[lang]}
            </span>
          );
        },
      },
      {
        id: "source",
        accessorKey: "source",
        header: lang === "ar" ? "المصدر" : "Source",
        cell: ({ row }) => {
          const s = row.original.source;
          return (
            <span className="text-sm text-muted-foreground">
              {s && SOURCE_LABELS[s]
                ? (SOURCE_LABELS[s] as { ar: string; en: string })[lang]
                : "—"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: false,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDrawerCustomer(c);
                }}
                aria-label={lang === "ar" ? "عرض الملف" : "View profile"}
                className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                style={{ display: "inline-flex" }}
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDelete(c);
                  }}
                  aria-label={lang === "ar" ? "حذف" : "Delete"}
                  className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
                  style={{ display: "inline-flex" }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        },
        meta: { align: "end" },
      },
    ],
    // openDelete is a stable function declared in this component; setDrawerCustomer is a stable setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, showPii, canDelete],
  );

  // ─── Kanban drag ────────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, customerId: string) {
    setDraggingId(customerId);
    e.dataTransfer.effectAllowed = "move";
  }

  async function handleDrop(status: string) {
    if (!draggingId) return;
    const customer = customers.find((c) => c.id === draggingId);
    setDraggingId(null);
    setDragOverStatus(null);

    if (status === "LOST") {
      // Open the lost reason modal instead of immediately updating
      setLostTarget({ id: draggingId, name: customer?.name ?? "" });
      setLostReason("");
      setShowLostModal(true);
      return;
    }

    const prev = customers;
    setCustomers((c) =>
      c.map((cust) => (cust.id === draggingId ? { ...cust, status } : cust))
    );
    try {
      await updateCustomerStatus(draggingId, status);
    } catch {
      setCustomers(prev);
      setError(
        lang === "ar"
          ? "فشل تحديث حالة العميل. يرجى المحاولة مجدداً."
          : "Failed to update status. Please try again."
      );
    }
  }

  // ─── Mark as Lost (with reason) ─────────────────────────────────────────────

  async function confirmLost() {
    if (!lostTarget || !lostReason) return;
    setSavingLost(true);
    const prev = customers;
    setCustomers((c) =>
      c.map((cust) =>
        cust.id === lostTarget.id
          ? { ...cust, status: "LOST", lostReason }
          : cust
      )
    );
    try {
      await updateCustomerStatus(lostTarget.id, "LOST", lostReason);
      setShowLostModal(false);
      setLostTarget(null);
    } catch {
      setCustomers(prev);
      setError(
        lang === "ar"
          ? "فشل تحديث حالة العميل. يرجى المحاولة مجدداً."
          : "Failed to update status. Please try again."
      );
    } finally {
      setSavingLost(false);
    }
  }

  // ─── Add Customer ────────────────────────────────────────────────────────────

  async function handleAddCustomer() {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      setError(
        lang === "ar"
          ? "الاسم والهاتف حقلان مطلوبان."
          : "Name and phone are required."
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createCustomer({
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email || undefined,
        nationalId: newCustomer.nationalId || undefined,
        nameArabic: newCustomer.nameArabic || undefined,
        source: newCustomer.source || undefined,
        status: newCustomer.status || undefined,
        personType: (newCustomer.personType as any) || undefined,
        gender: (newCustomer.gender as any) || undefined,
        dateOfBirth: newCustomer.dateOfBirth || undefined,
        nationality: newCustomer.nationality || undefined,
        maritalStatus: newCustomer.maritalStatus || undefined,
        budget: newCustomer.budget ? Number(newCustomer.budget) : undefined,
        agentId: newCustomer.agentId || undefined,
      });

      // Link property interest if a unit + intent was selected
      if (newCustSelectedUnit && newCustIntent) {
        await addCustomerInterest(created.id, newCustSelectedUnit.id, newCustIntent);
      }

      setCustomers((prev) => [created, ...prev]);
      setShowAddModal(false);
      setNewCustomer(EMPTY_NEW_CUSTOMER);
      setNewCustSelectedUnit(null);
      setNewCustIntent(null);
      setNewCustUnitSearch("");
    } catch (err: any) {
      // Only surface friendly messages — never raw Prisma/technical errors
      const msg = err?.message ?? "";
      const isFriendly = msg.length < 200 && !msg.includes("Prisma") && !msg.includes("Invalid `") && !msg.includes("invocation");
      setError(
        isFriendly && msg
          ? msg
          : lang === "ar"
            ? "تعذّر حفظ جهة الاتصال. يرجى التحقق من البيانات والمحاولة مجدداً."
            : "Failed to save contact. Please check the details and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  function openDelete(customer: any) {
    setDeleteTarget(customer);
    setShowDeleteDialog(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCustomer(deleteTarget.id);
      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    } catch (err: any) {
      setError(
        err?.message ||
          (lang === "ar"
            ? "فشل حذف العميل. يرجى المحاولة مجدداً."
            : "Failed to delete contact. Please try again.")
      );
    } finally {
      setDeleting(false);
    }
  }

  // ─── Export (CSV) ────────────────────────────────────────────────────────────

  function handleExport() {
    const rows = [
      ["Name", "Phone", "Email", "Status", "Source", "Budget", "Property Interest"],
      ...filteredCustomers.map((c) => [
        c.name,
        showPii ? c.phone : maskPhone(c.phone),
        showPii ? (c.email ?? "") : "",
        c.status,
        c.source ?? "",
        c.budget ?? "",
        c.propertyTypeInterest ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crm-contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Kanban columns — pipeline stages only (LOST shown as separate toggle section)
  const kanbanColumns = showLost
    ? [
        {
          key: "LOST",
          label: { ar: "خسارة", en: "Lost" },
          color: "bg-destructive/10 text-destructive border-destructive/30",
          dotColor: "bg-destructive",
        },
      ]
    : PIPELINE_STAGES;

  function toneForStatus(status: string): "default" | "blue" | "green" | "amber" | "red" | "purple" {
    switch (status) {
      case "NEW":
        return "blue";
      case "CONTACTED":
      case "INTERESTED":
        return "purple";
      case "QUALIFIED":
      case "VIEWING":
        return "amber";
      case "NEGOTIATION":
      case "CONVERTED":
      case "ACTIVE_TENANT":
      case "RESERVED":
        return "green";
      case "LOST":
      case "PAST_TENANT":
        return "red";
      default:
        return "default";
    }
  }

  function customerCardStatus(
    status: string,
  ): "hot" | "warm" | "cold" | "converted" | "churned" | "neutral" {
    switch (status) {
      case "NEW":
        return "hot";
      case "CONTACTED":
      case "QUALIFIED":
      case "VIEWING":
      case "NEGOTIATION":
      case "INTERESTED":
        return "warm";
      case "CONVERTED":
      case "RESERVED":
      case "ACTIVE_TENANT":
        return "converted";
      case "LOST":
      case "PAST_TENANT":
        return "churned";
      default:
        return "neutral";
    }
  }

  function renderMobileCardList(rows: any[], emptyLabel: { ar: string; en: string }) {
    if (rows.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">{emptyLabel[lang]}</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {rows.map((c) => {
          const phoneDisplay = c.phone
            ? showPii
              ? c.phone
              : maskPhone(c.phone)
            : null;
          const interest = c.propertyTypeInterest
            ? PROPERTY_TYPES.find((pt) => pt.key === c.propertyTypeInterest)
                ?.label[lang] ?? c.propertyTypeInterest
            : null;
          const activity =
            phoneDisplay && interest
              ? `${phoneDisplay} · ${interest}`
              : phoneDisplay || interest || null;
          return (
            <CustomerCard
              key={c.id}
              name={c.name}
              lastActivity={activity}
              status={customerCardStatus(c.status)}
              phone={showPii ? c.phone ?? null : null}
              onClick={() => setDrawerCustomer(c)}
              lang={lang}
            />
          );
        })}
      </div>
    );
  }

  function openAddCustomerModal() {
    setNewCustomer(EMPTY_NEW_CUSTOMER);
    setNewCustSelectedUnit(null);
    setNewCustIntent(null);
    setNewCustUnitSearch("");
    setShowAddModal(true);
  }

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        title={lang === "ar" ? "إدارة العملاء" : "CRM"}
        lang={lang}
        trailing={
          <button
            type="button"
            onClick={() => setShowMobileFilters(true)}
            aria-label={lang === "ar" ? "تصفية" : "Filter"}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full",
              "text-foreground hover:bg-muted/60 active:bg-muted transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
            )}
          >
            <Filter className="h-5 w-5" aria-hidden="true" />
          </button>
        }
      />

      <div className="px-4 pt-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "ar" ? "بحث بالاسم أو الهاتف..." : "Search by name or phone..."}
            className="h-10 ps-9"
          />
        </div>
      </div>

      <div className="px-4 pt-3">
        <MobileTabs
          ariaLabel={lang === "ar" ? "تبويبات العملاء" : "CRM tabs"}
          active={mobileTab}
          onChange={(k) => setMobileTab(k as "pipeline" | "leads" | "customers")}
          items={[
            { key: "pipeline", label: lang === "ar" ? "خط الأنابيب" : "Pipeline" },
            {
              key: "leads",
              label: `${lang === "ar" ? "العملاء المحتملون" : "Leads"} (${mobileLeads.length})`,
            },
            {
              key: "customers",
              label: `${lang === "ar" ? "العملاء" : "Customers"} (${mobileCustomers.length})`,
            },
          ]}
        />
      </div>

      <div className="flex-1 px-4 pb-24 pt-3">
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {mobileTab === "pipeline" ? (
          <MobileKanban
            columns={PIPELINE_STAGES.map((stage) => {
              const stageCustomers = filteredCustomers.filter((c) => c.status === stage.key);
              return {
                key: stage.key,
                title: (
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", stage.dotColor)} aria-hidden="true" />
                    <span>{stage.label[lang]}</span>
                    <span className="text-muted-foreground">({stageCustomers.length})</span>
                  </span>
                ),
                children:
                  stageCustomers.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      {lang === "ar" ? "لا يوجد" : "Empty"}
                    </p>
                  ) : (
                    stageCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setDrawerCustomer(c)}
                        className={cn(
                          "w-full rounded-xl border border-border bg-card p-3 text-start",
                          "transition-colors hover:border-foreground/20 active:scale-[0.99]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
                        )}
                      >
                        <div className="truncate text-sm font-semibold text-foreground">
                          {c.name}
                        </div>
                        {c.phone ? (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" aria-hidden="true" />
                            <span className="truncate">
                              {showPii ? c.phone : maskPhone(c.phone)}
                            </span>
                          </div>
                        ) : null}
                        {c.budget ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatSAR(c.budget, lang)}
                          </div>
                        ) : null}
                      </button>
                    ))
                  ),
              };
            })}
          />
        ) : mobileTab === "leads" ? (
          renderMobileCardList(mobileLeads, {
            ar: "لا يوجد عملاء محتملون مطابقون.",
            en: "No matching leads.",
          })
        ) : (
          renderMobileCardList(mobileCustomers, {
            ar: "لا يوجد عملاء مطابقون.",
            en: "No matching customers.",
          })
        )}
      </div>

      {canWrite && (
        <FAB
          icon={Plus}
          label={lang === "ar" ? "إضافة عميل" : "New Contact"}
          onClick={openAddCustomerModal}
        />
      )}

      {/* Mobile filters sheet */}
      <BottomSheet
        open={showMobileFilters}
        onOpenChange={setShowMobileFilters}
        title={lang === "ar" ? "تصفية" : "Filters"}
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => {
                setStatusFilter("");
                setShowLost(false);
              }}
            >
              {lang === "ar" ? "مسح" : "Reset"}
            </Button>
            <Button
              style={{ display: "inline-flex" }}
              onClick={() => setShowMobileFilters(false)}
            >
              {lang === "ar" ? "تطبيق" : "Apply"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {lang === "ar" ? "الحالة" : "Status"}
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("");
                  setShowLost(false);
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  !statusFilter && !showLost
                    ? "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "border-border bg-card text-muted-foreground"
                )}
              >
                {lang === "ar" ? "الكل" : "All"}
              </button>
              {PIPELINE_STAGES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(statusFilter === s.key ? "" : s.key);
                    setShowLost(false);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === s.key
                      ? "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {s.label[lang]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setShowLost((v) => !v);
                  setStatusFilter("");
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  showLost
                    ? "border-transparent bg-destructive text-destructive-foreground"
                    : "border-border bg-card text-muted-foreground"
                )}
              >
                {lang === "ar" ? "الخسائر فقط" : "Lost only"}
              </button>
            </div>
          </div>

          {hasPiiAccess && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {lang === "ar" ? "الخصوصية" : "Privacy"}
              </h4>
              <button
                type="button"
                onClick={() => setShowPii((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  showPii
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-border bg-card text-muted-foreground"
                )}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {showPii
                  ? lang === "ar"
                    ? "إخفاء البيانات الحساسة"
                    : "Hide PII"
                  : lang === "ar"
                    ? "عرض البيانات الحساسة"
                    : "Show PII"}
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Handshake className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {lang === "ar"
                ? "تسحب البطاقات في خط الأنابيب على النسخة الكاملة."
                : "Drag-and-drop pipeline available on desktop."}
            </span>
            <Building2 className="hidden h-4 w-4 shrink-0" aria-hidden="true" />
          </div>
        </div>
      </BottomSheet>
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div
      className="space-y-8 animate-in fade-in duration-500"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* ── Header ── */}
      <PageIntro
        title={lang === "ar" ? "إدارة العملاء" : "CRM"}
        description={
          lang === "ar"
            ? "تتبع العملاء المحتملين وإدارة خط أنابيب المبيعات"
            : "Track leads and manage your sales pipeline"
        }
        actions={
          <>
            {hasPiiAccess && (
              <button
                onClick={() => setShowPii((v) => !v)}
                className={cn(
                  "h-8 px-3 rounded-lg border text-xs font-medium transition-colors",
                  showPii
                    ? "border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                )}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Eye className="h-3.5 w-3.5" />
                {showPii
                  ? lang === "ar" ? "إخفاء البيانات الحساسة" : "Hide PII"
                  : lang === "ar" ? "عرض البيانات الحساسة" : "Show PII"}
              </button>
            )}
            {canExport && (
              <Button
                variant="outline"
                size="sm"
                style={{ display: "inline-flex" }}
                className="gap-2"
                onClick={handleExport}
              >
                <FileDown className="h-3.5 w-3.5" />
                {lang === "ar" ? "تصدير" : "Export"}
              </Button>
            )}
            {canWrite && (
              <Button
                variant="primary"
                size="sm"
                style={{ display: "inline-flex" }}
                className="gap-2"
                onClick={() => setShowAddModal(true)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {lang === "ar" ? "إضافة عميل" : "Add Customer"}
              </Button>
            )}
          </>
        }
      />

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600" aria-label={lang === "ar" ? "إغلاق" : "Dismiss"}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label={lang === "ar" ? "إجمالي جهات الاتصال" : "Active Contacts"}
          value={kpis.total}
          subtitle={lang === "ar" ? "جميع العملاء النشطين" : "All active contacts"}
          icon={<Users className="h-[18px] w-[18px]" />}
          accentColor="primary"
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "عملاء جدد" : "New Leads"}
          value={kpis.newLeads}
          subtitle={lang === "ar" ? "بانتظار التواصل" : "Awaiting first contact"}
          icon={<UserPlus className="h-[18px] w-[18px]" />}
          accentColor="info"
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "في خط الأنابيب" : "In Pipeline"}
          value={kpis.inProgress}
          subtitle={lang === "ar" ? "في مراحل متقدمة" : "Contacted through Negotiation"}
          icon={<TrendingUp className="h-[18px] w-[18px]" />}
          accentColor="warning"
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "خسائر" : "Lost Leads"}
          value={kpis.lost}
          subtitle={lang === "ar" ? "عملاء خرجوا من المسار" : "Exited pipeline"}
          icon={<AlertTriangle className="h-[18px] w-[18px]" />}
          accentColor="warning"
          loading={loading}
        />
      </div>

      {/* ── Toolbar ── */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setStatusFilter(""); setShowLost(false); }}
              className={cn(
                "px-3.5 py-2 rounded-full text-sm font-medium border transition-colors",
                !statusFilter && !showLost
                  ? "border-primary/30 bg-primary/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              )}
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? "الكل" : "All"} {customers.filter(c => c.status !== "LOST").length}
            </button>
            {PIPELINE_STAGES.map((s) => {
              const count = customers.filter((c) => c.status === s.key).length;
              return (
                <button
                  key={s.key}
                  onClick={() => { setStatusFilter(statusFilter === s.key ? "" : s.key); setShowLost(false); }}
                  className={cn(
                    "px-3.5 py-2 rounded-full text-sm font-medium border transition-colors",
                    statusFilter === s.key
                      ? "border-primary/30 bg-primary/15 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  )}
                  style={{ display: "inline-flex" }}
                >
                  {s.label[lang]} {count}
                </button>
              );
            })}
            {/* Lost toggle */}
            <button
              onClick={() => { setShowLost((v) => !v); setStatusFilter(""); }}
              className={cn(
                "px-3.5 py-2 rounded-full text-sm font-medium border transition-colors",
                showLost
                  ? "border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-400"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              )}
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? "خسائر" : "Lost"} {kpis.lost}
            </button>
          </div>

          {/* View toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("kanban")}
              className={cn(
                "px-3 py-2 rounded-full text-sm border transition-colors",
                viewMode === "kanban"
                  ? "border-primary/30 bg-primary/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/30"
              )}
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? "كانبان" : "Kanban"}
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "px-3 py-2 rounded-full text-sm border transition-colors",
                viewMode === "list"
                  ? "border-primary/30 bg-primary/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/30"
              )}
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? "قائمة" : "List"}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === "ar"
                ? "ابحث بالاسم أو رقم الهاتف..."
                : "Search by name or phone..."
            }
            className="w-full h-10 bg-background border border-input rounded-xl ps-10 pe-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
      </Card>

      {/* ── Kanban Board ── */}
      {viewMode === "kanban" && (
        <div
          className={cn(
            "grid gap-4 overflow-x-auto pb-4",
            showLost
              ? "grid-cols-1 max-w-sm"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          )}
        >
          {kanbanColumns.map((status) => {
            const colCustomers = filteredCustomers.filter(
              (c) => c.status === status.key
            );
            const isDragOver = dragOverStatus === status.key;
            const stageHue = STAGE_HUES[status.key];

            return (
              <div
                key={status.key}
                className={cn(
                  "flex flex-col gap-3 min-h-[400px] rounded-xl p-3 transition-colors",
                  isDragOver && "bg-primary/5 ring-2 ring-primary/20"
                )}
                style={
                  !isDragOver && stageHue
                    ? {
                        backgroundColor: `color-mix(in srgb, ${stageHue} 4%, hsl(var(--card)))`,
                      }
                    : undefined
                }
                onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status.key); }}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={() => handleDrop(status.key)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-1 px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={stageHue ? { backgroundColor: stageHue } : undefined}
                    />
                    <span className="text-xs font-bold text-foreground">
                      {status.label[lang]}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground bg-muted/40 rounded-full px-2 py-0.5">
                    {colCustomers.length}
                  </span>
                </div>

                {/* Cards */}
                {colCustomers.map((c) => (
                  <KanbanCard
                    key={c.id}
                    customer={c}
                    lang={lang}
                    showPii={showPii}
                    onDragStart={handleDragStart}
                    onViewProfile={setDrawerCustomer}
                    onDelete={openDelete}
                    canDelete={canDelete}
                  />
                ))}

                {/* Add shortcut (not on LOST column) */}
                {canWrite && !showLost && (
                  <button
                    onClick={() => {
                      setNewCustomer((prev) => ({ ...prev, status: status.key }));
                      setShowAddModal(true);
                    }}
                    className="mt-auto flex items-center justify-center gap-1.5 p-2 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors text-xs font-medium"
                    style={{ display: "inline-flex", width: "100%" }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {lang === "ar" ? "إضافة" : "Add"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── List View ── */}
      {viewMode === "list" && (
        <DataTable
          columns={listColumns}
          data={filteredCustomers}
          locale={lang}
          getRowId={(c) => c.id}
          pageSize={25}
          emptyTitle={lang === "ar" ? "لا توجد نتائج" : "No contacts found"}
          emptyDescription={
            lang === "ar"
              ? "حاول تعديل خيارات البحث أو الفلتر، أو أضف عميلاً جديداً."
              : "Try adjusting your search or filter, or add a new contact."
          }
          mobileCard={(c) => {
            const statusCfg = getStatusConfig(c.status);
            return (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{c.name}</p>
                    {c.nameArabic && c.nameArabic !== c.name && (
                      <p className="text-xs text-muted-foreground truncate">{c.nameArabic}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0",
                      statusCfg.color,
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dotColor)} />
                    {statusCfg.label[lang]}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">
                    {showPii ? c.phone : maskPhone(c.phone)}
                  </span>
                  <span>
                    {c.budget
                      ? `${Number(c.budget).toLocaleString(lang === "ar" ? "ar-SA" : "en-SA")} ${lang === "ar" ? "ر.س" : "SAR"}`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {c.source && SOURCE_LABELS[c.source]
                      ? (SOURCE_LABELS[c.source] as { ar: string; en: string })[lang]
                      : "—"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrawerCustomer(c);
                      }}
                      aria-label={lang === "ar" ? "عرض الملف" : "View profile"}
                      className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground"
                      style={{ display: "inline-flex" }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDelete(c);
                        }}
                        aria-label={lang === "ar" ? "حذف" : "Delete"}
                        className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground"
                        style={{ display: "inline-flex" }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }}
        />
      )}

      {/* ── Add Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div
            className="bg-card w-full max-w-lg rounded-xl shadow-2xl border border-border animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto"
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">
                {lang === "ar" ? "إضافة عميل جديد" : "Add New Customer"}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground" aria-label={lang === "ar" ? "إغلاق" : "Close"}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Required fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "الاسم الكامل *" : "Full Name *"}
                  </label>
                  <Input
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder={lang === "ar" ? "الاسم بالكامل" : "Full name"}
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "الاسم بالعربية" : "Arabic Name"}
                  </label>
                  <Input
                    value={newCustomer.nameArabic}
                    onChange={(e) => setNewCustomer({ ...newCustomer, nameArabic: e.target.value })}
                    placeholder="الاسم بالعربية"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "رقم الجوال *" : "Phone *"}
                  </label>
                  <SaudiPhoneInput
                    value={newCustomer.phone}
                    onChange={(e164) => setNewCustomer({ ...newCustomer, phone: e164 })}
                    placeholder="+966 5x xxx xxxx"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "البريد الإلكتروني" : "Email"}
                  </label>
                  <Input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    placeholder="email@example.com"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "المصدر" : "Source"}
                  </label>
                  <select
                    value={newCustomer.source}
                    onChange={(e) => setNewCustomer({ ...newCustomer, source: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{lang === "ar" ? "اختر المصدر" : "Select source"}</option>
                    {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label[lang]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "الحالة" : "Status"}
                  </label>
                  <select
                    value={newCustomer.status}
                    onChange={(e) => setNewCustomer({ ...newCustomer, status: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label[lang]}</option>
                    ))}
                  </select>
                </div>

                {/* CRM fields: Budget + Property Type */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "الميزانية (ريال)" : "Budget (SAR)"}
                  </label>
                  <Input
                    type="number"
                    value={newCustomer.budget}
                    onChange={(e) => setNewCustomer({ ...newCustomer, budget: e.target.value })}
                    placeholder={lang === "ar" ? "مثال: 500000" : "e.g. 500000"}
                    dir="ltr"
                    min="0"
                  />
                </div>
                {/* ── Link Property (Optional) ── */}
                <div className="col-span-2 space-y-2 pt-1">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    {lang === "ar" ? "ربط عقار (اختياري)" : "Link Property (Optional)"}
                  </label>

                  {/* Selected unit pill */}
                  {newCustSelectedUnit ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {newCustSelectedUnit.number}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{newCustSelectedUnit.type}</span>
                        {newCustSelectedUnit.city && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{newCustSelectedUnit.city}</span>
                          </>
                        )}
                        {newCustIntent && (
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            newCustIntent === "BUY"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                              : "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
                          )}>
                            {newCustIntent === "BUY" ? (lang === "ar" ? "شراء" : "BUY") : (lang === "ar" ? "إيجار" : "RENT")}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setNewCustSelectedUnit(null); setNewCustIntent(null); setNewCustUnitSearch(""); }}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label={lang === "ar" ? "إزالة" : "Remove"}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Search input */}
                      <div className="relative">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          value={newCustUnitSearch}
                          onChange={(e) => setNewCustUnitSearch(e.target.value)}
                          placeholder={lang === "ar" ? "ابحث برقم الوحدة أو المدينة..." : "Search by unit number or city..."}
                          className="ps-9 text-sm"
                        />
                      </div>

                      {/* Results list */}
                      {newCustUnitSearch.trim() ? (
                        newCustFilteredUnits.length > 0 ? (
                          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-48 overflow-y-auto">
                            {newCustFilteredUnits.map((unit) => {
                              const price = getUnitPrice(unit, newCustIntent);
                              const tag = getBudgetTag(price, newCustomer.budget, newCustIntent);
                              return (
                                <button
                                  key={unit.id}
                                  type="button"
                                  onClick={() => { setNewCustSelectedUnit(unit); setNewCustUnitSearch(""); }}
                                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-start hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 text-sm">
                                    <span className="font-medium text-foreground truncate">{unit.number}</span>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-muted-foreground text-xs">{unit.type}</span>
                                    {unit.city && (
                                      <>
                                        <span className="text-muted-foreground">·</span>
                                        <span className="text-muted-foreground text-xs truncate">{unit.city}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {price && (
                                      <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                                        {Number(price).toLocaleString(lang === "ar" ? "ar-SA" : "en-SA")} {lang === "ar" ? "ر.س" : "SAR"}
                                      </span>
                                    )}
                                    {tag && (
                                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", tag.color)}>
                                        {tag.label}
                                      </span>
                                    )}
                                  </div>
                                </button>
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
                          {lang === "ar" ? "ابدأ البحث للعثور على وحدات متاحة" : "Search to find available units"}
                        </div>
                      )}
                    </>
                  )}

                  {/* Intent selection — shown after unit is selected */}
                  {newCustSelectedUnit && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        {lang === "ar" ? "نوع الاهتمام" : "Interest Type"}
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewCustIntent("BUY")}
                          className={cn(
                            "flex-1 py-2 text-sm font-medium rounded-lg border transition-colors",
                            newCustIntent === "BUY"
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-border text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          {lang === "ar" ? "شراء" : "Buy"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewCustIntent("RENT")}
                          className={cn(
                            "flex-1 py-2 text-sm font-medium rounded-lg border transition-colors",
                            newCustIntent === "RENT"
                              ? "bg-violet-600 text-white border-violet-600"
                              : "border-border text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          {lang === "ar" ? "إيجار" : "Rent"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Agent Assignment */}
                {teamMembers.length > 0 && (
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "تعيين المسؤول" : "Assign Agent"}
                    </label>
                    <select
                      value={newCustomer.agentId}
                      onChange={(e) => setNewCustomer({ ...newCustomer, agentId: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">{lang === "ar" ? "غير معين" : "Unassigned"}</option>
                      {teamMembers.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
                      ))}
                    </select>
                  </div>
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
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "رقم الهوية" : "National ID"}
                    </label>
                    <NationalIdInput
                      value={newCustomer.nationalId}
                      onChange={(raw) => setNewCustomer({ ...newCustomer, nationalId: raw })}
                      placeholder="10x xxx xxxx"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "نوع الشخص" : "Person Type"}
                    </label>
                    <select
                      value={newCustomer.personType}
                      onChange={(e) => setNewCustomer({ ...newCustomer, personType: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">—</option>
                      <option value="INDIVIDUAL">{lang === "ar" ? "فرد" : "Individual"}</option>
                      <option value="COMPANY">{lang === "ar" ? "شركة" : "Company"}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "الجنس" : "Gender"}
                    </label>
                    <select
                      value={newCustomer.gender}
                      onChange={(e) => setNewCustomer({ ...newCustomer, gender: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">—</option>
                      <option value="MALE">{lang === "ar" ? "ذكر" : "Male"}</option>
                      <option value="FEMALE">{lang === "ar" ? "أنثى" : "Female"}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "الجنسية" : "Nationality"}
                    </label>
                    <Input
                      value={newCustomer.nationality}
                      onChange={(e) => setNewCustomer({ ...newCustomer, nationality: e.target.value })}
                      placeholder={lang === "ar" ? "سعودي" : "Saudi"}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "الحالة الاجتماعية" : "Marital Status"}
                    </label>
                    <select
                      value={newCustomer.maritalStatus}
                      onChange={(e) => setNewCustomer({ ...newCustomer, maritalStatus: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">—</option>
                      <option value="SINGLE">{lang === "ar" ? "أعزب" : "Single"}</option>
                      <option value="MARRIED">{lang === "ar" ? "متزوج" : "Married"}</option>
                      <option value="DIVORCED">{lang === "ar" ? "مطلق" : "Divorced"}</option>
                      <option value="WIDOWED">{lang === "ar" ? "أرمل" : "Widowed"}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">
                      {lang === "ar" ? "تاريخ الميلاد" : "Date of Birth"}
                    </label>
                    <Input
                      type="date"
                      value={newCustomer.dateOfBirth}
                      onChange={(e) => setNewCustomer({ ...newCustomer, dateOfBirth: e.target.value })}
                    />
                  </div>
                </div>
              </details>

              {/* Inline error */}
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <Button
                variant="secondary"
                style={{ display: "inline-flex" }}
                onClick={() => { setShowAddModal(false); setError(null); setNewCustSelectedUnit(null); setNewCustIntent(null); setNewCustUnitSearch(""); }}
                disabled={saving}
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleAddCustomer}
                disabled={saving}
                style={{ display: "inline-flex" }}
                className="gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === "ar" ? "حفظ جهة الاتصال" : "Save Contact"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lost Reason Modal ── */}
      <ResponsiveDialog
        open={showLostModal}
        onOpenChange={(open) => { if (!open) setShowLostModal(false); }}
        title={lang === "ar" ? "تحديد سبب الخسارة" : "Mark as Lost"}
        description={
          lang === "ar"
            ? `الرجاء تحديد سبب خسارة العميل "${lostTarget?.name}"`
            : `Please select why "${lostTarget?.name}" was lost`
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => setShowLostModal(false)}
              disabled={savingLost}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="danger"
              style={{ display: "inline-flex" }}
              className="gap-2"
              onClick={confirmLost}
              disabled={!lostReason || savingLost}
            >
              {savingLost && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ar" ? "تأكيد الخسارة" : "Confirm Lost"}
            </Button>
          </div>
        }
      >
        <div dir={lang === "ar" ? "rtl" : "ltr"} className="space-y-2 py-2">
            {LOST_REASONS.map((reason) => (
              <button
                key={reason.key}
                type="button"
                onClick={() => setLostReason(reason.key)}
                className={cn(
                  "w-full text-start px-4 py-3 rounded-lg border text-sm font-medium transition-colors",
                  lostReason === reason.key
                    ? "border-red-400/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                    : "border-border bg-card text-foreground hover:bg-muted/30"
                )}
                style={{ display: "block" }}
              >
                {reason.label[lang]}
              </button>
            ))}
        </div>
      </ResponsiveDialog>

      {/* ── Delete Dialog ── */}
      <ResponsiveDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={lang === "ar" ? "تأكيد الحذف" : "Confirm Deletion"}
        description={
          lang === "ar"
            ? `هل أنت متأكد من حذف "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
            : `Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => { setShowDeleteDialog(false); setError(null); }}
              disabled={deleting}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="danger"
              style={{ display: "inline-flex" }}
              className="gap-2"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ar" ? "حذف" : "Delete"}
            </Button>
          </div>
        }
      >
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </ResponsiveDialog>
    </div>
    </div>

    {/* ── Profile Drawer (shared across mobile + desktop) ── */}
    {drawerCustomer && (
      <CustomerDrawer
        customer={drawerCustomer}
        onClose={() => setDrawerCustomer(null)}
        onCustomerUpdated={(updated) => {
          setDrawerCustomer(updated);
          setCustomers((prev) =>
            prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
          );
          loadData();
        }}
        onMarkLost={(id, name) => {
          setLostTarget({ id, name });
          setLostReason("");
          setShowLostModal(true);
        }}
        lang={lang}
        teamMembers={teamMembers}
        assignments={drawerAssignments}
      />
    )}
    </>
  );
}
