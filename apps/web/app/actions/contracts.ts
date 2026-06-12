"use server";

import { db } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { syncDealStageForUnit } from "./customer-interests";
import { getNextSequenceValue, GLOBAL_SEQUENCE_SCOPE } from "../../lib/sequence";
import { CONTRACT_TRANSITIONS, isValidContractTransition } from "../../lib/contracts/state-machine";

const FREQUENCY_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
};

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
      // Generate contract number atomically via sequence counter (race-safe)
      const year = new Date().getFullYear();
      // Global per-type sequence (matches the original global count semantics):
      // contractNumber is globally @unique and its 4-char org prefix can repeat
      // across orgs, so the numeric tail must be globally monotonic per type.
      const counterType = `CONTRACT_${data.type}` as const; // e.g. "CONTRACT_LEASE"
      const seqValue = await getNextSequenceValue(tx, GLOBAL_SEQUENCE_SCOPE, counterType, year);
      const seq = String(seqValue).padStart(4, "0");
      const orgPrefix = session.organizationId.slice(0, 4).toUpperCase();
      const contractNumber = `${orgPrefix}-${data.type}-${year}-${seq}`;

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
    contract = await db.$transaction(async (tx) => {
      // Generate contract number atomically via sequence counter (race-safe)
      const year = new Date().getFullYear();
      const counterType = `CONTRACT_${data.type}` as const; // e.g. "CONTRACT_SALE"
      const seqValue = await getNextSequenceValue(tx, session.organizationId, counterType, year);
      const seq = String(seqValue).padStart(4, "0");
      const orgPrefix = session.organizationId.slice(0, 4).toUpperCase();
      const contractNumber = `${orgPrefix}-${data.type}-${year}-${seq}`;

      return tx.contract.create({
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

export async function getContracts(filters?: {
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await requirePermission("contracts:read");

  const where: any = {
    customer: { organizationId: session.organizationId },
  };

  if (filters?.status) where.status = filters.status;
  if (filters?.type) where.type = filters.type;

  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const contracts = await db.contract.findMany({
    where,
    include: {
      customer: true,
      unit: true,
      lease: { select: { id: true, startDate: true, endDate: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
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
  const allowed = CONTRACT_TRANSITIONS[contract.status];
  if (!allowed || !isValidContractTransition(contract.status, status)) {
    throw new Error(`This contract cannot be moved from its current status to the requested status. Please check the allowed workflow transitions.`);
  }

  // ── P2-2: single atomic transaction for all lifecycle writes ──────────────
  // The signing path (SIGNED) previously scattered writes across contract,
  // unit, customer, and lease without a transaction — a partial failure left
  // a SIGNED contract with stale unit/lease/customer state.  All writes for
  // every transition are now wrapped in one db.$transaction so the lifecycle
  // either commits entirely or rolls back entirely.
  //
  // Optimistic concurrency (SIGNED path): instead of a plain update we use
  // updateMany with the current status in the WHERE clause so that a
  // concurrent second sign attempt (race condition) produces count=0 and
  // throws a friendly error rather than silently double-writing.
  //
  // Post-tx calls (must stay outside the tx):
  //   • syncDealStageForUnit — uses the global `db` client directly and would
  //     create nested-transaction / connection-pool issues inside the tx.
  //   • logAuditEvent — fire-and-forget on `db`; designed as best-effort;
  //     consistent with pattern in leases.ts and every other action in this file.
  //   • revalidatePath — Next.js cache API; not a DB write.

  let updated: typeof contract;
  // Track whether syncDealStageForUnit needs to be called post-tx and with
  // which stage, so we can call it cleanly after the tx commits.
  let postTxSyncStage: "WON" | "QUALIFIED" | null = null;

  if (status === "SIGNED") {
    // SIGNED path — optimistic concurrency via updateMany + count check.
    // expectedFrom: DRAFT | SENT (both are valid predecessors per state machine).
    updated = await db.$transaction(async (tx) => {
      // Atomic optimistic-concurrency update — rejects the second concurrent sign.
      // Contract has no direct organizationId column; org guard was enforced by
      // the findFirst above (same request).  Here we scope by id + current status
      // so a concurrent second sign (race) produces count=0 and throws.
      const res = await tx.contract.updateMany({
        where: {
          id: contractId,
          status: { in: ["DRAFT", "SENT"] },
        },
        data: { status: "SIGNED", signedAt: new Date() },
      });
      if (res.count !== 1) {
        throw new Error(
          "This contract has already been signed or its status changed — please refresh and try again."
        );
      }

      // SALE: unit → SOLD
      if (contract.type === "SALE") {
        await tx.unit.update({
          where: { id: contract.unitId },
          data: { status: "SOLD" },
        });
      }

      // LEASE: unit → RENTED, customer → ACTIVE_TENANT, lease → ACTIVE
      if (contract.type === "LEASE") {
        await tx.unit.update({
          where: { id: contract.unitId },
          data: { status: "RENTED" },
        });
        // Tenancy lifecycle — writer of record is Customer.status (not the pipeline; § 4 / R3)
        await tx.customer.update({
          where: { id: contract.customerId },
          data: { status: "ACTIVE_TENANT" },
        });
        if (contract.leaseId) {
          await tx.lease.update({
            where: { id: contract.leaseId },
            data: { status: "ACTIVE" },
          });
        }
      }

      // Return the freshly updated contract (re-fetch inside tx so the
      // returned shape includes signedAt and is consistent with the tx state)
      const c = await tx.contract.findUniqueOrThrow({ where: { id: contractId } });
      return c as typeof contract;
    });

    // syncDealStageForUnit uses the global db client — must be called after tx commits
    if (contract.type === "SALE") {
      postTxSyncStage = "WON";
    }
    // LEASE signed — tenancy is written via Customer.status inside the tx;
    // pipeline sync is not needed for the LEASE signing path.

  } else {
    // NON-SIGNED path (SENT / CANCELLED / VOID) — all writes in one tx.
    updated = await db.$transaction(async (tx) => {
      const updateData: any = { status };
      const c = await tx.contract.update({
        where: { id: contractId },
        data: updateData,
      });

      // CANCELLED or VOID → free unit, terminate lease
      if (status === "CANCELLED" || status === "VOID") {
        const currentUnit = await tx.unit.findUnique({ where: { id: contract.unitId } });
        if (currentUnit && (currentUnit.status === "SOLD" || currentUnit.status === "RENTED")) {
          await tx.unit.update({
            where: { id: contract.unitId },
            data: { status: "AVAILABLE" },
          });
        }

        if (contract.leaseId) {
          await tx.lease.update({
            where: { id: contract.leaseId },
            data: { status: "TERMINATED" },
          });
        }

        // Check for other active contracts to decide whether to revert the pipeline
        const otherActive = await tx.contract.count({
          where: {
            customerId: contract.customerId,
            id: { not: contractId },
            status: { in: ["DRAFT", "SENT", "SIGNED"] },
          },
        });
        if (otherActive === 0) {
          // Flag for post-tx pipeline revert — syncDealStageForUnit uses global db
          postTxSyncStage = "QUALIFIED";
        }
      }

      return c as typeof contract;
    });
  }

  // ── Post-tx: pipeline sync (uses global db — must be outside the tx) ───────
  if (postTxSyncStage === "WON") {
    // Pipeline win — owned by the Deal entity (R3).
    await syncDealStageForUnit(contract.customerId, contract.unitId, "WON");
  } else if (postTxSyncStage === "QUALIFIED") {
    // Pipeline revert — derived from the Deal entity (R3).
    await syncDealStageForUnit(contract.customerId, contract.unitId, "QUALIFIED");
  }

  // ── Post-tx: audit log (fire-and-forget on global db — consistent with leases.ts) ──
  logAuditEvent({ userId: session.userId, userEmail: session.email, userRole: session.role, action: "UPDATE", resource: "Contract", resourceId: contractId, metadata: { previousStatus: contract.status, newStatus: status }, organizationId: session.organizationId });

  revalidatePath("/dashboard/contracts");
  revalidatePath("/dashboard/units");
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

