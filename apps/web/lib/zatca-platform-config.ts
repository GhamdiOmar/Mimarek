/**
 * Mimarek PropTech Co. — the fixed platform-seller identity for Track-A SaaS billing.
 *
 * The platform onboards ONE billing EGS, and Mimarek's tax identity (legal name, CR,
 * national address) is a constant — only the VAT number (+ a one-time ZATCA OTP) is a
 * real per-onboarding input. So the onboarding action/form default everything but the
 * VAT from here, instead of re-asking the admin to type the company profile.
 *
 * ⚠ Before production go-live (R5): replace the CR + national address with Mimarek's
 * REAL registered values (ideally sourced from env or a platform-company config record).
 * These defaults are correct for the ZATCA SANDBOX.
 */
export const PLATFORM_SELLER = {
  legalNameEn: "Mimarek PropTech Co.",
  legalNameAr: "شركة معمارك للتقنية العقارية",
  crNumber: "1010010000", // TODO(R5): Mimarek's real Commercial Registration
  industryCategory: "Software",
  invoiceTypeFlags: "1100", // standard B2B
  nationalAddress: {
    streetName: "Prince Sultan",
    buildingNumber: "2322",
    district: "Al-Murabba",
    city: "Riyadh",
    postalCode: "23333",
  },
} as const;
