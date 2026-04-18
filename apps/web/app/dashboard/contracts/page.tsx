"use client";

import * as React from "react";
import {
  Plus,
  Loader2,
  Search,
  X,
  FileText,
  Calendar,
  Handshake,
  AlertTriangle,
  Home,
  Key,
} from "lucide-react";
import {
  Button,
  Badge,
  Input,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageIntro,
  KPICard,
  ResponsiveDialog,
  AppBar,
  MobileKPICard,
  MobileTabs,
  DataCard,
  FAB,
  EmptyState,
  SARAmount,
  SARAmountInput,
  HijriDatePicker,
  StatusBadge,
  Skeleton,
  BottomSheet,
  Alert,
  AlertDescription,
} from "@repo/ui";
import { useLanguage } from "../../../components/LanguageProvider";
import { usePermissions } from "../../../hooks/usePermissions";
import { getContracts, createContract, updateContractStatus } from "../../actions/contracts";
import { getCustomers } from "../../actions/customers";
import { getUnitsWithBuildings } from "../../actions/units";
import { getReservationById } from "../../actions/reservations";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const SAR = (amount: number) =>
  new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(amount);

type Contract = {
  id: string;
  contractNumber: string | null;
  type: "SALE" | "LEASE";
  status: "DRAFT" | "SENT" | "SIGNED" | "CANCELLED" | "VOID";
  amount: number;
  signedAt: string | null;
  createdAt: string;
  customer: { id: string; name: string };
  unit: { id: string; number: string; buildingName: string | null };
  lease?: { id: string; startDate: string; endDate: string; status: string } | null;
};

type Customer = { id: string; name: string };
type Unit = { id: string; number: string; status: string };

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-800",
  SIGNED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
  VOID: "bg-orange-100 text-orange-700",
};

const CONTRACT_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" },
  SENT: { ar: "مُرسل", en: "Sent" },
  SIGNED: { ar: "موقّع", en: "Signed" },
  CANCELLED: { ar: "ملغي", en: "Cancelled" },
  VOID: { ar: "لاغٍ", en: "Void" },
};

export default function ContractsPage() {
  const { lang, dir } = useLanguage();
  const { can } = usePermissions();
  const searchParams = useSearchParams();
  const prefillDealId = searchParams.get("dealId");

  const [tab, setTab] = React.useState<"SALE" | "LEASE">("SALE");
  const [allContracts, setAllContracts] = React.useState<Contract[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [mobileTab, setMobileTab] = React.useState<"ALL" | "SALE" | "LEASE">("ALL");
  const [newContractSheetOpen, setNewContractSheetOpen] = React.useState(false);

  // Create modals
  const [saleModalOpen, setSaleModalOpen] = React.useState(false);
  const [leaseModalOpen, setLeaseModalOpen] = React.useState(false);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [units, setUnits] = React.useState<Unit[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  // Sale form
  const [saleForm, setSaleForm] = React.useState({
    customerId: "",
    customerName: "",
    customerSearch: "",
    unitId: "",
    unitNumber: "",
    unitSearch: "",
    amount: "",
    notes: "",
  });

  // Lease form
  const [leaseForm, setLeaseForm] = React.useState({
    customerId: "",
    customerName: "",
    customerSearch: "",
    unitId: "",
    unitNumber: "",
    unitSearch: "",
    startDate: "",
    endDate: "",
    amount: "",
    paymentFrequency: "MONTHLY",
    notes: "",
  });

  function loadContracts() {
    setLoading(true);
    setLoadError(null);
    getContracts()
      .then((data) => setAllContracts(data as Contract[]))
      .catch(() => {
        const msg = lang === "ar" ? "تعذّر تحميل العقود" : "Failed to load contracts";
        setLoadError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }

  async function handleSignContract(contractId: string) {
    try {
      await updateContractStatus(contractId, "SIGNED");
      toast.success(lang === "ar" ? "تم توقيع العقد بنجاح" : "Contract signed successfully");
      loadContracts();
    } catch (err: any) {
      toast.error(err.message || (lang === "ar" ? "حدث خطأ أثناء التوقيع" : "Failed to sign contract"));
    }
  }

  React.useEffect(() => {
    loadContracts();
  }, []);

  // Auto-open sale modal and pre-fill from reservation if dealId in URL
  React.useEffect(() => {
    if (!prefillDealId) return;
    openSaleModal();
    getReservationById(prefillDealId)
      .then((reservation) => {
        if (!reservation) return;
        setSaleForm((f) => ({
          ...f,
          customerId: reservation.customer.id,
          customerName: reservation.customer.name,
          customerSearch: reservation.customer.name,
          unitId: reservation.unit.id,
          unitNumber: reservation.unit.number,
          unitSearch: reservation.unit.number,
          amount: String(reservation.amount),
        }));
      })
      .catch(() => {});
  }, [prefillDealId]);

  const saleContracts = allContracts.filter((c) => c.type === "SALE");
  const leaseContracts = allContracts.filter((c) => c.type === "LEASE");
  const displayed = tab === "SALE" ? saleContracts : leaseContracts;

  const filtered = React.useMemo(() => {
    if (!search) return displayed;
    const q = search.toLowerCase();
    return displayed.filter(
      (c) =>
        c.customer.name.toLowerCase().includes(q) ||
        c.unit.number.toLowerCase().includes(q) ||
        (c.contractNumber ?? "").toLowerCase().includes(q)
    );
  }, [displayed, search]);

  // KPIs across all contracts
  const totalCount = allContracts.length;
  const activeCount = allContracts.filter((c) => c.status === "SIGNED").length;
  const draftCount = allContracts.filter((c) => c.status === "DRAFT").length;
  const totalValue = allContracts
    .filter((c) => c.status === "SIGNED")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  // Expiring soon: signed lease contracts with endDate within the next 30 days
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const expiringCount = allContracts.filter((c) => {
    if (c.type !== "LEASE" || c.status !== "SIGNED") return false;
    const end = c.lease?.endDate ? new Date(c.lease.endDate).getTime() : 0;
    return end > 0 && end - now > 0 && end - now <= THIRTY_DAYS;
  }).length;

  // Mobile filtering — tab (ALL/SALE/LEASE) + search
  const mobileFiltered = React.useMemo(() => {
    const base =
      mobileTab === "ALL"
        ? allContracts
        : allContracts.filter((c) => c.type === mobileTab);
    if (!search) return base;
    const q = search.toLowerCase();
    return base.filter(
      (c) =>
        c.customer.name.toLowerCase().includes(q) ||
        c.unit.number.toLowerCase().includes(q) ||
        (c.contractNumber ?? "").toLowerCase().includes(q)
    );
  }, [allContracts, mobileTab, search]);

  const canWrite = can("contracts:write");

  function loadLookups() {
    getCustomers()
      .then((data) => setCustomers(data as Customer[]))
      .catch(() => {});
    getUnitsWithBuildings()
      .then((data) => setUnits(data as Unit[]))
      .catch(() => {});
  }

  function openSaleModal() {
    setSaleModalOpen(true);
    loadLookups();
  }

  function openLeaseModal() {
    setLeaseModalOpen(true);
    loadLookups();
  }

  // Filtered autocomplete helpers
  const saleCustomerOptions = React.useMemo(() => {
    const q = saleForm.customerSearch.toLowerCase();
    return customers.filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [customers, saleForm.customerSearch]);

  const saleUnitOptions = React.useMemo(() => {
    const q = saleForm.unitSearch.toLowerCase();
    return units
      .filter((u) => (u.status === "AVAILABLE" || u.status === "RESERVED") && (!q || u.number.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [units, saleForm.unitSearch]);

  const leaseCustomerOptions = React.useMemo(() => {
    const q = leaseForm.customerSearch.toLowerCase();
    return customers.filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [customers, leaseForm.customerSearch]);

  const leaseUnitOptions = React.useMemo(() => {
    const q = leaseForm.unitSearch.toLowerCase();
    return units
      .filter((u) => u.status === "AVAILABLE" && (!q || u.number.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [units, leaseForm.unitSearch]);

  async function handleCreateSale() {
    if (!saleForm.customerId || !saleForm.unitId || !saleForm.amount) {
      toast.error(lang === "ar" ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      await createContract({
        customerId: saleForm.customerId,
        unitId: saleForm.unitId,
        type: "SALE",
        amount: parseFloat(saleForm.amount),
        notes: saleForm.notes || undefined,
      });
      toast.success(lang === "ar" ? "تم إنشاء عقد البيع بنجاح" : "Sale contract created successfully");
      setSaleModalOpen(false);
      setSaleForm({ customerId: "", customerName: "", customerSearch: "", unitId: "", unitNumber: "", unitSearch: "", amount: "", notes: "" });
      loadContracts();
    } catch (err: any) {
      toast.error(err.message || (lang === "ar" ? "حدث خطأ أثناء الإنشاء" : "Failed to create contract"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateLease() {
    if (!leaseForm.customerId || !leaseForm.unitId || !leaseForm.amount || !leaseForm.startDate || !leaseForm.endDate) {
      toast.error(lang === "ar" ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      await createContract({
        customerId: leaseForm.customerId,
        unitId: leaseForm.unitId,
        type: "LEASE",
        amount: parseFloat(leaseForm.amount),
        startDate: leaseForm.startDate,
        endDate: leaseForm.endDate,
        paymentFrequency: leaseForm.paymentFrequency,
        notes: leaseForm.notes || undefined,
      });
      toast.success(lang === "ar" ? "تم إنشاء عقد الإيجار بنجاح" : "Lease contract created successfully");
      setLeaseModalOpen(false);
      setLeaseForm({ customerId: "", customerName: "", customerSearch: "", unitId: "", unitNumber: "", unitSearch: "", startDate: "", endDate: "", amount: "", paymentFrequency: "MONTHLY", notes: "" });
      loadContracts();
    } catch (err: any) {
      toast.error(err.message || (lang === "ar" ? "حدث خطأ أثناء الإنشاء" : "Failed to create contract"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    {/* ─── Mobile (< md) ─────────────────────────────────────────────── */}
    <div
      className="md:hidden -m-4 sm:-m-6 min-h-dvh flex flex-col bg-background"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppBar title={lang === "ar" ? "العقود" : "Contracts"} lang={lang} />

      <div className="px-4 pt-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === "ar"
                ? "ابحث برقم العقد أو العميل..."
                : "Search by contract # or customer..."
            }
            className="h-10 ps-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-3">
        <MobileKPICard
          label={lang === "ar" ? "عقود موقّعة" : "Active"}
          value={<span className="tabular-nums">{activeCount}</span>}
          tone="green"
        />
        <MobileKPICard
          label={lang === "ar" ? "تنتهي قريبًا" : "Expiring soon"}
          value={<span className="tabular-nums">{expiringCount}</span>}
          tone="amber"
        />
        <MobileKPICard
          label={lang === "ar" ? "إجمالي القيمة" : "Total value"}
          value={
            <SARAmount
              value={totalValue}
              size={18}
              compact
              className="tabular-nums"
            />
          }
          tone="primary"
        />
        <MobileKPICard
          label={lang === "ar" ? "إجمالي العقود" : "Total"}
          value={<span className="tabular-nums">{totalCount}</span>}
          tone="default"
        />
      </div>

      <div className="px-4 pt-3">
        <MobileTabs
          ariaLabel={lang === "ar" ? "تبويبات العقود" : "Contract tabs"}
          active={mobileTab}
          onChange={(k) => setMobileTab(k as "ALL" | "SALE" | "LEASE")}
          items={[
            { key: "ALL", label: lang === "ar" ? "الكل" : "All" },
            { key: "SALE", label: lang === "ar" ? "بيع" : "Sale" },
            { key: "LEASE", label: lang === "ar" ? "إيجار" : "Lease" },
          ]}
        />
      </div>

      <div className="flex-1 px-4 pb-24 pt-3">
        {loadError && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        )}

        {!loading && mobileFiltered.length === 0 && (
          <EmptyState
            icon={<FileText className="h-10 w-10 text-primary" aria-hidden="true" />}
            title={lang === "ar" ? "لا توجد عقود" : "No contracts"}
            description={
              lang === "ar"
                ? "لم يتم العثور على عقود مطابقة للتصفية الحالية."
                : "No contracts match the current filter."
            }
          />
        )}

        {!loading && mobileFiltered.length > 0 && (
          <div className="rounded-2xl border border-border bg-card px-4">
            {mobileFiltered.map((c, idx) => (
              <DataCard
                key={c.id}
                icon={c.type === "SALE" ? Home : Key}
                iconTone="purple"
                divider={idx !== mobileFiltered.length - 1}
                title={
                  <span className="flex items-center gap-2">
                    <span className="truncate">{c.customer.name}</span>
                    {c.contractNumber ? (
                      <span className="font-mono text-xs text-muted-foreground truncate">
                        #{c.contractNumber}
                      </span>
                    ) : null}
                  </span>
                }
                subtitle={[
                  `${lang === "ar" ? "وحدة" : "Unit"} ${c.unit.number}`,
                  <SARAmount
                    key="amount"
                    value={Number(c.amount)}
                    size={12}
                    compact
                    className="tabular-nums"
                  />,
                ]}
                trailing={
                  <StatusBadge
                    entityType="contract"
                    status={c.status}
                    label={
                      lang === "ar"
                        ? CONTRACT_STATUS_LABELS[c.status]?.ar ?? c.status
                        : CONTRACT_STATUS_LABELS[c.status]?.en ?? c.status
                    }
                  />
                }
              />
            ))}
          </div>
        )}
      </div>

      {canWrite && (
        <FAB
          icon={Plus}
          label={lang === "ar" ? "عقد جديد" : "New contract"}
          onClick={() => setNewContractSheetOpen(true)}
        />
      )}

      {/* New contract type picker */}
      <BottomSheet
        open={newContractSheetOpen}
        onOpenChange={setNewContractSheetOpen}
        title={lang === "ar" ? "نوع العقد الجديد" : "Pick contract type"}
      >
        <div className="grid grid-cols-2 gap-3 p-1">
          <button
            type="button"
            onClick={() => {
              setNewContractSheetOpen(false);
              openSaleModal();
            }}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 text-center transition-colors hover:border-foreground/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Home className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-foreground">
              {lang === "ar" ? "عقد بيع" : "Sale"}
            </span>
            <span className="text-xs text-muted-foreground">
              {lang === "ar" ? "نقل ملكية وحدة" : "Transfer unit ownership"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setNewContractSheetOpen(false);
              openLeaseModal();
            }}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 text-center transition-colors hover:border-foreground/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Key className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-foreground">
              {lang === "ar" ? "عقد إيجار" : "Lease"}
            </span>
            <span className="text-xs text-muted-foreground">
              {lang === "ar" ? "تأجير وحدة لمستأجر" : "Rent unit to a tenant"}
            </span>
          </button>
        </div>
      </BottomSheet>
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div dir={dir} className="p-6 space-y-6">
      <PageIntro
        title={lang === "ar" ? "العقود" : "Contracts"}
        description={
          lang === "ar"
            ? "إدارة عقود البيع وعقود الإيجار في مكان واحد"
            : "Manage sale and lease contracts in one place"
        }
      />

      {/* KPI Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label={lang === "ar" ? "إجمالي العقود" : "Total Contracts"}
          value={String(totalCount)}
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "موقّعة" : "Active (Signed)"}
          value={String(activeCount)}
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "مسودة" : "Draft"}
          value={String(draftCount)}
          loading={loading}
        />
        <KPICard
          label={lang === "ar" ? "إجمالي القيمة" : "Total Value"}
          value={SAR(totalValue)}
          loading={loading}
        />
      </div>

      {/* Tab bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setTab("SALE")}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors",
              tab === "SALE"
                ? "bg-purple-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {lang === "ar" ? "عقود البيع" : "Sale Contracts"}
            <span className="ms-2 text-xs opacity-70">({saleContracts.length})</span>
          </button>
          <button
            onClick={() => setTab("LEASE")}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors border-s border-gray-200",
              tab === "LEASE"
                ? "bg-purple-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {lang === "ar" ? "عقود الإيجار" : "Lease Contracts"}
            <span className="ms-2 text-xs opacity-70">({leaseContracts.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "بحث..." : "Search..."}
              className="ps-9 w-56"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute top-1/2 -translate-y-1/2 end-3 text-gray-400 hover:text-gray-600"
                aria-label={lang === "ar" ? "مسح البحث" : "Clear search"}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {can("contracts:write") && (
            <Button
              onClick={tab === "SALE" ? openSaleModal : openLeaseModal}
              style={{ display: "inline-flex" }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {tab === "SALE"
                ? lang === "ar" ? "عقد بيع جديد" : "New Sale Contract"
                : lang === "ar" ? "عقد إيجار جديد" : "New Lease Contract"}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Handshake className="h-12 w-12" aria-hidden="true" />}
            title={lang === "ar" ? "لا توجد عقود بعد" : "No contracts yet"}
            description={
              lang === "ar"
                ? "تتبّع كل عقد إيجار أو بيع من المسودة حتى التوقيع."
                : "Track every lease and sale from draft to signed."
            }
            action={
              <Button
                onClick={tab === "SALE" ? openSaleModal : openLeaseModal}
                style={{ display: "inline-flex" }}
                className="gap-2"
              >
                <Plus className="h-[18px] w-[18px]" />
                {tab === "SALE"
                  ? lang === "ar" ? "إنشاء عقد بيع" : "Create sale contract"
                  : lang === "ar" ? "إنشاء عقد إيجار" : "Create lease contract"}
              </Button>
            }
            helpHref="/dashboard/help#contracts"
            helpLabel={lang === "ar" ? "تعرّف على العقود" : "Learn about contracts"}
          />
        ) : tab === "SALE" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "ar" ? "رقم العقد" : "Contract #"}</TableHead>
                <TableHead>{lang === "ar" ? "العميل" : "Client"}</TableHead>
                <TableHead>{lang === "ar" ? "العقار" : "Property"}</TableHead>
                <TableHead>{lang === "ar" ? "المبلغ" : "Amount (SAR)"}</TableHead>
                <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{lang === "ar" ? "تاريخ التوقيع" : "Signed Date"}</TableHead>
                <TableHead>{lang === "ar" ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-gray-600">
                    {c.contractNumber ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">{c.customer.name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">{lang === "ar" ? "وحدة" : "Unit"} {c.unit.number}</p>
                      <p className="text-gray-500 text-xs">{(c.unit as any).buildingName ?? (c.unit as any).city ?? "—"}</p>
                    </div>
                  </TableCell>
                  <TableCell>{SAR(Number(c.amount))}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CONTRACT_STATUS_COLORS[c.status]}`}>
                      {lang === "ar" ? (CONTRACT_STATUS_LABELS[c.status]?.ar ?? c.status) : (CONTRACT_STATUS_LABELS[c.status]?.en ?? c.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {c.signedAt
                      ? new Date(c.signedAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA")
                      : <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {(c.status === "DRAFT" || c.status === "SENT") && (
                        <button
                          onClick={() => handleSignContract(c.id)}
                          className="text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          {lang === "ar" ? "توقيع" : "Sign"}
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "ar" ? "رقم العقد" : "Contract #"}</TableHead>
                <TableHead>{lang === "ar" ? "المستأجر" : "Tenant"}</TableHead>
                <TableHead>{lang === "ar" ? "العقار" : "Property"}</TableHead>
                <TableHead>{lang === "ar" ? "الإيجار السنوي" : "Annual Rent (SAR)"}</TableHead>
                <TableHead>{lang === "ar" ? "تاريخ البداية" : "Start Date"}</TableHead>
                <TableHead>{lang === "ar" ? "تاريخ النهاية" : "End Date"}</TableHead>
                <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{lang === "ar" ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-gray-600">
                    {c.contractNumber ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">{c.customer.name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">{lang === "ar" ? "وحدة" : "Unit"} {c.unit.number}</p>
                      <p className="text-gray-500 text-xs">{(c.unit as any).buildingName ?? (c.unit as any).city ?? "—"}</p>
                    </div>
                  </TableCell>
                  <TableCell>{SAR(Number(c.amount))}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {c.lease?.startDate
                      ? new Date(c.lease.startDate).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA")
                      : <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {c.lease?.endDate
                      ? new Date(c.lease.endDate).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA")
                      : <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CONTRACT_STATUS_COLORS[c.status]}`}>
                      {lang === "ar" ? (CONTRACT_STATUS_LABELS[c.status]?.ar ?? c.status) : (CONTRACT_STATUS_LABELS[c.status]?.en ?? c.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {(c.status === "DRAFT" || c.status === "SENT") && (
                        <button
                          onClick={() => handleSignContract(c.id)}
                          className="text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          {lang === "ar" ? "توقيع" : "Sign"}
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* New Sale Contract Modal */}
      <ResponsiveDialog
        open={saleModalOpen}
        onOpenChange={setSaleModalOpen}
        title={lang === "ar" ? "عقد بيع جديد" : "New Sale Contract"}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setSaleModalOpen(false)} style={{ display: "inline-flex" }}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" form="sale-contract-form" disabled={submitting} style={{ display: "inline-flex" }} className="gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {lang === "ar" ? "إنشاء العقد" : "Create Contract"}
            </Button>
          </div>
        }
      >
        <form
          id="sale-contract-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateSale();
          }}
          className="space-y-4 py-2"
        >
          {/* Customer */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {lang === "ar" ? "العميل" : "Customer"} *
            </label>
            <div className="relative">
              <Input
                value={saleForm.customerName || saleForm.customerSearch}
                onChange={(e) => {
                  setSaleForm((f) => ({ ...f, customerSearch: e.target.value, customerId: "", customerName: "" }));
                }}
                placeholder={lang === "ar" ? "ابحث عن العميل..." : "Search customer..."}
              />
              {saleForm.customerSearch && !saleForm.customerId && saleCustomerOptions.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {saleCustomerOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSaleForm((f) => ({ ...f, customerId: c.id, customerName: c.name, customerSearch: c.name }))}
                      className="w-full text-start px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Unit */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {lang === "ar" ? "الوحدة" : "Unit"} *
            </label>
            <div className="relative">
              <Input
                value={saleForm.unitNumber || saleForm.unitSearch}
                onChange={(e) => {
                  setSaleForm((f) => ({ ...f, unitSearch: e.target.value, unitId: "", unitNumber: "" }));
                }}
                placeholder={lang === "ar" ? "ابحث عن وحدة..." : "Search unit..."}
              />
              {saleForm.unitSearch && !saleForm.unitId && saleUnitOptions.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {saleUnitOptions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSaleForm((f) => ({ ...f, unitId: u.id, unitNumber: u.number, unitSearch: u.number }))}
                      className="w-full text-start px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {lang === "ar" ? "وحدة" : "Unit"} {u.number}
                      <span className="ms-2 text-xs text-gray-400">{u.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {lang === "ar" ? "مبلغ العقد (ريال)" : "Contract Amount (SAR)"} *
            </label>
            <SARAmountInput
              value={saleForm.amount === "" ? null : Number(saleForm.amount)}
              onChange={(n) => setSaleForm((f) => ({ ...f, amount: n == null ? "" : String(n) }))}
              placeholder="0.00"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {lang === "ar" ? "ملاحظات" : "Notes"}
            </label>
            <textarea
              value={saleForm.notes}
              onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder={lang === "ar" ? "ملاحظات اختيارية..." : "Optional notes..."}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </form>
      </ResponsiveDialog>

      {/* New Lease Contract Modal */}
      <ResponsiveDialog
        open={leaseModalOpen}
        onOpenChange={setLeaseModalOpen}
        title={lang === "ar" ? "عقد إيجار جديد" : "New Lease Contract"}
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setLeaseModalOpen(false)} style={{ display: "inline-flex" }}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" form="lease-contract-form" disabled={submitting} style={{ display: "inline-flex" }} className="gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {lang === "ar" ? "إنشاء العقد" : "Create Contract"}
            </Button>
          </div>
        }
      >
        <form
          id="lease-contract-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateLease();
          }}
          className="space-y-4 py-2"
        >
          {/* Tenant */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {lang === "ar" ? "المستأجر" : "Tenant/Customer"} *
            </label>
            <div className="relative">
              <Input
                value={leaseForm.customerName || leaseForm.customerSearch}
                onChange={(e) => {
                  setLeaseForm((f) => ({ ...f, customerSearch: e.target.value, customerId: "", customerName: "" }));
                }}
                placeholder={lang === "ar" ? "ابحث عن المستأجر..." : "Search tenant..."}
              />
              {leaseForm.customerSearch && !leaseForm.customerId && leaseCustomerOptions.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {leaseCustomerOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setLeaseForm((f) => ({ ...f, customerId: c.id, customerName: c.name, customerSearch: c.name }))}
                      className="w-full text-start px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Unit */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {lang === "ar" ? "الوحدة" : "Unit"} *
            </label>
            <div className="relative">
              <Input
                value={leaseForm.unitNumber || leaseForm.unitSearch}
                onChange={(e) => {
                  setLeaseForm((f) => ({ ...f, unitSearch: e.target.value, unitId: "", unitNumber: "" }));
                }}
                placeholder={lang === "ar" ? "ابحث عن وحدة متاحة..." : "Search available unit..."}
              />
              {leaseForm.unitSearch && !leaseForm.unitId && leaseUnitOptions.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {leaseForm.unitSearch && !leaseForm.unitId && leaseUnitOptions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setLeaseForm((f) => ({ ...f, unitId: u.id, unitNumber: u.number, unitSearch: u.number }))}
                      className="w-full text-start px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {lang === "ar" ? "وحدة" : "Unit"} {u.number}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {lang === "ar" ? "تاريخ البداية" : "Start Date"} *
              </label>
              <HijriDatePicker
                value={leaseForm.startDate ? new Date(leaseForm.startDate) : null}
                onChange={(d) => setLeaseForm((f) => ({ ...f, startDate: d ? d.toISOString().slice(0, 10) : "" }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {lang === "ar" ? "تاريخ النهاية" : "End Date"} *
              </label>
              <HijriDatePicker
                value={leaseForm.endDate ? new Date(leaseForm.endDate) : null}
                onChange={(d) => setLeaseForm((f) => ({ ...f, endDate: d ? d.toISOString().slice(0, 10) : "" }))}
              />
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {lang === "ar" ? "إجمالي الإيجار (ريال)" : "Total Amount (SAR)"} *
            </label>
            <SARAmountInput
              value={leaseForm.amount === "" ? null : Number(leaseForm.amount)}
              onChange={(n) => setLeaseForm((f) => ({ ...f, amount: n == null ? "" : String(n) }))}
              placeholder="0.00"
            />
          </div>

          {/* Payment Frequency */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {lang === "ar" ? "دورية الدفع" : "Payment Frequency"}
            </label>
            <select
              value={leaseForm.paymentFrequency}
              onChange={(e) => setLeaseForm((f) => ({ ...f, paymentFrequency: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="MONTHLY">{lang === "ar" ? "شهري" : "Monthly"}</option>
              <option value="QUARTERLY">{lang === "ar" ? "ربع سنوي" : "Quarterly"}</option>
              <option value="SEMI_ANNUAL">{lang === "ar" ? "نصف سنوي" : "Semi-Annual"}</option>
              <option value="ANNUAL">{lang === "ar" ? "سنوي" : "Annual"}</option>
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {lang === "ar" ? "ملاحظات" : "Notes"}
            </label>
            <textarea
              value={leaseForm.notes}
              onChange={(e) => setLeaseForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder={lang === "ar" ? "ملاحظات اختيارية..." : "Optional notes..."}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </form>
      </ResponsiveDialog>
    </div>
    </div>
    </>
  );
}
