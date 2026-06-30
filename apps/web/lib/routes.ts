/**
 * Canonical app route paths — the single source of truth for `revalidatePath`
 * targets used by server actions. Never inline a raw `revalidatePath("/...")`
 * string in an action file: a rename then drifts silently and the stale path
 * keeps pointing at a deleted route (AGENTS.md §8.5 stale-rename hazard).
 *
 * Static paths live in `ROUTES`; dynamic-segment paths are built by the
 * `routeTo*` helpers below so even those derive from one prefix.
 */
export const ROUTES = {
  // Core / tenant
  dashboard: "/dashboard",
  crm: "/dashboard/crm",
  units: "/dashboard/units",
  reservations: "/dashboard/reservations",
  contracts: "/dashboard/contracts",
  payments: "/dashboard/payments",
  invoices: "/dashboard/invoices",
  finance: "/dashboard/finance",
  help: "/dashboard/help",
  billing: "/dashboard/billing",
  billingAddOns: "/dashboard/billing/add-ons",
  settings: "/dashboard/settings",
  settingsTeam: "/dashboard/settings/team",
  settingsZatca: "/dashboard/settings/zatca",

  // Maintenance
  maintenanceTickets: "/dashboard/maintenance/tickets",
  maintenancePreventive: "/dashboard/maintenance/preventive",

  // Marketplace
  marketplace: "/dashboard/marketplace",
  marketplaceMyListings: "/dashboard/marketplace/my-listings",

  // Admin / platform
  adminCoupons: "/dashboard/admin/coupons",
  adminAddOns: "/dashboard/admin/add-ons",
  adminPlans: "/dashboard/admin/plans",
  adminEmail: "/dashboard/admin/email",
  adminMarketplace: "/dashboard/admin/marketplace",
  adminDataRetention: "/dashboard/admin/data-retention",
  adminZatca: "/dashboard/admin/zatca",
  adminPayments: "/dashboard/admin/payments",
  adminSubscriptions: "/dashboard/admin/subscriptions",

  // Portal (non-dashboard tenant-facing surface)
  portal: "/portal",
} as const;

/** Dynamic contract detail path: `/dashboard/contracts/:id`. */
export function routeToContract(contractId: string): string {
  return `${ROUTES.contracts}/${contractId}`;
}

/** Dynamic maintenance request detail path: `/dashboard/maintenance/:id`. */
export function routeToMaintenanceRequest(requestId: string): string {
  return `/dashboard/maintenance/${requestId}`;
}

/** Dynamic support-ticket detail path: `/dashboard/help/tickets/:id`. */
export function routeToHelpTicket(ticketId: string): string {
  return `${ROUTES.help}/tickets/${ticketId}`;
}
