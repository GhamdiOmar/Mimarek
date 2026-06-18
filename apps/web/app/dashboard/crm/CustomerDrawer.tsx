"use client";

import * as React from "react";
import {
  Users,
  Plus,
  Loader2,
  X,
  Search,
  Trash2,
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
} from "lucide-react";
import {
  Button,
  IconButton,
  ActionLink,
  Input,
  SelectField,
  HijriDatePicker,
  ResponsiveDialog,
  QuickActionRail,
  DirectionalIcon,
  SaudiPhoneInput,
  EmptyState,
  LifecycleRail,
  NextActionPanel,
  ProcessBlockerBanner,
  RelatedContextPanel,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import { updateCustomer } from "../../actions/customers";
import { getJourneySummary } from "../../actions/journey";
import type { JourneySummary } from "@repo/types";
import CustomerActivityTimeline from "../../../components/CustomerActivityTimeline";
import {
  getCustomerInterests,
  addCustomerInterest,
  dropCustomerInterest,
  convertInterestToDeal,
  getAvailableUnitsForInterest,
} from "../../actions/customer-interests";
import { maskPhone, maskEmail } from "@/lib/pii-masking";
import { toWhatsAppNumber } from "@/lib/phone";
import { getStatusConfig, formatSAR } from "./crm-helpers";
import {
  SOURCE_LABELS,
  PROPERTY_TYPES,
  LOST_REASONS,
  DEAL_STAGE_LABELS,
} from "./crm-config";

// ─── Customer Profile Drawer ──────────────────────────────────────────────────

// These mirror the masked-row shapes the caller (CrmView) already declares. Each
// carries a `[key: string]: unknown` index signature so the typed props accept
// CrmView's index-signature'd rows; the declared keys still take precedence over
// the index signature for known field accesses.

/** Agent / team-member relation as selected by the server actions. */
type CrmAgent = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  [key: string]: unknown;
};

/**
 * Masked + serialized customer payload as it reaches the client from
 * `getCustomers()` / `updateCustomer()` — PII fields are masked strings (or the
 * raw value when `showPii`), Decimals/dates are serialized, and the server adds
 * `contactPhoneE164`. Typed to the fields this drawer reads.
 */
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
  agent?: { id?: string; name?: string | null; email?: string | null } | null;
  budget?: number | string | null;
  propertyTypeInterest?: string | null;
  nationality?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  dateOfBirth?: string | Date | null;
  contactPhoneE164?: string | null;
  [key: string]: unknown;
};

/** Customer interest row (with its unit) as serialized by `getCustomerInterests`. */
type CrmInterestUnit = {
  id: string;
  number?: string | null;
  city?: string | null;
  type?: string | null;
  buildingName?: string | null;
  rentalPrice?: number | string | null;
  markupPrice?: number | string | null;
  [key: string]: unknown;
};
type CrmInterest = {
  id: string;
  intent?: string | null;
  stage?: string | null;
  status?: string | null;
  unit?: CrmInterestUnit | null;
  [key: string]: unknown;
};

/** Available unit option for the link-property flow. */
type CrmAvailableUnit = {
  id: string;
  number?: string | null;
  city?: string | null;
  type?: string | null;
  buildingName?: string | null;
  rentalPrice?: number | string | null;
  markupPrice?: number | string | null;
  [key: string]: unknown;
};

/** Reservation/contract assignment row for the "active records" list. */
type CrmAssignment = {
  type?: string;
  unitNumber?: string | null;
  unitId?: string | null;
  building?: string | null;
  status?: string | null;
  [key: string]: unknown;
};

export function CustomerDrawer({
  customer,
  onClose,
  onCustomerUpdated,
  onMarkLost,
  lang,
  teamMembers,
  assignments,
  showPii,
}: {
  customer: CrmCustomer;
  onClose: () => void;
  onCustomerUpdated: (updated: CrmCustomer) => void;
  onMarkLost?: (customerId: string, customerName: string) => void;
  lang: "ar" | "en";
  teamMembers: CrmAgent[];
  assignments: CrmAssignment[];
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
  const [interests, setInterests] = React.useState<CrmInterest[]>([]);
  const [loadingInterests, setLoadingInterests] = React.useState(false);
  const [showLinkModal, setShowLinkModal] = React.useState(false);
  const [availableUnits, setAvailableUnits] = React.useState<CrmAvailableUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = React.useState(false);
  const [linkUnitSearch, setLinkUnitSearch] = React.useState("");
  const [linkSelectedUnit, setLinkSelectedUnit] = React.useState<CrmAvailableUnit | null>(null);
  const [linkIntent, setLinkIntent] = React.useState<"BUY" | "RENT" | "">("");
  const [savingLink, setSavingLink] = React.useState(false);
  const [linkError, setLinkError] = React.useState<string | null>(null);

  const [showDropConfirm, setShowDropConfirm] = React.useState(false);
  const [droppingInterest, setDroppingInterest] = React.useState<CrmInterest | null>(null);
  const [droppingLoading, setDroppingLoading] = React.useState(false);

  const [showConvertDealModal, setShowConvertDealModal] = React.useState(false);
  const [convertingInterest, setConvertingInterest] = React.useState<CrmInterest | null>(null);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
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

  function openConvertModal(interest: CrmInterest) {
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
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

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[90] bg-overlay/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer
          RTL-logical shell (B2): on md+ it is a full-height side panel anchored to the
          INLINE-END (right in LTR, left in RTL) via `end-0`; on <md it becomes a
          bottom-sheet (inset-x-0, bottom-0, capped height, rounded top). The entrance
          uses a direction-agnostic fade/slide so it never animates the wrong way in RTL
          — `slide-in-from-right` was LTR-locked and is removed. A full ResponsiveDialog
          re-platform is intentionally NOT done: its desktop leg is a CENTER-screen modal,
          which would destroy this wide, end-anchored, full-height drawer surface. */}
      <div
        className={cn(
          "fixed z-[100] bg-card border-border shadow-2xl flex flex-col",
          // Mobile: bottom-sheet
          "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl border-t pb-safe-bottom",
          "animate-in fade-in slide-in-from-bottom duration-300",
          // Desktop (md+): full-height end-anchored side drawer
          "md:inset-x-auto md:inset-y-0 md:end-0 md:w-full md:max-w-md md:max-h-none md:rounded-none md:border-t-0 md:border-s md:pb-0",
          "md:slide-in-from-bottom-0",
        )}
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        {/* Mobile bottom-sheet grab handle (hidden on md+ side drawer) */}
        <div
          aria-hidden="true"
          className="md:hidden mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30"
        />

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
                                  ? "bg-info/10 text-info-strong border-info/30"
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
                                    ? "bg-warning/10 text-warning-strong border-warning/30"
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
                {assignments.map((item: CrmAssignment, idx: number) => {
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
            <SelectField
              label={lang === "ar" ? "المصدر" : "Source"}
              value={editForm.source}
              onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
            >
              <option value="">{lang === "ar" ? "اختر المصدر" : "Select source"}</option>
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label[lang]}</option>
              ))}
            </SelectField>
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
            <SelectField
              label={lang === "ar" ? "نوع العقار المطلوب" : "Property Interest"}
              value={editForm.propertyTypeInterest}
              onChange={(e) => setEditForm({ ...editForm, propertyTypeInterest: e.target.value })}
            >
              <option value="">{lang === "ar" ? "اختر النوع" : "Select type"}</option>
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt.key} value={pt.key}>{pt.label[lang]}</option>
              ))}
            </SelectField>
            {teamMembers.length > 0 && (
              <SelectField
                label={lang === "ar" ? "المسؤول" : "Agent"}
                value={editForm.agentId}
                onChange={(e) => setEditForm({ ...editForm, agentId: e.target.value })}
                wrapperClassName="col-span-2"
              >
                <option value="">{lang === "ar" ? "غير معين" : "Unassigned"}</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
                ))}
              </SelectField>
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
                        ? "border-info/50 bg-info/10 text-info-strong hover:bg-info/15"
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
              <HijriDatePicker
                locale={lang}
                value={convertExpiry ? new Date(convertExpiry) : null}
                onChange={(d) => setConvertExpiry(d ? d.toISOString().slice(0, 10) : "")}
                placeholder={lang === "ar" ? "اختر تاريخًا" : "Pick a date"}
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
