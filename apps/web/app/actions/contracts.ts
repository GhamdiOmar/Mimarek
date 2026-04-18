"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT", "SIGNED", "CANCELLED"],
  SENT: ["SIGNED", "CANCELLED"],
  SIGNED: ["VOID"],
  CANCELLED: [],
  VOID: [],
};

const FREQUENCY_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
};

async function generateContractNumber(
  organizationId: string,
  type: "SALE" | "LEASE"
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.contract.count({
    where: {
      type,
      customer: { organizationId },
      createdAt: { gte: new Date(`${year}-01-01`) },
    },
  });
  const seq = String(count + 1).padStart(4, "0");
  return `${type}-${year}-${seq}`;
}

export async function createContract(data: {
  customerId: string;
  unitId: string;
  type: "SALE" | "LEASE";
  amount: number;
  fileUrl?: string;
  // Ejar fields (LEASE)
  startDate?: string;
  endDate?: string;
  paymentFrequency?: string;
  securityDeposit?: number;
  autoRenewal?: boolean;
  maintenanceResponsibility?: string;
  noticePeriodDays?: number;
  // Sale fields
  deliveryDate?: string;
  // Shared
  notes?: string;
}) {
  const session = await requirePermission("contracts:write");

  // Validate amount
  if (!data.amount || data.amount <= 0 || !Number.isFinite(data.amount)) {
    throw new Error("Please enter a valid contract amount. The amount must be a positive number.");
  }

  // Verify customer belongs to org
  const customer = await db.customer.findFirst({
    where: { id: data.customerId, organizationId: session.organizationId },
  });
  if (!customer) throw new Error("Customer not found or you don't have access. Please verify the customer exists in your organization.");

  // Verify unit belongs to org
  const unit = await db.unit.findFirst({
    where: { id: data.unitId, organizationId: session.organizationId },
  });
  if (!unit) {
    throw new Error("Unit not found or you don't have access. Please verify the unit exists in your organization.");
  }

  // Generate contract number
  const contractNumber = await generateContractNumber(session.organizationId, data.type);

  // Ejar validation for LEASE contracts
  if (data.type === "LEASE") {
    if (!data.startDate || !data.endDate) {
      throw new Error("Start date and end date are required for lease contracts. Please provide both dates.");
    }
    if (!data.paymentFrequency) {
      throw new Error("Payment frequency is required for lease contracts. Please select a payment schedule (monthly, quarterly, etc.).");
    }
    // Security deposit max 5% per Ejar
    if (data.securityDeposit && data.securityDeposit > data.amount * 0.05) {
      throw new Error("The security deposit cannot exceed 5% of the total lease amount, as required by Ejar regulations. Please reduce the deposit amount.");
    }
    // Default auto-renewal for leases > 3 months
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (monthsDiff > 3 && data.autoRenewal === undefined) {
      data.autoRenewal = true;
    }
    if (data.noticePeriodDays === undefined) {
      data.noticePeriodDays = 60;
    }
  }

  let contract;

  if (data.type === "LEASE" && data.startDate && data.endDate && data.paymentFrequency) {
    // Create Lease + Installments + Contract in transaction
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const freqMonths = FREQUENCY_MONTHS[data.paymentFrequency] || 1;
    const totalMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
    const installmentCount = Math.max(1, Math.ceil(totalMonths / freqMonths));
    const installmentAmount = data.amount / installmentCount;

    contract = await db.$transaction(async (tx) => {
      // Create Lease
      const lease = await tx.lease.create({
        data: {
          unitId: data.unitId,
          customerId: data.customerId,
          startDate: start,
          endDate: end,
          totalAmount: data.amount,
          status: "DRAFT",
        },
      });

      // Generate rent installments
      const installments = [];
      for (let i = 0; i < installmentCount; i++) {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + i * freqMonths);
        installments.push({
          leaseId: lease.id,
          dueDate,
          amount: installmentAmount,
          status: "UNPAID" as const,
        });
      }
      await tx.rentInstallment.createMany({ data: installments });

      // Create Contract linked to Lease
      const c = await tx.contract.create({
        data: {
          customerId: data.customerId,
          unitId: data.unitId,
          type: "LEASE",
          amount: data.amount,
          fileUrl: data.fileUrl,
          userId: session.userId,
          status: "DRAFT",
          contractNumber,
          leaseId: lease.id,
          paymentFrequency: data.paymentFrequency as any,
          securityDeposit: data.securityDeposit,
          autoRenewal: data.autoRenewal,
          maintenanceResponsibility: data.maintenanceResponsibility,
          noticePeriodDays: data.noticePeriodDays,
          notes: data.notes,
        },
      });

      return c;
    });
  } else {
    // SALE contract (or LEASE without dates as fallback)
    contract = await db.contract.create({
      data: {
        customerId: data.customerId,
        unitId: data.unitId,
        type: data.type,
        amount: data.amount,
        fileUrl: data.fileUrl,
        userId: session.userId,
        status: "DRAFT",
        contractNumber,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
        notes: data.notes,
      },
    });
  }

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "CREATE", resource: "Contract", resourceId: contract.id, organizationId: session.organizationId });

  revalidatePath("/dashboard/contracts");
  return JSON.parse(JSON.stringify(contract));
}

export async function getContract(contractId: string) {
  const session = await requirePermission("contracts:read");

  const contract = await db.contract.findFirst({
    where: { id: contractId, customer: { organizationId: session.organizationId } },
    include: {
      customer: true,
      unit: true,
      lease: { include: { installments: { orderBy: { dueDate: "asc" } } } },
    },
  });

  if (!contract) {
    throw new Error("Contract not found or you don't have access. Please verify the contract exists.");
  }

  return JSON.parse(JSON.stringify(contract));
}

export async function getContracts(filters?: { status?: string; type?: string }) {
  const session = await requirePermission("contracts:read");

  const where: any = {
    customer: { organizationId: session.organizationId },
  };

  if (filters?.status) where.status = filters.status;
  if (filters?.type) where.type = filters.type;

  const contracts = await db.contract.findMany({
    where,
    include: {
      customer: true,
      unit: true,
      lease: { select: { id: true, startDate: true, endDate: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return JSON.parse(JSON.stringify(contracts));
}

export async function updateContractStatus(
  contractId: string,
  status: "SENT" | "SIGNED" | "CANCELLED" | "VOID"
) {
  // Destructive transitions require contracts:delete permission
  const permission = (status === "CANCELLED" || status === "VOID") ? "contracts:delete" : "contracts:write";
  const session = await requirePermission(permission);

  const contract = await db.contract.findFirst({
    where: { id: contractId, customer: { organizationId: session.organizationId } },
    include: { customer: true },
  });
  if (!contract) {
    throw new Error("Contract not found or you don't have access. Please verify the contract exists.");
  }

  // Enforce state machine
  const allowed = VALID_TRANSITIONS[contract.status];
  if (!allowed || !allowed.includes(status)) {
    throw new Error(`This contract cannot be moved from its current status to the requested status. Please check the allowed workflow transitions.`);
  }

  const data: any = { status };
  if (status === "SIGNED") {
    data.signedAt = new Date();
  }

  const updated = await db.contract.update({
    where: { id: contractId },
    data,
  });

  // SALE contract signed → unit SOLD
  if (status === "SIGNED" && contract.type === "SALE") {
    await db.unit.update({
      where: { id: contract.unitId },
      data: { status: "SOLD" },
    });
    await db.customer.update({
      where: { id: contract.customerId },
      data: { status: "CONVERTED" },
    });

  }

  // LEASE contract signed → unit RENTED, lease ACTIVE
  if (status === "SIGNED" && contract.type === "LEASE") {
    await db.unit.update({
      where: { id: contract.unitId },
      data: { status: "RENTED" },
    });
    await db.customer.update({
      where: { id: contract.customerId },
      data: { status: "ACTIVE_TENANT" },
    });
    // Activate linked lease
    if (contract.leaseId) {
      await db.lease.update({
        where: { id: contract.leaseId },
        data: { status: "ACTIVE" },
      });
    }
  }

  // CANCELLED or VOID → free unit, revert customer
  if (status === "CANCELLED" || status === "VOID") {
    const currentUnit = await db.unit.findUnique({ where: { id: contract.unitId } });
    if (currentUnit && (currentUnit.status === "SOLD" || currentUnit.status === "RENTED")) {
      await db.unit.update({
        where: { id: contract.unitId },
        data: { status: "AVAILABLE" },
      });
    }

    // Terminate linked lease
    if (contract.leaseId) {
      await db.lease.update({
        where: { id: contract.leaseId },
        data: { status: "TERMINATED" },
      });
    }

    const otherActive = await db.contract.count({
      where: {
        customerId: contract.customerId,
        id: { not: contractId },
        status: { in: ["DRAFT", "SENT", "SIGNED"] },
      },
    });
    if (otherActive === 0) {
      await db.customer.update({
        where: { id: contract.customerId },
        data: { status: "QUALIFIED" },
      });
    }

  }

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "Contract", resourceId: contractId, metadata: { previousStatus: contract.status, newStatus: status }, organizationId: session.organizationId });

  revalidatePath("/dashboard/contracts");
  revalidatePath("/dashboard/units");
  revalidatePath("/dashboard/contracts");
  return JSON.parse(JSON.stringify(updated));
}

export async function deleteContract(contractId: string) {
  const session = await requirePermission("contracts:delete");

  const contract = await db.contract.findFirst({
    where: { id: contractId, customer: { organizationId: session.organizationId } },
    include: { customer: true },
  });
  if (!contract) {
    throw new Error("Contract not found or you don't have access. Please verify the contract exists.");
  }

  // Only DRAFT contracts can be deleted
  if (contract.status !== "DRAFT") {
    throw new Error("Only draft contracts can be deleted. Use Cancel or Void for active contracts.");
  }

  await db.$transaction(async (tx) => {
    // Delete linked lease + installments if exists
    if (contract.leaseId) {
      await tx.rentInstallment.deleteMany({ where: { leaseId: contract.leaseId } });
      // Unlink before deleting lease
      await tx.contract.update({ where: { id: contractId }, data: { leaseId: null } });
      await tx.lease.delete({ where: { id: contract.leaseId } });
    }

    await tx.contract.delete({ where: { id: contractId } });
  });

  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "DELETE", resource: "Contract", resourceId: contractId, organizationId: session.organizationId });

  revalidatePath("/dashboard/contracts");
  revalidatePath("/dashboard/units");
}

// ─── RED: Contract Amount & Signature Enhancements ──────────────────────────

export async function updateContractAmounts(
  contractId: string,
  data: { grossAmount: number; discountAmount?: number }
) {
  const session = await requirePermission("contracts:write");

  const contract = await db.contract.findFirst({
    where: { id: contractId, unit: { organizationId: session.organizationId } },
  });
  if (!contract) throw new Error("Contract not found or you don't have access. Please verify the contract exists.");

  const discount = data.discountAmount ?? 0;
  const netAmount = data.grossAmount - discount;

  const updated = await db.contract.update({
    where: { id: contractId },
    data: {
      grossAmount: data.grossAmount,
      discountAmount: discount,
      netAmount,
      amount: netAmount, // Keep amount in sync
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "Contract",
    resourceId: contractId,
    before: { grossAmount: contract.grossAmount, discountAmount: contract.discountAmount, netAmount: contract.netAmount },
    after: { grossAmount: data.grossAmount, discountAmount: discount, netAmount },
    organizationId: session.organizationId,
  });

  revalidatePath(`/dashboard/contracts/${contractId}`);
  return JSON.parse(JSON.stringify(updated));
}

export async function recordBuyerSignature(contractId: string, signatureUrl: string) {
  const session = await requirePermission("contracts:write");

  const contract = await db.contract.findFirst({
    where: { id: contractId, unit: { organizationId: session.organizationId } },
  });
  if (!contract) throw new Error("Contract not found or you don't have access. Please verify the contract exists.");

  const updated = await db.contract.update({
    where: { id: contractId },
    data: {
      buyerSignedAt: new Date(),
      buyerSignatureUrl: signatureUrl,
    },
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "Contract",
    resourceId: contractId,
    metadata: { event: "buyer_signature_recorded" },
    organizationId: session.organizationId,
  });

  revalidatePath(`/dashboard/contracts/${contractId}`);
  return JSON.parse(JSON.stringify(updated));
}

