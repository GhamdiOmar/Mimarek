/* ─── Mimaric Custom Components ─────────────────────────────── */
/* These take precedence over shadcn primitives where names overlap */
export * from "./components/Button";
export * from "./components/Input";
export * from "./components/Badge";
export * from "./components/SARAmount";
export * from "./components/Skeleton";
export * from "./components/EmptyState";
export * from "./components/KPICard";
export * from "./components/Dialog";
export * from "./components/Select";
export * from "./components/Popover";
export * from "./components/Tabs";
export * from "./components/Toast";

/* ─── New Design System Components ────────────────────────── */
export * from "./components/PageHeader";
export * from "./components/FilterBar";
export * from "./components/StatusBadge";
export * from "./components/StatCard";
export * from "./components/DataTable";
export * from "./components/FormSection";
export * from "./components/FormField"; /* exports FieldWrapper */
export * from "./components/PageIntro";
export * from "./components/DirectionalIcon";
export * from "./components/DateRangePicker";
export * from "./components/LastUpdatedAgo";

/* ─── Saudi Input Primitives ──────────────────────────────── */
export * from "./components/saudi";

/* ─── Shadcn Primitives (no overlap with above) ───────────── */
export * from "./primitives/accordion";
export * from "./primitives/alert";
export * from "./primitives/alert-dialog";
export * from "./primitives/aspect-ratio";
export * from "./primitives/avatar";
export * from "./primitives/breadcrumb";
export * from "./primitives/calendar";
export * from "./primitives/card";
export * from "./primitives/carousel";
export * from "./primitives/chart";
export * from "./primitives/checkbox";
export * from "./primitives/collapsible";
export * from "./primitives/command";
export * from "./primitives/context-menu";
export * from "./primitives/drawer";
export * from "./primitives/dropdown-menu";
export * from "./primitives/form";
export * from "./primitives/hover-card";
export * from "./primitives/input-otp";
export * from "./primitives/label";
export * from "./primitives/menubar";
export * from "./primitives/navigation-menu";
export * from "./primitives/pagination";
export * from "./primitives/progress";
export * from "./primitives/radio-group";
export * from "./primitives/resizable";
export * from "./primitives/scroll-area";
export * from "./primitives/separator";
export * from "./primitives/sheet";
export * from "./primitives/sidebar";
export * from "./primitives/slider";
export * from "./primitives/switch";
export * from "./primitives/table";
export * from "./primitives/textarea";
export * from "./primitives/toggle";
export * from "./primitives/toggle-group";
export * from "./primitives/tooltip";

/* ─── Mobile Primitives ───────────────────────────────────── */
export * from "./components/mobile/BottomSheet";
export * from "./components/mobile/ResponsiveDialog";
export * from "./components/mobile/FAB";

/* ─── Mobile Primitives (Phase 1) ─────────────────────────── */
export * from "./components/mobile/MobileShell";
export * from "./components/mobile/AppBar";
export * from "./components/mobile/BottomNav";

/* ─── Mobile Content Primitives ───────────────────────────── */
export * from "./components/mobile/DataCard";
export * from "./components/mobile/MobileTabs";
export * from "./components/mobile/MobileKanban";
export * from "./components/mobile/MetricTile";

/* ─── Mobile v2 Primitives ────────────────────────────────── */
export * from "./components/mobile/MobileKPICard";
export * from "./components/mobile/PropertyCard";
export * from "./components/mobile/CustomerCard";
export * from "./components/mobile/QuickActionRail";
export * from "./components/mobile/ApprovalRow";
export * from "./components/mobile/ActivityTimeline";

/* ─── Hooks ────────────────────────────────────────────────── */
export * from "./hooks/use-mobile";

/* ─── Icons ────────────────────────────────────────────────── */
export * from "./icons/RiyalIcon";

/* ─── Utilities ────────────────────────────────────────────── */
export * from "./lib/utils";
export * from "./lib/format-sar";
