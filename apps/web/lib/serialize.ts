/**
 * Decimal/Date-safe clone for returning Prisma results from server actions.
 * Prisma Decimal and Date fields are not serializable across the RSC
 * boundary; a JSON round-trip normalizes them. One seam — do not inline
 * JSON.parse(JSON.stringify(...)) in action files.
 */
export function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
