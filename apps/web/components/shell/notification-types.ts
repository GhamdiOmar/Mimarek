import type { getMyNotifications } from "../../app/actions/notifications";

/** A single notification element as returned by `getMyNotifications()` (Prisma scalars only). */
type NotificationPayload = Awaited<ReturnType<typeof getMyNotifications>>[number];

/**
 * Shape of a notification as the shell renders it.
 *
 * `getMyNotifications()` returns Prisma `Notification` scalars (no relations
 * included), so the `user` relation is absent from the payload. The topbar still
 * reads an optional `user` display string defensively, so we model it explicitly
 * as an optional scalar on top of the scalar payload.
 */
export type TopbarNotification = NotificationPayload & {
  /** Optional display name string; not part of the scalar payload (always undefined at runtime today). */
  user?: string | null;
};
