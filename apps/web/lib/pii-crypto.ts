import {
  encrypt,
  decrypt,
  hashForSearch,
  legacyHashForSearch,
  classifyCiphertext,
} from "./encryption";
import { logSecurityEvent } from "./security-log";
import { normalizeSaudiPhoneE164 } from "./phone";

/**
 * Decrypt one PII field, degrading gracefully (QA-SEC-06 caller-resilience).
 *
 * `decrypt()` now fails CLOSED — it throws on a GCM auth-tag mismatch (tampering
 * or a stale/wrong key) instead of silently returning the ciphertext. That is the
 * correct behaviour for the crypto PRIMITIVE, but a single corrupt row must not
 * 500 an entire list render. At the data-access layer we catch that throw, log a
 * security event (no secrets), and return an empty string so the affected row
 * degrades to "unavailable" while the rest of the page renders. We do NOT return
 * the ciphertext — that would re-introduce the fail-open behaviour QA-SEC-06 fixed.
 *
 * A2 plaintext-passthrough telemetry: a truthy value that classifies as "plaintext"
 * is PII that was never encrypted (pre-migration row, or a write that bypassed the
 * canonical encrypt path). decrypt() would return it verbatim. We surface the real
 * value so the row still renders, but flag it via logSecurityEvent so log alerting
 * can catch the leak. This becomes impossible once the A1 DB CHECK constraint is live.
 */
export function safeDecryptField(value: string, field: string): string {
  if (value && classifyCiphertext(value) === "plaintext") {
    logSecurityEvent("PII_PLAINTEXT_DETECTED", field);
    return value;
  }
  try {
    return decrypt(value);
  } catch {
    console.error(
      `[pii-crypto] decrypt failed for field "${field}" — possible stale key or tampered ciphertext; rendering as unavailable.`,
    );
    return "";
  }
}

/**
 * Per-tenant search-key for a phone (v2): HMAC over the E.164-normalized form
 * when the value is a valid Saudi mobile, else over the raw value, keyed by
 * `orgId`. The SEARCH path MUST mirror this exactly (via `phoneSearchHashCandidates`)
 * so a customer is found whether the query is "0551234567" or "+966551234567".
 */
export function phoneSearchHash(phone: string, orgId: string): string {
  return hashForSearch(normalizeSaudiPhoneE164(phone) ?? phone, orgId);
}

/** Legacy (v1) phone search-key — dual-read / backfill only. See encryption.legacyHashForSearch. */
export function legacyPhoneSearchHash(phone: string): string {
  return legacyHashForSearch(normalizeSaudiPhoneE164(phone) ?? phone);
}

/**
 * Blind-index candidates for a search term during the v1→v2 migration window:
 * the per-tenant v2 hash AND the legacy v1 hash. Search sites query
 * `{ <hashColumn>: { in: candidates } }` so BOTH already-migrated (v2) and
 * not-yet-backfilled (v1) rows match — the migration is non-breaking even if the
 * backfill is partial. Once every environment is fully v2, the v1 leg can be dropped.
 */
export function searchHashCandidates(value: string, orgId: string): string[] {
  return [hashForSearch(value, orgId), legacyHashForSearch(value)];
}

/** Phone-specific blind-index candidates (v2 + legacy v1) — see searchHashCandidates. */
export function phoneSearchHashCandidates(phone: string, orgId: string): string[] {
  return [phoneSearchHash(phone, orgId), legacyPhoneSearchHash(phone)];
}

/**
 * Input accepted by {@link encryptCustomerData}: the three PII fields (any of
 * which may be absent/null on a partial update) plus arbitrary passthrough
 * fields that are copied unchanged.
 */
interface EncryptableCustomerData {
  nationalId?: string | null;
  phone?: string | null;
  email?: string | null;
  [key: string]: unknown;
}

/**
 * Output of {@link encryptCustomerData}: the PII fields replaced with ciphertext
 * plus their blind-index search hashes, alongside the untouched passthrough fields.
 *
 * The PII + hash fields are typed as plain `string` (not optional) because every
 * call site feeds them straight into a Prisma `create`/`createMany` where the
 * column is a required string — this mirrors the original `Record<string, any>`
 * return contract. A field is only ever present on the output when its source
 * field was present on the input (guarded below); the type intentionally treats
 * "the caller asked to encrypt this field, so it exists" as the invariant.
 */
interface EncryptedCustomerData {
  nationalId: string;
  nationalIdHash: string;
  phone: string;
  phoneHash: string;
  email: string;
  emailHash: string;
  [key: string]: unknown;
}

/**
 * Encrypt PII fields in customer data before writing to DB.
 * Returns new object with encrypted nationalId, phone, email and their per-tenant
 * (v2) blind-index hashes — keyed by `orgId`, the owning organization's id.
 */
export function encryptCustomerData(
  data: EncryptableCustomerData,
  orgId: string,
): EncryptedCustomerData {
  const encrypted = { ...data } as EncryptedCustomerData;

  if (data.nationalId) {
    encrypted.nationalId = encrypt(data.nationalId);
    encrypted.nationalIdHash = hashForSearch(data.nationalId, orgId);
  }
  if (data.phone) {
    // Store the E.164-normalized value for valid Saudi mobiles (consistent display
    // + search); fall back to the raw value for anything else (no data loss).
    const phoneForStorage = normalizeSaudiPhoneE164(data.phone) ?? String(data.phone);
    encrypted.phone = encrypt(phoneForStorage);
    encrypted.phoneHash = phoneSearchHash(phoneForStorage, orgId);
  }
  if (data.email) {
    encrypted.email = encrypt(data.email);
    encrypted.emailHash = hashForSearch(data.email, orgId);
  }

  return encrypted;
}

/**
 * The PII columns {@link decryptCustomerData} reads + rewrites. Any Customer-shaped
 * row carrying these (each nullable) satisfies the constraint; extra fields pass
 * through untouched.
 */
interface DecryptableCustomer {
  nationalId?: string | null;
  phone?: string | null;
  email?: string | null;
}

/**
 * Decrypt PII fields in customer data after reading from DB.
 */
export function decryptCustomerData<T extends DecryptableCustomer>(customer: T): T {
  if (!customer) return customer;

  return {
    ...customer,
    nationalId: customer.nationalId ? safeDecryptField(customer.nationalId, "nationalId") : customer.nationalId,
    phone: customer.phone ? safeDecryptField(customer.phone, "phone") : customer.phone,
    email: customer.email ? safeDecryptField(customer.email, "email") : customer.email,
  } as T;
}

/**
 * Decrypt PII for an array of customers.
 */
export function decryptCustomerList<T extends DecryptableCustomer>(customers: T[]): T[] {
  return customers.map(decryptCustomerData);
}

/**
 * Shape of the `Organization.managerInfo` JSON blob this module touches: an
 * optional `managerId` (the only encrypted field) plus arbitrary passthrough keys.
 */
interface OrgManagerInfo {
  managerId?: string | null;
  [key: string]: unknown;
}

/**
 * Encrypt the managerId field in Organization.managerInfo JSON.
 */
export function encryptOrgManagerId(
  managerInfo: OrgManagerInfo | null | undefined,
): OrgManagerInfo | null | undefined {
  if (!managerInfo || !managerInfo.managerId) return managerInfo;
  return {
    ...managerInfo,
    managerId: encrypt(managerInfo.managerId),
  };
}

/**
 * Decrypt the managerId field in Organization.managerInfo JSON.
 */
export function decryptOrgManagerId(
  managerInfo: OrgManagerInfo | null | undefined,
): OrgManagerInfo | null | undefined {
  if (!managerInfo || !managerInfo.managerId) return managerInfo;
  return {
    ...managerInfo,
    managerId: safeDecryptField(managerInfo.managerId, "managerId"),
  };
}
