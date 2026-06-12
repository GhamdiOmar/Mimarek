/**
 * Standard discriminated result for server actions. Adopt in new actions
 * and actions touched for other reasons — do not mass-migrate existing ones.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(error: string, code?: string): ActionResult<T> {
  return { ok: false, error, code };
}
