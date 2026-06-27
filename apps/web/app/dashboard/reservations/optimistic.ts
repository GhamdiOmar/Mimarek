// Optimistic reducer for the reservations table (used with useOptimisticAction).
// Pure + dependency-free so it unit-tests cheaply; `Reservation` is a TYPE-ONLY import
// (erased at runtime) so importing this module never pulls the heavy View.
import type { Reservation } from "./ReservationsView";

export type ReservationStatus = Reservation["status"];
export type ReservationPatch = { id: string; status: ReservationStatus };

/** Optimistically set the targeted reservation's status; reconciled by the post-action refetch. */
export function reservationReducer(rows: Reservation[], patch: ReservationPatch): Reservation[] {
  return rows.map((r) => (r.id === patch.id ? { ...r, status: patch.status } : r));
}
