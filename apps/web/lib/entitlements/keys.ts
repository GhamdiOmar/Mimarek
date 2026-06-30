// Pure feature-key registry — NO db / next imports, so it is safe to import from
// client components (the admin add-ons page) and unit tests, unlike the cached
// `lib/entitlements.ts` engine which re-exports these.

/**
 * All feature keys used in the entitlement system.
 * Matches PlanEntitlement.featureKey values in the database.
 */
export const FEATURE_KEYS = {
  // ─── Numeric limits (absolute counts) ───
  USERS_MAX: "users.max",
  UNITS_MAX: "units.max",
  CUSTOMERS_MAX: "customers.max",
  MARKETPLACE_LISTINGS_MAX: "marketplace.listings.max",
  STORAGE_GB_MAX: "storage.gb.max",

  // ─── Module access flags ───
  CRM_ACCESS: "crm.access",
  RESERVATIONS_ACCESS: "reservations.access",
  CONTRACTS_ACCESS: "contracts.access",
  PAYMENTS_ACCESS: "payments.access",
  FINANCE_ACCESS: "finance.access",
  CMMS_ACCESS: "cmms.access",
  PLANNING_ACCESS: "planning.access",
  GIS_ACCESS: "gis.access",
  REPORTS_ACCESS: "reports.access",
  AUDIT_ACCESS: "audit.access",
  MARKETPLACE_READ_ACCESS: "marketplace.read.access",
  MARKETPLACE_PUBLISH_ACCESS: "marketplace.publish.access",

  // ─── Capability flags ───
  REPORTS_EXPORT: "reports.export",
  PII_ENCRYPTION: "pii.encryption",
  API_ACCESS: "api.access",
  CUSTOM_BRANDING: "custom.branding",
  CUSTOM_TEMPLATES_ACCESS: "custom.templates.access",
  ZATCA_SANDBOX_ACCESS: "zatca.sandbox.access",
  ZATCA_PRODUCTION_ACCESS: "zatca.production.access",

  // ─── Tier-based ───
  SLA_PRIORITY: "sla.priority",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/**
 * Feature keys an admin can attach to a sellable add-on (the add-ons catalogue
 * dropdown). A curated subset of FEATURE_KEYS — the absolute-count LIMITs plus
 * the module/capability BOOLEANs that make sense to sell as a booster. Built
 * from `FEATURE_KEYS.*` references (NOT string literals), so it can never drift
 * out of the registry — a typo is a compile error. Excludes non-grantable
 * internals (pii.encryption, sla.priority, the always-on module flags).
 */
export const GRANTABLE_FEATURE_KEYS: readonly FeatureKey[] = [
  FEATURE_KEYS.USERS_MAX,
  FEATURE_KEYS.UNITS_MAX,
  FEATURE_KEYS.CUSTOMERS_MAX,
  FEATURE_KEYS.MARKETPLACE_LISTINGS_MAX,
  FEATURE_KEYS.STORAGE_GB_MAX,
  FEATURE_KEYS.MARKETPLACE_PUBLISH_ACCESS,
  FEATURE_KEYS.FINANCE_ACCESS,
  FEATURE_KEYS.CMMS_ACCESS,
  FEATURE_KEYS.REPORTS_EXPORT,
  FEATURE_KEYS.AUDIT_ACCESS,
  FEATURE_KEYS.API_ACCESS,
  FEATURE_KEYS.CUSTOM_BRANDING,
  FEATURE_KEYS.CUSTOM_TEMPLATES_ACCESS,
  FEATURE_KEYS.ZATCA_SANDBOX_ACCESS,
  FEATURE_KEYS.ZATCA_PRODUCTION_ACCESS,
];
