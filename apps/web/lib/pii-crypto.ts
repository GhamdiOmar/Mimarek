import { encrypt, decrypt, hashForSearch } from "./encryption";
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
 */
export function safeDecryptField(value: string, field: string): string {
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
 * Search-key for a phone: HMAC over the E.164-normalized form when the value is
 * a valid Saudi mobile, else over the raw value. The SEARCH path in customers.ts
 * MUST mirror this exactly (hashForSearch(normalizeSaudiPhoneE164(x) ?? x)) so a
 * customer is found whether the query is "0551234567" or "+966551234567".
 */
export function phoneSearchHash(phone: string): string {
  return hashForSearch(normalizeSaudiPhoneE164(phone) ?? phone);
}

/**
 * Encrypt PII fields in customer data before writing to DB.
 * Returns new object with encrypted nationalId, phone, email and their search hashes.
 */
export function encryptCustomerData(data: Record<string, any>): Record<string, any> {
  const encrypted = { ...data };

  if (data.nationalId) {
    encrypted.nationalId = encrypt(data.nationalId);
    encrypted.nationalIdHash = hashForSearch(data.nationalId);
  }
  if (data.phone) {
    // Store the E.164-normalized value for valid Saudi mobiles (consistent display
    // + search); fall back to the raw value for anything else (no data loss).
    const phoneForStorage = normalizeSaudiPhoneE164(data.phone) ?? String(data.phone);
    encrypted.phone = encrypt(phoneForStorage);
    encrypted.phoneHash = phoneSearchHash(phoneForStorage);
  }
  if (data.email) {
    encrypted.email = encrypt(data.email);
    encrypted.emailHash = hashForSearch(data.email);
  }

  return encrypted;
}

/**
 * Decrypt PII fields in customer data after reading from DB.
 */
export function decryptCustomerData<T extends Record<string, any>>(customer: T): T {
  if (!customer) return customer;

  return {
    ...customer,
    nationalId: customer.nationalId ? safeDecryptField(customer.nationalId, "nationalId") : customer.nationalId,
    phone: customer.phone ? safeDecryptField(customer.phone, "phone") : customer.phone,
    email: customer.email ? safeDecryptField(customer.email, "email") : customer.email,
  };
}

/**
 * Decrypt PII for an array of customers.
 */
export function decryptCustomerList<T extends Record<string, any>>(customers: T[]): T[] {
  return customers.map(decryptCustomerData);
}

/**
 * Encrypt the managerId field in Organization.managerInfo JSON.
 */
export function encryptOrgManagerId(managerInfo: any): any {
  if (!managerInfo || !managerInfo.managerId) return managerInfo;
  return {
    ...managerInfo,
    managerId: encrypt(managerInfo.managerId),
  };
}

/**
 * Decrypt the managerId field in Organization.managerInfo JSON.
 */
export function decryptOrgManagerId(managerInfo: any): any {
  if (!managerInfo || !managerInfo.managerId) return managerInfo;
  return {
    ...managerInfo,
    managerId: safeDecryptField(managerInfo.managerId, "managerId"),
  };
}
