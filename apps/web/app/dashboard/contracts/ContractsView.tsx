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
  AlertTriangle,
  Home,
  Key,
  Eye,
  PenLine,
  Pencil,
  Send,
  Ban,
  Trash2,
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
  SelectField,
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
import {
  getContracts,
  createContract,
  updateContract,
  updateContractStatus,
  bulkUpdateContractStatus,
  bulkDeleteContracts,
} from "../../actions/contracts";
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
  notes?: string | null;
  paymentFrequency?: string | null;
  customer: { id: string; name: string };
  unit: { id: string; number: string; buildingName: string | null; city?: string | null };
  lease?: { id: string; startDate: string; endDate: string; status: string } | null;
};

type Customer = { id: string; name: string };
type Unit = { id: string; number: string; status: string };


type ContractsViewProps = { initialContracts: Contract[] };

export default function ContractsView({ initialContracts }: ContractsViewProps) {
  const { t, lang, dir } = useLanguage();
  const { can } = usePermissions();
  const searchParams = useSearchParams();
  const prefillDealId = searchParams.get("dealId");

  const [tab, setTab] = React.useState<"SALE" | "LEASE">("SALE");
  const [allContracts, setAllContracts] = React.useState<Contract[]>(initialContracts);
  const [loading, setLoading] = React.useState(false);
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

  // Create / edit modals — `editingContractId` non-null = the sale/lease form is
  // in edit mode (CX-011), reusing the create form pre-filled with the contract.
  const [saleModalOpen, setSaleModalOpen] = React.useState(false);
  const [leaseModalOpen, setLeaseModalOpen] = React.useState(false);
  const [editingContractId, setEditingContractId] = React.useState<string | null>(null);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [units, setUnits] = React.useState<Unit[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  // CX-010 — bulk delete confirm (DRAFT-only; destructive → ConfirmDialog).
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = React.useState<string[]>([]);

  // ── Zod schemas (built per-render so bilingual messages use current `lang`) ──

  const saleSchema = React.useMemo(
    () =>
      z.object({
        customerId: z.string().min(1, t("العميل مطلوب", "Customer is required")),
        unitId: z.string().min(1, t("الوحدة مطلوبة", "Unit is required")),
        amount: z
          .number({ invalid_type_error: t("المبلغ مطلوب", "Amount is required") })
          .positive(t("المبلغ يجب أن يكون أكبر من صفر", "Amount must be greater than zero")),
        notes: z.string().optional(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is derived purely from `lang`; depending on `lang` alone rebuilds the schema on language change without churning on `t`'s unstable identity
    [lang],
  );

  const leaseSchema = React.useMemo(
    () =>
      z
        .object({
          customerId: z.string().min(1, t("المستأجر مطلوب", "Customer is required")),
          unitId: z.string().min(1, t("الوحدة مطلوبة", "Unit is required")),
          startDate: z.string().min(1, t("تاريخ البداية مطلوب", "Start date is required")),
          endDate: z.string().min(1, t("تاريخ النهاية مطلوب", "End date is required")),
          amount: z
            .number({ invalid_type_error: t("المبلغ مطلوب", "Amount is required") })
            .positive(t("المبلغ يجب أن يكون أكبر من صفر", "Amount must be greater than zero")),
          paymentFrequency: z.string().min(1),
          notes: z.string().optional(),
        })
        .refine(
          (d) => !d.startDate || !d.endDate || d.endDate > d.startDate,
          {
            message: t("تاريخ النهاية يجب أن يكون بعد تاريخ البداية", "End date must be after start date"),
            path: ["endDate"],
          },
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is derived purely from `lang`; depending on `lang` alone rebuilds the schema on language change without churning on `t`'s unstable identity
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on the contract id only; re-running on the full `detailContract` object would re-fetch journey/docs on every unrelated list refresh that re-creates the object
  }, [detailContract?.id]);

  function loadContracts() {
    setLoading(true);
    setLoadError(null);
    getContracts()
      .then((data) => setAllContracts(data as Contract[]))
      .catch(() => {
        const msg = t("تعذّر تحميل العقود", "Failed to load contracts");
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
      toast.success(t("تم توقيع العقد بنجاح", "Contract signed successfully"));
      loadContracts();
    } catch (err) {
      toast.error(sanitizeError(err, lang));
    }
  }

  // Initial contracts arrive as props from the RSC server shell (CX-003 pt1 —
  // no first-paint client mount-fetch). `loadContracts()` is kept for the
  // post-mutation refresh paths (create/edit/sign/bulk/delete) below.

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
      if (editingContractId) {
        // CX-011 — DRAFT edit (server re-enforces DRAFT-only).
        await updateContract(editingContractId, {
          customerId: values.customerId,
          unitId: values.unitId,
          amount: values.amount,
          notes: values.notes || undefined,
        });
        toast.success(t("تم تحديث عقد البيع بنجاح", "Sale contract updated successfully"));
      } else {
        await createContract({
          customerId: values.customerId,
          unitId: values.unitId,
          type: "SALE",
          amount: values.amount,
          notes: values.notes || undefined,
        });
        trackEvent(AnalyticsEvent.ContractCreated, { contract_type: "SALE", amount: values.amount });
        toast.success(t("تم إنشاء عقد البيع بنجاح", "Sale contract created successfully"));
      }
      setSaleModalOpen(false);
      setEditingContractId(null);
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
      if (editingContractId) {
        // CX-011 — DRAFT edit; lease-term changes recreate installments server-side.
        await updateContract(editingContractId, {
          customerId: values.customerId,
          unitId: values.unitId,
          amount: values.amount,
          startDate: values.startDate,
          endDate: values.endDate,
          paymentFrequency: values.paymentFrequency,
          notes: values.notes || undefined,
        });
        toast.success(t("تم تحديث عقد الإيجار بنجاح", "Lease contract updated successfully"));
      } else {
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
        toast.success(t("تم إنشاء عقد الإيجار بنجاح", "Lease contract created successfully"));
      }
      setLeaseModalOpen(false);
      setEditingContractId(null);
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

  // CX-011 — open the create form pre-filled for a DRAFT contract (edit mode).
  // Reuses the existing sale/lease RHF forms; only DRAFT contracts reach here
  // (the Edit button renders solely for status === "DRAFT").
  function openEditContract(c: Contract) {
    if (c.status !== "DRAFT") return;
    setDetailContract(null);
    setEditingContractId(c.id);
    loadLookups();
    if (c.type === "SALE") {
      saleRhf.reset({
        customerId: c.customer.id,
        unitId: c.unit.id,
        amount: Number(c.amount),
        notes: c.notes ?? "",
      });
      setSaleCustomerName(c.customer.name);
      setSaleCustomerSearch(c.customer.name);
      setSaleUnitNumber(c.unit.number);
      setSaleUnitSearch(c.unit.number);
      setSaleModalOpen(true);
    } else {
      leaseRhf.reset({
        customerId: c.customer.id,
        unitId: c.unit.id,
        startDate: c.lease?.startDate ? c.lease.startDate.slice(0, 10) : "",
        endDate: c.lease?.endDate ? c.lease.endDate.slice(0, 10) : "",
        amount: Number(c.amount),
        paymentFrequency: c.paymentFrequency ?? "MONTHLY",
        notes: c.notes ?? "",
      });
      setLeaseCustomerName(c.customer.name);
      setLeaseCustomerSearch(c.customer.name);
      setLeaseUnitNumber(c.unit.number);
      setLeaseUnitSearch(c.unit.number);
      setLeaseModalOpen(true);
    }
  }

  // CX-010 — bulk status transition (Send / Cancel selected). Reports skipped.
  async function handleBulkStatus(ids: string[], target: "SENT" | "CANCELLED") {
    try {
      const res = await bulkUpdateContractStatus(ids, target);
      const verb =
        target === "SENT"
          ? t("إرسال", "sent")
          : t("إلغاء", "cancelled");
      if (lang === "ar") {
        toast.success(
          res.skippedCount > 0
            ? `تم ${verb} ${res.updatedCount} عقد، وتم تخطّي ${res.skippedCount}`
            : `تم ${verb} ${res.updatedCount} عقد`,
        );
      } else {
        toast.success(
          res.skippedCount > 0
            ? `${res.updatedCount} contract(s) ${verb}, ${res.skippedCount} skipped`
            : `${res.updatedCount} contract(s) ${verb}`,
        );
      }
      loadContracts();
    } catch (err) {
      toast.error(sanitizeError(err, lang));
    }
  }

  // CX-010 — bulk delete (DRAFT-only). Server rejects non-DRAFT; we still gate
  // the affordance client-side and confirm before the destructive call.
  function askBulkDelete(ids: string[]) {
    setBulkDeleteIds(ids);
    setBulkDeleteOpen(true);
  }
  async function confirmBulkDelete() {
    try {
      const res = await bulkDeleteContracts(bulkDeleteIds);
      toast.success(
        t(`تم حذف ${res.deletedCount} عقد`, `${res.deletedCount} contract(s) deleted`),
      );
      loadContracts();
    } catch (err) {
      toast.error(sanitizeError(err, lang));
    }
  }

  // Shared bulk-action toolbar renderer for both sale + lease tables.
  // (DataTable owns row selection and renders its own "clear" X; deleted rows
  // also drop out naturally on the post-op reload.)
  function renderBulkActions(selectedRows: Contract[]) {
    const ids = selectedRows.map((r) => r.id);
    const allDraft = selectedRows.length > 0 && selectedRows.every((r) => r.status === "DRAFT");
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="subtle"
          size="sm"
          onClick={() => handleBulkStatus(ids, "SENT")}
          style={{ display: "inline-flex" }}
          className="gap-1.5"
        >
          <Send className="h-3.5 w-3.5" />
          {t("إرسال المحدد", "Send selected")}
        </Button>
        <Button
          variant="subtle"
          size="sm"
          onClick={() => handleBulkStatus(ids, "CANCELLED")}
          style={{ display: "inline-flex" }}
          className="gap-1.5"
        >
          <Ban className="h-3.5 w-3.5" />
          {t("إلغاء المحدد", "Cancel selected")}
        </Button>
        {can("contracts:delete") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => askBulkDelete(ids)}
            disabled={!allDraft}
            title={
              !allDraft
                ? t("يمكن حذف المسودات فقط", "Only draft contracts can be deleted")
                : undefined
            }
            style={{ display: "inline-flex" }}
            className="gap-1.5 text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("حذف المحدد", "Delete selected")}
          </Button>
        )}
      </div>
    );
  }

  // ── Sale table columns ──────────────────────────────────────────────
  const saleColumns: ColumnDef<Contract>[] = [
    {
      accessorKey: "contractNumber",
      header: t("رقم العقد", "Contract #"),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.contractNumber ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "customer.name",
      header: t("العميل", "Client"),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.customer.name}</span>
      ),
    },
    {
      id: "property",
      header: t("العقار", "Property"),
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="font-medium">
            {t("وحدة", "Unit")} {row.original.unit.number}
          </p>
          <p className="text-muted-foreground text-xs">
            {row.original.unit.buildingName ?? row.original.unit.city ?? "—"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: t("المبلغ", "Amount (SAR)"),
      meta: { numeric: true },
      cell: ({ row }) => SAR(Number(row.original.amount)),
    },
    {
      accessorKey: "status",
      header: t("الحالة", "Status"),
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
      header: t("تاريخ التوقيع", "Signed Date"),
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
              aria-label={t("عرض التفاصيل", "View details")}
              variant="ghost"
              size="icon"
              onClick={() => setDetailContract(c)}
              className="h-8 w-8"
            />
            {(c.status === "DRAFT" || c.status === "SENT") && (
              <IconButton
                icon={PenLine}
                aria-label={t("توقيع", "Sign")}
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
      header: t("رقم العقد", "Contract #"),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.contractNumber ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "customer.name",
      header: t("المستأجر", "Tenant"),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.customer.name}</span>
      ),
    },
    {
      id: "property",
      header: t("العقار", "Property"),
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="font-medium">
            {t("وحدة", "Unit")} {row.original.unit.number}
          </p>
          <p className="text-muted-foreground text-xs">
            {row.original.unit.buildingName ?? row.original.unit.city ?? "—"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: t("الإيجار السنوي", "Annual Rent (SAR)"),
      meta: { numeric: true },
      cell: ({ row }) => SAR(Number(row.original.amount)),
    },
    {
      id: "startDate",
      header: t("تاريخ البداية", "Start Date"),
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
      header: t("تاريخ النهاية", "End Date"),
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
      header: t("الحالة", "Status"),
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
              aria-label={t("عرض التفاصيل", "View details")}
              variant="ghost"
              size="icon"
              onClick={() => setDetailContract(c)}
              className="h-8 w-8"
            />
            {(c.status === "DRAFT" || c.status === "SENT") && (
              <IconButton
                icon={PenLine}
                aria-label={t("توقيع", "Sign")}
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
      <AppBar title={t("العقود", "Contracts")} lang={lang} />

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
              t("ابحث برقم العقد أو العميل...", "Search by contract # or customer...")
            }
            className="h-10 ps-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pt-3">
        <MobileKPICard
          label={t("عقود موقّعة", "Active")}
          value={<span className="tabular-nums">{activeCount}</span>}
          tone="green"
        />
        <MobileKPICard
          label={t("تنتهي قريبًا", "Expiring soon")}
          value={<span className="tabular-nums">{expiringCount}</span>}
          tone="amber"
        />
        <MobileKPICard
          label={t("إجمالي القيمة", "Total value")}
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
          label={t("إجمالي العقود", "Total")}
          value={<span className="tabular-nums">{totalCount}</span>}
          tone="default"
        />
      </div>

      <div className="px-4 pt-3">
        <MobileTabs
          ariaLabel={t("تبويبات العقود", "Contract tabs")}
          active={mobileTab}
          onChange={(k) => setMobileTab(k as "ALL" | "SALE" | "LEASE")}
          items={[
            { key: "ALL", label: t("الكل", "All") },
            { key: "SALE", label: t("بيع", "Sale") },
            { key: "LEASE", label: t("إيجار", "Lease") },
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
              title={t("لا توجد عقود بعد", "No contracts yet")}
              description={
                t("تتبّع كل عقد إيجار أو بيع من المسودة حتى التوقيع.", "Track every lease and sale from draft to signed.")
              }
              action={
                <Button size="sm" onClick={openSaleModal} style={{ display: "inline-flex" }}>
                  <Plus className="h-4 w-4 me-1.5" />
                  {t("إنشاء عقد", "Create contract")}
                </Button>
              }
              helpHref="/dashboard/help#contracts"
              helpLabel={t("تعرّف على العقود", "Learn about contracts")}
            />
          ) : (
            <EmptyState
              variant="filtered"
              icon={<Search className="h-10 w-10" aria-hidden="true" />}
              title={t("لا توجد نتائج مطابقة", "No matching contracts")}
              description={
                t("جرّب تعديل البحث أو التبويب.", "Try adjusting your search or tab.")
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
                  {t("مسح الفلاتر", "Clear filters")}
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
                iconTone="primary"
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
                  `${t("وحدة", "Unit")} ${c.unit.number}`,
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
          label={t("عقد جديد", "New contract")}
          onClick={() => setNewContractSheetOpen(true)}
        />
      )}

      {/* New contract type picker */}
      <BottomSheet
        open={newContractSheetOpen}
        onOpenChange={setNewContractSheetOpen}
        title={t("نوع العقد الجديد", "Pick contract type")}
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
              {t("عقد بيع", "Sale")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("نقل ملكية وحدة", "Transfer unit ownership")}
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
              {t("عقد إيجار", "Lease")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("تأجير وحدة لمستأجر", "Rent unit to a tenant")}
            </span>
          </Button>
        </div>
      </BottomSheet>
    </div>

    {/* ─── Desktop (≥ md) ─ unchanged ───────────────────────────────── */}
    <div className="hidden md:block">
    <div dir={dir} className="p-6 space-y-6">
      <PageIntro
        title={t("العقود", "Contracts")}
        description={
          t("إدارة عقود البيع وعقود الإيجار في مكان واحد", "Manage sale and lease contracts in one place")
        }
      />

      {/* KPI Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label={t("إجمالي العقود", "Total Contracts")}
          value={String(totalCount)}
          loading={loading}
        />
        <KPICard
          label={t("موقّعة", "Active (Signed)")}
          value={String(activeCount)}
          loading={loading}
        />
        <KPICard
          label={t("مسودة", "Draft")}
          value={String(draftCount)}
          loading={loading}
        />
        <KPICard
          label={t("إجمالي القيمة", "Total Value")}
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
            {t("عقود البيع", "Sale Contracts")}
            <span className="ms-2 text-xs opacity-70">({saleContracts.length})</span>
          </Button>
          <Button
            onClick={() => setTab("LEASE")}
            variant={tab === "LEASE" ? "primary" : "subtle"}
            size="sm"
            className="rounded-none rounded-e-lg border-0 border-s border-border px-4 py-2"
            style={{ display: "inline-flex" }}
          >
            {t("عقود الإيجار", "Lease Contracts")}
            <span className="ms-2 text-xs opacity-70">({leaseContracts.length})</span>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("بحث...", "Search...")}
              className="ps-9 w-56"
            />
            {search && (
              <span className="absolute top-1/2 -translate-y-1/2 end-1">
                <IconButton
                  icon={X}
                  aria-label={t("مسح البحث", "Clear search")}
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
                ? t("عقد بيع جديد", "New Sale Contract")
                : t("عقد إيجار جديد", "New Lease Contract")}
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
                  ? t("لا توجد عقود بيع بعد", "No sale contracts yet")
                  : t("لا توجد عقود إيجار بعد", "No lease contracts yet")
              }
              description={
                t("تتبّع كل عقد إيجار أو بيع من المسودة حتى التوقيع.", "Track every lease and sale from draft to signed.")
              }
              action={
                <Button
                  onClick={tab === "SALE" ? openSaleModal : openLeaseModal}
                  style={{ display: "inline-flex" }}
                  className="gap-2"
                >
                  <Plus className="h-[18px] w-[18px]" />
                  {tab === "SALE"
                    ? t("إنشاء عقد بيع", "Create sale contract")
                    : t("إنشاء عقد إيجار", "Create lease contract")}
                </Button>
              }
              helpHref="/dashboard/help#contracts"
              helpLabel={t("تعرّف على العقود", "Learn about contracts")}
            />
          ) : (
            <EmptyState
              variant="filtered"
              icon={<Search className="h-12 w-12" aria-hidden="true" />}
              title={t("لا توجد نتائج مطابقة", "No matching contracts")}
              description={
                t("جرّب تعديل البحث.", "Try adjusting your search.")
              }
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearch("")}
                  style={{ display: "inline-flex" }}
                >
                  {t("مسح الفلاتر", "Clear filters")}
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
            enableSelection={canWrite}
            bulkActions={canWrite ? renderBulkActions : undefined}
            exportable
            onExport={({ rows, columns: exportColumns }) =>
              exportToExcel({
                filename: `sale-contracts-${new Date().toISOString().slice(0, 10)}`,
                title: t("عقود البيع", "Sale Contracts"),
                lang,
                columns: exportColumns.map((c) => ({ header: c.header, key: c.id })),
                data: rows.map((c) => ({
                  contractNumber: c.contractNumber ?? "—",
                  customer_name: c.customer.name,
                  property: `${t("وحدة", "Unit")} ${c.unit.number}${c.unit.buildingName ? ` — ${c.unit.buildingName}` : ""}`,
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
                iconTone="primary"
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
                  `${t("وحدة", "Unit")} ${row.unit.number}`,
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
            emptyTitle={t("لا توجد عقود بيع", "No sale contracts")}
            emptyDescription={t("جرّب تعديل البحث.", "Try adjusting your search.")}
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
            enableSelection={canWrite}
            bulkActions={canWrite ? renderBulkActions : undefined}
            exportable
            onExport={({ rows, columns: exportColumns }) =>
              exportToExcel({
                filename: `lease-contracts-${new Date().toISOString().slice(0, 10)}`,
                title: t("عقود الإيجار", "Lease Contracts"),
                lang,
                columns: exportColumns.map((c) => ({ header: c.header, key: c.id })),
                data: rows.map((c) => ({
                  contractNumber: c.contractNumber ?? "—",
                  customer_name: c.customer.name,
                  property: `${t("وحدة", "Unit")} ${c.unit.number}${c.unit.buildingName ? ` — ${c.unit.buildingName}` : ""}`,
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
                iconTone="primary"
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
                  `${t("وحدة", "Unit")} ${row.unit.number}`,
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
            emptyTitle={t("لا توجد عقود إيجار", "No lease contracts")}
            emptyDescription={t("جرّب تعديل البحث.", "Try adjusting your search.")}
          />
        )}
      </Card>

      {/* Contract Detail Modal */}
      <ResponsiveDialog
        open={!!detailContract}
        onOpenChange={(open) => {
          if (!open) setDetailContract(null);
        }}
        title={t("تفاصيل العقد", "Contract Details")}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDetailContract(null)}
              style={{ display: "inline-flex" }}
            >
              {t("إغلاق", "Close")}
            </Button>
            {/* CX-011 — Edit shown only for DRAFT (the only editable state). */}
            {detailContract?.status === "DRAFT" && canWrite && (
              <Button
                onClick={() => detailContract && openEditContract(detailContract)}
                style={{ display: "inline-flex" }}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                {t("تعديل", "Edit")}
              </Button>
            )}
          </div>
        }
      >
        {detailContract && (
          <div className="space-y-3 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-muted-foreground text-xs">{t("رقم العقد", "Contract #")}</p>
                <p className="font-medium font-mono">{detailContract.contractNumber ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("النوع", "Type")}</p>
                <p className="font-medium">
                  {detailContract.type === "SALE"
                    ? t("بيع", "Sale")
                    : t("إيجار", "Lease")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("العميل", "Client")}</p>
                <p className="font-medium">{detailContract.customer.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("الوحدة", "Unit")}</p>
                <p className="font-medium">{detailContract.unit.number}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("المبلغ", "Amount")}</p>
                <p className="font-medium">{SAR(Number(detailContract.amount))}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("الحالة", "Status")}</p>
                <Badge variant={CONTRACT_STATUS_VARIANT[detailContract.status] ?? "default"} size="sm">
                  {lang === "ar" ? (CONTRACT_STATUS_LABELS[detailContract.status]?.ar ?? detailContract.status) : (CONTRACT_STATUS_LABELS[detailContract.status]?.en ?? detailContract.status)}
                </Badge>
              </div>
              {detailContract.signedAt && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">{t("تاريخ التوقيع", "Signed Date")}</p>
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
                {t("جارٍ تحميل المسار...", "Loading journey...")}
              </div>
            )}
            {!journeyLoading && journey && (
              <div className="space-y-3 border-t border-border pt-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t("المسار", "Journey")}
                </h4>
                {journey.blockers.length > 0 && (
                  <ProcessBlockerBanner blockers={journey.blockers} lang={lang} />
                )}
                <LifecycleRail
                  stages={journey.stages}
                  lang={lang}
                  ariaLabel={t("مراحل العقد", "Contract lifecycle")}
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
                      {t(`السجلات المرتبطة (${journey.related.length})`, `Related records (${journey.related.length})`)}
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

      {/* Sale Contract Modal (create + CX-011 DRAFT edit) */}
      <ResponsiveDialog
        open={saleModalOpen}
        onOpenChange={(open) => {
          setSaleModalOpen(open);
          if (!open) {
            setEditingContractId(null);
            saleRhf.reset();
            setSaleCustomerSearch("");
            setSaleCustomerName("");
            setSaleUnitSearch("");
            setSaleUnitNumber("");
          }
        }}
        title={
          editingContractId
            ? t("تعديل عقد البيع", "Edit Sale Contract")
            : t("عقد بيع جديد", "New Sale Contract")
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setSaleModalOpen(false);
                setEditingContractId(null);
                saleRhf.reset();
                setSaleCustomerSearch("");
                setSaleCustomerName("");
                setSaleUnitSearch("");
                setSaleUnitNumber("");
              }}
              style={{ display: "inline-flex" }}
            >
              {t("إلغاء", "Cancel")}
            </Button>
            <Button type="submit" form="sale-contract-form" disabled={submitting} style={{ display: "inline-flex" }} className="gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingContractId
                ? t("حفظ التغييرات", "Save changes")
                : t("إنشاء العقد", "Create Contract")}
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
            {t("الحقول المطلوبة معلّمة بـ *", "Required fields marked with *")}
          </p>

          {/* Customer */}
          <Controller
            control={saleRhf.control}
            name="customerId"
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {t("العميل", "Customer")} *
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
                    placeholder={t("ابحث عن العميل...", "Search customer...")}
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
                  {t("الوحدة", "Unit")} *
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
                    placeholder={t("ابحث عن وحدة...", "Search unit...")}
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
                          {t("وحدة", "Unit")} {u.number}
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
                  {t("مبلغ العقد (ريال)", "Contract Amount (SAR)")} *
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
                  {t("ملاحظات", "Notes")}
                  {" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    ({t("اختياري", "optional")})
                  </span>
                </label>
                <textarea
                  {...field}
                  rows={3}
                  placeholder={t("ملاحظات اختيارية...", "Optional notes...")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>
            )}
          />
        </form>
      </ResponsiveDialog>

      {/* Lease Contract Modal (create + CX-011 DRAFT edit) */}
      <ResponsiveDialog
        open={leaseModalOpen}
        onOpenChange={(open) => {
          setLeaseModalOpen(open);
          if (!open) {
            setEditingContractId(null);
            leaseRhf.reset();
            setLeaseCustomerSearch("");
            setLeaseCustomerName("");
            setLeaseUnitSearch("");
            setLeaseUnitNumber("");
          }
        }}
        title={
          editingContractId
            ? t("تعديل عقد الإيجار", "Edit Lease Contract")
            : t("عقد إيجار جديد", "New Lease Contract")
        }
        contentClassName="sm:max-w-[640px]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setLeaseModalOpen(false);
                setEditingContractId(null);
                leaseRhf.reset();
                setLeaseCustomerSearch("");
                setLeaseCustomerName("");
                setLeaseUnitSearch("");
                setLeaseUnitNumber("");
              }}
              style={{ display: "inline-flex" }}
            >
              {t("إلغاء", "Cancel")}
            </Button>
            <Button type="submit" form="lease-contract-form" disabled={submitting} style={{ display: "inline-flex" }} className="gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingContractId
                ? t("حفظ التغييرات", "Save changes")
                : t("إنشاء العقد", "Create Contract")}
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
            {t("الحقول المطلوبة معلّمة بـ *", "Required fields marked with *")}
          </p>

          {/* Tenant */}
          <Controller
            control={leaseRhf.control}
            name="customerId"
            render={({ field, fieldState }) => (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {t("المستأجر", "Tenant/Customer")} *
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
                    placeholder={t("ابحث عن المستأجر...", "Search tenant...")}
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
                  {t("الوحدة", "Unit")} *
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
                    placeholder={t("ابحث عن وحدة متاحة...", "Search available unit...")}
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
                          {t("وحدة", "Unit")} {u.number}
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
                    {t("تاريخ البداية", "Start Date")} *
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
                    {t("تاريخ النهاية", "End Date")} *
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
                  {t("إجمالي الإيجار (ريال)", "Total Amount (SAR)")} *
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
                  {t("دورية الدفع", "Payment Frequency")}
                </label>
                <SelectField
                  {...field}
                  aria-label={t("دورية الدفع", "Payment Frequency")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                >
                  <option value="MONTHLY">{t("شهري", "Monthly")}</option>
                  <option value="QUARTERLY">{t("ربع سنوي", "Quarterly")}</option>
                  <option value="SEMI_ANNUAL">{t("نصف سنوي", "Semi-Annual")}</option>
                  <option value="ANNUAL">{t("سنوي", "Annual")}</option>
                </SelectField>
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
                  {t("ملاحظات", "Notes")}
                  {" "}
                  <span className="text-muted-foreground text-xs font-normal">
                    ({t("اختياري", "optional")})
                  </span>
                </label>
                <textarea
                  {...field}
                  rows={3}
                  placeholder={t("ملاحظات اختيارية...", "Optional notes...")}
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
        title={t("توقيع العقد؟", "Sign this contract?")}
        description={
          signMissingDocs.length > 0
            ? t(`تنبيه: توجد مستندات مطلوبة ناقصة (${signMissingDocs.length}). التوقيع نهائي ولا يمكن التراجع عنه.`, `Warning: ${signMissingDocs.length} required document(s) still missing. Signing is final and cannot be undone.`)
            : t("التوقيع نهائي ولا يمكن التراجع عنه.", "Signing is final and cannot be undone.")
        }
        confirmLabel={t("توقيع", "Sign")}
        cancelLabel={t("إلغاء", "Cancel")}
        onConfirm={confirmSign}
      />

      {/* CX-010 — Bulk delete confirm (DRAFT-only, destructive) */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={t("حذف العقود المحددة؟", "Delete selected contracts?")}
        description={
          t(`سيتم حذف ${bulkDeleteIds.length} عقد مسودة نهائيًا ولا يمكن التراجع عن ذلك.`, `This will permanently delete ${bulkDeleteIds.length} draft contract(s). This cannot be undone.`)
        }
        confirmLabel={t("حذف", "Delete")}
        cancelLabel={t("إلغاء", "Cancel")}
        variant="destructive"
        onConfirm={confirmBulkDelete}
      />
    </>
  );
}
