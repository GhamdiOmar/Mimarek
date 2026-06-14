"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ExpandedState,
  type GroupingState,
  type Header,
  type RowSelectionState,
  type SortingState,
  type Table as TanstackTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import type { KeyboardCoordinateGetter } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Filter,
  GripVertical,
  Layers,
  RowsIcon,
  Save,
  Trash2,
  Download,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { Input } from "./Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../primitives/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Checkbox } from "../primitives/checkbox";

export type { ColumnDef } from "@tanstack/react-table";

export type DataTableDensity = "compact" | "default" | "comfortable";

/** Columns that are structural — never draggable, never exported. */
const PINNED_COLUMN_IDS = new Set(["__select", "actions"]);

const densityClass: Record<DataTableDensity, string> = {
  compact: "[&_td]:py-1.5 [&_th]:py-2",
  default: "[&_td]:py-3 [&_th]:py-3",
  comfortable: "[&_td]:py-5 [&_th]:py-4",
};

/* ─── Saved-view config (CX-014) ───────────────────────────────────────────── */

/** The JSON-serializable slice of table state a saved view captures. */
export interface SavedTableViewState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  columnOrder: string[];
  density: DataTableDensity;
  pageSize: number;
}

/** Versioned saved-view blob — `config` of a SavedTableView row. */
export interface SavedTableViewConfig {
  v: 1;
  state: SavedTableViewState;
}

export interface SavedTableViewItem {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
}

export interface SavedViewsProp {
  /** Stable key identifying this table (e.g. "payments"). */
  tableKey: string;
  /** The user's personal saved views for this table. */
  views: SavedTableViewItem[];
  /** Persist a new view. Receives the serialized config blob. */
  onCreate: (name: string, config: SavedTableViewConfig) => void | Promise<void>;
  /** Delete a view by id. */
  onDelete: (id: string) => void | Promise<void>;
}

/** Build the versioned saved-view blob from the current state. */
export function serializeTableView(state: SavedTableViewState): SavedTableViewConfig {
  return { v: 1, state };
}

/**
 * Reconcile a saved `columnOrder` against the live column ids:
 *  - keep saved ids that still exist (saved ∩ live), in saved order
 *  - append any live ids not in the saved order (never hide a newly-added column)
 *  - drop saved ids that no longer exist
 */
export function reconcileColumnOrder(saved: string[], live: string[]): string[] {
  const liveSet = new Set(live);
  const kept = saved.filter((id) => liveSet.has(id));
  const keptSet = new Set(kept);
  const appended = live.filter((id) => !keptSet.has(id));
  return [...kept, ...appended];
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  skeletonRows?: number;
  /** Global-search placeholder — if provided, renders a search input in the toolbar. */
  searchPlaceholder?: string;
  /** Locale for RTL-aware labels. */
  locale?: "ar" | "en";
  /** Enable pagination UI + paginated row model (default: true). */
  pagination?: boolean;
  /** Initial page size (default: 10). */
  pageSize?: number;
  /** Enable row selection (checkbox column auto-inserted when true). */
  enableSelection?: boolean;
  /** Action slot rendered when rows are selected (bulk actions). */
  bulkActions?: (selectedRows: TData[]) => React.ReactNode;
  /** Rendered in the toolbar, trailing side (exports etc.). */
  toolbarTrailing?: React.ReactNode;
  /** Accessible table caption for screen readers. */
  caption?: string;
  /** Click handler for rows. */
  onRowClick?: (row: TData) => void;
  /** Stable key for each row — falls back to row.id or row index. */
  getRowId?: (row: TData) => string;
  /** Mobile card renderer. When provided, the table collapses to a card list at <md. */
  mobileCard?: (row: TData) => React.ReactNode;
  /** Optional per-row className (desktop row + mobile card) — e.g. status-keyed start-border accents. */
  rowClassName?: (row: TData) => string | undefined;
  /**
   * Columns the user can cluster rows by (collapsible grouped rows). When provided,
   * a "Group by" control renders in the toolbar. Each `id` must match a column id
   * with an accessor. Pass `defaultGroupBy` to group on first render.
   */
  groupableColumns?: { id: string; label: string }[];
  /** Initial group-by column id (must be one of `groupableColumns`). */
  defaultGroupBy?: string;
  /** Initial sort. */
  initialSorting?: SortingState;
  /** URL-sync — stores sort/filter/page state in query params. Requires caller to pass the current searchParams-like pair. */
  urlState?: {
    value: URLSearchParams;
    onChange: (next: URLSearchParams) => void;
  };
  /**
   * Opt-in (CX-014): allow the user to drag-reorder columns. Off by default — all
   * existing usages render identically. Structural columns (`__select`, `actions`)
   * are pinned and never draggable.
   */
  enableColumnReorder?: boolean;
  /**
   * Opt-in (CX-014): render a toolbar Excel-export button. When set, you MUST pass
   * `onExport` — `@repo/ui` cannot import `apps/web/lib/export.ts`, so the page wires
   * the actual ExcelJS call. The button passes the current FILTERED rows plus the
   * visible (non-structural) columns' ids and headers.
   */
  exportable?: boolean;
  /** Called by the toolbar Excel button — wire to `exportToExcel` in the page. */
  onExport?: (payload: {
    rows: TData[];
    columns: { id: string; header: string }[];
  }) => void | Promise<void>;
  /**
   * Opt-in (CX-014): personal DB-backed saved views. When set, renders a "Views"
   * dropdown that lists/applies/saves/deletes view configs.
   */
  savedViews?: SavedViewsProp;
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Optional primary CTA rendered in the no-data empty state (§6.12.1) — e.g. a <Button onClick>. */
  emptyAction?: React.ReactNode;
  /** Optional icon rendered above the empty-state title. */
  emptyIcon?: React.ReactNode;
}

/* ─────────────────────────────────────────────────────────────────────────── */

function DataTableInner<TData, TValue>({
  columns: userColumns,
  data,
  loading = false,
  skeletonRows = 6,
  searchPlaceholder,
  locale = "en",
  pagination = true,
  pageSize = 10,
  enableSelection = false,
  bulkActions,
  toolbarTrailing,
  caption,
  onRowClick,
  getRowId,
  mobileCard,
  rowClassName,
  groupableColumns,
  defaultGroupBy,
  initialSorting = [],
  urlState,
  enableColumnReorder = false,
  exportable = false,
  onExport,
  savedViews,
  className,
  emptyTitle,
  emptyDescription,
  emptyAction,
  emptyIcon,
}: DataTableProps<TData, TValue>) {
  const t = locale === "ar"
    ? {
        search: "بحث",
        columns: "الأعمدة",
        density: "الكثافة",
        filter: "تصفية",
        clear: "مسح",
        noResults: emptyTitle ?? "لا توجد نتائج",
        noResultsDesc: emptyDescription ?? "جرّب تغيير فلاتر البحث.",
        rowsSelected: "صف محدد",
        page: "صفحة",
        of: "من",
        previous: "السابق",
        next: "التالي",
        compact: "مضغوط",
        default: "افتراضي",
        comfortable: "مريح",
        all: "كل الأعمدة",
        groupBy: "تجميع حسب",
        none: "بدون",
        reorderColumn: "إعادة ترتيب العمود",
        export: "تصدير Excel",
        views: "العروض",
        savedViews: "العروض المحفوظة",
        saveCurrentView: "حفظ العرض الحالي…",
        viewName: "اسم العرض",
        save: "حفظ",
        cancel: "إلغاء",
        deleteView: "حذف العرض",
        noSavedViews: "لا توجد عروض محفوظة",
      }
    : {
        search: "Search",
        columns: "Columns",
        density: "Density",
        filter: "Filter",
        clear: "Clear",
        noResults: emptyTitle ?? "No results",
        noResultsDesc: emptyDescription ?? "Try adjusting your filters.",
        rowsSelected: "selected",
        page: "Page",
        of: "of",
        previous: "Previous",
        next: "Next",
        compact: "Compact",
        default: "Default",
        comfortable: "Comfortable",
        all: "All columns",
        groupBy: "Group by",
        none: "None",
        reorderColumn: "Reorder column",
        export: "Export to Excel",
        views: "Views",
        savedViews: "Saved views",
        saveCurrentView: "Save current view…",
        viewName: "View name",
        save: "Save",
        cancel: "Cancel",
        deleteView: "Delete view",
        noSavedViews: "No saved views",
      };

  /* ── state — sort / filter / page / selection / visibility / density ── */

  const [sorting, setSorting] = React.useState<SortingState>(() => {
    if (urlState?.value.get("sort")) {
      return parseSortParam(urlState.value.get("sort") ?? "");
    }
    return initialSorting;
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState<string>(
    urlState?.value.get("q") ?? "",
  );
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(() => {
    if (enableColumnReorder && urlState?.value.get("cols")) {
      return parseColumnOrderParam(urlState.value.get("cols") ?? "");
    }
    return [];
  });
  const [density, setDensity] = React.useState<DataTableDensity>("default");
  const [grouping, setGrouping] = React.useState<GroupingState>(
    defaultGroupBy ? [defaultGroupBy] : [],
  );
  const [expanded, setExpanded] = React.useState<ExpandedState>(
    defaultGroupBy ? true : {},
  );
  const [pageIndex, setPageIndex] = React.useState<number>(() => {
    const p = Number(urlState?.value.get("page") ?? "1");
    return Number.isFinite(p) && p > 0 ? p - 1 : 0;
  });
  const [pageSizeState, setPageSizeState] = React.useState<number>(pageSize);

  /* ── URL-sync ── */

  const urlOnChange = urlState?.onChange;
  React.useEffect(() => {
    if (!urlState) return;
    const next = new URLSearchParams(urlState.value);
    const sortStr = serializeSortParam(sorting);
    if (sortStr) next.set("sort", sortStr);
    else next.delete("sort");
    if (globalFilter) next.set("q", globalFilter);
    else next.delete("q");
    if (pageIndex > 0) next.set("page", String(pageIndex + 1));
    else next.delete("page");
    if (enableColumnReorder && columnOrder.length) next.set("cols", columnOrder.join(","));
    else next.delete("cols");
    if (next.toString() !== urlState.value.toString()) urlOnChange?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting, globalFilter, pageIndex, columnOrder]);

  /* ── columns (+ selection column when enabled) ── */

  const columns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!enableSelection) return userColumns;
    const selectCol: ColumnDef<TData, TValue> = {
      id: "__select",
      enableSorting: false,
      enableHiding: false,
      size: 36,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label={locale === "ar" ? "تحديد الكل" : "Select all"}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label={locale === "ar" ? "تحديد الصف" : "Select row"}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    };
    return [selectCol, ...userColumns];
  }, [userColumns, enableSelection, locale]);

  /* ── table instance ── */

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
      columnVisibility,
      grouping,
      expanded,
      ...(enableColumnReorder ? { columnOrder } : {}),
      ...(pagination ? { pagination: { pageIndex, pageSize: pageSizeState } } : {}),
    },
    enableRowSelection: enableSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: enableColumnReorder ? setColumnOrder : undefined,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize: pageSizeState })
          : updater;
      setPageIndex(next.pageIndex);
      setPageSizeState(next.pageSize);
    },
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    ...(pagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const hasSelection = selectedRows.length > 0;

  /* ── column-reorder DnD (header-only) ── */

  // Seed columnOrder once the table knows its leaf columns (skip if a saved/URL
  // order already populated it). Reconcile-on-mount keeps any new column visible.
  const leafIds = React.useMemo(
    () => table.getAllLeafColumns().map((c) => c.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns],
  );
  React.useEffect(() => {
    if (!enableColumnReorder) return;
    setColumnOrder((prev) =>
      prev.length === 0 ? leafIds : reconcileColumnOrder(prev, leafIds),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableColumnReorder, leafIds.join(",")]);

  // Only non-pinned columns participate in the sortable context.
  const sortableIds = React.useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .map((c) => c.id)
        .filter((id) => !PINNED_COLUMN_IDS.has(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, columnOrder, columnVisibility],
  );

  const rtlKeyboardCoordinates = React.useMemo(
    () => makeRtlAwareCoordinateGetter(locale === "ar"),
    [locale],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: rtlKeyboardCoordinates }),
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setColumnOrder((prev) => {
        const base = prev.length ? prev : leafIds;
        const from = base.indexOf(active.id as string);
        const to = base.indexOf(over.id as string);
        if (from === -1 || to === -1) return base;
        return arrayMove(base, from, to);
      });
    },
    [leafIds],
  );

  const dndAnnouncements = locale === "ar"
    ? {
        onDragStart: ({ active }: { active: { id: string | number } }) =>
          `بدأ سحب العمود ${active.id}`,
        onDragOver: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
          over ? `العمود ${active.id} فوق ${over.id}` : `العمود ${active.id}`,
        onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
          over ? `تم إفلات العمود ${active.id} في موضع ${over.id}` : `تم إفلات العمود ${active.id}`,
        onDragCancel: ({ active }: { active: { id: string | number } }) =>
          `أُلغي سحب العمود ${active.id}`,
      }
    : {
        onDragStart: ({ active }: { active: { id: string | number } }) =>
          `Picked up column ${active.id}`,
        onDragOver: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
          over ? `Column ${active.id} is over ${over.id}` : `Column ${active.id}`,
        onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
          over ? `Column ${active.id} dropped over ${over.id}` : `Column ${active.id} dropped`,
        onDragCancel: ({ active }: { active: { id: string | number } }) =>
          `Reordering column ${active.id} was cancelled`,
      };

  // Props passed to <DndContext> only when column reorder is enabled (DataTableSurface).
  const dndContextProps: DndSurfaceProps = {
    sensors,
    collisionDetection: closestCenter,
    modifiers: [restrictToHorizontalAxis],
    onDragEnd: handleDragEnd,
    accessibility: { announcements: dndAnnouncements },
  };

  /* ── export ── */

  function handleExport() {
    if (!onExport) return;
    const exportColumns = table
      .getVisibleLeafColumns()
      .filter((c) => !PINNED_COLUMN_IDS.has(c.id))
      .map((c) => ({
        id: c.id,
        header:
          typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
      }));
    const rows = table.getFilteredRowModel().rows.map((r) => r.original);
    void onExport({ rows, columns: exportColumns });
  }

  /* ── saved views ── */

  function applySavedView(rawConfig: unknown) {
    const state = extractViewState(rawConfig);
    if (!state) return;
    setSorting(state.sorting ?? []);
    setColumnFilters(state.columnFilters ?? []);
    setColumnVisibility(state.columnVisibility ?? {});
    if (enableColumnReorder) {
      setColumnOrder(reconcileColumnOrder(state.columnOrder ?? [], leafIds));
    }
    if (state.density) setDensity(state.density);
    if (state.pageSize) setPageSizeState(state.pageSize);
    setPageIndex(0);
  }

  function buildCurrentViewConfig(): SavedTableViewConfig {
    return serializeTableView({
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder: enableColumnReorder
        ? (columnOrder.length ? columnOrder : leafIds)
        : [],
      density,
      pageSize: pageSizeState,
    });
  }

  /* ── render ── */

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {searchPlaceholder && (
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Input
              type="search"
              value={globalFilter}
              onChange={(e) => {
                setGlobalFilter(e.target.value);
                setPageIndex(0);
              }}
              placeholder={searchPlaceholder}
              className="h-9"
              aria-label={t.search}
            />
          </div>
        )}

        {hasSelection && bulkActions && (
          <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs">
            <span className="tabular-nums font-medium text-foreground">
              {selectedRows.length} {t.rowsSelected}
            </span>
            {bulkActions(selectedRows)}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRowSelection({})}
              aria-label={t.clear}
              style={{ display: "inline-flex" }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 ms-auto">
          {toolbarTrailing}

          {/* Saved views (CX-014) */}
          {savedViews && (
            <SavedViewsMenu
              t={t}
              views={savedViews.views}
              onApply={applySavedView}
              onCreate={(name) => savedViews.onCreate(name, buildCurrentViewConfig())}
              onDelete={savedViews.onDelete}
            />
          )}

          {/* Excel export (CX-014) */}
          {exportable && onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              style={{ display: "inline-flex" }}
            >
              <Download className="h-3.5 w-3.5 me-1" />
              {t.export}
            </Button>
          )}

          {/* Group by (clustering) */}
          {groupableColumns && groupableColumns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" style={{ display: "inline-flex" }}>
                  <Layers className="h-3.5 w-3.5 me-1" />
                  {grouping.length
                    ? groupableColumns.find((g) => g.id === grouping[0])?.label ?? t.groupBy
                    : t.groupBy}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t.groupBy}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={grouping[0] ?? "__none"}
                  onValueChange={(v) => {
                    if (v === "__none") {
                      setGrouping([]);
                      setExpanded({});
                    } else {
                      setGrouping([v]);
                      setExpanded(true);
                      setPageIndex(0);
                    }
                  }}
                >
                  <DropdownMenuRadioItem value="__none">{t.none}</DropdownMenuRadioItem>
                  {groupableColumns.map((g) => (
                    <DropdownMenuRadioItem key={g.id} value={g.id}>
                      {g.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Density */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label={t.density} style={{ display: "inline-flex" }}>
                <RowsIcon className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t.density}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={density}
                onValueChange={(v) => setDensity(v as DataTableDensity)}
              >
                <DropdownMenuRadioItem value="compact">{t.compact}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="default">{t.default}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="comfortable">{t.comfortable}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" style={{ display: "inline-flex" }}>
                {t.columns}
                <ChevronDown className="h-3.5 w-3.5 ms-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t.columns}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide() && c.id !== "__select")
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {typeof column.columnDef.header === "string"
                      ? column.columnDef.header
                      : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile cards */}
      {mobileCard && (
        <div className="md:hidden space-y-2">
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <div className="rounded-lg border border-border bg-card py-10 text-center">
              {emptyIcon && <div className="mb-3 flex justify-center text-muted-foreground/60">{emptyIcon}</div>}
              <p className="text-sm font-medium text-foreground">{t.noResults}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.noResultsDesc}</p>
              {emptyAction && <div className="mt-4 flex justify-center">{emptyAction}</div>}
            </div>
          ) : (
            table.getRowModel().rows.map((row) => (
              <div
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  "rounded-lg border border-border bg-card p-3 transition-colors",
                  onRowClick && "cursor-pointer active:bg-muted/40",
                  rowClassName?.(row.original),
                )}
              >
                {mobileCard(row.original)}
              </div>
            ))
          )}
        </div>
      )}

      {/* Desktop table */}
      <div className={cn("rounded-lg border border-border bg-card overflow-hidden", mobileCard && "hidden md:block")}>
        <div className="overflow-x-auto">
          <DataTableSurface enableColumnReorder={enableColumnReorder} dnd={dndContextProps}>
            <Table className={densityClass[density]}>
              {caption && <caption className="sr-only">{caption}</caption>}
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {enableColumnReorder ? (
                      <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
                        {group.headers.map((header) => (
                          <SortableHeaderCell
                            key={header.id}
                            header={header}
                            locale={locale}
                            filterLabel={t.filter}
                            reorderLabel={t.reorderColumn}
                            sortable={!PINNED_COLUMN_IDS.has(header.column.id)}
                          />
                        ))}
                      </SortableContext>
                    ) : (
                      group.headers.map((header) => (
                        <PlainHeaderCell
                          key={header.id}
                          header={header}
                          locale={locale}
                          filterLabel={t.filter}
                        />
                      ))
                    )}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: skeletonRows }).map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                      {columns.map((_c, j) => (
                        <TableCell key={j}>
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-16 text-center">
                      {emptyIcon && <div className="mb-3 flex justify-center text-muted-foreground/60">{emptyIcon}</div>}
                      <p className="text-sm font-medium text-foreground">{t.noResults}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t.noResultsDesc}</p>
                      {emptyAction && <div className="mt-4 flex justify-center">{emptyAction}</div>}
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    // Collapsible group header row (clustering)
                    if (row.getIsGrouped()) {
                      const groupCol = row.groupingColumnId as string;
                      return (
                        <TableRow key={row.id} className="bg-muted/40 hover:bg-muted/40">
                          <TableCell
                            colSpan={table.getVisibleLeafColumns().length}
                            className="py-2"
                          >
                            <button
                              type="button"
                              onClick={row.getToggleExpandedHandler()}
                              aria-expanded={row.getIsExpanded()}
                              className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
                              style={{ display: "inline-flex" }}
                            >
                              {row.getIsExpanded() ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground icon-directional" />
                              )}
                              <span>{String(row.getValue(groupCol) ?? "—")}</span>
                              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                                {row.subRows.length}
                              </span>
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                        className={cn(onRowClick && "cursor-pointer", rowClassName?.(row.original))}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const meta = (cell.column.columnDef.meta ?? {}) as { align?: "start" | "end" | "center"; numeric?: boolean };
                          const alignCls =
                            meta.align === "end" || meta.numeric
                              ? "text-end tabular-nums"
                              : meta.align === "center"
                                ? "text-center"
                                : "";
                          return (
                            <TableCell key={cell.id} className={alignCls}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </DataTableSurface>
        </div>
      </div>

      {/* Pagination */}
      {pagination && table.getRowModel().rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {t.page} {table.getState().pagination.pageIndex + 1} {t.of}{" "}
            {Math.max(1, table.getPageCount())}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              style={{ display: "inline-flex" }}
            >
              {t.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              style={{ display: "inline-flex" }}
            >
              {t.next}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Table surface — wraps in DndContext only when reorder is enabled ───────── */

interface DndSurfaceProps {
  sensors: ReturnType<typeof useSensors>;
  collisionDetection: typeof closestCenter;
  modifiers: Modifier[];
  onDragEnd: (event: DragEndEvent) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  accessibility: { announcements: any };
}

/**
 * Backward-compat shim: existing DataTable usages (reorder off) render with NO
 * DndContext at all — identical DOM/behavior to before CX-014. Only when
 * `enableColumnReorder` is true do we mount the DnD provider.
 */
function DataTableSurface({
  enableColumnReorder,
  dnd,
  children,
}: {
  enableColumnReorder: boolean;
  dnd: DndSurfaceProps;
  children: React.ReactNode;
}) {
  if (!enableColumnReorder) return <>{children}</>;
  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={dnd.collisionDetection}
      modifiers={dnd.modifiers}
      onDragEnd={dnd.onDragEnd}
      accessibility={dnd.accessibility}
    >
      {children}
    </DndContext>
  );
}

/* ─── Header cells ──────────────────────────────────────────────────────────── */

function headerAlignClass(meta: { align?: "start" | "end" | "center"; numeric?: boolean }): string {
  return meta.align === "end" || meta.numeric
    ? "text-end"
    : meta.align === "center"
      ? "text-center"
      : "text-start";
}

/** Inner header content shared by both header-cell variants (no DnD concerns). */
function HeaderCellInner<TData, TValue>({
  header,
  locale,
  filterLabel,
  alignCls,
  dragHandle,
}: {
  header: Header<TData, TValue>;
  locale: "ar" | "en";
  filterLabel: string;
  alignCls: string;
  dragHandle?: React.ReactNode;
}) {
  const column = header.column;
  const canSort = column.getCanSort();
  const sort = column.getIsSorted();
  const canFilter = column.getCanFilter() && column.id !== "__select";

  return (
    <div className={cn("inline-flex items-center gap-1", alignCls === "text-end" && "flex-row-reverse")}>
      {dragHandle}
      {canSort ? (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          aria-label={locale === "ar" ? "فرز" : "Sort"}
          className="inline-flex items-center gap-1 cursor-pointer select-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
        >
          {header.isPlaceholder
            ? null
            : flexRender(column.columnDef.header, header.getContext())}
          <span className="text-muted-foreground">
            {sort === "asc" ? (
              <ChevronUp className="h-3 w-3" />
            ) : sort === "desc" ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-60" />
            )}
          </span>
        </button>
      ) : (
        <span>
          {header.isPlaceholder
            ? null
            : flexRender(column.columnDef.header, header.getContext())}
        </span>
      )}
      {canFilter && (
        <ColumnFilterPopover
          value={(column.getFilterValue() as string) ?? ""}
          onChange={(v) => column.setFilterValue(v || undefined)}
          label={filterLabel}
        />
      )}
    </div>
  );
}

/** Plain header cell — used when column reorder is OFF (no dnd-kit hook). */
function PlainHeaderCell<TData, TValue>({
  header,
  locale,
  filterLabel,
}: {
  header: Header<TData, TValue>;
  locale: "ar" | "en";
  filterLabel: string;
}) {
  const meta = (header.column.columnDef.meta ?? {}) as { align?: "start" | "end" | "center"; numeric?: boolean };
  const alignCls = headerAlignClass(meta);
  return (
    <TableHead className={alignCls}>
      <HeaderCellInner header={header} locale={locale} filterLabel={filterLabel} alignCls={alignCls} />
    </TableHead>
  );
}

/** Sortable (drag-reorderable) header cell — used when column reorder is ON. */
function SortableHeaderCell<TData, TValue>({
  header,
  locale,
  filterLabel,
  reorderLabel,
  sortable,
}: {
  header: Header<TData, TValue>;
  locale: "ar" | "en";
  filterLabel: string;
  reorderLabel: string;
  /** When true the column may be drag-reordered (non-pinned). */
  sortable: boolean;
}) {
  const column = header.column;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, disabled: !sortable });

  const meta = (column.columnDef.meta ?? {}) as { align?: "start" | "end" | "center"; numeric?: boolean };
  const alignCls = headerAlignClass(meta);

  // CSS.Translate (not Transform) — avoids the squish/scale artifact on columns.
  const style: React.CSSProperties = sortable
    ? {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : undefined,
        zIndex: isDragging ? 1 : undefined,
        position: "relative",
      }
    : {};

  const dragHandle = sortable ? (
    <IconButton
      icon={GripVertical}
      aria-label={reorderLabel}
      variant="ghost"
      className="cursor-grab text-muted-foreground/60 hover:text-foreground active:cursor-grabbing touch-none"
      {...attributes}
      {...listeners}
    />
  ) : undefined;

  return (
    <TableHead ref={sortable ? setNodeRef : undefined} className={alignCls} style={style}>
      <HeaderCellInner
        header={header}
        locale={locale}
        filterLabel={filterLabel}
        alignCls={alignCls}
        dragHandle={dragHandle}
      />
    </TableHead>
  );
}

/* ─── Saved-views menu (CX-014) ──────────────────────────────────────────────── */

interface SavedViewsLabels {
  views: string;
  savedViews: string;
  saveCurrentView: string;
  viewName: string;
  save: string;
  cancel: string;
  deleteView: string;
  noSavedViews: string;
}

function SavedViewsMenu({
  t,
  views,
  onApply,
  onCreate,
  onDelete,
}: {
  t: SavedViewsLabels;
  views: SavedTableViewItem[];
  onApply: (config: unknown) => void;
  onCreate: (name: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (saving) inputRef.current?.focus();
  }, [saving]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate(trimmed);
    setName("");
    setSaving(false);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" style={{ display: "inline-flex" }}>
          <Save className="h-3.5 w-3.5 me-1" />
          {t.views}
          <ChevronDown className="h-3.5 w-3.5 ms-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{t.savedViews}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">{t.noSavedViews}</p>
        ) : (
          views.map((view) => (
            <div
              key={view.id}
              className="flex items-center gap-1 px-1"
            >
              <DropdownMenuItem
                className="flex-1"
                onSelect={(e) => {
                  e.preventDefault();
                  onApply(view.config);
                }}
              >
                <Check className="h-3.5 w-3.5 me-2 opacity-0" />
                <span className="truncate">{view.name}</span>
              </DropdownMenuItem>
              <IconButton
                icon={Trash2}
                aria-label={t.deleteView}
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void onDelete(view.id);
                }}
              />
            </div>
          ))
        )}
        <DropdownMenuSeparator />
        {saving ? (
          <div className="p-2" onKeyDown={(e) => e.stopPropagation()}>
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setSaving(false);
                  setName("");
                }
              }}
              placeholder={t.viewName}
              className="h-8 text-sm"
              aria-label={t.viewName}
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSaving(false);
                  setName("");
                }}
                style={{ display: "inline-flex" }}
              >
                {t.cancel}
              </Button>
              <Button
                size="sm"
                onClick={() => void submit()}
                disabled={!name.trim()}
                style={{ display: "inline-flex" }}
              >
                {t.save}
              </Button>
            </div>
          </div>
        ) : (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setSaving(true);
            }}
          >
            <Save className="h-3.5 w-3.5 me-2" />
            {t.saveCurrentView}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Column filter popover ─────────────────────────────────────────────── */

function ColumnFilterPopover({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "p-0.5 rounded text-muted-foreground hover:text-foreground",
            value && "text-primary",
          )}
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-3" align="start">
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          className="h-8 text-sm"
        />
      </PopoverContent>
    </Popover>
  );
}

/* ─── RTL-aware keyboard coordinate getter ──────────────────────────────────── */

/**
 * dnd-kit's `sortableKeyboardCoordinates` is purely geometric — ArrowLeft always
 * moves left in screen space, which feels inverted for an RTL column strip. When
 * `rtl` is true we swap ArrowLeft ↔ ArrowRight before delegating so the keys match
 * the logical reading direction. Up/Down are passed through unchanged.
 */
function makeRtlAwareCoordinateGetter(rtl: boolean): KeyboardCoordinateGetter {
  if (!rtl) return sortableKeyboardCoordinates;
  return (event, args) => {
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      const swappedCode = event.code === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";
      const swapped = new KeyboardEvent(event.type, {
        key: swappedCode === "ArrowRight" ? "ArrowRight" : "ArrowLeft",
        code: swappedCode,
        bubbles: event.bubbles,
        cancelable: event.cancelable,
      });
      return sortableKeyboardCoordinates(swapped, args);
    }
    return sortableKeyboardCoordinates(event, args);
  };
}

/* ─── Saved-view config helpers ─────────────────────────────────────────────── */

/** Pull a `SavedTableViewState` out of a stored config blob (tolerant of shape). */
function extractViewState(rawConfig: unknown): SavedTableViewState | null {
  if (!rawConfig || typeof rawConfig !== "object") return null;
  const cfg = rawConfig as { state?: unknown } & Partial<SavedTableViewState>;
  // Versioned blob: { v: 1, state: {...} }. Fall back to a bare state object.
  const state = (cfg.state ?? cfg) as Partial<SavedTableViewState>;
  if (!state || typeof state !== "object") return null;
  return {
    sorting: Array.isArray(state.sorting) ? state.sorting : [],
    columnFilters: Array.isArray(state.columnFilters) ? state.columnFilters : [],
    columnVisibility:
      state.columnVisibility && typeof state.columnVisibility === "object"
        ? state.columnVisibility
        : {},
    columnOrder: Array.isArray(state.columnOrder) ? state.columnOrder : [],
    density: (state.density as DataTableDensity) ?? "default",
    pageSize: typeof state.pageSize === "number" ? state.pageSize : 10,
  };
}

/* ─── URL-param serialization ───────────────────────────────────────────── */

function serializeSortParam(sorting: SortingState): string {
  return sorting.map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`).join(",");
}

function parseSortParam(str: string): SortingState {
  if (!str) return [];
  return str
    .split(",")
    .map((part) => {
      const [id, dir] = part.split(":");
      if (!id) return null;
      return { id, desc: dir === "desc" };
    })
    .filter(Boolean) as SortingState;
}

function parseColumnOrderParam(str: string): ColumnOrderState {
  if (!str) return [];
  return str.split(",").map((s) => s.trim()).filter(Boolean);
}

/* ─────────────────────────────────────────────────────────────────────────── */

export const DataTable = DataTableInner;

// Re-exported for callers that want to inspect/transform the table type.
export type { Column as DataTableColumn, TanstackTable as DataTableInstance };
