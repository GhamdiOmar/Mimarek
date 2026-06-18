/**
 * PII Masking — unified convention (AGENTS §6.15.3)
 *
 * TOKEN: exactly `***` (three asterisks) everywhere — no 4-star, no 6-star variants.
 *
 * maskNationalId / maskPhone  →  `***` + last-4 digits   e.g. ***6789
 * maskEmail                   →  first-char + `***` + @ + domain   e.g. u***@example.com
 *                                (local-part ≤ 1 char)  →  `***@` + domain
 * maskCustomerPii             →  dateOfBirthHijri → `***`; all other fields unchanged.
 *
 * RTL / LTR rendering:
 *   Every UI site that renders a masked phone / nationalId / email MUST render the
 *   value inside an element with `dir="ltr"` (or the project's `.number-ltr` class,
 *   defined in packages/ui/src/globals.css) so masked tokens never visually reverse
 *   in Arabic RTL context (AGENTS §6.15.3 hard rule).
 */

/**
 * Mask a Saudi National ID / Iqama number.
 * "1023456789" → "***6789"
 */
export function maskNationalId(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return "***";
  return "***" + value.slice(-4);
}

/**
 * Mask a phone number.
 * "0501234567" → "***4567"
 */
export function maskPhone(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return "***";
  return "***" + value.slice(-4);
}

/**
 * Mask an email address.
 * "user@example.com" → "u***@example.com"
 */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return "";
  const atIndex = value.indexOf("@");
  if (atIndex <= 1) return "***" + value.slice(atIndex);
  return value[0] + "***" + value.slice(atIndex);
}

/**
 * The fields {@link maskCustomerPii} reads + rewrites. The three string PII
 * columns plus the four sensitive blobs/dates it nulls or stubs. Any
 * Customer-shaped row satisfies this; extra fields pass through untouched.
 */
interface MaskableCustomer {
  nationalId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: unknown;
  documentInfo?: unknown;
  dateOfBirth?: unknown;
  dateOfBirthHijri?: unknown;
}

/**
 * Apply PII masking to a customer object based on whether the user has PII access.
 */
export function maskCustomerPii<T extends MaskableCustomer>(
  customer: T,
  hasPiiAccess: boolean
): T {
  if (hasPiiAccess || !customer) return customer;

  return {
    ...customer,
    nationalId: customer.nationalId ? maskNationalId(customer.nationalId) : customer.nationalId,
    phone: customer.phone ? maskPhone(customer.phone) : customer.phone,
    email: customer.email ? maskEmail(customer.email) : customer.email,
    address: customer.address ? { masked: true } : customer.address,
    documentInfo: customer.documentInfo ? { masked: true } : customer.documentInfo,
    dateOfBirth: customer.dateOfBirth ? null : customer.dateOfBirth,
    dateOfBirthHijri: customer.dateOfBirthHijri ? "***" : customer.dateOfBirthHijri,
  } as T;
}
