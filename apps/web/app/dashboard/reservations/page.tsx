import type { ComponentProps } from "react";
import { requirePermission } from "../../../lib/auth-helpers";
import { getReservations } from "../../actions/reservations";
import ReservationsView from "./ReservationsView";

/**
 * Reservations — Server Component (CX-003 pt1). Fetches the reservation list
 * server-side so the page arrives already filled (no client mount-fetch
 * waterfall). Permission matches `getReservations` (`reservations:read`);
 * customers/units stay lazily loaded in the client island (only on create-modal
 * open). The interactive client body lives in ReservationsView.
 */
export default async function ReservationsPage() {
  await requirePermission("reservations:read");
  const initialReservations = (await getReservations()) as unknown as ComponentProps<
    typeof ReservationsView
  >["initialReservations"];

  return <ReservationsView initialReservations={initialReservations} />;
}
