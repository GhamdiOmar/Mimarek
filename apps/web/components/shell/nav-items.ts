import type { Permission } from "../../lib/permissions";

export interface NavItem {
  label: { ar: string; en: string };
  icon: string; // Lucide icon name
  href: string;
  section: "core" | "operations" | "system";
  permission?: Permission;
  /** "tenant" = hide from platform staff; "platform" = hide from tenant users; omit = show to all */
  audience?: "tenant" | "platform";
  /** true = exclude from primary nav surfaces (sidebar + mobile More). Still surfaced in Cmd-K and breadcrumbs. */
  hiddenFromNav?: boolean;
}

export const navItems: NavItem[] = [
  // Core — tenant only
  { label: { ar: "الرئيسية", en: "Dashboard" }, icon: "LayoutGrid", href: "/dashboard", section: "core", permission: "dashboard:read", audience: "tenant" },
  { label: { ar: "لوحة التأجير", en: "Leasing" }, icon: "ClipboardList", href: "/dashboard/leasing", section: "core", permission: "dashboard:read", audience: "tenant" },
  { label: { ar: "المالية", en: "Finance" }, icon: "Wallet", href: "/dashboard/finance", section: "core", permission: "dashboard:read", audience: "tenant" },
  { label: { ar: "إدارة العملاء", en: "CRM" }, icon: "Users", href: "/dashboard/crm", section: "core", permission: "crm:read", audience: "tenant" },
  { label: { ar: "العقارات", en: "Properties" }, icon: "Building2", href: "/dashboard/units", section: "core", permission: "properties:read", audience: "tenant" },
  { label: { ar: "الصفقات", en: "Deals" }, icon: "TrendingUp", href: "/dashboard/deals", section: "core", permission: "deals:read", audience: "tenant" },
  { label: { ar: "العقود", en: "Contracts" }, icon: "FileText", href: "/dashboard/contracts", section: "core", permission: "contracts:read", audience: "tenant" },

  // Operations — tenant only
  { label: { ar: "المدفوعات", en: "Payments" }, icon: "CreditCard", href: "/dashboard/payments", section: "operations", permission: "payments:read", audience: "tenant" },
  { label: { ar: "الصيانة", en: "Maintenance" }, icon: "Wrench", href: "/dashboard/maintenance", section: "operations", permission: "maintenance:read", audience: "tenant" },
  // Sub-sections of Maintenance — exposed via the sub-tab bar inside /dashboard/maintenance
  // and Cmd-K search, but not as separate sidebar entries (IA: one top-level per workflow).
  { label: { ar: "تذاكر الصيانة", en: "Maintenance · Tickets" }, icon: "ClipboardList", href: "/dashboard/maintenance/tickets", section: "operations", permission: "maintenance:read", audience: "tenant", hiddenFromNav: true },
  { label: { ar: "الصيانة الوقائية", en: "Maintenance · Preventive" }, icon: "CalendarCheck", href: "/dashboard/maintenance/preventive", section: "operations", permission: "maintenance:read", audience: "tenant", hiddenFromNav: true },

  // System
  { label: { ar: "الاشتراك والفوترة", en: "Billing" }, icon: "Receipt", href: "/dashboard/billing", section: "system", permission: "billing:read", audience: "tenant" },
  { label: { ar: "إدارة المنصة", en: "Admin" }, icon: "ShieldCheck", href: "/dashboard/admin", section: "system", permission: "billing:admin", audience: "platform" },
  { label: { ar: "إعدادات SEO", en: "SEO Settings" }, icon: "SearchCheck", href: "/dashboard/admin/seo", section: "system", permission: "billing:admin", audience: "platform" },
  { label: { ar: "تذاكر الدعم", en: "Support Tickets" }, icon: "TicketCheck", href: "/dashboard/admin/tickets", section: "system", permission: "billing:admin", audience: "platform" },
  { label: { ar: "الإعدادات", en: "Settings" }, icon: "Settings", href: "/dashboard/settings", section: "system", permission: "organization:read" },
];

export const breadcrumbLabels: Record<string, { ar: string; en: string }> = {
  "": { ar: "الرئيسية", en: "Dashboard" },
  "crm": { ar: "إدارة العملاء", en: "CRM" },
  "properties": { ar: "العقارات", en: "Properties" },
  "deals": { ar: "الصفقات", en: "Deals" },
  "contracts": { ar: "العقود", en: "Contracts" },
  "payments": { ar: "المدفوعات", en: "Payments" },
  "maintenance": { ar: "الصيانة", en: "Maintenance" },
  "leasing": { ar: "لوحة التأجير", en: "Leasing" },
  "finance": { ar: "المالية", en: "Finance" },
  "settings": { ar: "الإعدادات", en: "Settings" },
  "team": { ar: "الفريق", en: "Team" },
  "security": { ar: "الأمان", en: "Security" },
  "audit": { ar: "السجل", en: "Audit" },
  "billing": { ar: "الفوترة", en: "Billing" },
  "plans": { ar: "الباقات", en: "Plans" },
  "invoices": { ar: "الفواتير", en: "Invoices" },
  "admin": { ar: "إدارة المنصة", en: "Admin" },
  "seo": { ar: "إعدادات SEO", en: "SEO Settings" },
  "coupons": { ar: "الكوبونات", en: "Coupons" },
  "subscriptions": { ar: "الاشتراكات", en: "Subscriptions" },
  "help": { ar: "المساعدة", en: "Help" },
  "new": { ar: "جديد", en: "New" },
  "onboarding": { ar: "التهيئة", en: "Onboarding" },
  "tickets": { ar: "التذاكر", en: "Tickets" },
  "overview": { ar: "نظرة عامة", en: "Overview" },
  "preventive": { ar: "الصيانة الوقائية", en: "Preventive" },
  "documents": { ar: "المستندات", en: "Documents" },
  "payment-plan": { ar: "خطة الدفع", en: "Payment Plan" },
  "templates": { ar: "القوالب", en: "Templates" },
  "statement": { ar: "كشف حساب", en: "Statement" },
  "preview": { ar: "معاينة", en: "Preview" },
  "import": { ar: "استيراد", en: "Import" },
  "change-requests": { ar: "طلبات التعديل", en: "Change Requests" },
};

export const roleLabels: Record<string, { ar: string; en: string }> = {
  SYSTEM_ADMIN: { ar: "مدير المنصة", en: "System Admin" },
  SYSTEM_SUPPORT: { ar: "دعم المنصة", en: "System Support" },
  ADMIN: { ar: "مدير", en: "Admin" },
  MANAGER: { ar: "مدير عمليات", en: "Manager" },
  AGENT: { ar: "وكيل", en: "Agent" },
  LEASING: { ar: "مسؤول تأجير", en: "Leasing" },
  FINANCE: { ar: "محاسب مالي", en: "Finance" },
  TECHNICIAN: { ar: "فني صيانة", en: "Technician" },
  USER: { ar: "مستخدم", en: "User" },
};

export const sectionLabels: Record<string, { ar: string; en: string }> = {
  core: { ar: "الأساسية", en: "Core" },
  operations: { ar: "العمليات", en: "Operations" },
  system: { ar: "النظام", en: "System" },
};
