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
  MoreVertical,
  ArrowRightLeft,
} from "lucide-react";
import {
  Button,
  IconButton,
  ActionLink,
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
  EmptyState,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  type ColumnDef,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import {
  getCustomers,
  createCustomer,
  deleteCustomer,
  updateCustomer,
  getCustomerUnitAssignments,
} from "../../actions/customers";
import { getJourneySummary } from "../../actions/journey";
import type { JourneySummary } from "@repo/types";
import {
  LifecycleRail,
  NextActionPanel,
  ProcessBlockerBanner,
  RelatedContextPanel,
} from "@repo/ui";
import { getTeamMembers } from "../../actions/team";
import { usePermissions } from "../../../hooks/usePermissions";
import CustomerActivityTimeline from "../../../components/CustomerActivityTimeline";
import {
  getCustomerInterests,
  addCustomerInterest,
  dropCustomerInterest,
  convertInterestToDeal,
  getAvailableUnitsForInterest,
  setCustomerPipelineStage,
} from "../../actions/customer-interests";
import { maskPhone, maskEmail } from "@/lib/pii-masking";
import { toWhatsAppNumber } from "@/lib/phone";
import { trackEvent, AnalyticsEvent } from "../../../lib/analytics";

// ─── Pipeline Stage Config ────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  {
    key: "NEW",
    label: { ar: "جديد", en: "New Lead" },
    color: "bg-info/10 text-info border-info/30",
    dotColor: "bg-info",
  },
  {
    key: "CONTACTED",
    label: { ar: "تم التواصل", en: "Contacted" },
    color: "bg-primary/10 text-primary border-primary/30",
    dotColor: "bg-primary",
  },
  {
    key: "QUALIFIED",
    label: { ar: "مؤهل", en: "Qualified" },
    color: "bg-warning/10 text-warning border-warning/30",
    dotColor: "bg-warning",
  },
  {
    key: "VIEWING",
    label: { ar: "معاينة", en: "Viewing" },
    color: "bg-warning/10 text-warning border-warning/30",
    dotColor: "bg-warning",
  },
  {
    key: "NEGOTIATION",
    label: { ar: "تفاوض", en: "Negotiation" },
    color: "bg-success/10 text-success-strong border-success/30",
    dotColor: "bg-success",
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

// Deal.stage → bilingual label (drawer interest badges). Mirrors the DealStage
// enum in @repo/db.
const DEAL_STAGE_LABELS: Record<string, { ar: string; en: string }> = {
  NEW: { ar: "جديد", en: "New" },
  QUALIFIED: { ar: "مؤهل", en: "Qualified" },
  VIEWING: { ar: "معاينة", en: "Viewing" },
  NEGOTIATION: { ar: "تفاوض", en: "Negotiation" },
  RESERVED: { ar: "محجوز", en: "Reserved" },
  WON: { ar: "مكسوب", en: "Won" },
  LOST: { ar: "خسارة", en: "Lost" },
};

// Legacy statuses not shown in kanban but valid for filter/display
const ALL_STATUS_CONFIGS = [
  ...PIPELINE_STAGES,
  {
    key: "INTERESTED",
    label: { ar: "مهتم", en: "Interested" },
    color: "bg-primary/10 text-primary border-primary/30",
    dotColor: "bg-primary",
  },
  {
    key: "RESERVED",
    label: { ar: "محجوز", en: "Reserved" },
    color: "bg-info/10 text-info border-info/30",
    dotColor: "bg-info",
  },
  {
    key: "CONVERTED",
    label: { ar: "تم التحويل", en: "Converted" },
    color: "bg-success/10 text-success-strong border-success/30",
    dotColor: "bg-success",
  },
  {
    key: "LOST",
    label: { ar: "خسارة", en: "Lost" },
    color: "bg-destructive/10 text-destructive border-destructive/30",
    dotColor: "bg-destructive",
  },
  {
    key: "ACTIVE_TENANT",
    label: { ar: "مستأجر نشط", en: "Active Tenant" },
    color: "bg-info/10 text-info border-info/30",
    dotColor: "bg-info",
  },
  {
    key: "PAST_TENANT",
    label: { ar: "مستأجر سابق", en: "Past Tenant" },
    color: "bg-muted text-muted-foreground border-border",
    dotColor: "bg-muted-foreground",
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
  MARKETPLACE: { ar: "السوق", en: "Marketplace" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_STATUS_CONFIG = ALL_STATUS_CONFIGS[0]!;

function getStatusConfig(key: string) {
  return ALL_STATUS_CONFIGS.find((s) => s.key === key) ?? DEFAULT_STATUS_CONFIG;
}

function formatSAR(amount: number | string | null | undefined, locale: string) {
  if (!amount) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-SA", {
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
  showPii,
  hasPiiAccess,
}: {
  customer: any;
  onClose: () => void;
  onCustomerUpdated: (updated: any) => void;
  onMarkLost?: (customerId: string, customerName: string) => void;
  lang: "ar" | "en";
  teamMembers: any[];
  assignments: any[];
  showPii: boolean;
  hasPiiAccess: boolean;
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

  // Journey state
  const [journey, setJourney] = React.useState<JourneySummary | null>(null);
  const [journeyLoading, setJourneyLoading] = React.useState(false);
  const [journeyRelatedOpen, setJourneyRelatedOpen] = React.useState(false);

  // Load interests when drawer opens
  React.useEffect(() => {
    loadInterests(customer.id);
  }, [customer.id]);

  // Load journey when drawer opens
  React.useEffect(() => {
    setJourneyLoading(true);
    getJourneySummary("customer", customer.id)
      .then((data) => setJourney(data))
      .catch(() => setJourney(null))
      .finally(() => setJourneyLoading(false));
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
    window.location.href = `/dashboard/reservations?${params.toString()}`;
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
      showToast(lang === "ar" ? "تم إنشاء الحجز بنجاح" : "Reservation created successfully");
      setTimeout(() => {
        window.location.href = "/dashboard/reservations";
      }, 1200);
    } catch (err: any) {
      const msg = err?.message ?? "";
      const isFriendly = msg.length < 200 && !msg.includes("Prisma") && !msg.includes("Invalid `");
      setConvertError(
        isFriendly && msg
          ? msg
          : lang === "ar"
            ? "تعذّر إنشاء الحجز. يرجى المحاولة مجدداً."
            : "Failed to create reservation. Please try again."
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
            <Button
              variant="outline"
              size="sm"
              style={{ display: "inline-flex" }}
              className="gap-1.5 text-xs"
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
            >
              <Pencil className="h-3.5 w-3.5" />
              {lang === "ar" ? "تعديل" : "Edit"}
            </Button>
            <IconButton
              icon={X}
              aria-label={lang === "ar" ? "إغلاق" : "Close"}
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            />
          </div>
        </div>

        {/* Toast */}
        {drawerToast && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/30 text-success-strong text-xs font-medium animate-in fade-in duration-200">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {drawerToast}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Mobile quick action rail — call / WhatsApp / email.
              Uses contactPhoneE164 from getCustomer() — masked/invalid phone → controls omitted. */}
          {(customer.contactPhoneE164 || customer.email) && (
            <div className="md:hidden">
              <QuickActionRail
                actions={[
                  ...(customer.contactPhoneE164
                    ? [
                        {
                          key: "call",
                          label: lang === "ar" ? "اتصال" : "Call",
                          icon: Phone,
                          href: `tel:${customer.contactPhoneE164}`,
                          tone: "primary" as const,
                        },
                        {
                          key: "wa",
                          label: lang === "ar" ? "واتساب" : "WhatsApp",
                          icon: MessageCircle,
                          href: `https://wa.me/${toWhatsAppNumber(customer.contactPhoneE164)}`,
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
              <span
                className={cn(
                  "text-xs rounded-full px-2.5 py-1 border",
                  customer.source === "MARKETPLACE"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "text-muted-foreground border-border",
                )}
              >
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
                {lang === "ar" ? "تحويل لحجز" : "Convert to Reservation"}
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
                      {Number(customer.budget).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")} {lang === "ar" ? "ريال" : "SAR"}
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
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-destructive">
                  {lang === "ar" ? "سبب الخسارة" : "Lost Reason"}
                </p>
                <p className="text-xs text-destructive mt-0.5">
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
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                  <span className="text-sm font-medium text-foreground" dir="ltr">
                    {showPii ? customer.phone : maskPhone(customer.phone)}
                  </span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                  <span className="text-sm font-medium text-foreground truncate" dir="ltr">
                    {showPii ? customer.email : maskEmail(customer.email)}
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
                        lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA"
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
              <Button
                variant="outline"
                size="sm"
                style={{ display: "inline-flex" }}
                className="gap-1 text-[10px] text-primary border-primary/30 hover:bg-primary/5 h-7 px-2"
                onClick={openLinkModal}
              >
                <Plus className="h-3 w-3" />
                {lang === "ar" ? "ربط عقار" : "Link Property"}
              </Button>
            </div>

            {loadingInterests ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : interests.length === 0 ? (
              <EmptyState
                compact
                title={lang === "ar" ? "لا توجد اهتمامات مرتبطة" : "No properties linked yet"}
                description={
                  lang === "ar"
                    ? "ابدأ بربط وحدات يهتم بها العميل."
                    : "Link units this contact is interested in."
                }
              />
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
                                  ? "bg-info/10 text-info border-info/30"
                                  : "bg-primary/10 text-primary border-primary/30"
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
                                  ? "bg-success/10 text-success-strong border-success/30"
                                  : interest.status === "CONVERTED"
                                    ? "bg-warning/10 text-warning border-warning/30"
                                    : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {interest.status === "ACTIVE"
                                ? lang === "ar" ? "نشط" : "Active"
                                : interest.status === "CONVERTED"
                                  ? lang === "ar" ? "محوّل" : "Converted"
                                  : lang === "ar" ? "مُسقط" : "Dropped"}
                            </span>
                            {interest.stage && (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/30"
                                title={lang === "ar" ? "مرحلة الصفقة" : "Deal stage"}
                              >
                                {DEAL_STAGE_LABELS[interest.stage]?.[lang] ?? interest.stage}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions — only for ACTIVE interests */}
                      {interest.status === "ACTIVE" && (
                        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                          <Button
                            size="sm"
                            style={{ display: "inline-flex" }}
                            className="gap-1 text-[10px] h-7 px-2"
                            onClick={() => openConvertModal(interest)}
                          >
                            <DirectionalIcon icon={ArrowRight} className="h-3 w-3" />
                            {lang === "ar" ? "تحويل لحجز" : "Convert to Reservation"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ display: "inline-flex" }}
                            className="gap-1 text-[10px] h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                            onClick={() => {
                              setDroppingInterest(interest);
                              setShowDropConfirm(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                            {lang === "ar" ? "إسقاط" : "Drop"}
                          </Button>
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
              {lang === "ar" ? "الحجوزات والعقود / Reservations & Contracts" : "Reservations & Contracts / الحجوزات والعقود"}
            </h3>

            {assignments.length === 0 ? (
              <EmptyState
                compact
                title={lang === "ar" ? "لا توجد حجوزات أو عقود نشطة" : "No active reservations or contracts"}
                description={
                  lang === "ar"
                    ? "عند إنشاء حجز أو عقد ستظهر هنا."
                    : "Reservations and contracts for this contact will show up here."
                }
              />
            ) : (
              <div className="space-y-2">
                {assignments.map((item: any, idx: number) => {
                  const isReservation = item.type === "reservation";
                  const isLease = item.type === "lease";
                  const href = isReservation ? "/dashboard/reservations" : "/dashboard/contracts";
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
                                ? "bg-success/10 text-success-strong border-success/30"
                                : "bg-warning/10 text-warning border-warning/30"
                            )}
                          >
                            {item.status}
                          </span>
                        </div>
                      </div>
                      <ActionLink
                        href={href}
                        className="text-[10px] font-semibold shrink-0"
                        trailingIcon={ChevronRight}
                        directional
                      >
                        {lang === "ar" ? "عرض" : "View"}
                      </ActionLink>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Journey Section ── */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {lang === "ar" ? "المسار" : "Journey"}
            </h3>
            {journeyLoading && (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {lang === "ar" ? "جارٍ تحميل المسار..." : "Loading journey..."}
              </div>
            )}
            {!journeyLoading && journey && (
              <div className="space-y-3">
                {journey.blockers.length > 0 && (
                  <ProcessBlockerBanner blockers={journey.blockers} lang={lang} />
                )}
                <LifecycleRail
                  stages={journey.stages}
                  lang={lang}
                  ariaLabel={lang === "ar" ? "مراحل العميل" : "Customer lifecycle"}
                />
                <NextActionPanel actions={journey.nextActions} lang={lang} />
                {journey.related.length > 0 && (
                  <>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      style={{ display: "inline-flex" }}
                      className="text-xs h-auto p-0"
                      onClick={() => setJourneyRelatedOpen(true)}
                    >
                      {lang === "ar"
                        ? `السجلات المرتبطة (${journey.related.length})`
                        : `Related records (${journey.related.length})`}
                    </Button>
                    <RelatedContextPanel
                      open={journeyRelatedOpen}
                      onOpenChange={setJourneyRelatedOpen}
                      records={journey.related}
                      lang={lang}
                    />
                  </>
                )}
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
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              {editError}
            </p>
          )}
          {editSuccess && (
            <p className="text-sm text-success-strong bg-success/10 border border-success/30 rounded-lg px-3 py-2 flex items-center gap-2">
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
                  <Button
                    key={unit.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    style={{ display: "block", width: "100%" }}
                    className={cn(
                      "text-start p-2.5 rounded-lg border h-auto",
                      linkSelectedUnit?.id === unit.id
                        ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                        : "border-border hover:bg-muted/30"
                    )}
                    onClick={() => {
                      setLinkSelectedUnit(unit);
                      setLinkIntent("");
                    }}
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
                        {unit.rentalPrice && <div className="text-primary">{formatSAR(unit.rentalPrice, lang)}/{lang === "ar" ? "شهر" : "mo"}</div>}
                      </div>
                    </div>
                  </Button>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    style={{ display: "inline-flex", flex: 1 }}
                    className={cn(
                      "py-2 text-sm h-auto justify-center",
                      linkIntent === "BUY"
                        ? "border-info/50 bg-info/10 text-info hover:bg-info/15"
                        : ""
                    )}
                    onClick={() => setLinkIntent("BUY")}
                  >
                    {lang === "ar" ? "شراء" : "Buy"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    style={{ display: "inline-flex", flex: 1 }}
                    className={cn(
                      "py-2 text-sm h-auto justify-center",
                      linkIntent === "RENT"
                        ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15"
                        : ""
                    )}
                    onClick={() => setLinkIntent("RENT")}
                  >
                    {lang === "ar" ? "إيجار" : "Rent"}
                  </Button>
                </div>
              </div>
            )}

            {linkError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
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
              variant="destructive"
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
        title={lang === "ar" ? "تحويل لحجز / Convert to Reservation" : "Convert to Reservation / تحويل لحجز"}
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
              {lang === "ar" ? "إنشاء الحجز" : "Create Reservation"}
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
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
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
  onMoveToStage,
  currentStage,
}: {
  customer: any;
  lang: "ar" | "en";
  showPii: boolean;
  onDragStart: (e: React.DragEvent, customerId: string) => void;
  onViewProfile: (customer: any) => void;
  onDelete: (customer: any) => void;
  canDelete: boolean;
  onMoveToStage: (customerId: string, stage: string) => void;
  currentStage: string;
}) {
  // Contact controls: use the precomputed contactPhoneE164 from the server action.
  // null means masked/invalid → omit the control entirely (never disable, per Roselli).
  const contactPhoneE164: string | null = customer.contactPhoneE164 ?? null;
  const waNumber: string | null = toWhatsAppNumber(contactPhoneE164);
  const email = typeof customer.email === "string" ? customer.email : "";
  const hasEmail = email.length > 0 && email.includes("@") && !email.startsWith("*");

  const initials =
    (typeof customer.name === "string" ? customer.name : "")
      .trim()
      .split(/\s+/)
      .map((w: string) => w.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "؟";

  // Owner avatar — agent initials using the same helper pattern
  const agentInitials = customer.agent?.name
    ? (customer.agent.name as string)
        .trim()
        .split(/\s+/)
        .map((w: string) => w.charAt(0))
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "؟"
    : null;

  // Time-in-stage chip — days since stageEnteredAt (fall back to createdAt, crash-safe)
  const stageRefDate: Date | null = (() => {
    const raw = customer.stageEnteredAt ?? customer.createdAt ?? null;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  })();
  const daysInStage: number | null = stageRefDate
    ? Math.floor((Date.now() - stageRefDate.getTime()) / 86_400_000)
    : null;
  // Threshold coloring via CSS variable tokens only — no dark: utilities, no hardcoded hex
  const stageDayClass =
    daysInStage === null
      ? null
      : daysInStage <= 7
        ? "bg-muted text-muted-foreground"
        : daysInStage <= 14
          ? "bg-warning/15 text-warning"
          : "bg-destructive/15 text-destructive";
  const stageDayLabel =
    daysInStage === null
      ? null
      : lang === "ar"
        ? `${daysInStage} يوم`
        : `${daysInStage}d`;

  const openProfile = () => onViewProfile(customer);
  const viewLabel =
    lang === "ar" ? `عرض ملف ${customer.name}` : `View ${customer.name}`;

  // Other stages the card can be moved to (keyboard/SR path — redundant-click pattern)
  const moveTargetStages = PIPELINE_STAGES.filter((s) => s.key !== currentStage);

  return (
    // a11y: plain draggable container with no role/tabIndex/aria-label.
    // The card title <button> is the single accessible open-profile affordance.
    // Container onClick forwards to openProfile ONLY when the click did NOT
    // originate on another interactive control (redundant-click card pattern,
    // Heydon Pickering / inclusive-components). This eliminates the axe
    // nested-interactive violation while preserving pointer-convenience.
    <div
      draggable
      onDragStart={(e) => onDragStart(e, customer.id)}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a,button,[role='menuitem']")) {
          openProfile();
        }
      }}
      className="group relative rounded-lg border border-border bg-card card-quiet p-3.5 cursor-grab active:cursor-grabbing hover:border-primary/30 hover:bg-card-hover transition-[background-color,border-color]"
    >
      {/* Name + avatar + overflow (move/delete actions) */}
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          {/* Card title IS the single accessible open-profile control — §6.6.0 Scenario 1 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openProfile();
            }}
            className="block w-full text-start font-semibold text-sm text-foreground truncate hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm"
            aria-label={viewLabel}
            title={customer.name}
          >
            {customer.name}
          </button>
          {customer.nameArabic && customer.nameArabic !== customer.name && (
            <p className="text-[11px] text-muted-foreground truncate" aria-hidden="true">
              {customer.nameArabic}
            </p>
          )}
        </div>
        {/* Overflow menu: move + delete — keyboard/SR path for drag outcomes */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              icon={MoreVertical}
              aria-label={lang === "ar" ? "خيارات" : "Options"}
              variant="ghost"
              className="relative z-10 -me-1.5 -mt-1.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Move-to items: one per other stage (keyboard/SR equivalent of drag) */}
            {moveTargetStages.map((stage) => (
              <DropdownMenuItem
                key={stage.key}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToStage(customer.id, stage.key);
                }}
              >
                <ArrowRightLeft className="me-2 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {lang === "ar"
                  ? `نقل إلى ${stage.label.ar}`
                  : `Move to ${stage.label.en}`}
              </DropdownMenuItem>
            ))}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(customer);
                  }}
                >
                  <Trash2 className="me-2 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {lang === "ar" ? "حذف" : "Delete"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Deal value — the prominence anchor */}
      {customer.budget ? (
        <p
          dir="ltr"
          className="number-ltr mt-2.5 text-base font-bold tabular-nums text-foreground"
        >
          {Number(customer.budget).toLocaleString(
            lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA",
          )}
          <span className="ms-1 text-xs font-normal text-muted-foreground">
            {lang === "ar" ? "ر.س" : "SAR"}
          </span>
        </p>
      ) : null}

      {/* Meta: phone + source */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {customer.phone ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate font-mono" dir="ltr">
              {showPii ? customer.phone : maskPhone(customer.phone)}
            </span>
          </span>
        ) : (
          <span />
        )}
        {customer.source && SOURCE_LABELS[customer.source] && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {(SOURCE_LABELS[customer.source] as { ar: string; en: string })[lang]}
          </span>
        )}
      </div>

      {/* Premium signals row: time-in-stage chip + owner avatar */}
      {(stageDayLabel !== null || agentInitials !== null) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {/* Time-in-stage chip */}
          {stageDayLabel !== null && stageDayClass !== null ? (
            <span
              dir="ltr"
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${stageDayClass}`}
              title={
                lang === "ar"
                  ? `الوقت في هذه المرحلة: ${stageDayLabel}`
                  : `Time in stage: ${stageDayLabel}`
              }
              aria-label={
                lang === "ar"
                  ? `الوقت في المرحلة ${stageDayLabel}`
                  : `Time in stage ${stageDayLabel}`
              }
            >
              {stageDayLabel}
            </span>
          ) : (
            <span />
          )}

          {/* Owner (agent) avatar */}
          {agentInitials !== null && (
            <span
              aria-label={
                lang === "ar"
                  ? `المسؤول: ${customer.agent.name}`
                  : `Owner: ${customer.agent.name}`
              }
              title={
                lang === "ar"
                  ? `المسؤول: ${customer.agent.name}`
                  : `Owner: ${customer.agent.name}`
              }
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary text-[9px] font-semibold"
            >
              {agentInitials}
            </span>
          )}
        </div>
      )}

      {/* Quick-contact rail — omitted entirely when no valid contactPhoneE164 and no email.
          Controls are <a> siblings (not nested in a button), so no nested-interactive issue. */}
      {(contactPhoneE164 !== null || hasEmail) && (
        <div
          className="relative z-10 mt-2.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {contactPhoneE164 !== null && (
            <a
              href={`tel:${contactPhoneE164}`}
              aria-label={lang === "ar" ? "اتصال هاتفي" : "Call phone"}
              title={lang === "ar" ? "اتصال" : "Call"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
          )}
          {waNumber !== null && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={lang === "ar" ? "فتح واتساب" : "Open WhatsApp"}
              title={lang === "ar" ? "واتساب" : "WhatsApp"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
          {hasEmail && (
            <a
              href={`mailto:${email}`}
              aria-label={lang === "ar" ? "إرسال بريد إلكتروني" : "Send email"}
              title={lang === "ar" ? "بريد إلكتروني" : "Email"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
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

export default function CrmView({
  initialCustomers,
  initialTeamMembers,
  initialAvailableUnits,
}: {
  initialCustomers: any[];
  initialTeamMembers: any[];
  initialAvailableUnits: any[];
}) {
  const { lang } = useLanguage();
  const { can } = usePermissions();

  // Seeded from the Server Component's masked getCustomers() result — no
  // client mount-time fetch for the initial paint. `loadData()` below stays as
  // a callable refetch used after mutations to re-sync from the server.
  const [customers, setCustomers] = React.useState<any[]>(initialCustomers);
  const [teamMembers, setTeamMembers] = React.useState<any[]>(initialTeamMembers);
  const [loading, setLoading] = React.useState(false);
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

  // Add modal — property linking (seeded server-side; refreshed by loadData())
  const [pageAvailableUnits, setPageAvailableUnits] = React.useState<any[]>(initialAvailableUnits);
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

  // Accessible move announcement (aria-live region text)
  const [moveAnnouncement, setMoveAnnouncement] = React.useState<string | null>(null);

  // Mobile-only UI state (reuses desktop state for search/statusFilter/showLost)
  const [mobileTab, setMobileTab] = React.useState<"pipeline" | "leads" | "customers">("pipeline");
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  const canWrite = can("crm:write") || can("customers:write");
  const canDelete = can("crm:delete") || can("customers:delete");
  const canExport = can("crm:export") || can("customers:export");
  const hasPiiAccess = can("customers:read_pii");

  // ─── Load ───────────────────────────────────────────────────────────────────
  // NOTE: no mount-time fetch — initial customers/team/units are server-rendered
  // and seeded into state above. `loadData()` remains a callable refetch used
  // after profile edits (via onCustomerUpdated) to re-sync masked data.

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
      color: "text-destructive bg-destructive/10",
    };
    if (ratio >= 0.9) return {
      label: lang === "ar" ? "ضمن الميزانية" : "On Budget",
      color: "text-success-strong bg-success/10",
    };
    return {
      label: lang === "ar" ? "أقل من الميزانية" : "Under Budget",
      color: "text-info bg-info/10",
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
        cell: ({ row }) =>
          row.original.phone ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground" dir="ltr">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              {showPii ? row.original.phone : maskPhone(row.original.phone)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
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
                ? `${Number(b).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")} ${lang === "ar" ? "ر.س" : "SAR"}`
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
            <div className="flex items-center justify-end gap-1">
              <IconButton
                icon={Eye}
                aria-label={lang === "ar" ? "عرض" : "View"}
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setDrawerCustomer(c);
                }}
              />
              {canDelete && (
                <IconButton
                  icon={Trash2}
                  aria-label={lang === "ar" ? "حذف" : "Delete"}
                  variant="ghost"
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDelete(c);
                  }}
                />
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
      // Pipeline is owned by the Deal entity now (R3). This advances the
      // customer's primary active deal's stage then derives Customer.status;
      // leads with no linked deal fall back to the manual status setter.
      await setCustomerPipelineStage(draggingId, status);
    } catch {
      setCustomers(prev);
      setError(
        lang === "ar"
          ? "فشل تحديث حالة العميل. يرجى المحاولة مجدداً."
          : "Failed to update status. Please try again."
      );
    }
  }

  // ─── Keyboard / SR move (overflow menu — redundant drag path) ───────────────

  async function handleMoveToStage(customerId: string, targetStage: string) {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    if (targetStage === "LOST") {
      setLostTarget({ id: customerId, name: customer.name ?? "" });
      setLostReason("");
      setShowLostModal(true);
      return;
    }

    const fromStage = PIPELINE_STAGES.find((s) => s.key === customer.status);
    const toStage = PIPELINE_STAGES.find((s) => s.key === targetStage);
    const prev = customers;
    setCustomers((c) =>
      c.map((cust) => (cust.id === customerId ? { ...cust, status: targetStage } : cust))
    );

    // Announce to screen readers
    const fromLabel = fromStage?.label[lang] ?? customer.status;
    const toLabel = toStage?.label[lang] ?? targetStage;
    setMoveAnnouncement(
      lang === "ar"
        ? `تم نقل ${customer.name} من ${fromLabel} إلى ${toLabel}`
        : `Moved ${customer.name ?? "customer"} from ${fromLabel} to ${toLabel}`
    );
    setTimeout(() => setMoveAnnouncement(null), 3000);

    try {
      await setCustomerPipelineStage(customerId, targetStage);
    } catch {
      setCustomers(prev);
      setMoveAnnouncement(null);
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
      // Marking lost flows through the Deal entity (sets the primary deal's
      // stage=LOST + lostReason); leads with no linked deal fall back to the
      // manual LOST setter (which also cascades the LOST state).
      await setCustomerPipelineStage(lostTarget.id, "LOST", lostReason);
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
      trackEvent(AnalyticsEvent.CustomerCreated, { source: newCustomer.source || "manual" });
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
    trackEvent(AnalyticsEvent.ExportPerformed, { kind: "customers", count: Number(filteredCustomers.length) });
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
      // No filters active AND no customers at all → first-time empty. Otherwise filter-empty.
      const isFirstTime = customers.length === 0;
      return isFirstTime ? (
        <EmptyState
          variant="first-time"
          icon={<Users className="h-12 w-12" />}
          title={lang === "ar" ? "لا يوجد عملاء بعد" : "No contacts yet"}
          description={
            lang === "ar"
              ? "أضف أول عميل محتمل وابدأ ببناء خط أعمالك."
              : "Add your first lead and start building your pipeline."
          }
          action={
            canWrite ? (
              <Button size="sm" onClick={openAddCustomerModal} style={{ display: "inline-flex" }}>
                <Plus className="h-4 w-4 me-1.5" />
                {lang === "ar" ? "إضافة عميل" : "Add contact"}
              </Button>
            ) : undefined
          }
          helpHref="/dashboard/help#crm"
          helpLabel={lang === "ar" ? "تعرّف على CRM" : "Learn about CRM"}
        />
      ) : (
        <EmptyState
          variant="filtered"
          icon={<Search className="h-10 w-10" />}
          title={emptyLabel[lang]}
          description={
            lang === "ar" ? "جرّب تعديل البحث أو الفلاتر." : "Try adjusting your search or filters."
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearch("")}
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
            </Button>
          }
        />
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
          const activity: React.ReactNode =
            phoneDisplay && interest ? (
              <><span dir="ltr">{phoneDisplay}</span>{" · "}{interest}</>
            ) : phoneDisplay ? (
              <span dir="ltr">{phoneDisplay}</span>
            ) : interest || null;
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
    {/* Accessible live region for keyboard/SR move announcements */}
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {moveAnnouncement}
    </div>

    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar
        title={lang === "ar" ? "إدارة العملاء" : "CRM"}
        lang={lang}
        trailing={
          <IconButton
            icon={Filter}
            aria-label={lang === "ar" ? "تصفية" : "Filter"}
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={() => setShowMobileFilters(true)}
          />
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
            { key: "pipeline", label: lang === "ar" ? "مسار الفرص العقارية" : "Pipeline" },
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

      <div className="flex-1 px-4 py-3">
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
                      {lang === "ar" ? "لا توجد صفقات في هذه المرحلة" : "No deals in this stage"}
                    </p>
                  ) : (
                    stageCustomers.map((c) => (
                      <Button
                        key={c.id}
                        type="button"
                        variant="ghost"
                        style={{ display: "block" }}
                        onClick={() => setDrawerCustomer(c)}
                        className="w-full rounded-xl border border-border bg-card p-3 text-start h-auto hover:border-foreground/20 active:scale-[0.99] transition-colors"
                      >
                        <div className="truncate text-sm font-semibold text-foreground">
                          {c.name}
                        </div>
                        {c.phone ? (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" aria-hidden="true" />
                            <span className="truncate" dir="ltr">
                              {showPii ? c.phone : maskPhone(c.phone)}
                            </span>
                          </div>
                        ) : null}
                        {c.budget ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatSAR(c.budget, lang)}
                          </div>
                        ) : null}
                      </Button>
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
              <Button
                type="button"
                variant={!statusFilter && !showLost ? "primary" : "subtle"}
                size="sm"
                style={{ display: "inline-flex" }}
                className="rounded-full"
                aria-pressed={!statusFilter && !showLost}
                onClick={() => {
                  setStatusFilter("");
                  setShowLost(false);
                }}
              >
                {lang === "ar" ? "الكل" : "All"}
              </Button>
              {PIPELINE_STAGES.map((s) => (
                <Button
                  key={s.key}
                  type="button"
                  variant={statusFilter === s.key ? "primary" : "subtle"}
                  size="sm"
                  style={{ display: "inline-flex" }}
                  className="rounded-full"
                  aria-pressed={statusFilter === s.key}
                  onClick={() => {
                    setStatusFilter(statusFilter === s.key ? "" : s.key);
                    setShowLost(false);
                  }}
                >
                  {s.label[lang]}
                </Button>
              ))}
              <Button
                type="button"
                variant={showLost ? "primary" : "subtle"}
                size="sm"
                style={{ display: "inline-flex" }}
                className="rounded-full"
                aria-pressed={showLost}
                onClick={() => {
                  setShowLost((v) => !v);
                  setStatusFilter("");
                }}
              >
                {lang === "ar" ? "الخسائر فقط" : "Lost only"}
              </Button>
            </div>
          </div>

          {hasPiiAccess && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {lang === "ar" ? "الخصوصية" : "Privacy"}
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                style={{ display: "inline-flex" }}
                className={cn(
                  "rounded-full gap-2 px-3 py-1.5 text-xs h-auto",
                  showPii
                    ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
                    : ""
                )}
                onClick={() => setShowPii((v) => !v)}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {showPii
                  ? lang === "ar"
                    ? "إخفاء البيانات الحساسة"
                    : "Hide PII"
                  : lang === "ar"
                    ? "عرض البيانات الحساسة"
                    : "Show PII"}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Handshake className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {lang === "ar"
                ? "سحب البطاقات بين مراحل مسار الفرص متاح على سطح المكتب."
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
              <Button
                variant="outline"
                size="sm"
                style={{ display: "inline-flex" }}
                className={cn(
                  "gap-1.5 text-xs",
                  showPii
                    ? "border-warning/50 bg-warning/10 text-warning hover:bg-warning/20"
                    : ""
                )}
                onClick={() => setShowPii((v) => !v)}
              >
                <Eye className="h-3.5 w-3.5" />
                {showPii
                  ? lang === "ar" ? "إخفاء البيانات الحساسة" : "Hide PII"
                  : lang === "ar" ? "عرض البيانات الحساسة" : "Show PII"}
              </Button>
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
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-sm text-destructive">{error}</p>
          <IconButton
            icon={X}
            aria-label={lang === "ar" ? "إغلاق" : "Dismiss"}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive/70 hover:text-destructive"
            onClick={() => setError(null)}
          />
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
          label={lang === "ar" ? "في مسار الفرص" : "In Pipeline"}
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
            <Button
              variant={!statusFilter && !showLost ? "primary" : "subtle"}
              size="sm"
              style={{ display: "inline-flex" }}
              className="rounded-full"
              aria-pressed={!statusFilter && !showLost}
              onClick={() => { setStatusFilter(""); setShowLost(false); }}
            >
              {lang === "ar" ? "الكل" : "All"} {customers.filter(c => c.status !== "LOST").length}
            </Button>
            {PIPELINE_STAGES.map((s) => {
              const count = customers.filter((c) => c.status === s.key).length;
              return (
                <Button
                  key={s.key}
                  variant={statusFilter === s.key ? "primary" : "subtle"}
                  size="sm"
                  style={{ display: "inline-flex" }}
                  className="rounded-full"
                  aria-pressed={statusFilter === s.key}
                  onClick={() => { setStatusFilter(statusFilter === s.key ? "" : s.key); setShowLost(false); }}
                >
                  {s.label[lang]} {count}
                </Button>
              );
            })}
            {/* Lost toggle */}
            <Button
              variant={showLost ? "primary" : "subtle"}
              size="sm"
              style={{ display: "inline-flex" }}
              className="rounded-full"
              aria-pressed={showLost}
              onClick={() => { setShowLost((v) => !v); setStatusFilter(""); }}
            >
              {lang === "ar" ? "خسائر" : "Lost"} {kpis.lost}
            </Button>
          </div>

          {/* View toggle */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === "kanban" ? "primary" : "subtle"}
              size="sm"
              style={{ display: "inline-flex" }}
              className="rounded-full"
              aria-pressed={viewMode === "kanban"}
              onClick={() => setViewMode("kanban")}
            >
              {lang === "ar" ? "كانبان" : "Kanban"}
            </Button>
            <Button
              variant={viewMode === "list" ? "primary" : "subtle"}
              size="sm"
              style={{ display: "inline-flex" }}
              className="rounded-full"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              {lang === "ar" ? "قائمة" : "List"}
            </Button>
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
            const colValue = colCustomers.reduce(
              (sum, c) => sum + (Number(c.budget) || 0),
              0,
            );

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
                <div className="mb-2 px-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={stageHue ? { backgroundColor: stageHue } : undefined}
                      />
                      <span className="text-xs font-bold text-foreground truncate">
                        {status.label[lang]}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
                      {colCustomers.length}
                    </span>
                  </div>
                  {colValue > 0 && (
                    <p
                      dir="ltr"
                      className="number-ltr mt-1 text-[11px] font-medium tabular-nums text-muted-foreground"
                    >
                      {colValue.toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")}{" "}
                      {lang === "ar" ? "ر.س" : "SAR"}
                    </p>
                  )}
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
                    onMoveToStage={handleMoveToStage}
                    currentStage={status.key}
                  />
                ))}

                {/* Add shortcut (not on LOST column) */}
                {canWrite && !showLost && (
                  <Button
                    variant="outline"
                    size="sm"
                    style={{ display: "inline-flex", width: "100%" }}
                    className="mt-auto gap-1.5 p-2 rounded-xl border-2 border-dashed text-muted-foreground hover:border-primary/40 hover:text-primary h-auto text-xs justify-center"
                    onClick={() => {
                      setNewCustomer((prev) => ({ ...prev, status: status.key }));
                      setShowAddModal(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {lang === "ar" ? "إضافة" : "Add"}
                  </Button>
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
          emptyIcon={<Users className="h-12 w-12" aria-hidden="true" />}
          emptyTitle={lang === "ar" ? "لا توجد نتائج" : "No contacts found"}
          emptyDescription={
            lang === "ar"
              ? "حاول تعديل خيارات البحث أو الفلتر، أو أضف عميلاً جديداً."
              : "Try adjusting your search or filter, or add a new contact."
          }
          emptyAction={
            !search.trim() && !statusFilter ? (
              <Button
                onClick={openAddCustomerModal}
                style={{ display: "inline-flex" }}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {lang === "ar" ? "إضافة عميل" : "Add contact"}
              </Button>
            ) : undefined
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
                  {c.phone ? (
                    <span className="inline-flex items-center gap-1.5 font-mono" dir="ltr">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                      {showPii ? c.phone : maskPhone(c.phone)}
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                  <span>
                    {c.budget
                      ? `${Number(c.budget).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")} ${lang === "ar" ? "ر.س" : "SAR"}`
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
                    <IconButton
                      icon={Eye}
                      aria-label={lang === "ar" ? "عرض الملف" : "View profile"}
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 sm:h-8 sm:w-8 border border-border bg-background"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrawerCustomer(c);
                      }}
                    />
                    {canDelete && (
                      <IconButton
                        icon={Trash2}
                        aria-label={lang === "ar" ? "حذف" : "Delete"}
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 sm:h-8 sm:w-8 border border-border bg-background"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDelete(c);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          }}
        />
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
              variant="destructive"
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
              <Button
                key={reason.key}
                type="button"
                variant={lostReason === reason.key ? "outline" : "outline"}
                size="sm"
                style={{ display: "block", width: "100%" }}
                className={cn(
                  "text-start px-4 py-3 h-auto text-sm justify-start",
                  lostReason === reason.key
                    ? "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/15"
                    : "hover:bg-muted/30"
                )}
                onClick={() => setLostReason(reason.key)}
              >
                {reason.label[lang]}
              </Button>
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
              variant="destructive"
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
        {error && <p className="text-sm text-destructive">{error}</p>}
      </ResponsiveDialog>
    </div>
    </div>

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
              <IconButton
                icon={X}
                aria-label={lang === "ar" ? "إغلاق" : "Close"}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowAddModal(false)}
              />
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
                              ? "bg-info/15 text-info"
                              : "bg-primary/15 text-primary"
                          )}>
                            {newCustIntent === "BUY" ? (lang === "ar" ? "شراء" : "BUY") : (lang === "ar" ? "إيجار" : "RENT")}
                          </span>
                        )}
                      </div>
                      <IconButton
                        icon={X}
                        aria-label={lang === "ar" ? "إزالة" : "Remove"}
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => { setNewCustSelectedUnit(null); setNewCustIntent(null); setNewCustUnitSearch(""); }}
                      />
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
                                <Button
                                  key={unit.id}
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  style={{ display: "flex", width: "100%" }}
                                  className="items-center justify-between gap-3 px-3 py-2.5 text-start h-auto rounded-none"
                                  onClick={() => { setNewCustSelectedUnit(unit); setNewCustUnitSearch(""); }}
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
                                        {Number(price).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")} {lang === "ar" ? "ر.س" : "SAR"}
                                      </span>
                                    )}
                                    {tag && (
                                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", tag.color)}>
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
                        <Button
                          type="button"
                          variant={newCustIntent === "BUY" ? "primary" : "outline"}
                          size="sm"
                          style={{ display: "inline-flex", flex: 1 }}
                          className={cn(
                            "py-2 text-sm h-auto justify-center",
                            newCustIntent === "BUY"
                              ? "bg-info text-info-foreground border-info hover:bg-info/90"
                              : ""
                          )}
                          onClick={() => setNewCustIntent("BUY")}
                        >
                          {lang === "ar" ? "شراء" : "Buy"}
                        </Button>
                        <Button
                          type="button"
                          variant={newCustIntent === "RENT" ? "primary" : "outline"}
                          size="sm"
                          style={{ display: "inline-flex", flex: 1 }}
                          className="py-2 text-sm h-auto justify-center"
                          onClick={() => setNewCustIntent("RENT")}
                        >
                          {lang === "ar" ? "إيجار" : "Rent"}
                        </Button>
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
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
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
        showPii={showPii}
        hasPiiAccess={hasPiiAccess}
      />
    )}
    </>
  );
}
