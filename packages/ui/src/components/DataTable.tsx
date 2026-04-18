"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, ChevronUp, Filter, RowsIcon, X } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./Button";
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

const densityClass: Record<DataTableDensity, string> = {
  compact: "[&_td]:py-1.5 [&_th]:py-2",
  default: "[&_td]:py-3 [&_th]:py-3",
  comfortable: "[&_td]:py-5 [&_th]:py-4",
};

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
  /** Initial sort. */
  initialSorting?: SortingState;
  /** URL-sync — stores sort/filter/page state in query params. Requires caller to pass the current searchParams-like pair. */
  urlState?: {
    value: URLSearchParams;
    onChange: (next: URLSearchParams) => void;
  };
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
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
  initialSorting = [],
  urlState,
  className,
  emptyTitle,
  emptyDescription,
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
  const [density, setDensity] = React.useState<DataTableDensity>("default");
  const [pageIndex, setPageIndex] = React.useState<number>(() => {
    const p = Number(urlState?.value.get("page") ?? "1");
    return Number.isFinite(p) && p > 0 ? p - 1 : 0;
  });

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
    if (next.toString() !== urlState.value.toString()) urlOnChange?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting, globalFilter, pageIndex]);

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
      ...(pagination ? { pagination: { pageIndex, pageSize } } : {}),
    },
    enableRowSelection: enableSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize })
          : updater;
      setPageIndex(next.pageIndex);
    },
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const hasSelection = selectedRows.length > 0;

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
              <p className="text-sm font-medium text-foreground">{t.noResults}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.noResultsDesc}</p>
            </div>
          ) : (
            table.getRowModel().rows.map((row) => (
              <div
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  "rounded-lg border border-border bg-card p-3 transition-colors",
                  onRowClick && "cursor-pointer active:bg-muted/40",
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
          <Table className={densityClass[density]}>
            {caption && <caption className="sr-only">{caption}</caption>}
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sort = header.column.getIsSorted();
                    const canFilter = header.column.getCanFilter() && header.column.id !== "__select";
                    const meta = (header.column.columnDef.meta ?? {}) as { align?: "start" | "end" | "center"; numeric?: boolean };
                    const alignCls =
                      meta.align === "end" || meta.numeric
                        ? "text-end"
                        : meta.align === "center"
                          ? "text-center"
                          : "text-start";
                    return (
                      <TableHead key={header.id} className={alignCls}>
                        <div className={cn("inline-flex items-center gap-1", alignCls === "text-end" && "flex-row-reverse")}>
                          <span
                            className={cn(canSort && "cursor-pointer select-none hover:text-foreground")}
                            onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {canSort && (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              aria-label={locale === "ar" ? "فرز" : "Sort"}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {sort === "asc" ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : sort === "desc" ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-60" />
                              )}
                            </button>
                          )}
                          {canFilter && (
                            <ColumnFilterPopover
                              value={(header.column.getFilterValue() as string) ?? ""}
                              onChange={(v) => header.column.setFilterValue(v || undefined)}
                              label={t.filter}
                            />
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
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
                    <p className="text-sm font-medium text-foreground">{t.noResults}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t.noResultsDesc}</p>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn(onRowClick && "cursor-pointer")}
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
                ))
              )}
            </TableBody>
          </Table>
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

/* ─────────────────────────────────────────────────────────────────────────── */

export const DataTable = DataTableInner;
