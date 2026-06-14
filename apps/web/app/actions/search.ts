"use server";

import { db } from "@repo/db";
import { getSessionOrThrow } from "../../lib/auth-helpers";
import { hasPermission, isSystemRole } from "../../lib/permissions";
import { logAuditEvent } from "../../lib/audit";
import { decryptCustomerList, phoneSearchHash } from "../../lib/pii-crypto";
import { maskCustomerPii, maskPhone } from "../../lib/pii-masking";
import { hashForSearch } from "../../lib/encryption";
import {
  CONTRACT_STATUS_LABEL,
  RESERVATION_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  MAINTENANCE_STATUS_LABEL,
} from "../../lib/domain-labels";
import type { SearchGroup, SearchHit, SearchResult } from "../../lib/search-types";

// Per-group render cap. We query `take: PAGE` (= CAP + 1) so a full page tells us
// there is more to see ("See all →") without a second count query.
const CAP = 5;
const PAGE = CAP + 1;

type Lang = "ar" | "en";

/**
 * Federated record search (CX-002).
 *
 * Finds a customer by name / Arabic name / phone / email / national-ID (the last
 * three via blind index over encrypted columns — same OR-query as
 * customers.getCustomers), plus units, contracts, reservations, payments,
 * maintenance tickets and documents — all tenant-scoped to the caller's org.
 *
 * §8 audience gate: returns an empty result for system/no-org sessions (they have
 * no tenant surfaces). Uses getSessionOrThrow (NOT requirePermission) so an
 * org-less system user gets a graceful empty result rather than a thrown error.
 *
 * Each entity query is individually gated on the caller's read permission so a
 * user never sees records for a surface they can't open.
 *
 * PII: customer contact values are decrypted then ALWAYS masked for display
 * (`***4567`); raw phone/email/national-ID never enter the returned payload.
 */
export async function globalSearch(
  query: string,
  lang: Lang = "en",
): Promise<SearchResult> {
  const session = await getSessionOrThrow();

  // §8 server gate — system users / org-less sessions have no tenant surfaces.
  if (isSystemRole(session.role) || !session.organizationId) {
    return { groups: [] };
  }

  const orgId = session.organizationId;
  const q = query.trim();
  if (q.length < 2) return { groups: [] };

  const can = (perm: Parameters<typeof hasPermission>[1]) =>
    hasPermission(session.role, perm);
  const hasPiiAccess = can("customers:read_pii");

  // Blind-index keys (mirror customers.getCustomers exactly so encrypted
  // phone/email/nationalId match whether typed as 05… or +966… etc.).
  const searchHash = hashForSearch(q);
  const phoneHash = phoneSearchHash(q);

  const groups: SearchGroup[] = [];
  let totalCount = 0;

  // Run every permitted entity query in parallel; skip entirely when not allowed.
  const [
    customers,
    units,
    contracts,
    reservations,
    payments,
    maintenance,
    documents,
  ] = await Promise.all([
    can("customers:read")
      ? db.customer.findMany({
          where: {
            organizationId: orgId,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { nameArabic: { contains: q, mode: "insensitive" } },
              { phoneHash },
              { emailHash: searchHash },
              { nationalIdHash: searchHash },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: PAGE,
        })
      : Promise.resolve(null),

    can("units:read")
      ? db.unit.findMany({
          where: {
            organizationId: orgId,
            OR: [
              { number: { contains: q, mode: "insensitive" } },
              { buildingName: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, number: true, buildingName: true, city: true },
          orderBy: { updatedAt: "desc" },
          take: PAGE,
        })
      : Promise.resolve(null),

    can("contracts:read")
      ? db.contract.findMany({
          // Contract has no direct organizationId — scope via customer's org
          // (same as getContracts).
          where: {
            customer: { organizationId: orgId },
            OR: [
              { id: { contains: q } },
              { contractNumber: { contains: q, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            contractNumber: true,
            status: true,
            customer: { select: { name: true, nameArabic: true } },
          },
          orderBy: { createdAt: "desc" },
          take: PAGE,
        })
      : Promise.resolve(null),

    can("deals:read")
      ? db.reservation.findMany({
          // Reservation has no direct organizationId — scope via customer's org.
          where: {
            customer: { organizationId: orgId },
            OR: [
              { id: { contains: q } },
              { unit: { number: { contains: q, mode: "insensitive" } } },
              { customer: { name: { contains: q, mode: "insensitive" } } },
              { customer: { nameArabic: { contains: q, mode: "insensitive" } } },
            ],
          },
          select: {
            id: true,
            status: true,
            unit: { select: { number: true } },
            customer: { select: { name: true, nameArabic: true } },
          },
          orderBy: { createdAt: "desc" },
          take: PAGE,
        })
      : Promise.resolve(null),

    can("payments:read")
      ? db.rentInstallment.findMany({
          // RentInstallment scopes via lease → customer → org (same as getInstallments).
          where: {
            lease: { customer: { organizationId: orgId } },
            OR: [
              { referenceNumber: { contains: q, mode: "insensitive" } },
              { paymentReference: { contains: q, mode: "insensitive" } },
              {
                lease: {
                  customer: { name: { contains: q, mode: "insensitive" } },
                },
              },
              { lease: { unit: { number: { contains: q, mode: "insensitive" } } } },
            ],
          },
          select: {
            id: true,
            status: true,
            referenceNumber: true,
            lease: {
              select: {
                customer: { select: { name: true, nameArabic: true } },
                unit: { select: { number: true } },
              },
            },
          },
          orderBy: { dueDate: "desc" },
          take: PAGE,
        })
      : Promise.resolve(null),

    can("maintenance:read")
      ? db.maintenanceRequest.findMany({
          where: {
            organizationId: orgId,
            OR: [
              { id: { contains: q } },
              { title: { contains: q, mode: "insensitive" } },
              { unit: { number: { contains: q, mode: "insensitive" } } },
            ],
          },
          select: {
            id: true,
            title: true,
            status: true,
            unit: { select: { number: true } },
          },
          orderBy: { createdAt: "desc" },
          take: PAGE,
        })
      : Promise.resolve(null),

    can("documents:read")
      ? db.document.findMany({
          where: {
            organizationId: orgId,
            name: { contains: q, mode: "insensitive" },
          },
          select: { id: true, name: true, category: true },
          orderBy: { createdAt: "desc" },
          take: PAGE,
        })
      : Promise.resolve(null),
  ]);

  // Pack a query group with cap + hasMore, tracking the running total for audit.
  function pack(type: SearchGroup["type"], hits: SearchHit[], rawCount: number) {
    if (hits.length === 0) return;
    totalCount += hits.length;
    groups.push({ type, hits, hasMore: rawCount > CAP });
  }

  // ── Customers ── decrypt → ALWAYS mask for display (search is high-exposure).
  if (customers) {
    const decrypted = decryptCustomerList(customers);
    const hits: SearchHit[] = decrypted.slice(0, CAP).map((c) => {
      const masked = maskCustomerPii(c, hasPiiAccess);
      const title =
        lang === "ar"
          ? c.nameArabic || c.name
          : c.name || c.nameArabic || "";
      return {
        id: c.id,
        type: "customer" as const,
        title,
        maskedPii: maskPhone(masked.phone as string | null | undefined) || undefined,
        href: `/dashboard/crm?q=${encodeURIComponent(q)}`,
      };
    });
    pack("customer", hits, customers.length);
  }

  // ── Units ──
  if (units) {
    const hits: SearchHit[] = units.slice(0, CAP).map((u) => ({
      id: u.id,
      type: "unit" as const,
      title: u.number,
      subtitle: [u.buildingName, u.city].filter(Boolean).join(" · ") || undefined,
      href: `/dashboard/units?q=${encodeURIComponent(q)}`,
    }));
    pack("unit", hits, units.length);
  }

  // ── Contracts ──
  if (contracts) {
    const hits: SearchHit[] = contracts.slice(0, CAP).map((c) => {
      const customerName =
        lang === "ar"
          ? c.customer.nameArabic || c.customer.name
          : c.customer.name || c.customer.nameArabic || "";
      const statusLabel = CONTRACT_STATUS_LABEL[c.status]?.[lang] ?? c.status;
      return {
        id: c.id,
        type: "contract" as const,
        title: c.contractNumber || c.id,
        subtitle: [customerName, statusLabel].filter(Boolean).join(" · ") || undefined,
        href: `/dashboard/contracts?q=${encodeURIComponent(q)}`,
      };
    });
    pack("contract", hits, contracts.length);
  }

  // ── Reservations ──
  if (reservations) {
    const hits: SearchHit[] = reservations.slice(0, CAP).map((r) => {
      const customerName =
        lang === "ar"
          ? r.customer.nameArabic || r.customer.name
          : r.customer.name || r.customer.nameArabic || "";
      const statusLabel = RESERVATION_STATUS_LABEL[r.status]?.[lang] ?? r.status;
      const unitPart = r.unit?.number
        ? (lang === "ar" ? `وحدة ${r.unit.number}` : `Unit ${r.unit.number}`)
        : "";
      return {
        id: r.id,
        type: "reservation" as const,
        title: customerName || r.id,
        subtitle: [unitPart, statusLabel].filter(Boolean).join(" · ") || undefined,
        href: `/dashboard/reservations?q=${encodeURIComponent(q)}`,
      };
    });
    pack("reservation", hits, reservations.length);
  }

  // ── Payments (rent installments) ──
  if (payments) {
    const hits: SearchHit[] = payments.slice(0, CAP).map((p) => {
      const customerName =
        lang === "ar"
          ? p.lease.customer.nameArabic || p.lease.customer.name
          : p.lease.customer.name || p.lease.customer.nameArabic || "";
      const statusLabel = PAYMENT_STATUS_LABEL[p.status]?.[lang] ?? p.status;
      const unitPart = p.lease.unit?.number
        ? (lang === "ar" ? `وحدة ${p.lease.unit.number}` : `Unit ${p.lease.unit.number}`)
        : "";
      return {
        id: p.id,
        type: "payment" as const,
        title: p.referenceNumber || customerName || p.id,
        subtitle: [customerName, unitPart, statusLabel].filter(Boolean).join(" · ") || undefined,
        href: `/dashboard/payments?q=${encodeURIComponent(q)}`,
      };
    });
    pack("payment", hits, payments.length);
  }

  // ── Maintenance ── this one HAS a real detail route.
  if (maintenance) {
    const hits: SearchHit[] = maintenance.slice(0, CAP).map((m) => {
      const statusLabel = MAINTENANCE_STATUS_LABEL[m.status]?.[lang] ?? m.status;
      const unitPart = m.unit?.number
        ? (lang === "ar" ? `وحدة ${m.unit.number}` : `Unit ${m.unit.number}`)
        : "";
      return {
        id: m.id,
        type: "maintenance" as const,
        title: m.title || m.id,
        subtitle: [unitPart, statusLabel].filter(Boolean).join(" · ") || undefined,
        href: `/dashboard/maintenance/${m.id}`,
      };
    });
    pack("maintenance", hits, maintenance.length);
  }

  // ── Documents ──
  if (documents) {
    const hits: SearchHit[] = documents.slice(0, CAP).map((d) => ({
      id: d.id,
      type: "document" as const,
      title: d.name,
      subtitle: d.category || undefined,
      href: `/dashboard/documents?q=${encodeURIComponent(q)}`,
    }));
    pack("document", hits, documents.length);
  }

  // Audit every search — PII-exposure level depends on whether the caller can
  // read unmasked customer PII (mirrors customers.getCustomers).
  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: hasPiiAccess ? "READ_PII" : "READ",
    resource: "Search",
    metadata: { count: totalCount },
    organizationId: orgId,
  });

  return { groups };
}
