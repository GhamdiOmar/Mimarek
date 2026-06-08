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
  Eye,
  PenLine,
} from "lucide-react";
import {
  Button,
  IconButton,
  Badge,
  Input,
  Card,
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
  DataTable,
  type ColumnDef,
} from "@repo/ui";
import { useLanguage } from "../../../components/LanguageProvider";
import { usePermissions } from "../../../hooks/usePermissions";
import { getContracts, createContract, updateContractStatus } from "../../actions/contracts";
import { getCustomers } from "../../actions/customers";
import { getUnitsWithBuildings } from "../../actions/units";
import { getReservationById } from "../../actions/reservations";
import { getJourneySummary } from "../../actions/journey";
import { getMissingRequiredDocs } from "../../actions/document-requirements";
import type { JourneySummary } from "@repo/types";
import {
  LifecycleRail,
  NextActionPanel,
  ProcessBlockerBanner,
  RelatedContextPanel,
} from "@repo/ui";
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

const CONTRACT_STATUS_VARIANT: Record<string, React.ComponentProps<typeof Badge>["variant"]> = {
  DRAFT: "draft",
  SENT: "info",
  SIGNED: "success",
  CANCELLED: "error",
  VOID: "warning",
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

  // Contract detail drawer + journey
  const [detailContract, setDetailContract] = React.useState<Contract | null>(null);
  const [journey, setJourney] = React.useState<JourneySummary | null>(null);
  const [journeyLoading, setJourneyLoading] = React.useState(false);
  const [journeyRelatedOpen, setJourneyRelatedOpen] = React.useState(false);

  // Missing required docs for the open contract
  const [missingDocs, setMissingDocs] = React.useState<string[]>([]);

  // Fetch journey + missing docs when detail drawer opens
  React.useEffect(() => {
    if (!detailContract) {
      setJourney(null);
      setJourneyRelatedOpen(false);
      setMissingDocs([]);
      return;
    }
    setJourneyLoading(true);
    getJourneySummary("contract", detailContract.id)
      .then((data) => setJourney(data))
      .catch(() => setJourney(null))
      .finally(() => setJourneyLoading(false));

    getMissingRequiredDocs(detailContract.id)
      .then((cats) => setMissingDocs(cats))
      .catch(() => setMissingDocs([]));
  }, [detailContract?.id]);

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

  // ── Sale table columns ──────────────────────────────────────────────
  const saleColumns: ColumnDef<Contract>[] = [
    {
      accessorKey: "contractNumber",
      header: lang === "ar" ? "رقم العقد" : "Contract #",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.contractNumber ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "customer.name",
      header: lang === "ar" ? "العميل" : "Client",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.customer.name}</span>
      ),
    },
    {
      id: "property",
      header: lang === "ar" ? "العقار" : "Property",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="font-medium">
            {lang === "ar" ? "وحدة" : "Unit"} {row.original.unit.number}
          </p>
          <p className="text-muted-foreground text-xs">
            {(row.original.unit as any).buildingName ?? (row.original.unit as any).city ?? "—"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: lang === "ar" ? "المبلغ" : "Amount (SAR)",
      meta: { numeric: true },
      cell: ({ row }) => SAR(Number(row.original.amount)),
    },
    {
      accessorKey: "status",
      header: lang === "ar" ? "الحالة" : "Status",
      cell: ({ row }) => (
        <Badge variant={CONTRACT_STATUS_VARIANT[row.original.status] ?? "default"} size="sm">
          {lang === "ar"
            ? (CONTRACT_STATUS_LABELS[row.original.status]?.ar ?? row.original.status)
            : (CONTRACT_STATUS_LABELS[row.original.status]?.en ?? row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: "signedAt",
      header: lang === "ar" ? "تاريخ التوقيع" : "Signed Date",
      cell: ({ row }) =>
        row.original.signedAt ? (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.signedAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA")}
          </span>
        ) : (
          <span className="text-muted-foreground/70">—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <IconButton
              icon={Eye}
              aria-label={lang === "ar" ? "عرض التفاصيل" : "View details"}
              variant="ghost"
              size="icon"
              onClick={() => setDetailContract(c)}
              className="h-8 w-8"
            />
            {(c.status === "DRAFT" || c.status === "SENT") && (
              <IconButton
                icon={PenLine}
                aria-label={lang === "ar" ? "توقيع" : "Sign"}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary"
                onClick={() => handleSignContract(c.id)}
              />
            )}
          </div>
        );
      },
    },
  ];

  // ── Lease table columns ──────────────────────────────────────────────
  const leaseColumns: ColumnDef<Contract>[] = [
    {
      accessorKey: "contractNumber",
      header: lang === "ar" ? "رقم العقد" : "Contract #",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.contractNumber ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "customer.name",
      header: lang === "ar" ? "المستأجر" : "Tenant",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.customer.name}</span>
      ),
    },
    {
      id: "property",
      header: lang === "ar" ? "العقار" : "Property",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="font-medium">
            {lang === "ar" ? "وحدة" : "Unit"} {row.original.unit.number}
          </p>
          <p className="text-muted-foreground text-xs">
            {(row.original.unit as any).buildingName ?? (row.original.unit as any).city ?? "—"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: lang === "ar" ? "الإيجار السنوي" : "Annual Rent (SAR)",
      meta: { numeric: true },
      cell: ({ row }) => SAR(Number(row.original.amount)),
    },
    {
      id: "startDate",
      header: lang === "ar" ? "تاريخ البداية" : "Start Date",
      cell: ({ row }) =>
        row.original.lease?.startDate ? (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.lease.startDate).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA")}
          </span>
        ) : (
          <span className="text-muted-foreground/70">—</span>
        ),
    },
    {
      id: "endDate",
      header: lang === "ar" ? "تاريخ النهاية" : "End Date",
      cell: ({ row }) =>
        row.original.lease?.endDate ? (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.lease.endDate).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA")}
          </span>
        ) : (
          <span className="text-muted-foreground/70">—</span>
        ),
    },
    {
      accessorKey: "status",
      header: lang === "ar" ? "الحالة" : "Status",
      cell: ({ row }) => (
        <Badge variant={CONTRACT_STATUS_VARIANT[row.original.status] ?? "default"} size="sm">
          {lang === "ar"
            ? (CONTRACT_STATUS_LABELS[row.original.status]?.ar ?? row.original.status)
            : (CONTRACT_STATUS_LABELS[row.original.status]?.en ?? row.original.status)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <IconButton
              icon={Eye}
              aria-label={lang === "ar" ? "عرض التفاصيل" : "View details"}
              variant="ghost"
              size="icon"
              onClick={() => setDetailContract(c)}
              className="h-8 w-8"
            />
            {(c.status === "DRAFT" || c.status === "SENT") && (
              <IconButton
                icon={PenLine}
                aria-label={lang === "ar" ? "توقيع" : "Sign"}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary"
                onClick={() => handleSignContract(c.id)}
              />
            )}
          </div>
        );
      },
    },
  ];

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
          allContracts.length === 0 ? (
            <EmptyState
              variant="first-time"
              icon={<FileText className="h-12 w-12" aria-hidden="true" />}
              title={lang === "ar" ? "لا توجد عقود بعد" : "No contracts yet"}
              description={
                lang === "ar"
                  ? "تتبّع كل عقد إيجار أو بيع من المسودة حتى التوقيع."
                  : "Track every lease and sale from draft to signed."
              }
              action={
                <Button size="sm" onClick={openSaleModal} style={{ display: "inline-flex" }}>
                  <Plus className="h-4 w-4 me-1.5" />
                  {lang === "ar" ? "إنشاء عقد" : "Create contract"}
                </Button>
              }
              helpHref="/dashboard/help#contracts"
              helpLabel={lang === "ar" ? "تعرّف على العقود" : "Learn about contracts"}
            />
          ) : (
            <EmptyState
              variant="filtered"
              icon={<Search className="h-10 w-10" aria-hidden="true" />}
              title={lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching contracts"}
              description={
                lang === "ar"
                  ? "جرّب تعديل البحث أو التبويب."
                  : "Try adjusting your search or tab."
              }
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setMobileTab("ALL");
                  }}
                  style={{ display: "inline-flex" }}
                >
                  {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
                </Button>
              }
            />
          )
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
                onClick={() => setDetailContract(c)}
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
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setNewContractSheetOpen(false);
              openSaleModal();
            }}
            className="flex h-auto flex-col items-center gap-2 rounded-2xl p-5"
            style={{ display: "flex" }}
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
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setNewContractSheetOpen(false);
              openLeaseModal();
            }}
            className="flex h-auto flex-col items-center gap-2 rounded-2xl p-5"
            style={{ display: "flex" }}
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
          </Button>
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
        <div className="flex border border-border rounded-lg overflow-hidden">
          <Button
            onClick={() => setTab("SALE")}
            variant={tab === "SALE" ? "primary" : "subtle"}
            size="sm"
            className="rounded-none rounded-s-lg border-0 px-4 py-2"
            style={{ display: "inline-flex" }}
          >
            {lang === "ar" ? "عقود البيع" : "Sale Contracts"}
            <span className="ms-2 text-xs opacity-70">({saleContracts.length})</span>
          </Button>
          <Button
            onClick={() => setTab("LEASE")}
            variant={tab === "LEASE" ? "primary" : "subtle"}
            size="sm"
            className="rounded-none rounded-e-lg border-0 border-s border-border px-4 py-2"
            style={{ display: "inline-flex" }}
          >
            {lang === "ar" ? "عقود الإيجار" : "Lease Contracts"}
            <span className="ms-2 text-xs opacity-70">({leaseContracts.length})</span>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "بحث..." : "Search..."}
              className="ps-9 w-56"
            />
            {search && (
              <span className="absolute top-1/2 -translate-y-1/2 end-1">
                <IconButton
                  icon={X}
                  aria-label={lang === "ar" ? "مسح البحث" : "Clear search"}
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearch("")}
                  className="h-7 w-7"
                />
              </span>
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
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          allContracts.length === 0 || (tab === "SALE" ? saleContracts.length === 0 : leaseContracts.length === 0) ? (
            <EmptyState
              variant="first-time"
              icon={<FileText className="h-12 w-12" aria-hidden="true" />}
              title={
                tab === "SALE"
                  ? lang === "ar"
                    ? "لا توجد عقود بيع بعد"
                    : "No sale contracts yet"
                  : lang === "ar"
                    ? "لا توجد عقود إيجار بعد"
                    : "No lease contracts yet"
              }
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
          ) : (
            <EmptyState
              variant="filtered"
              icon={<Search className="h-12 w-12" aria-hidden="true" />}
              title={lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching contracts"}
              description={
                lang === "ar"
                  ? "جرّب تعديل البحث."
                  : "Try adjusting your search."
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
          )
        ) : tab === "SALE" ? (
          <DataTable
            columns={saleColumns}
            data={filtered}
            getRowId={(r) => r.id}
            locale={lang === "ar" ? "ar" : "en"}
            pagination
            pageSize={10}
            mobileCard={(row) => (
              <DataCard
                icon={Home}
                iconTone="purple"
                divider={false}
                title={
                  <span className="flex items-center gap-2">
                    <span className="truncate">{row.customer.name}</span>
                    {row.contractNumber ? (
                      <span className="font-mono text-xs text-muted-foreground truncate">
                        #{row.contractNumber}
                      </span>
                    ) : null}
                  </span>
                }
                subtitle={[
                  `${lang === "ar" ? "وحدة" : "Unit"} ${row.unit.number}`,
                  <SARAmount key="amount" value={Number(row.amount)} size={12} compact className="tabular-nums" />,
                ]}
                trailing={
                  <StatusBadge
                    entityType="contract"
                    status={row.status}
                    label={
                      lang === "ar"
                        ? CONTRACT_STATUS_LABELS[row.status]?.ar ?? row.status
                        : CONTRACT_STATUS_LABELS[row.status]?.en ?? row.status
                    }
                  />
                }
                onClick={() => setDetailContract(row)}
              />
            )}
            emptyTitle={lang === "ar" ? "لا توجد عقود بيع" : "No sale contracts"}
            emptyDescription={lang === "ar" ? "جرّب تعديل البحث." : "Try adjusting your search."}
          />
        ) : (
          <DataTable
            columns={leaseColumns}
            data={filtered}
            getRowId={(r) => r.id}
            locale={lang === "ar" ? "ar" : "en"}
            pagination
            pageSize={10}
            mobileCard={(row) => (
              <DataCard
                icon={Key}
                iconTone="purple"
                divider={false}
                title={
                  <span className="flex items-center gap-2">
                    <span className="truncate">{row.customer.name}</span>
                    {row.contractNumber ? (
                      <span className="font-mono text-xs text-muted-foreground truncate">
                        #{row.contractNumber}
                      </span>
                    ) : null}
                  </span>
                }
                subtitle={[
                  `${lang === "ar" ? "وحدة" : "Unit"} ${row.unit.number}`,
                  <SARAmount key="amount" value={Number(row.amount)} size={12} compact className="tabular-nums" />,
                ]}
                trailing={
                  <StatusBadge
                    entityType="contract"
                    status={row.status}
                    label={
                      lang === "ar"
                        ? CONTRACT_STATUS_LABELS[row.status]?.ar ?? row.status
                        : CONTRACT_STATUS_LABELS[row.status]?.en ?? row.status
                    }
                  />
                }
                onClick={() => setDetailContract(row)}
              />
            )}
            emptyTitle={lang === "ar" ? "لا توجد عقود إيجار" : "No lease contracts"}
            emptyDescription={lang === "ar" ? "جرّب تعديل البحث." : "Try adjusting your search."}
          />
        )}
      </Card>

      {/* Contract Detail Modal */}
      <ResponsiveDialog
        open={!!detailContract}
        onOpenChange={(open) => {
          if (!open) setDetailContract(null);
        }}
        title={lang === "ar" ? "تفاصيل العقد" : "Contract Details"}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDetailContract(null)}
              style={{ display: "inline-flex" }}
            >
              {lang === "ar" ? "إغلاق" : "Close"}
            </Button>
          </div>
        }
      >
        {detailContract && (
          <div className="space-y-3 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-muted-foreground text-xs">{lang === "ar" ? "رقم العقد" : "Contract #"}</p>
                <p className="font-medium font-mono">{detailContract.contractNumber ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{lang === "ar" ? "النوع" : "Type"}</p>
                <p className="font-medium">
                  {detailContract.type === "SALE"
                    ? lang === "ar" ? "بيع" : "Sale"
                    : lang === "ar" ? "إيجار" : "Lease"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{lang === "ar" ? "العميل" : "Client"}</p>
                <p className="font-medium">{detailContract.customer.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{lang === "ar" ? "الوحدة" : "Unit"}</p>
                <p className="font-medium">{detailContract.unit.number}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{lang === "ar" ? "المبلغ" : "Amount"}</p>
                <p className="font-medium">{SAR(Number(detailContract.amount))}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{lang === "ar" ? "الحالة" : "Status"}</p>
                <Badge variant={CONTRACT_STATUS_VARIANT[detailContract.status] ?? "default"} size="sm">
                  {lang === "ar" ? (CONTRACT_STATUS_LABELS[detailContract.status]?.ar ?? detailContract.status) : (CONTRACT_STATUS_LABELS[detailContract.status]?.en ?? detailContract.status)}
                </Badge>
              </div>
              {detailContract.signedAt && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">{lang === "ar" ? "تاريخ التوقيع" : "Signed Date"}</p>
                  <p className="font-medium">
                    {new Date(detailContract.signedAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-SA")}
                  </p>
                </div>
              )}
            </div>

            {/* ── Missing Required Docs Banner ── */}
            {missingDocs.length > 0 && (
              <ProcessBlockerBanner
                lang={lang}
                blockers={missingDocs.map((cat) => {
                  const catLabels: Record<string, { ar: string; en: string }> = {
                    LEGAL:    { ar: "مستند قانوني", en: "Legal document" },
                    CONTRACT: { ar: "نسخة العقد",   en: "Signed contract copy" },
                    FINANCE:  { ar: "مستند مالي",   en: "Finance document" },
                    MARKETING:{ ar: "مستند تسويقي", en: "Marketing document" },
                    GENERAL:  { ar: "مستند عام",    en: "General document" },
                  };
                  const label = catLabels[cat] ?? { ar: cat, en: cat };
                  return {
                    id: `missing-doc-${cat}`,
                    severity: "warning" as const,
                    title: {
                      ar: `مستند مطلوب: ${label.ar}`,
                      en: `Required document: ${label.en}`,
                    },
                    detail: {
                      ar: `يجب رفع مستند من فئة "${label.ar}" لاستكمال هذه المرحلة.`,
                      en: `A document of category "${label.en}" must be uploaded to complete this stage.`,
                    },
                    actionLabel: { ar: "رفع مستند", en: "Upload document" },
                    actionHref: "/dashboard/documents",
                  };
                })}
              />
            )}

            {/* ── Journey Section ── */}
            {journeyLoading && (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {lang === "ar" ? "جارٍ تحميل المسار..." : "Loading journey..."}
              </div>
            )}
            {!journeyLoading && journey && (
              <div className="space-y-3 border-t border-border pt-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {lang === "ar" ? "المسار" : "Journey"}
                </h4>
                {journey.blockers.length > 0 && (
                  <ProcessBlockerBanner blockers={journey.blockers} lang={lang} />
                )}
                <LifecycleRail
                  stages={journey.stages}
                  lang={lang}
                  ariaLabel={lang === "ar" ? "مراحل العقد" : "Contract lifecycle"}
                />
                <NextActionPanel actions={journey.nextActions} lang={lang} />
                {journey.related.length > 0 && (
                  <>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => setJourneyRelatedOpen(true)}
                      className="h-auto p-0 text-xs"
                      style={{ display: "inline-flex" }}
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
        )}
      </ResponsiveDialog>

      {/* New Sale Contract Modal */}
      <ResponsiveDialog
        open={saleModalOpen}
        onOpenChange={setSaleModalOpen}
        title={lang === "ar" ? "عقد بيع جديد" : "New Sale Contract"}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setSaleModalOpen(false)} style={{ display: "inline-flex" }}>
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
            <label className="text-sm font-medium text-foreground">
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
                <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {saleCustomerOptions.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSaleForm((f) => ({ ...f, customerId: c.id, customerName: c.name, customerSearch: c.name }))}
                      className="w-full justify-start rounded-none px-3 py-2 text-sm font-normal"
                      style={{ display: "flex" }}
                    >
                      {c.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Unit */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
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
                <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {saleUnitOptions.map((u) => (
                    <Button
                      key={u.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSaleForm((f) => ({ ...f, unitId: u.id, unitNumber: u.number, unitSearch: u.number }))}
                      className="w-full justify-start rounded-none px-3 py-2 text-sm font-normal"
                      style={{ display: "flex" }}
                    >
                      {lang === "ar" ? "وحدة" : "Unit"} {u.number}
                      <span className="ms-2 text-xs text-muted-foreground">{u.status}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
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
            <label className="text-sm font-medium text-foreground">
              {lang === "ar" ? "ملاحظات" : "Notes"}
            </label>
            <textarea
              value={saleForm.notes}
              onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder={lang === "ar" ? "ملاحظات اختيارية..." : "Optional notes..."}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
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
            <Button variant="ghost" onClick={() => setLeaseModalOpen(false)} style={{ display: "inline-flex" }}>
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
            <label className="text-sm font-medium text-foreground">
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
                <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {leaseCustomerOptions.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLeaseForm((f) => ({ ...f, customerId: c.id, customerName: c.name, customerSearch: c.name }))}
                      className="w-full justify-start rounded-none px-3 py-2 text-sm font-normal"
                      style={{ display: "flex" }}
                    >
                      {c.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Unit */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
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
                <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {leaseForm.unitSearch && !leaseForm.unitId && leaseUnitOptions.map((u) => (
                    <Button
                      key={u.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLeaseForm((f) => ({ ...f, unitId: u.id, unitNumber: u.number, unitSearch: u.number }))}
                      className="w-full justify-start rounded-none px-3 py-2 text-sm font-normal"
                      style={{ display: "flex" }}
                    >
                      {lang === "ar" ? "وحدة" : "Unit"} {u.number}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
                {lang === "ar" ? "تاريخ البداية" : "Start Date"} *
              </label>
              <HijriDatePicker
                value={leaseForm.startDate ? new Date(leaseForm.startDate) : null}
                onChange={(d) => setLeaseForm((f) => ({ ...f, startDate: d ? d.toISOString().slice(0, 10) : "" }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">
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
            <label className="text-sm font-medium text-foreground">
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
            <label className="text-sm font-medium text-foreground">
              {lang === "ar" ? "دورية الدفع" : "Payment Frequency"}
            </label>
            <select
              value={leaseForm.paymentFrequency}
              onChange={(e) => setLeaseForm((f) => ({ ...f, paymentFrequency: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
            >
              <option value="MONTHLY">{lang === "ar" ? "شهري" : "Monthly"}</option>
              <option value="QUARTERLY">{lang === "ar" ? "ربع سنوي" : "Quarterly"}</option>
              <option value="SEMI_ANNUAL">{lang === "ar" ? "نصف سنوي" : "Semi-Annual"}</option>
              <option value="ANNUAL">{lang === "ar" ? "سنوي" : "Annual"}</option>
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              {lang === "ar" ? "ملاحظات" : "Notes"}
            </label>
            <textarea
              value={leaseForm.notes}
              onChange={(e) => setLeaseForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder={lang === "ar" ? "ملاحظات اختيارية..." : "Optional notes..."}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
            />
          </div>
        </form>
      </ResponsiveDialog>
    </div>
    </div>
    </>
  );
}
