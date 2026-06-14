"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  ConfirmDialog,
  type ColumnDef,
} from "@repo/ui";
import { useLanguage } from "../../../components/LanguageProvider";
import { usePermissions } from "../../../hooks/usePermissions";
import { useUnsavedChanges } from "../../../hooks/useUnsavedChanges";
import { getContracts, createContract, updateContractStatus } from "../../actions/contracts";
import { getCustomers } from "../../actions/customers";
import { getUnitsWithBuildings } from "../../actions/units";
import { getReservationById } from "../../actions/reservations";
import { getJourneySummary } from "../../actions/journey";
import { getMissingRequiredDocs } from "../../actions/document-requirements";
import {
  getSavedViews,
  createSavedView,
  deleteSavedView,
  type SavedTableViewDTO,
} from "../../actions/saved-views";
import { exportToExcel } from "../../../lib/export";
import type { JourneySummary } from "@repo/types";
import {
  CONTRACT_STATUS_LABEL as CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_VARIANT,
} from "../../../lib/domain-labels";
import { sanitizeError } from "../../../lib/error-sanitizer";
import { trackEvent, AnalyticsEvent } from "../../../lib/analytics";
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


export default function ContractsPage() {
  const { lang, dir } = useLanguage();
  const { can } = usePermissions();
  const searchParams = useSearchParams();
  const prefillDealId = searchParams.get("dealId");

  const [tab, setTab] = React.useState<"SALE" | "LEASE">("SALE");
  const [allContracts, setAllContracts] = React.useState<Contract[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // CX-014 — DataTable saved views (personal, DB-backed). Sale and lease tables
  // carry different column sets, so each tab keeps its own keyed views.
  const contractsTableKey = tab === "SALE" ? "contracts-sale" : "contracts-lease";
  const [savedViews, setSavedViews] = React.useState<SavedTableViewDTO[]>([]);
  const refreshSavedViews = React.useCallback(() => {
    getSavedViews(contractsTableKey)
      .then(setSavedViews)
      .catch(() => {});
  }, [contractsTableKey]);
  React.useEffect(() => {
    // Clear the previous tab's views before refetching so switching SALE↔LEASE
    // never briefly shows the other tab's saved views (different column sets).
    setSavedViews([]);
    refreshSavedViews();
  }, [refreshSavedViews]);
  const [search, setSearch] = React.useState("");
  const [mobileTab, setMobileTab] = React.useState<"ALL" | "SALE" | "LEASE">("ALL");
  const [newContractSheetOpen, setNewContractSheetOpen] = React.useState(false);

  // Create modals
  const [saleModalOpen, setSaleModalOpen] = React.useState(false);
  const [leaseModalOpen, setLeaseModalOpen] = React.useState(false);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [units, setUnits] = React.useState<Unit[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  // ── Zod schemas (built per-render so bilingual messages use current `lang`) ──

  const saleSchema = React.useMemo(
    () =>
      z.object({
        customerId: z.string().min(1, lang === "ar" ? "العميل مطلوب" : "Customer is required"),
        unitId: z.string().min(1, lang === "ar" ? "الوحدة مطلوبة" : "Unit is required"),
        amount: z
          .number({ invalid_type_error: lang === "ar" ? "المبلغ مطلوب" : "Amount is required" })
          .positive(lang === "ar" ? "المبلغ يجب أن يكون أكبر من صفر" : "Amount must be greater than zero"),
        notes: z.string().optional(),
      }),
    [lang],
  );

  const leaseSchema = React.useMemo(
    () =>
      z
        .object({
          customerId: z.string().min(1, lang === "ar" ? "المستأجر مطلوب" : "Customer is required"),
          unitId: z.string().min(1, lang === "ar" ? "الوحدة مطلوبة" : "Unit is required"),
          startDate: z.string().min(1, lang === "ar" ? "تاريخ البداية مطلوب" : "Start date is required"),
          endDate: z.string().min(1, lang === "ar" ? "تاريخ النهاية مطلوب" : "End date is required"),
          amount: z
            .number({ invalid_type_error: lang === "ar" ? "المبلغ مطلوب" : "Amount is required" })
            .positive(lang === "ar" ? "المبلغ يجب أن يكون أكبر من صفر" : "Amount must be greater than zero"),
          paymentFrequency: z.string().min(1),
          notes: z.string().optional(),
        })
        .refine(
          (d) => !d.startDate || !d.endDate || d.endDate > d.startDate,
          {
            message: lang === "ar" ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" : "End date must be after start date",
            path: ["endDate"],
          },
        ),
    [lang],
  );

  type SaleFormValues = z.infer<typeof saleSchema>;
  type LeaseFormValues = z.infer<typeof leaseSchema>;

  // ── react-hook-form instances ──────────────────────────────────────────────

  const saleRhf = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    mode: "onTouched",
    defaultValues: { customerId: "", unitId: "", amount: undefined as unknown as number, notes: "" },
  });

  const leaseRhf = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseSchema),
    mode: "onTouched",
    defaultValues: {
      customerId: "",
      unitId: "",
      startDate: "",
      endDate: "",
      amount: undefined as unknown as number,
      paymentFrequency: "MONTHLY",
      notes: "",
    },
  });

  // Unsaved-changes guard — warn on tab close/refresh when either form is dirty
  useUnsavedChanges(saleRhf.formState.isDirty || leaseRhf.formState.isDirty);

  // ── Autocomplete display state (local UI only — not RHF fields) ────────────

  // Sale autocomplete display
  const [saleCustomerSearch, setSaleCustomerSearch] = React.useState("");
  const [saleCustomerName, setSaleCustomerName] = React.useState("");
  const [saleUnitSearch, setSaleUnitSearch] = React.useState("");
  const [saleUnitNumber, setSaleUnitNumber] = React.useState("");

  // Lease autocomplete display
  const [leaseCustomerSearch, setLeaseCustomerSearch] = React.useState("");
  const [leaseCustomerName, setLeaseCustomerName] = React.useState("");
  const [leaseUnitSearch, setLeaseUnitSearch] = React.useState("");
  const [leaseUnitNumber, setLeaseUnitNumber] = React.useState("");

  // Contract detail drawer + journey
  const [detailContract, setDetailContract] = React.useState<Contract | null>(null);
  const [journey, setJourney] = React.useState<JourneySummary | null>(null);
  const [journeyLoading, setJourneyLoading] = React.useState(false);
  const [journeyRelatedOpen, setJourneyRelatedOpen] = React.useState(false);

  // Missing required docs for the open contract
  const [missingDocs, setMissingDocs] = React.useState<string[]>([]);
  const [signConfirmOpen, setSignConfirmOpen] = React.useState(false);
  const [signTargetId, setSignTargetId] = React.useState<string | null>(null);
  const [signMissingDocs, setSignMissingDocs] = React.useState<string[]>([]);

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

  // CX-021: signing is irreversible — open a confirm that also surfaces the
  // required-documents gate (previously visible only in the detail drawer), so
  // a user signing from the list row sees missing docs before committing.
  async function askSign(contractId: string) {
    setSignTargetId(contractId);
    setSignMissingDocs([]);
    setSignConfirmOpen(true);
    try {
      const cats = await getMissingRequiredDocs(contractId);
      setSignMissingDocs(cats);
    } catch {
      /* docs check failed — still allow the confirm, just without the warning */
    }
  }

  async function confirmSign() {
    const contractId = signTargetId;
    if (!contractId) return;
    try {
      await updateContractStatus(contractId, "SIGNED");
      trackEvent(AnalyticsEvent.ContractSigned);
      toast.success(lang === "ar" ? "تم توقيع العقد بنجاح" : "Contract signed successfully");
      loadContracts();
    } catch (err) {
      toast.error(sanitizeError(err, lang));
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
        saleRhf.setValue("customerId", reservation.customer.id, { shouldValidate: true });
        saleRhf.setValue("unitId", reservation.unit.id, { shouldValidate: true });
        saleRhf.setValue("amount", Number(reservation.amount), { shouldValidate: true });
        setSaleCustomerName(reservation.customer.name);
        setSaleCustomerSearch(reservation.customer.name);
        setSaleUnitNumber(reservation.unit.number);
        setSaleUnitSearch(reservation.unit.number);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const q = saleCustomerSearch.toLowerCase();
    return customers.filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [customers, saleCustomerSearch]);

  const saleUnitOptions = React.useMemo(() => {
    const q = saleUnitSearch.toLowerCase();
    return units
      .filter((u) => (u.status === "AVAILABLE" || u.status === "RESERVED") && (!q || u.number.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [units, saleUnitSearch]);

  const leaseCustomerOptions = React.useMemo(() => {
    const q = leaseCustomerSearch.toLowerCase();
    return customers.filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [customers, leaseCustomerSearch]);

  const leaseUnitOptions = React.useMemo(() => {
    const q = leaseUnitSearch.toLowerCase();
    return units
      .filter((u) => u.status === "AVAILABLE" && (!q || u.number.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [units, leaseUnitSearch]);

  const handleCreateSale = saleRhf.handleSubmit(async (values: SaleFormValues) => {
    setSubmitting(true);
    try {
      await createContract({
        customerId: values.customerId,
        unitId: values.unitId,
        type: "SALE",
        amount: values.amount,
        notes: values.notes || undefined,
      });
      trackEvent(AnalyticsEvent.ContractCreated, { contract_type: "SALE", amount: values.amount });
      toast.success(lang === "ar" ? "تم إنشاء عقد البيع بنجاح" : "Sale contract created successfully");
      setSaleModalOpen(false);
      saleRhf.reset();
      setSaleCustomerSearch("");
      setSaleCustomerName("");
      setSaleUnitSearch("");
      setSaleUnitNumber("");
      loadContracts();
    } catch (err) {
      toast.error(sanitizeError(err, lang));
    } finally {
      setSubmitting(false);
    }
  });

  const handleCreateLease = leaseRhf.handleSubmit(async (values: LeaseFormValues) => {
    setSubmitting(true);
    try {
      await createContract({
        customerId: values.customerId,
        unitId: values.unitId,
        type: "LEASE",
        amount: values.amount,
        startDate: values.startDate,
        endDate: values.endDate,
        paymentFrequency: values.paymentFrequency,
        notes: values.notes || undefined,
      });
      trackEvent(AnalyticsEvent.ContractCreated, { contract_type: "LEASE", amount: values.amount });
      toast.success(lang === "ar" ? "تم إنشاء عقد الإيجار بنجاح" : "Lease contract created successfully");
      setLeaseModalOpen(false);
      leaseRhf.reset();
      setLeaseCustomerSearch("");
      setLeaseCustomerName("");
      setLeaseUnitSearch("");
      setLeaseUnitNumber("");
      loadContracts();
    } catch (err) {
      toast.error(sanitizeError(err, lang));
    } finally {
      setSubmitting(false);
    }
  });

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
            {new Date(row.original.signedAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")}
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
                onClick={() => askSign(c.id)}
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
            {new Date(row.original.lease.startDate).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")}
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
            {new Date(row.original.lease.endDate).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")}
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
                onClick={() => askSign(c.id)}
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
            enableColumnReorder
            exportable
            onExport={({ rows, columns: exportColumns }) =>
              exportToExcel({
                filename: `sale-contracts-${new Date().toISOString().slice(0, 10)}`,
                title: lang === "ar" ? "عقود البيع" : "Sale Contracts",
                lang,
                columns: exportColumns.map((c) => ({ header: c.header, key: c.id })),
                data: rows.map((c) => ({
                  contractNumber: c.contractNumber ?? "—",
                  customer_name: c.customer.name,
                  property: `${lang === "ar" ? "وحدة" : "Unit"} ${c.unit.number}${c.unit.buildingName ? ` — ${c.unit.buildingName}` : ""}`,
                  amount: SAR(Number(c.amount)),
                  status:
                    lang === "ar"
                      ? CONTRACT_STATUS_LABELS[c.status]?.ar ?? c.status
                      : CONTRACT_STATUS_LABELS[c.status]?.en ?? c.status,
                  signedAt: c.signedAt
                    ? new Date(c.signedAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")
                    : "—",
                })),
              })
            }
            savedViews={{
              tableKey: "contracts-sale",
              views: savedViews,
              onCreate: async (name, config) => {
                await createSavedView({ tableKey: "contracts-sale", name, config });
                refreshSavedViews();
              },
              onDelete: async (id) => {
                await deleteSavedView(id);
                refreshSavedViews();
              },
            }}
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
            enableColumnReorder
            exportable
            onExport={({ rows, columns: exportColumns }) =>
              exportToExcel({
                filename: `lease-contracts-${new Date().toISOString().slice(0, 10)}`,
                title: lang === "ar" ? "عقود الإيجار" : "Lease Contracts",
                lang,
                columns: exportColumns.map((c) => ({ header: c.header, key: c.id })),
                data: rows.map((c) => ({
                  contractNumber: c.contractNumber ?? "—",
                  customer_name: c.customer.name,
                  property: `${lang === "ar" ? "وحدة" : "Unit"} ${c.unit.number}${c.unit.buildingName ? ` — ${c.unit.buildingName}` : ""}`,
                  amount: SAR(Number(c.amount)),
                  startDate: c.lease?.startDate
                    ? new Date(c.lease.startDate).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")
                    : "—",
                  endDate: c.lease?.endDate
                    ? new Date(c.lease.endDate).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")
                    : "—",
                  status:
                    lang === "ar"
                      ? CONTRACT_STATUS_LABELS[c.status]?.ar ?? c.status
                      : CONTRACT_STATUS_LABELS[c.status]?.en ?? c.status,
                })),
              })
            }
            savedViews={{
              tableKey: "contracts-lease",
              views: savedViews,
              onCreate: async (name, config) => {
                await createSavedView({ tableKey: "contracts-lease", name, config });
                refreshSavedViews();
              },
              onDelete: async (id) => {
                await deleteSavedView(id);
                refreshSavedViews();
              },
            }}
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
                    {new Date(detailContract.signedAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA")}
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
        onOpenChange={(open) => {
          setSaleModalOpen(open);
          if (!open) {
            saleRhf.reset();
            setSaleCustomerSearch("");
            setSaleCustomerName("");
            setSaleUnitSearch("");
            setSaleUnitNumber("");
          }
        }}
        title={lang === "ar" ? "عقد بيع جديد" : "New Sale Contract"}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setSaleModalOpen(false);
                saleRhf.reset();
                setSaleCustomerSearch("");
                setSaleCustomerName("");
                setSaleUnitSearch("");
                setSaleUnitNumber("");
              }}
              style={{ display: "inline-flex" }}
            >
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
          onSubmit={handleCreateSale}
          className="space-y-4 py-2"
        >
          {/* Required fields legend */}
          <p className="text-caption text-muted-foreground text-xs">
            {lang === "ar" ? "الحقول المطلوبة معلّمة بـ *" : "Required fields marked with *"}
          </p>

          {/* Customer */}
          <Controller
            control={saleRhf.control}
            name="customerId"
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "العميل" : "Customer"} *
                </label>
                <div className="relative">
                  <Input
                    value={saleCustomerName || saleCustomerSearch}
                    onChange={(e) => {
                      setSaleCustomerSearch(e.target.value);
                      setSaleCustomerName("");
                      field.onChange("");
                    }}
                    onBlur={field.onBlur}
                    placeholder={lang === "ar" ? "ابحث عن العميل..." : "Search customer..."}
                    aria-invalid={!!fieldState.error}
                  />
                  {saleCustomerSearch && !field.value && saleCustomerOptions.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {saleCustomerOptions.map((c) => (
                        <Button
                          key={c.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSaleCustomerName(c.name);
                            setSaleCustomerSearch(c.name);
                            field.onChange(c.id);
                          }}
                          className="w-full justify-start rounded-none px-3 py-2 text-sm font-normal"
                          style={{ display: "flex" }}
                        >
                          {c.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                {fieldState.error && (
                  <p className="text-caption text-destructive mt-1 text-xs">{fieldState.error.message}</p>
                )}
              </div>
            )}
          />

          {/* Unit */}
          <Controller
            control={saleRhf.control}
            name="unitId"
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "الوحدة" : "Unit"} *
                </label>
                <div className="relative">
                  <Input
                    value={saleUnitNumber || saleUnitSearch}
                    onChange={(e) => {
                      setSaleUnitSearch(e.target.value);
                      setSaleUnitNumber("");
                      field.onChange("");
                    }}
                    onBlur={field.onBlur}
                    placeholder={lang === "ar" ? "ابحث عن وحدة..." : "Search unit..."}
                    aria-invalid={!!fieldState.error}
                  />
                  {saleUnitSearch && !field.value && saleUnitOptions.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {saleUnitOptions.map((u) => (
                        <Button
                          key={u.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSaleUnitNumber(u.number);
                            setSaleUnitSearch(u.number);
                            field.onChange(u.id);
                          }}
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
                {fieldState.error && (
                  <p className="text-caption text-destructive mt-1 text-xs">{fieldState.error.message}</p>
                )}
              </div>
            )}
          />

          {/* Amount */}
          <Controller
            control={saleRhf.control}
            name="amount"
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "مبلغ العقد (ريال)" : "Contract Amount (SAR)"} *
                </label>
                <SARAmountInput
                  value={field.value ?? null}
                  onChange={(n) => field.onChange(n ?? undefined)}
                  onBlur={field.onBlur}
                  placeholder="0.00"
                  aria-invalid={!!fieldState.error}
                />
                {fieldState.error && (
                  <p className="text-caption text-destructive mt-1 text-xs">{fieldState.error.message}</p>
                )}
              </div>
            )}
          />

          {/* Notes */}
          <Controller
            control={saleRhf.control}
            name="notes"
            render={({ field }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "ملاحظات" : "Notes"}
                  {" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    ({lang === "ar" ? "اختياري" : "optional"})
                  </span>
                </label>
                <textarea
                  {...field}
                  rows={3}
                  placeholder={lang === "ar" ? "ملاحظات اختيارية..." : "Optional notes..."}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>
            )}
          />
        </form>
      </ResponsiveDialog>

      {/* New Lease Contract Modal */}
      <ResponsiveDialog
        open={leaseModalOpen}
        onOpenChange={(open) => {
          setLeaseModalOpen(open);
          if (!open) {
            leaseRhf.reset();
            setLeaseCustomerSearch("");
            setLeaseCustomerName("");
            setLeaseUnitSearch("");
            setLeaseUnitNumber("");
          }
        }}
        title={lang === "ar" ? "عقد إيجار جديد" : "New Lease Contract"}
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setLeaseModalOpen(false);
                leaseRhf.reset();
                setLeaseCustomerSearch("");
                setLeaseCustomerName("");
                setLeaseUnitSearch("");
                setLeaseUnitNumber("");
              }}
              style={{ display: "inline-flex" }}
            >
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
          onSubmit={handleCreateLease}
          className="space-y-4 py-2"
        >
          {/* Required fields legend */}
          <p className="text-caption text-muted-foreground text-xs">
            {lang === "ar" ? "الحقول المطلوبة معلّمة بـ *" : "Required fields marked with *"}
          </p>

          {/* Tenant */}
          <Controller
            control={leaseRhf.control}
            name="customerId"
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "المستأجر" : "Tenant/Customer"} *
                </label>
                <div className="relative">
                  <Input
                    value={leaseCustomerName || leaseCustomerSearch}
                    onChange={(e) => {
                      setLeaseCustomerSearch(e.target.value);
                      setLeaseCustomerName("");
                      field.onChange("");
                    }}
                    onBlur={field.onBlur}
                    placeholder={lang === "ar" ? "ابحث عن المستأجر..." : "Search tenant..."}
                    aria-invalid={!!fieldState.error}
                  />
                  {leaseCustomerSearch && !field.value && leaseCustomerOptions.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {leaseCustomerOptions.map((c) => (
                        <Button
                          key={c.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLeaseCustomerName(c.name);
                            setLeaseCustomerSearch(c.name);
                            field.onChange(c.id);
                          }}
                          className="w-full justify-start rounded-none px-3 py-2 text-sm font-normal"
                          style={{ display: "flex" }}
                        >
                          {c.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                {fieldState.error && (
                  <p className="text-caption text-destructive mt-1 text-xs">{fieldState.error.message}</p>
                )}
              </div>
            )}
          />

          {/* Unit */}
          <Controller
            control={leaseRhf.control}
            name="unitId"
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "الوحدة" : "Unit"} *
                </label>
                <div className="relative">
                  <Input
                    value={leaseUnitNumber || leaseUnitSearch}
                    onChange={(e) => {
                      setLeaseUnitSearch(e.target.value);
                      setLeaseUnitNumber("");
                      field.onChange("");
                    }}
                    onBlur={field.onBlur}
                    placeholder={lang === "ar" ? "ابحث عن وحدة متاحة..." : "Search available unit..."}
                    aria-invalid={!!fieldState.error}
                  />
                  {leaseUnitSearch && !field.value && leaseUnitOptions.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {leaseUnitOptions.map((u) => (
                        <Button
                          key={u.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLeaseUnitNumber(u.number);
                            setLeaseUnitSearch(u.number);
                            field.onChange(u.id);
                          }}
                          className="w-full justify-start rounded-none px-3 py-2 text-sm font-normal"
                          style={{ display: "flex" }}
                        >
                          {lang === "ar" ? "وحدة" : "Unit"} {u.number}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                {fieldState.error && (
                  <p className="text-caption text-destructive mt-1 text-xs">{fieldState.error.message}</p>
                )}
              </div>
            )}
          />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={leaseRhf.control}
              name="startDate"
              render={({ field, fieldState }) => (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    {lang === "ar" ? "تاريخ البداية" : "Start Date"} *
                  </label>
                  <HijriDatePicker
                    value={field.value ? new Date(field.value) : null}
                    onChange={(d) => {
                      field.onChange(d ? d.toISOString().slice(0, 10) : "");
                    }}
                  />
                  {fieldState.error && (
                    <p className="text-caption text-destructive mt-1 text-xs">{fieldState.error.message}</p>
                  )}
                </div>
              )}
            />
            <Controller
              control={leaseRhf.control}
              name="endDate"
              render={({ field, fieldState }) => (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    {lang === "ar" ? "تاريخ النهاية" : "End Date"} *
                  </label>
                  <HijriDatePicker
                    value={field.value ? new Date(field.value) : null}
                    onChange={(d) => {
                      field.onChange(d ? d.toISOString().slice(0, 10) : "");
                    }}
                  />
                  {fieldState.error && (
                    <p className="text-caption text-destructive mt-1 text-xs">{fieldState.error.message}</p>
                  )}
                </div>
              )}
            />
          </div>

          {/* Amount */}
          <Controller
            control={leaseRhf.control}
            name="amount"
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "إجمالي الإيجار (ريال)" : "Total Amount (SAR)"} *
                </label>
                <SARAmountInput
                  value={field.value ?? null}
                  onChange={(n) => field.onChange(n ?? undefined)}
                  onBlur={field.onBlur}
                  placeholder="0.00"
                  aria-invalid={!!fieldState.error}
                />
                {fieldState.error && (
                  <p className="text-caption text-destructive mt-1 text-xs">{fieldState.error.message}</p>
                )}
              </div>
            )}
          />

          {/* Payment Frequency */}
          <Controller
            control={leaseRhf.control}
            name="paymentFrequency"
            render={({ field }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "دورية الدفع" : "Payment Frequency"}
                </label>
                <select
                  {...field}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                >
                  <option value="MONTHLY">{lang === "ar" ? "شهري" : "Monthly"}</option>
                  <option value="QUARTERLY">{lang === "ar" ? "ربع سنوي" : "Quarterly"}</option>
                  <option value="SEMI_ANNUAL">{lang === "ar" ? "نصف سنوي" : "Semi-Annual"}</option>
                  <option value="ANNUAL">{lang === "ar" ? "سنوي" : "Annual"}</option>
                </select>
              </div>
            )}
          />

          {/* Notes */}
          <Controller
            control={leaseRhf.control}
            name="notes"
            render={({ field }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {lang === "ar" ? "ملاحظات" : "Notes"}
                  {" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    ({lang === "ar" ? "اختياري" : "optional"})
                  </span>
                </label>
                <textarea
                  {...field}
                  rows={3}
                  placeholder={lang === "ar" ? "ملاحظات اختيارية..." : "Optional notes..."}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>
            )}
          />
        </form>
      </ResponsiveDialog>
    </div>
    </div>
      <ConfirmDialog
        open={signConfirmOpen}
        onOpenChange={setSignConfirmOpen}
        title={lang === "ar" ? "توقيع العقد؟" : "Sign this contract?"}
        description={
          signMissingDocs.length > 0
            ? lang === "ar"
              ? `تنبيه: توجد مستندات مطلوبة ناقصة (${signMissingDocs.length}). التوقيع نهائي ولا يمكن التراجع عنه.`
              : `Warning: ${signMissingDocs.length} required document(s) still missing. Signing is final and cannot be undone.`
            : lang === "ar"
              ? "التوقيع نهائي ولا يمكن التراجع عنه."
              : "Signing is final and cannot be undone."
        }
        confirmLabel={lang === "ar" ? "توقيع" : "Sign"}
        cancelLabel={lang === "ar" ? "إلغاء" : "Cancel"}
        onConfirm={confirmSign}
      />
    </>
  );
}
