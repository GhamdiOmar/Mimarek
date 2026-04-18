"use client";

import { useLanguage } from "../../../components/LanguageProvider";
import * as React from "react";
import {
  Building2,
  Search,
  Plus,
  Loader2,
  Wrench,
  X,
  Eye,
  ShoppingCart,
  Home,
  Receipt,
  Trash2,
  Pencil,
  DollarSign,
  FileDown,
  CheckCircle2,
  KeyRound,
  Filter,
  Store,
  Warehouse as WarehouseIcon,
  Car,
  Briefcase,
  BedDouble,
  Bath,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Button,
  Badge,
  Input,
  SARAmount,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageIntro,
  StatusBadge,
  KPICard,
  ResponsiveDialog,
  AppBar,
  MobileTabs,
  PropertyCard,
  BottomSheet,
  FAB,
  formatSAR,
} from "@repo/ui";
import { cn } from "@repo/ui/lib/utils";
import {
  getUnitsWithBuildings,
  massUpdateUnits,
  createUnit,
  deleteUnit,
  getUnitFinancialSummary,
  getActiveContractForUnit,
} from "../../actions/units";
import { getMaintenanceForUnit } from "../../actions/maintenance";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const unitTypeLabels: Record<string, { ar: string; en: string }> = {
  APARTMENT: { ar: "شقة", en: "Apartment" },
  VILLA: { ar: "فيلا", en: "Villa" },
  OFFICE: { ar: "مكتب", en: "Office" },
  RETAIL: { ar: "محل تجاري", en: "Retail" },
  WAREHOUSE: { ar: "مستودع", en: "Warehouse" },
  PARKING: { ar: "موقف", en: "Parking" },
};

const unitStatusLabels: Record<string, { ar: string; en: string }> = {
  AVAILABLE: { ar: "متاح", en: "Available" },
  RESERVED: { ar: "محجوز", en: "Reserved" },
  SOLD: { ar: "مباع", en: "Sold" },
  RENTED: { ar: "مؤجر", en: "Rented" },
  MAINTENANCE: { ar: "صيانة", en: "Maintenance" },
};


export default function AdvancedUnitMatrixPageWrapper() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-[calc(100vh-200px)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AdvancedUnitMatrixPage />
    </React.Suspense>
  );
}

function AdvancedUnitMatrixPage() {
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const [selectedUnits, setSelectedUnits] = React.useState<string[]>([]);
  const [units, setUnits] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showPriceModal, setShowPriceModal] = React.useState(false);
  const [bulkPrice, setBulkPrice] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"cards" | "table">("cards");
  const [density, setDensity] = React.useState<"compact" | "default" | "comfortable">("default");
  const [unitSearch, setUnitSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  // Mobile-only filter state (does not affect desktop behavior)
  const [mobileFilterOpen, setMobileFilterOpen] = React.useState(false);
  const [mobileTypeFilter, setMobileTypeFilter] = React.useState<string>("");
  const [mobileMinPrice, setMobileMinPrice] = React.useState<string>("");
  const [mobileMaxPrice, setMobileMaxPrice] = React.useState<string>("");
  const [newUnit, setNewUnit] = React.useState({
    number: "",
    type: "APARTMENT",
    area: "",
    price: "",
    markupPrice: "",
    rentalPrice: "",
    status: "AVAILABLE",
  });

  // Error state for inline error display
  const [error, setError] = React.useState<string | null>(null);
  // Confirm delete dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  // Deleting state (separate from updating for granularity)
  const [deleting, setDeleting] = React.useState(false);

  // Unit detail modal
  const [detailUnit, setDetailUnit] = React.useState<any>(null);
  const [detailMaintenance, setDetailMaintenance] = React.useState<any[]>([]);
  const [detailFinancials, setDetailFinancials] = React.useState<any>(null);
  const [detailContract, setDetailContract] = React.useState<any>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const maintenanceStatusLabels: Record<
    string,
    { ar: string; en: string; variant: string }
  > = {
    OPEN: { ar: "بانتظار المراجعة", en: "Waiting Review", variant: "draft" },
    ASSIGNED: { ar: "معيّن", en: "Assigned", variant: "reserved" },
    IN_PROGRESS: { ar: "قيد التنفيذ", en: "In Progress", variant: "reserved" },
    ON_HOLD: { ar: "معلّق", en: "On Hold", variant: "maintenance" },
    RESOLVED: { ar: "تم الحل", en: "Resolved", variant: "available" },
    CLOSED: { ar: "مغلق", en: "Closed", variant: "sold" },
  };

  async function openUnitDetail(unit: any) {
    setDetailUnit(unit);
    setDetailFinancials(null);
    setDetailContract(null);
    setLoadingDetail(true);
    try {
      const [maint, fin, contract] = await Promise.all([
        getMaintenanceForUnit(unit.id),
        getUnitFinancialSummary(unit.id).catch(() => null),
        getActiveContractForUnit(unit.id).catch(() => null),
      ]);
      setDetailMaintenance(maint);
      setDetailFinancials(fin);
      setDetailContract(contract);
    } catch (e) {
      console.error(e);
      setDetailMaintenance([]);
    } finally {
      setLoadingDetail(false);
    }
  }

  React.useEffect(() => {
    async function loadUnits() {
      try {
        const data = await getUnitsWithBuildings();
        setUnits(data);
      } catch (err) {
        console.error("Failed to fetch units");
      } finally {
        setLoading(false);
      }
    }
    loadUnits();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedUnits((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (!newStatus) return;
    setUpdating(true);
    setError(null);
    try {
      const updates = selectedUnits.map((id) => ({ id, status: newStatus }));
      await massUpdateUnits(updates);
      setUnits(
        units.map((u) =>
          u && selectedUnits.includes(u.id) ? { ...u, status: newStatus } : u
        )
      );
      setSelectedUnits([]);
    } catch (err) {
      setError(lang === "ar" ? "فشل تحديث حالة الوحدات" : "Failed to update units");
    } finally {
      setUpdating(false);
    }
  };

  const handleAddUnit = async () => {
    setUpdating(true);
    try {
      const unit = await createUnit({
        ...newUnit,
        area: newUnit.area ? parseFloat(newUnit.area) : undefined,
        price: newUnit.price ? parseFloat(newUnit.price) : undefined,
        markupPrice: newUnit.markupPrice
          ? parseFloat(newUnit.markupPrice)
          : undefined,
        rentalPrice: newUnit.rentalPrice
          ? parseFloat(newUnit.rentalPrice)
          : undefined,
      });
      setUnits((prev) => [...prev, unit]);
      setShowAddModal(false);
      setNewUnit({
        number: "",
        type: "APARTMENT",
        area: "",
        price: "",
        markupPrice: "",
        rentalPrice: "",
        status: "AVAILABLE",
      });
    } catch (err) {
      setError(lang === "ar" ? "فشل إنشاء الوحدة" : "Failed to create unit");
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkPriceUpdate = async () => {
    if (!bulkPrice) return;
    setUpdating(true);
    try {
      const updates = selectedUnits.map((id) => ({
        id,
        price: parseFloat(bulkPrice),
      }));
      await massUpdateUnits(updates);
      setUnits(
        units.map((u) =>
          selectedUnits.includes(u.id)
            ? { ...u, price: parseFloat(bulkPrice) }
            : u
        )
      );
      setSelectedUnits([]);
      setShowPriceModal(false);
      setBulkPrice("");
    } catch (err) {
      setError(lang === "ar" ? "فشل تحديث السعر" : "Failed to update price");
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      for (const id of selectedUnits) {
        await deleteUnit(id);
      }
      setUnits(units.filter((u) => !selectedUnits.includes(u.id)));
      setSelectedUnits([]);
      setShowDeleteConfirm(false);
    } catch (err) {
      setError(lang === "ar" ? "فشل حذف بعض الوحدات" : "Failed to delete some units");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered units based on search and status
  const filteredUnits = React.useMemo(() => {
    return units.filter((u: any) => {
      const q = unitSearch.trim().toLowerCase();
      const matchesSearch = !q || u.number?.toLowerCase().includes(q) || u.buildingName?.toLowerCase().includes(q) || u.city?.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || u.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [units, unitSearch, statusFilter]);

  // Status counts for pills
  const statusCounts = React.useMemo(() => ({
    total: units.length,
    available: units.filter((u: any) => u.status === "AVAILABLE").length,
    reserved: units.filter((u: any) => u.status === "RESERVED").length,
    sold: units.filter((u: any) => u.status === "SOLD").length,
    rented: units.filter((u: any) => u.status === "RENTED").length,
    maintenance: units.filter((u: any) => u.status === "MAINTENANCE").length,
  }), [units]);

  // ─── Mobile view derived memo (must run every render, before any early return) ──
  const mobileFilteredUnits = React.useMemo(() => {
    return filteredUnits.filter((u: any) => {
      if (mobileTypeFilter && u.type !== mobileTypeFilter) return false;
      const priceNum = u.price != null ? Number(u.price) : null;
      const min = mobileMinPrice ? parseFloat(mobileMinPrice) : null;
      const max = mobileMaxPrice ? parseFloat(mobileMaxPrice) : null;
      if (min !== null && (priceNum === null || priceNum < min)) return false;
      if (max !== null && (priceNum === null || priceNum > max)) return false;
      return true;
    });
  }, [filteredUnits, mobileTypeFilter, mobileMinPrice, mobileMaxPrice]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Mobile view derived state ─────────────────────────────────────────
  const mobileStatusTabs: Array<{ key: string; label: string }> = [
    { key: "", label: lang === "ar" ? "الكل" : "All" },
    { key: "AVAILABLE", label: unitStatusLabels.AVAILABLE?.[lang] ?? "Available" },
    { key: "RESERVED", label: unitStatusLabels.RESERVED?.[lang] ?? "Reserved" },
    { key: "SOLD", label: unitStatusLabels.SOLD?.[lang] ?? "Sold" },
    { key: "RENTED", label: unitStatusLabels.RENTED?.[lang] ?? "Rented" },
    { key: "MAINTENANCE", label: unitStatusLabels.MAINTENANCE?.[lang] ?? "Maintenance" },
  ];

  const unitTypeIcons: Record<string, LucideIcon> = {
    APARTMENT: Building2,
    VILLA: Home,
    OFFICE: Briefcase,
    RETAIL: Store,
    WAREHOUSE: WarehouseIcon,
    PARKING: Car,
  };

  const mobileActiveFilterCount =
    (mobileTypeFilter ? 1 : 0) +
    (mobileMinPrice ? 1 : 0) +
    (mobileMaxPrice ? 1 : 0);

  return (
    <>
      {/* ═══ MOBILE LAYOUT (below md) ═══════════════════════════════════ */}
      <div
        className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        <AppBar
          title={lang === "ar" ? "الوحدات" : "Units"}
          subtitle={
            lang === "ar"
              ? `${filteredUnits.length} وحدة`
              : `${filteredUnits.length} units`
          }
          lang={lang}
          trailing={
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              aria-label={lang === "ar" ? "تصفية" : "Filter"}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted/60 active:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
            >
              <Filter className="h-5 w-5" aria-hidden="true" />
              {mobileActiveFilterCount > 0 && (
                <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          }
        />

        {/* Search input */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
              placeholder={
                lang === "ar"
                  ? "ابحث برقم الوحدة أو المبنى..."
                  : "Search unit #, building, or city..."
              }
              className="w-full h-11 bg-card border border-border rounded-xl ps-10 pe-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
        </div>

        {/* Status tabs */}
        <div className="px-4 pt-3">
          <MobileTabs
            ariaLabel={lang === "ar" ? "تصفية الحالة" : "Status filter"}
            items={mobileStatusTabs}
            active={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        {/* List */}
        <div className="flex-1 px-4 py-3">
          {mobileFilteredUnits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                <Building2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {lang === "ar" ? "لا توجد وحدات" : "No units found"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {lang === "ar"
                  ? "جرّب تعديل البحث أو الفلاتر"
                  : "Try adjusting your search or filters"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {mobileFilteredUnits.map((u: any) => {
                const Icon = unitTypeIcons[u.type] ?? Building2;
                const buildingOrCity = u.buildingName || u.city || null;
                const typeKey: "apartment" | "villa" | "warehouse" | "retail" | "office" | "other" =
                  u.type === "APARTMENT"
                    ? "apartment"
                    : u.type === "VILLA"
                      ? "villa"
                      : u.type === "WAREHOUSE"
                        ? "warehouse"
                        : u.type === "RETAIL"
                          ? "retail"
                          : u.type === "OFFICE"
                            ? "office"
                            : "other";
                const statusKey: "available" | "reserved" | "sold" | "rented" | "maintenance" =
                  u.status === "AVAILABLE"
                    ? "available"
                    : u.status === "RESERVED"
                      ? "reserved"
                      : u.status === "SOLD"
                        ? "sold"
                        : u.status === "RENTED"
                          ? "rented"
                          : "maintenance";
                const unitLabel = unitTypeLabels[u.type]?.[lang] ?? u.type;
                const titleText = `${unitLabel} · ${u.number}`;
                return (
                  <PropertyCard
                    key={u.id}
                    title={titleText}
                    icon={Icon}
                    type={typeKey}
                    status={statusKey}
                    location={buildingOrCity}
                    bedrooms={u.bedrooms ?? null}
                    bathrooms={u.bathrooms ?? null}
                    areaSqm={u.area ?? null}
                    price={
                      u.price != null
                        ? `${formatSAR(Number(u.price))} ${lang === "ar" ? "ر.س" : "SAR"}`
                        : undefined
                    }
                    lang={lang}
                    onClick={() => openUnitDetail(u)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* FAB */}
        <FAB
          icon={Plus}
          label={lang === "ar" ? "وحدة جديدة" : "New unit"}
          onClick={() => setShowAddModal(true)}
        />

        {/* Filter BottomSheet */}
        <BottomSheet
          open={mobileFilterOpen}
          onOpenChange={setMobileFilterOpen}
          title={lang === "ar" ? "تصفية الوحدات" : "Filter units"}
          description={
            lang === "ar"
              ? "حدد معايير لتضييق قائمة الوحدات"
              : "Narrow the unit list by type, status, or price"
          }
          footer={
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                style={{ display: "inline-flex" }}
                className="flex-1"
                onClick={() => {
                  setMobileTypeFilter("");
                  setMobileMinPrice("");
                  setMobileMaxPrice("");
                  setStatusFilter("");
                }}
              >
                {lang === "ar" ? "مسح الكل" : "Clear all"}
              </Button>
              <Button
                style={{ display: "inline-flex" }}
                className="flex-1"
                onClick={() => setMobileFilterOpen(false)}
              >
                {lang === "ar" ? "تطبيق" : "Apply"}
              </Button>
            </div>
          }
        >
          <div className="space-y-5 py-2">
            {/* Status */}
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                {lang === "ar" ? "الحالة" : "Status"}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStatusFilter("")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                    !statusFilter
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/20",
                  )}
                >
                  {lang === "ar" ? "الكل" : "All"}
                </button>
                {Object.entries(unitStatusLabels).map(([key, label]) => {
                  const active = statusFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setStatusFilter(active ? "" : key)
                      }
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                        active
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-foreground/20",
                      )}
                    >
                      {label[lang]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Unit type */}
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                {lang === "ar" ? "نوع الوحدة" : "Unit type"}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMobileTypeFilter("")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                    !mobileTypeFilter
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/20",
                  )}
                >
                  {lang === "ar" ? "الكل" : "All"}
                </button>
                {Object.entries(unitTypeLabels).map(([key, label]) => {
                  const active = mobileTypeFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setMobileTypeFilter(active ? "" : key)
                      }
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                        active
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-foreground/20",
                      )}
                    >
                      {label[lang]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price range */}
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                {lang === "ar" ? "نطاق السعر (ر.س)" : "Price range (SAR)"}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={mobileMinPrice}
                  onChange={(e) => setMobileMinPrice(e.target.value)}
                  placeholder={lang === "ar" ? "الحد الأدنى" : "Min"}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  value={mobileMaxPrice}
                  onChange={(e) => setMobileMaxPrice(e.target.value)}
                  placeholder={lang === "ar" ? "الحد الأعلى" : "Max"}
                />
              </div>
            </div>
          </div>
        </BottomSheet>
      </div>

      {/* ═══ DESKTOP LAYOUT (md and up) ═══════════════════════════════ */}
      <div
        className="hidden md:block space-y-8 animate-in fade-in duration-500"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
      {/* Header */}
      <PageIntro
        title={lang === "ar" ? "الوحدات" : "Units"}
        description={
          lang === "ar"
            ? "إدارة وتتبع جميع الوحدات العقارية عبر المشاريع والمباني"
            : "Manage and track all property units across projects and buildings"
        }
        actions={
          <>
            <Button variant="primary" size="sm" style={{ display: "inline-flex" }} className="gap-2" onClick={() => setShowAddModal(true)}>
              <Plus className="h-3.5 w-3.5" />
              {lang === "ar" ? "إضافة وحدة" : "Add Unit"}
            </Button>
            <Button variant="outline" size="sm" style={{ display: "inline-flex" }} className="gap-2">
              <FileDown className="h-3.5 w-3.5" />
              {lang === "ar" ? "تصدير" : "Export"}
            </Button>
          </>
        }
      />

      {/* Inline Error Display */}
      {error && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => setError(null)} className="text-destructive/70 hover:text-destructive" aria-label={lang === "ar" ? "إغلاق" : "Close"}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label={lang === "ar" ? "إجمالي الوحدات" : "Total Units"}
          value={loading ? "—" : units.length}
          subtitle={lang === "ar" ? "جميع الوحدات المسجلة عبر المشاريع والمباني" : "All registered units across projects and buildings"}
          icon={<Building2 className="h-[18px] w-[18px]" />}
          accentColor="primary"
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "متاح" : "Available"}
          value={loading ? "—" : units.filter((u: any) => u.status === "AVAILABLE").length}
          subtitle={lang === "ar" ? "وحدات جاهزة للبيع أو التأجير فوراً" : "Units ready for immediate sale or lease"}
          icon={<CheckCircle2 className="h-[18px] w-[18px]" />}
          accentColor="secondary"
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "مؤجرة / مباعة" : "Occupied / Leased"}
          value={loading ? "—" : units.filter((u: any) => u.status === "RENTED" || u.status === "SOLD").length}
          subtitle={lang === "ar" ? "وحدات مشغولة بعقود بيع أو إيجار نشطة" : "Units with active sale or rental contracts"}
          icon={<KeyRound className="h-[18px] w-[18px]" />}
          accentColor="info"
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "تحت الصيانة" : "Under Maintenance"}
          value={loading ? "—" : units.filter((u: any) => u.status === "MAINTENANCE").length}
          subtitle={lang === "ar" ? "وحدات قيد الإصلاح أو التجديد حالياً" : "Units currently under repair or renovation"}
          icon={<Wrench className="h-[18px] w-[18px]" />}
          accentColor="warning"
          loading={loading}
        />
      </div>

      {/* ═══ PHYSICAL UNITS ═══ */}
      {true && (
        <>
          {/* Bulk Action Bar (Floating) */}
          {selectedUnits.length > 0 && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-primary-deep text-white px-6 py-4 rounded-xl shadow-2xl border border-white/10 flex items-center gap-8 animate-in slide-in-from-bottom-10">
              <div className="flex items-center gap-3 border-e border-white/20 pe-6 me-2">
                <span className="h-6 w-6 bg-secondary text-white rounded-full flex items-center justify-center text-xs font-bold leading-none">
                  {selectedUnits.length}
                </span>
                <span className="text-sm">
                  {lang === "ar" ? "وحدة مختارة" : "Units Selected"}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {updating && <Loader2 className="h-4 w-4 animate-spin text-white" />}
                <select
                  onChange={(e) => handleBulkStatusUpdate(e.target.value)}
                  disabled={updating || deleting}
                  className="bg-secondary/80 hover:bg-secondary text-white text-xs font-bold rounded-md px-3 py-2 outline-none border-none cursor-pointer disabled:opacity-50"
                >
                  <option value="">
                    {lang === "ar" ? "تحديث الحالة" : "Update Status"}
                  </option>
                  {Object.entries(unitStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label[lang]}
                    </option>
                  ))}
                </select>

                <Button
                  size="sm"
                  variant="secondary"
                  style={{ display: "inline-flex" }}
                  className="gap-2 bg-card/10 border-white/20 text-white hover:bg-card/20"
                  onClick={() => setShowPriceModal(true)}
                  disabled={updating}
                >
                  <DollarSign className="h-4 w-4" />
                  {lang === "ar" ? "تغيير السعر" : "Change Price"}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  style={{ display: "inline-flex" }}
                  className="gap-2 bg-destructive/80 hover:bg-destructive whitespace-nowrap"
                  onClick={handleBulkDelete}
                  disabled={updating || deleting}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {lang === "ar" ? "حذف" : "Delete"}
                </Button>
              </div>

              <button
                onClick={() => setSelectedUnits([])}
                className="text-xs text-white/50 hover:text-white underline underline-offset-4 ms-4"
              >
                {lang === "ar" ? "إلغاء التحديد" : "Clear Selection"}
              </button>
            </div>
          )}

          {/* Consolidated Toolbar */}
          <Card className="p-4 space-y-4">
            {/* Row 1: Status tabs + view toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter("")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    !statusFilter
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                  style={{ display: "inline-flex" }}
                >
                  {lang === "ar" ? "الكل" : "All"} {statusCounts.total}
                </button>
                {Object.entries(unitStatusLabels).map(([key, label]) => {
                  const count = units.filter((u: any) => u.status === key).length;
                  const active = statusFilter === key;
                  const activeClasses: Record<string, string> = {
                    AVAILABLE: "bg-success/15 text-success ring-1 ring-success/30",
                    RESERVED: "bg-info/15 text-info ring-1 ring-info/30",
                    SOLD: "bg-primary/15 text-primary ring-1 ring-primary/30",
                    RENTED: "bg-secondary/15 text-secondary ring-1 ring-secondary/30",
                    MAINTENANCE: "bg-warning/15 text-warning ring-1 ring-warning/30",
                  };
                  return (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(active ? "" : key)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        active
                          ? activeClasses[key] ?? "bg-primary/10 text-primary ring-1 ring-primary/30"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      )}
                      style={{ display: "inline-flex" }}
                    >
                      {label[lang]} {count}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                {/* Density toggle (desktop only) */}
                <div className="hidden md:inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
                  {([
                    { key: "compact", en: "Compact", ar: "مضغوط" },
                    { key: "default", en: "Default", ar: "افتراضي" },
                    { key: "comfortable", en: "Comfortable", ar: "موسّع" },
                  ] as const).map((d) => {
                    const active = density === d.key;
                    return (
                      <button
                        key={d.key}
                        onClick={() => setDensity(d.key)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        style={{ display: "inline-flex" }}
                        aria-pressed={active}
                        aria-label={lang === "ar" ? `الكثافة: ${d.ar}` : `Density: ${d.en}`}
                      >
                        {lang === "ar" ? d.ar : d.en}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setViewMode("cards")}
                  className={cn(
                    "px-3 py-2 rounded-full text-sm border transition-colors",
                    viewMode === "cards" ? "border-primary/30 bg-primary/15 text-foreground" : "border-border bg-card text-muted-foreground"
                  )}
                  style={{ display: "inline-flex" }}
                >
                  {lang === "ar" ? "بطاقات" : "Cards"}
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "px-3 py-2 rounded-full text-sm border transition-colors",
                    viewMode === "table" ? "border-primary/30 bg-primary/15 text-foreground" : "border-border bg-card text-muted-foreground"
                  )}
                  style={{ display: "inline-flex" }}
                >
                  {lang === "ar" ? "جدول" : "Table"}
                </button>
              </div>
            </div>
            {/* Row 2: Search + filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  placeholder={lang === "ar" ? "ابحث برقم الوحدة أو المشروع أو المبنى..." : "Search by unit #, project, or building..."}
                  className="w-full h-10 bg-background border border-input rounded-xl ps-10 pe-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
            </div>
          </Card>

          {/* Meta row: count + status pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{lang === "ar" ? "عرض" : "Showing"} <strong className="text-foreground">{filteredUnits.length}</strong> {lang === "ar" ? "وحدة" : "units"}</span>
              <Badge variant="available" className="bg-success/10 text-success border-success/20">{unitStatusLabels.AVAILABLE?.[lang]} {statusCounts.available}</Badge>
              <Badge variant="reserved" className="bg-primary/10 text-primary border-primary/20">{unitStatusLabels.RESERVED?.[lang]} {statusCounts.reserved}</Badge>
              <Badge variant="sold" className="bg-muted text-muted-foreground border-muted">{unitStatusLabels.SOLD?.[lang]}/{unitStatusLabels.RENTED?.[lang]} {statusCounts.sold + statusCounts.rented}</Badge>
              <Badge variant="draft" className="bg-warning/10 text-warning border-warning/20">{unitStatusLabels.MAINTENANCE?.[lang]} {statusCounts.maintenance}</Badge>
            </div>
          </div>

          {/* Card View */}
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredUnits.map((unit: any) => {
                const statusChipClasses: Record<string, string> = {
                  AVAILABLE: "bg-success/10 text-success border border-success/20",
                  RESERVED: "bg-info/10 text-info border border-info/20",
                  SOLD: "bg-primary/10 text-primary border border-primary/20",
                  RENTED: "bg-secondary/10 text-secondary border border-secondary/20",
                  MAINTENANCE: "bg-warning/10 text-warning border border-warning/20",
                };
                const chipClass =
                  statusChipClasses[unit.status] ??
                  "bg-muted text-muted-foreground border border-border";
                const statusLabel = unitStatusLabels[unit.status]?.[lang] ?? unit.status;
                const isRented = unit.status === "RENTED";
                const heroPriceRaw = isRented
                  ? unit.rentalPrice
                  : (unit.markupPrice ?? unit.price);
                const heroPriceNum =
                  heroPriceRaw != null ? Number(heroPriceRaw) : null;
                const areaLabel = lang === "ar" ? "م²" : "m²";
                const floorLabel = lang === "ar" ? "الطابق" : "Floor";
                const padding =
                  density === "compact"
                    ? "p-3"
                    : density === "comfortable"
                      ? "p-5"
                      : "p-4";
                const rowGap =
                  density === "compact"
                    ? "gap-2"
                    : density === "comfortable"
                      ? "gap-4"
                      : "gap-3";
                const buildingName = unit.buildingName ?? "—";
                return (
                  <div
                    key={unit.id}
                    onClick={() => openUnitDetail(unit)}
                    className={cn(
                      "rounded-xl border border-border bg-card hover:border-primary/40 transition-colors cursor-pointer",
                      padding,
                      density === "comfortable" ? "space-y-4" : "space-y-3"
                    )}
                  >
                    {/* Header row: unit number + status chip */}
                    <div className={cn("flex items-center", rowGap)}>
                      <code className="font-mono text-base font-semibold text-foreground">
                        {unit.number}
                      </code>
                      <span
                        className={cn(
                          "ms-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          chipClass
                        )}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {/* Hero row: price + area */}
                    <div className={cn("flex items-end justify-between", rowGap)}>
                      <div className="min-w-0">
                        {heroPriceNum != null ? (
                          <SARAmount
                            value={heroPriceNum}
                            size={density === "comfortable" ? 20 : 18}
                            compact
                          />
                        ) : (
                          <span className="text-lg font-semibold text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>
                      {unit.area != null && (
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {unit.area} {areaLabel}
                        </span>
                      )}
                    </div>

                    {/* Meta row: bed/bath (hidden in compact) */}
                    {density !== "compact" &&
                      (unit.bedrooms != null || unit.bathrooms != null) && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {unit.bedrooms != null && (
                            <span className="inline-flex items-center gap-1">
                              <BedDouble className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="tabular-nums">{unit.bedrooms}</span>
                            </span>
                          )}
                          {unit.bathrooms != null && (
                            <span className="inline-flex items-center gap-1">
                              <Bath className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="tabular-nums">{unit.bathrooms}</span>
                            </span>
                          )}
                        </div>
                      )}

                    {/* Footer row: floor + building */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">
                        {floorLabel} {unit.floor ?? "—"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={cn(
                          "min-w-0",
                          density === "comfortable"
                            ? "whitespace-normal"
                            : "truncate"
                        )}
                        title={buildingName}
                      >
                        {buildingName}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Add Unit Placeholder */}
              <div
                onClick={() => setShowAddModal(true)}
                className="rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center min-h-[240px] text-muted-foreground hover:border-primary hover:text-primary transition-all cursor-pointer"
              >
                <Plus className="h-8 w-8" />
                <span className="text-xs font-bold mt-2">{lang === "ar" ? "إضافة وحدة" : "Add Unit"}</span>
              </div>
            </div>
          ) : (
            /* Table View */
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{lang === "ar" ? "رقم الوحدة" : "Unit #"}</TableHead>
                      <TableHead>{lang === "ar" ? "المبنى / المدينة" : "Building / City"}</TableHead>
                      <TableHead>{lang === "ar" ? "النوع" : "Type"}</TableHead>
                      <TableHead>{lang === "ar" ? "المساحة" : "Area"}</TableHead>
                      <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
                      <TableHead>{lang === "ar" ? "السعر" : "Price"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnits.map((unit: any) => (
                      <TableRow key={unit.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openUnitDetail(unit)}>
                        <TableCell className="font-bold text-primary/80 tabular-nums">{unit.number}</TableCell>
                        <TableCell>{unit.buildingName || unit.city || "—"}</TableCell>
                        <TableCell>{unitTypeLabels[unit.type]?.[lang] ?? unit.type}</TableCell>
                        <TableCell className="tabular-nums">{unit.area} m²</TableCell>
                        <TableCell><StatusBadge entityType="unit" status={unit.status} label={unitStatusLabels[unit.status]?.[lang] ?? unit.status} /></TableCell>
                        <TableCell>{unit.price ? <SARAmount value={Number(unit.price)} size={11} compact /> : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* OFF-PLAN INVENTORY TAB REMOVED in v3.0 */}

      {/* Change Price Modal */}
      {showPriceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div
            className="bg-card w-full max-w-sm rounded-xl shadow-2xl p-8 border border-border animate-in zoom-in-95 duration-300"
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            <h2 className="text-xl font-bold text-primary mb-2">
              {lang === "ar" ? "تغيير السعر" : "Change Price"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {lang === "ar"
                ? `تحديث سعر ${selectedUnits.length} وحدة مختارة`
                : `Update price for ${selectedUnits.length} selected unit(s)`}
            </p>
            <div className="space-y-1 mb-6">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                {lang === "ar" ? "السعر الجديد" : "New Price"}
              </label>
              <Input
                type="number"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                style={{ display: "inline-flex" }}
                onClick={() => {
                  setShowPriceModal(false);
                  setBulkPrice("");
                }}
                disabled={updating}
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleBulkPriceUpdate}
                disabled={updating || !bulkPrice}
                style={{ display: "inline-flex" }}
                className="gap-2"
              >
                {updating && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {lang === "ar" ? "تحديث السعر" : "Update Price"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unit Detail Modal */}
      {detailUnit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div
            className="bg-card w-full max-w-xl rounded-xl shadow-2xl border border-border animate-in zoom-in-95 duration-300 max-h-[85vh] overflow-y-auto"
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-primary">
                  {lang === "ar" ? "تفاصيل الوحدة" : "Unit Details"} &mdash;{" "}
                  {detailUnit.number}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {detailUnit.buildingName || detailUnit.city || ""}
                </p>
              </div>
              <button
                onClick={() => setDetailUnit(null)}
                className="text-muted-foreground hover:text-primary"
                aria-label={lang === "ar" ? "إغلاق" : "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Unit Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    {lang === "ar" ? "النوع" : "Type"}
                  </span>
                  <p className="text-sm font-bold text-primary">
                    {unitTypeLabels[detailUnit.type]?.[lang] ??
                      detailUnit.type}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    {lang === "ar" ? "الحالة" : "Status"}
                  </span>
                  <div className="text-sm mt-0.5">
                    <StatusBadge
                      entityType="unit"
                      status={detailUnit.status}
                      label={
                        unitStatusLabels[detailUnit.status]?.[lang] ??
                        detailUnit.status
                      }
                      size="sm"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    {lang === "ar" ? "المساحة" : "Area"}
                  </span>
                  <p className="text-sm font-bold text-primary">
                    {detailUnit.area
                      ? `${detailUnit.area} \u0645\u00B2`
                      : "\u2014"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    {lang === "ar" ? "سعر التكلفة" : "Cost Price"}
                  </span>
                  <p className="text-sm font-bold text-primary">
                    <SARAmount value={detailUnit.price} size={12} />
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    {lang === "ar" ? "سعر البيع" : "Selling Price"}
                  </span>
                  <p className="text-sm font-bold text-secondary">
                    {detailUnit.markupPrice ? (
                      <SARAmount value={detailUnit.markupPrice} size={12} />
                    ) : (
                      "\u2014"
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    {lang === "ar" ? "سعر الإيجار" : "Rental Price"}
                  </span>
                  <p className="text-sm font-bold text-primary">
                    {detailUnit.rentalPrice ? (
                      <SARAmount value={detailUnit.rentalPrice} size={12} />
                    ) : (
                      "\u2014"
                    )}
                  </p>
                </div>
              </div>

              {/* Financial Summary */}
              {detailFinancials && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    {lang === "ar" ? "الملخص المالي" : "Financial Summary"}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/20 rounded-md p-3">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">
                        {lang === "ar" ? "إيجار محصّل" : "Rent Collected"}
                      </span>
                      <p className="text-sm font-bold text-secondary mt-0.5">
                        <SARAmount
                          value={detailFinancials.totalRentCollected}
                          size={10}
                          compact
                        />
                      </p>
                    </div>
                    <div className="bg-muted/20 rounded-md p-3">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">
                        {lang === "ar" ? "إيراد البيع" : "Sale Revenue"}
                      </span>
                      <p className="text-sm font-bold text-primary mt-0.5">
                        <SARAmount
                          value={detailFinancials.saleRevenue}
                          size={10}
                          compact
                        />
                      </p>
                    </div>
                    <div className="bg-muted/20 rounded-md p-3">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">
                        {lang === "ar" ? "تكاليف صيانة" : "Maintenance"}
                      </span>
                      <p className="text-sm font-bold text-destructive mt-0.5">
                        <SARAmount
                          value={detailFinancials.totalMaintenanceCost}
                          size={10}
                          compact
                        />
                      </p>
                    </div>
                    <div className="bg-muted/20 rounded-md p-3">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">
                        {lang === "ar" ? "صافي الدخل" : "Net Income"}
                      </span>
                      <p
                        className={`text-sm font-bold mt-0.5 ${detailFinancials.netIncome >= 0 ? "text-secondary" : "text-destructive"}`}
                      >
                        <SARAmount
                          value={detailFinancials.netIncome}
                          size={10}
                          compact
                        />
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Contract Info */}
              {detailContract && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
                    <Receipt className="h-3.5 w-3.5" />
                    {lang === "ar" ? "العقد المرتبط" : "Linked Contract"}
                  </h3>
                  <div className="p-3 rounded-md bg-muted/30 border border-border space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {lang === "ar" ? "النوع" : "Type"}
                      </span>
                      <Badge variant="draft" className="text-[10px]">
                        {detailContract.type === "SALE"
                          ? lang === "ar"
                            ? "بيع"
                            : "Sale"
                          : lang === "ar"
                            ? "إيجار"
                            : "Lease"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {lang === "ar" ? "الحالة" : "Status"}
                      </span>
                      <StatusBadge
                        entityType="contract"
                        status={detailContract.status}
                        label={
                          detailContract.status === "DRAFT"
                            ? lang === "ar"
                              ? "مسودة"
                              : "Draft"
                            : detailContract.status === "SENT"
                              ? lang === "ar"
                                ? "مُرسل"
                                : "Sent"
                              : lang === "ar"
                                ? "موقّع"
                                : "Signed"
                        }
                        size="sm"
                      />
                    </div>
                    {detailContract.customer?.name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {lang === "ar" ? "العميل" : "Customer"}
                        </span>
                        <span className="font-bold text-primary">
                          {detailContract.customer.name}
                        </span>
                      </div>
                    )}
                    {detailContract.contractNumber && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {lang === "ar" ? "رقم العقد" : "Contract No."}
                        </span>
                        <span className="font-bold text-primary font-dm-sans">
                          {detailContract.contractNumber}
                        </span>
                      </div>
                    )}
                    <Link
                      href={`/dashboard/contracts/${detailContract.id}`}
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        style={{ display: "inline-flex" }}
                        className="gap-1 text-[10px] w-full mt-1"
                      >
                        <Eye className="h-3 w-3" />
                        {lang === "ar" ? "عرض العقد" : "View Contract"}
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Sell / Rent Quick Actions */}
              {detailUnit.status === "AVAILABLE" && (
                <div className="border-t border-border pt-4 flex items-center gap-3">
                  <Link
                    href={`/dashboard/deals?unitId=${detailUnit.id}`}
                    className="flex-1"
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      style={{ display: "inline-flex" }}
                      className="gap-2 w-full"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      {lang === "ar" ? "بيع" : "Sell"}
                    </Button>
                  </Link>
                  <Link
                    href={`/dashboard/deals?unitId=${detailUnit.id}`}
                    className="flex-1"
                  >
                    <Button
                      size="sm"
                      style={{ display: "inline-flex" }}
                      className="gap-2 w-full"
                    >
                      <Home className="h-3.5 w-3.5" />
                      {lang === "ar" ? "تأجير" : "Rent"}
                    </Button>
                  </Link>
                </div>
              )}

              {/* Maintenance Section */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Wrench className="h-3.5 w-3.5" />
                    {lang === "ar"
                      ? "طلبات الصيانة"
                      : "Maintenance Requests"}
                    {detailMaintenance.filter(
                      (m: any) =>
                        !["RESOLVED", "CLOSED"].includes(m.status)
                    ).length > 0 && (
                      <Badge variant="overdue" className="text-[9px]">
                        {
                          detailMaintenance.filter(
                            (m: any) =>
                              !["RESOLVED", "CLOSED"].includes(m.status)
                          ).length
                        }
                      </Badge>
                    )}
                  </h3>
                  <Link href={`/dashboard/maintenance`}>
                    <Button
                      variant="secondary"
                      size="sm"
                      style={{ display: "inline-flex" }}
                      className="gap-1 text-[10px]"
                    >
                      <Plus className="h-3 w-3" />
                      {lang === "ar" ? "طلب جديد" : "New Request"}
                    </Button>
                  </Link>
                </div>

                {loadingDetail ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : detailMaintenance.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {lang === "ar"
                      ? "لا توجد طلبات صيانة لهذه الوحدة"
                      : "No maintenance requests for this unit"}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {detailMaintenance.map((m: any) => {
                      const mStatus = maintenanceStatusLabels[m.status] ?? {
                        ar: m.status,
                        en: m.status,
                        variant: "draft",
                      };
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-muted/10 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="text-xs font-bold text-primary">
                              {m.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(m.createdAt).toLocaleDateString(
                                "en-SA"
                              )}
                              {m.assignedTo?.name &&
                                ` \u2022 ${m.assignedTo.name}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={mStatus.variant as any}
                              className="text-[9px]"
                            >
                              {mStatus[lang]}
                            </Badge>
                            <Link href={`/dashboard/maintenance/${m.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                style={{ display: "inline-flex" }}
                                aria-label={lang === "ar" ? "عرض" : "View"}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Unit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div
            className="bg-card w-full max-w-md rounded-xl shadow-2xl p-8 border border-border animate-in zoom-in-95 duration-300"
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            <h2 className="text-xl font-bold text-primary mb-6">
              {lang === "ar" ? "إضافة وحدة جديدة" : "Add New Unit"}
            </h2>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">
                  {lang === "ar" ? "رقم الوحدة" : "Unit Number"}
                </label>
                <Input
                  value={newUnit.number}
                  onChange={(e) =>
                    setNewUnit({ ...newUnit, number: e.target.value })
                  }
                  placeholder="e.g. A-101"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">
                  {lang === "ar" ? "نوع الوحدة" : "Unit Type"}
                </label>
                <select
                  value={newUnit.type}
                  onChange={(e) =>
                    setNewUnit({ ...newUnit, type: e.target.value })
                  }
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {Object.entries(unitTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label[lang]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "المساحة (م²)" : "Area (sqm)"}
                  </label>
                  <Input
                    type="number"
                    value={newUnit.area}
                    onChange={(e) =>
                      setNewUnit({ ...newUnit, area: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "سعر التكلفة" : "Cost Price"}
                  </label>
                  <Input
                    type="number"
                    value={newUnit.price}
                    onChange={(e) =>
                      setNewUnit({ ...newUnit, price: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "سعر البيع" : "Selling Price"}
                  </label>
                  <Input
                    type="number"
                    value={newUnit.markupPrice}
                    onChange={(e) =>
                      setNewUnit({ ...newUnit, markupPrice: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? "سعر الإيجار" : "Rental Price"}
                  </label>
                  <Input
                    type="number"
                    value={newUnit.rentalPrice}
                    onChange={(e) =>
                      setNewUnit({ ...newUnit, rentalPrice: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <Button
                variant="secondary"
                style={{ display: "inline-flex" }}
                onClick={() => setShowAddModal(false)}
                disabled={updating}
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleAddUnit}
                disabled={updating}
                style={{ display: "inline-flex" }}
                className="gap-2"
              >
                {updating && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {lang === "ar" ? "حفظ الوحدة" : "Save Unit"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ResponsiveDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={lang === "ar" ? "تأكيد الحذف" : "Confirm Deletion"}
        description={
          lang === "ar"
            ? `هل أنت متأكد من حذف ${selectedUnits.length} وحدة؟ لا يمكن التراجع عن هذا الإجراء.`
            : `Are you sure you want to delete ${selectedUnits.length} unit(s)? This action cannot be undone.`
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              style={{ display: "inline-flex" }}
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="danger"
              style={{ display: "inline-flex" }}
              className="gap-2"
              onClick={confirmBulkDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ar" ? "حذف" : "Delete"}
            </Button>
          </div>
        }
      >
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </ResponsiveDialog>
      </div>
    </>
  );
}
