import type { ComponentType } from "react";
import {
  Users,
  Building2,
  FileText,
  CalendarCheck,
  CreditCard,
  Wrench,
  Receipt,
} from "lucide-react";
import type { SearchEntityType } from "./search-types";

// Single source of truth for the federated-search entity presentation (CX-002):
// icon + bilingual group label + the "See all →" list route. Imported by all
// three search surfaces (Cmd-K palette, top-bar dropdown, mobile sheet) so a
// label correction or route change happens in ONE place.

type IconType = ComponentType<{ className?: string }>;

export interface SearchEntityMeta {
  icon: IconType;
  label: { ar: string; en: string };
  /** List route for "See all →", with the query pre-applied. */
  listHref: (q: string) => string;
}

export const SEARCH_ENTITY_META: Record<SearchEntityType, SearchEntityMeta> = {
  customer: {
    icon: Users,
    label: { ar: "العملاء", en: "Customers" },
    listHref: (q) => `/dashboard/crm?q=${encodeURIComponent(q)}`,
  },
  unit: {
    icon: Building2,
    label: { ar: "الوحدات", en: "Units" },
    listHref: (q) => `/dashboard/units?q=${encodeURIComponent(q)}`,
  },
  contract: {
    icon: FileText,
    label: { ar: "العقود", en: "Contracts" },
    listHref: (q) => `/dashboard/contracts?q=${encodeURIComponent(q)}`,
  },
  reservation: {
    icon: CalendarCheck,
    label: { ar: "الحجوزات", en: "Reservations" },
    listHref: (q) => `/dashboard/reservations?q=${encodeURIComponent(q)}`,
  },
  payment: {
    icon: CreditCard,
    label: { ar: "المدفوعات", en: "Payments" },
    listHref: (q) => `/dashboard/payments?q=${encodeURIComponent(q)}`,
  },
  maintenance: {
    icon: Wrench,
    label: { ar: "الصيانة", en: "Maintenance" },
    listHref: (q) => `/dashboard/maintenance?q=${encodeURIComponent(q)}`,
  },
  document: {
    icon: Receipt,
    label: { ar: "المستندات", en: "Documents" },
    listHref: (q) => `/dashboard/documents?q=${encodeURIComponent(q)}`,
  },
};

/** Fixed, intent-based group order (stable for keyboard muscle memory). */
export const SEARCH_ENTITY_ORDER: SearchEntityType[] = [
  "customer",
  "unit",
  "contract",
  "reservation",
  "payment",
  "maintenance",
  "document",
];
