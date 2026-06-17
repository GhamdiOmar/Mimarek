/**
 * Decimal/Date-safe clone for returning Prisma results from server actions.
 * Prisma `Decimal` and `Date` fields are not serializable across the RSC
 * boundary; a JSON round-trip normalizes them. One seam — never inline
 * `JSON.parse(JSON.stringify(...))` in action files (enforced by the
 * `mimaric/no-inline-json-serialize` ESLint rule).
 *
 * Return type is intentionally `any`, NOT `T`. This is a faithful drop-in for
 * the inline `JSON.parse(JSON.stringify(x))` idiom it replaces — that idiom
 * returned `any`, and ~90 call sites across the action layer (and their RSC
 * consumers / DTO casts in pages and views) rely on that widening: the runtime
 * JSON shape genuinely differs from the input type `T` (Prisma `Decimal` →
 * `string`, `Date` → `string`), so the common `serialize(row) as SomeDTO` cast
 * is only sound because the value is `any` first. Typing this `<T>(v: T): T`
 * re-tightens every return to the *pre*-serialization Prisma type and breaks
 * those casts ("Decimal is not comparable to number", "Date not comparable to
 * string") at sites this seam-adoption refactor must not touch. Keeping `any`
 * preserves byte-identical runtime behavior AND identical type-checking to the
 * idiom being centralized.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialize<T>(value: T): any {
  return JSON.parse(JSON.stringify(value));
}
