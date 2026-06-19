"use server";

import { db, Prisma, TicketCategory, TicketPriority, TicketStatus } from "@repo/db";
import { revalidatePath } from "next/cache";
import { ROUTES, routeToHelpTicket } from "../../lib/routes";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { createNotification, notifyAdmins } from "../../lib/create-notification";
import { hasPermission } from "../../lib/permissions";

export async function createSupportTicket(data: {
  subject: string;
  description: string;
  category: string;
  priority?: string;
}) {
  const session = await requirePermission("help:create_ticket");

  // Generate ticket number with retry on unique constraint violation
  let ticket;
  let retries = 3;
  while (retries > 0) {
    try {
      const lastTicket = await db.supportTicket.findFirst({
        where: { organizationId: session.organizationId },
        orderBy: { createdAt: "desc" },
        select: { ticketNumber: true },
      });
      const nextNum = lastTicket
        ? parseInt(lastTicket.ticketNumber.replace("TKT-", "")) + 1
        : 1;
      const ticketNumber = `TKT-${String(nextNum).padStart(3, "0")}`;

      ticket = await db.supportTicket.create({
        data: {
          ticketNumber,
          userId: session.userId,
          subject: data.subject,
          description: data.description,
          category: data.category as TicketCategory,
          priority: (data.priority as TicketPriority | undefined) ?? "MEDIUM",
          status: "OPEN",
          organizationId: session.organizationId,
        },
      });
      break; // Success
    } catch (error) {
      // Prisma's `meta.target` is typed `unknown`; it can be a string or string[]
      // depending on the driver. Guard both shapes to mirror the original
      // `error.meta?.target?.includes("ticketNumber")` check without an `any` cast.
      const target =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.meta?.target
          : undefined;
      const hitsTicketNumber = Array.isArray(target)
        ? target.includes("ticketNumber")
        : typeof target === "string"
          ? target.includes("ticketNumber")
          : false;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        hitsTicketNumber
      ) {
        retries--;
        if (retries === 0) throw new Error("Unable to create a ticket number. Please try again in a moment.");
        continue; // Retry with new number
      }
      throw error;
    }
  }

  if (!ticket) throw new Error("We were unable to create your support ticket. Please try again.");

  await notifyAdmins({
    type: "SUPPORT_TICKET",
    title: `تذكرة دعم جديدة: ${ticket.ticketNumber}`,
    titleEn: `New Support Ticket: ${ticket.ticketNumber}`,
    message: `${session.name ?? session.email}: ${data.subject}`,
    messageEn: `${session.name ?? session.email}: ${data.subject}`,
    link: `/dashboard/help/tickets/${ticket.id}`,
    organizationId: session.organizationId,
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "CREATE",
    resource: "SupportTicket",
    resourceId: ticket.id,
    metadata: { ticketNumber: ticket.ticketNumber, category: data.category },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.help);
  return ticket;
}

export async function getMySupportTickets() {
  const session = await requirePermission("help:read");

  return db.supportTicket.findMany({
    where: { userId: session.userId, organizationId: session.organizationId },
    include: {
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getAllSupportTickets(filters?: {
  status?: string;
  category?: string;
  priority?: string;
}) {
  const session = await requirePermission("help:manage_tickets");

  return db.supportTicket.findMany({
    where: {
      organizationId: session.organizationId,
      ...(filters?.status ? { status: filters.status as TicketStatus } : {}),
      ...(filters?.category ? { category: filters.category as TicketCategory } : {}),
      ...(filters?.priority ? { priority: filters.priority as TicketPriority } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getTicketWithMessages(ticketId: string) {
  const session = await requirePermission("help:read");

  const isAdmin = hasPermission(session.role, "help:manage_tickets");

  const ticket = await db.supportTicket.findFirst({
    where: {
      id: ticketId,
      ...(isAdmin
        ? { organizationId: session.organizationId }
        : { userId: session.userId }),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      assignee: { select: { id: true, name: true, email: true } },
      messages: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) throw new Error("Support ticket not found or you don't have access to view it.");
  return ticket;
}

export async function addTicketMessage(ticketId: string, message: string) {
  const session = await requirePermission("help:read");

  const isAdmin = hasPermission(session.role, "help:manage_tickets");

  // Verify access
  const ticket = await db.supportTicket.findFirst({
    where: {
      id: ticketId,
      ...(isAdmin
        ? { organizationId: session.organizationId }
        : { userId: session.userId }),
    },
  });
  if (!ticket) throw new Error("Support ticket not found or you don't have access to view it.");

  const ticketMessage = await db.ticketMessage.create({
    data: {
      ticketId,
      userId: session.userId,
      message,
      isStaffReply: isAdmin,
    },
  });

  // Auto-update status on staff reply
  if (isAdmin && ticket.status === "OPEN") {
    await db.supportTicket.update({
      where: { id: ticketId },
      data: { status: "IN_PROGRESS" },
    });
  }

  // Update ticket updatedAt
  await db.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });

  // Notify the other party
  if (isAdmin) {
    await createNotification({
      userId: ticket.userId,
      type: "TICKET_REPLY",
      title: `رد على التذكرة ${ticket.ticketNumber}`,
      titleEn: `Reply on ticket ${ticket.ticketNumber}`,
      message: message.slice(0, 100),
      messageEn: message.slice(0, 100),
      link: `/dashboard/help/tickets/${ticketId}`,
      organizationId: session.organizationId,
    });
  } else {
    await notifyAdmins({
      type: "TICKET_REPLY",
      title: `رد جديد على التذكرة ${ticket.ticketNumber}`,
      titleEn: `New reply on ticket ${ticket.ticketNumber}`,
      message: `${session.name ?? session.email}: ${message.slice(0, 100)}`,
      messageEn: `${session.name ?? session.email}: ${message.slice(0, 100)}`,
      link: `/dashboard/help/tickets/${ticketId}`,
      organizationId: session.organizationId,
    });
  }

  revalidatePath(routeToHelpTicket(ticketId));
  return ticketMessage;
}

export async function updateTicketStatus(ticketId: string, status: string) {
  const session = await requirePermission("help:manage_tickets");

  const ticket = await db.supportTicket.findFirst({
    where: { id: ticketId, organizationId: session.organizationId },
  });
  if (!ticket) throw new Error("Support ticket not found or you don't have access to view it.");

  const updated = await db.supportTicket.update({
    where: { id: ticketId },
    data: { status: status as TicketStatus },
  });

  // Notify ticket owner
  const statusLabels: Record<string, { ar: string; en: string }> = {
    OPEN: { ar: "مفتوحة", en: "Open" },
    IN_PROGRESS: { ar: "قيد المعالجة", en: "In Progress" },
    WAITING_ON_USER: { ar: "بانتظار ردك", en: "Waiting on You" },
    RESOLVED: { ar: "تم الحل", en: "Resolved" },
    CLOSED: { ar: "مغلقة", en: "Closed" },
  };
  const label = statusLabels[status] ?? { ar: status, en: status };

  await createNotification({
    userId: ticket.userId,
    type: "TICKET_STATUS",
    title: `تحديث التذكرة ${ticket.ticketNumber}`,
    titleEn: `Ticket ${ticket.ticketNumber} Updated`,
    message: `حالة التذكرة: ${label.ar}`,
    messageEn: `Ticket status: ${label.en}`,
    link: `/dashboard/help/tickets/${ticketId}`,
    organizationId: session.organizationId,
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "SupportTicket",
    resourceId: ticketId,
    metadata: { status, ticketNumber: ticket.ticketNumber },
    organizationId: session.organizationId,
  });

  revalidatePath(routeToHelpTicket(ticketId));
  revalidatePath(ROUTES.help);
  return updated;
}

export async function getHelpDashboardStats() {
  const session = await requirePermission("help:manage_tickets");

  const [openTickets, inProgressTickets, pendingRequests] = await Promise.all([
    db.supportTicket.count({
      where: { organizationId: session.organizationId, status: "OPEN" },
    }),
    db.supportTicket.count({
      where: { organizationId: session.organizationId, status: "IN_PROGRESS" },
    }),
    db.permissionRequest.count({
      where: { organizationId: session.organizationId, status: "PENDING" },
    }),
  ]);

  return { openTickets, inProgressTickets, pendingRequests };
}
