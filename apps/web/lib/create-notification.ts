import { db } from "@repo/db";

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  titleEn: string;
  message: string;
  messageEn: string;
  link?: string;
  organizationId?: string | null;
}) {
  return db.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      titleEn: params.titleEn,
      message: params.message,
      messageEn: params.messageEn,
      link: params.link,
      read: false,
      organizationId: params.organizationId ?? null,
    },
  });
}

/**
 * Notify all admins (COMPANY_ADMIN, SYSTEM_ADMIN, SYSTEM_SUPPORT) in an organization.
 */
export async function notifyAdmins(params: {
  type: string;
  title: string;
  titleEn: string;
  message: string;
  messageEn: string;
  link?: string;
  organizationId: string;
}) {
  const admins = await db.user.findMany({
    where: {
      organizationId: params.organizationId,
      role: { in: ["ADMIN", "SYSTEM_ADMIN", "SYSTEM_SUPPORT"] },
    },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: params.type,
        title: params.title,
        titleEn: params.titleEn,
        message: params.message,
        messageEn: params.messageEn,
        link: params.link,
        organizationId: params.organizationId,
      })
    )
  );
}

/**
 * Notify Mimarek platform staff (D29). Targets SYSTEM_ADMIN / SYSTEM_SUPPORT users
 * with organizationId === null (platform staff are not org members — the old
 * "system-org sentinel" idea fails). Used for platform-level ZATCA alerts
 * (REJECTED / ERROR clearance, failed reporting). Notifications carry organizationId null.
 */
export async function notifyPlatformStaff(params: {
  type: string;
  title: string;
  titleEn: string;
  message: string;
  messageEn: string;
  link?: string;
}) {
  const staff = await db.user.findMany({
    where: { organizationId: null, role: { in: ["SYSTEM_ADMIN", "SYSTEM_SUPPORT"] } },
    select: { id: true },
  });

  await Promise.all(
    staff.map((u) =>
      createNotification({
        userId: u.id,
        type: params.type,
        title: params.title,
        titleEn: params.titleEn,
        message: params.message,
        messageEn: params.messageEn,
        link: params.link,
        organizationId: null,
      }),
    ),
  );
}
