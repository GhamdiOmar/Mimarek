import { encrypt, decrypt, hashForSearch } from "./encryption";
import { normalizeSaudiPhoneE164 } from "./phone";

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
    nationalId: customer.nationalId ? decrypt(customer.nationalId) : customer.nationalId,
    phone: customer.phone ? decrypt(customer.phone) : customer.phone,
    email: customer.email ? decrypt(customer.email) : customer.email,
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
    managerId: decrypt(managerInfo.managerId),
  };
}
