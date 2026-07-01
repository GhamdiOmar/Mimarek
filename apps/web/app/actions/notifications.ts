"use server";

import { db } from "@repo/db";
import { requirePermission } from "../../lib/auth-helpers";

export async function getMyNotifications(limit = 20) {
  const session = await requirePermission("notifications:read");
  // Clamp so a caller-supplied limit can't become an unbounded Prisma take.
  limit = Math.min(100, Math.max(1, limit));
  return db.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadCount() {
  const session = await requirePermission("notifications:read");
  return db.notification.count({
    where: { userId: session.userId, read: false },
  });
}

export async function markAsRead(id: string) {
  const session = await requirePermission("notifications:read");
  await db.notification.updateMany({
    where: { id, userId: session.userId },
    data: { read: true },
  });
}

export async function markAllAsRead() {
  const session = await requirePermission("notifications:read");
  await db.notification.updateMany({
    where: { userId: session.userId, read: false },
    data: { read: true },
  });
}
