"use server";

import { db, Prisma, ContractStatus, ContractType, RecurrenceType } from "@repo/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "../../lib/auth-helpers";
import { logAuditEvent } from "../../lib/audit";
import { ROUTES, routeToContract } from "../../lib/routes";
import { serialize } from "../../lib/serialize";
import { syncDealStageForUnit } from "../../lib/server/pipeline-sync";
import { getNextSequenceValue, GLOBAL_SEQUENCE_SCOPE } from "../../lib/sequence";
import { CONTRACT_TRANSITIONS, isValidContractTransition } from "../../lib/contracts/state-machine";

const FREQUENCY_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
};

/**
 * Compute the rent-installment schedule for a lease term.
 *
 * Single source of truth for the schedule shape — used by BOTH createContract
 * (initial generation) and updateContract (recreation when lease terms change).
 * Returns the per-installment rows WITHOUT a leaseId so each caller can attach
 * the lease id it owns. Keeping this pure (no `tx`) lets both paths reuse the
 * exact same date/amount math, so an edited lease can never drift from a freshly
 * created one. (`"use server"` files may export only async functions — see § 4 —
 * so this stays a module-private non-exported helper, not an `export`.)
 */
function buildRentInstallments(input: {
  startDate: Date;
  endDate: Date;
  amount: number;
  paymentFrequency: string;
}): Array<{ dueDate: Date; amount: number; status: "UNPAID" }> {
  const { startDate, endDate, amount, paymentFrequency } = input;
  const freqMonths = FREQUENCY_MONTHS[paymentFrequency] || 1;
  const totalMonths = Math.max(
    1,
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth()),
  );
  const installmentCount = Math.max(1, Math.ceil(totalMonths / freqMonths));
  const installmentAmount = amount / installmentCount;

  const installments: Array<{ dueDate: Date; amount: number; status: "UNPAID" }> = [];
  for (let i = 0; i < installmentCount; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i * freqMonths);
    installments.push({ dueDate, amount: installmentAmount, status: "UNPAID" });
  }
  return installments;
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
    // Capture the narrowed frequency in a local const — the outer `if` narrowing
    // does not survive into the async tx closure (data could mutate before run).
    const paymentFrequency = data.paymentFrequency;

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
          organizationId: session.organizationId,
          unitId: data.unitId,
          customerId: data.customerId,
          startDate: start,
          endDate: end,
          totalAmount: data.amount,
          status: "DRAFT",
        },
      });

      // Generate rent installments (shared schedule logic — see buildRentInstallments)
      const installments = buildRentInstallments({
        startDate: start,
        endDate: end,
        amount: data.amount,
        paymentFrequency,
      }).map((inst) => ({ ...inst, leaseId: lease.id }));
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
          paymentFrequency: data.paymentFrequency as RecurrenceType,
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

  revalidatePath(ROUTES.contracts);
  return serialize(contract);
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

  return serialize(contract);
}

export async function getContracts(filters?: {
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await requirePermission("contracts:read");

  const where: Prisma.ContractWhereInput = {
    customer: { organizationId: session.organizationId },
  };

  if (filters?.status) where.status = filters.status as ContractStatus;
  if (filters?.type) where.type = filters.type as ContractType;

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
  return serialize(contracts);
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
      // returned shape includes signedAt and is consistent with the tx state).
      // Re-fetch WITH the customer relation so the returned shape honestly
      // matches `typeof contract` (which includes customer) — no cast/shape-lie.
      const c = await tx.contract.findUniqueOrThrow({
        where: { id: contractId },
        include: { customer: true },
      });
      return c;
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
      const updateData: Prisma.ContractUpdateInput = { status };
      // Include the customer relation so the returned shape honestly matches
      // `typeof contract` (no cast/shape-lie — see the SIGNED branch above).
      const c = await tx.contract.update({
        where: { id: contractId },
        data: updateData,
        include: { customer: true },
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

      return c;
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

  revalidatePath(ROUTES.contracts);
  revalidatePath(ROUTES.units);
  return serialize(updated);
}

/**
 * Edit a DRAFT contract's core terms (CX-011).
 *
 * DRAFT is the only freely-editable state (state-machine.ts): once a contract is
 * SENT/SIGNED/CANCELLED/VOID its terms are locked. This is enforced on BOTH the
 * server (throw below) and the client (the Edit button only renders for DRAFT).
 *
 * For LEASE contracts, if the term-defining inputs (startDate / endDate /
 * paymentFrequency / amount) change, the rent-installment schedule is REGENERATED
 * from scratch (delete + recreate via the shared buildRentInstallments helper) so
 * no stale installment rows survive an edit. The lease row's dates/totalAmount are
 * updated in the same atomic transaction.
 */
export async function updateContract(
  contractId: string,
  data: {
    customerId: string;
    unitId: string;
    amount: number;
    notes?: string;
    // LEASE-only term fields
    startDate?: string;
    endDate?: string;
    paymentFrequency?: string;
  },
) {
  const session = await requirePermission("contracts:write");

  // Load the contract (org-scoped) + its lease so we can diff term changes.
  const contract = await db.contract.findFirst({
    where: { id: contractId, customer: { organizationId: session.organizationId } },
    include: { lease: true },
  });
  if (!contract) {
    throw new Error("Contract not found or you don't have access. Please verify the contract exists.");
  }

  // DRAFT-only — only draft contracts can be edited (server enforcement).
  if (contract.status !== "DRAFT") {
    throw new Error("Forbidden: only DRAFT contracts can be edited");
  }

  // Validate amount
  if (!data.amount || data.amount <= 0 || !Number.isFinite(data.amount)) {
    throw new Error("Please enter a valid contract amount. The amount must be a positive number.");
  }

  // Verify the (possibly changed) customer + unit belong to the org.
  const customer = await db.customer.findFirst({
    where: { id: data.customerId, organizationId: session.organizationId },
  });
  if (!customer) {
    throw new Error("Customer not found or you don't have access. Please verify the customer exists in your organization.");
  }
  const unit = await db.unit.findFirst({
    where: { id: data.unitId, organizationId: session.organizationId },
  });
  if (!unit) {
    throw new Error("Unit not found or you don't have access. Please verify the unit exists in your organization.");
  }

  const isLease = contract.type === "LEASE";

  // LEASE term validation (mirrors createContract's Ejar rules for edited terms).
  if (isLease) {
    if (!data.startDate || !data.endDate) {
      throw new Error("Start date and end date are required for lease contracts. Please provide both dates.");
    }
    if (!data.paymentFrequency) {
      throw new Error("Payment frequency is required for lease contracts. Please select a payment schedule (monthly, quarterly, etc.).");
    }
  }

  // Snapshot BEFORE for the audit field-diff.
  const before: Record<string, unknown> = {
    customerId: contract.customerId,
    unitId: contract.unitId,
    amount: contract.amount,
    notes: contract.notes,
    ...(isLease
      ? {
          startDate: contract.lease?.startDate ?? null,
          endDate: contract.lease?.endDate ?? null,
          paymentFrequency: contract.paymentFrequency ?? null,
        }
      : {}),
  };

  // Determine whether the lease schedule must be regenerated.
  const newStart = data.startDate ? new Date(data.startDate) : null;
  const newEnd = data.endDate ? new Date(data.endDate) : null;
  const termChanged =
    isLease &&
    !!newStart &&
    !!newEnd &&
    (contract.lease?.startDate?.getTime() !== newStart.getTime() ||
      contract.lease?.endDate?.getTime() !== newEnd.getTime() ||
      contract.paymentFrequency !== data.paymentFrequency ||
      Number(contract.amount) !== data.amount);

  const updated = await db.$transaction(async (tx) => {
    // 1) Update core contract terms.
    const c = await tx.contract.update({
      where: { id: contractId },
      data: {
        customerId: data.customerId,
        unitId: data.unitId,
        amount: data.amount,
        notes: data.notes,
        ...(isLease
          ? { paymentFrequency: data.paymentFrequency as RecurrenceType }
          : {}),
      },
    });

    // 2) LEASE: keep the linked lease row in sync, and recreate installments
    //    whenever a term-defining input changed (no stale rows left behind).
    if (isLease && contract.leaseId && newStart && newEnd) {
      await tx.lease.update({
        where: { id: contract.leaseId },
        data: {
          customerId: data.customerId,
          unitId: data.unitId,
          startDate: newStart,
          endDate: newEnd,
          totalAmount: data.amount,
        },
      });

      if (termChanged) {
        // Delete-and-regenerate the schedule via the SAME logic as createContract.
        await tx.rentInstallment.deleteMany({ where: { leaseId: contract.leaseId } });
        const installments = buildRentInstallments({
          startDate: newStart,
          endDate: newEnd,
          amount: data.amount,
          paymentFrequency: data.paymentFrequency!,
        }).map((inst) => ({ ...inst, leaseId: contract.leaseId! }));
        await tx.rentInstallment.createMany({ data: installments });
      }
    }

    return c;
  });

  // Snapshot AFTER — drives logAuditEvent's fieldChanges diff.
  const after: Record<string, unknown> = {
    customerId: data.customerId,
    unitId: data.unitId,
    amount: data.amount,
    notes: data.notes ?? null,
    ...(isLease
      ? {
          startDate: newStart,
          endDate: newEnd,
          paymentFrequency: data.paymentFrequency ?? null,
        }
      : {}),
  };

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "Contract",
    resourceId: contractId,
    before,
    after,
    metadata: { installmentsRecreated: termChanged },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.contracts);
  revalidatePath(routeToContract(contractId));
  return serialize(updated);
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

  revalidatePath(ROUTES.contracts);
  revalidatePath(ROUTES.units);
}

// ─── CX-010: Bulk operations on contracts ───────────────────────────────────

/**
 * Bulk status transition (CX-010) — e.g. "Send selected" / "Cancel selected".
 *
 * Each contract's transition is validated independently via the state machine
 * (isValidContractTransition); ids whose current status can't reach the target
 * are SKIPPED (collected + reported back), never forced. All valid transitions
 * commit in one atomic transaction so a mid-batch failure rolls the whole batch
 * back. Org scope is enforced by the findMany filter. Destructive targets
 * (CANCELLED / VOID) require contracts:delete; others require contracts:write.
 */
export async function bulkUpdateContractStatus(
  ids: string[],
  targetStatus: "SENT" | "SIGNED" | "CANCELLED" | "VOID",
) {
  const permission =
    targetStatus === "CANCELLED" || targetStatus === "VOID" ? "contracts:delete" : "contracts:write";
  const session = await requirePermission(permission);

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("No contracts were selected. Please select at least one contract.");
  }

  // Org-scoped load — anything not in the caller's org simply isn't returned.
  const contracts = await db.contract.findMany({
    where: { id: { in: ids }, customer: { organizationId: session.organizationId } },
    select: { id: true, status: true, type: true, unitId: true, customerId: true, leaseId: true },
  });

  const eligible = contracts.filter((c) => isValidContractTransition(c.status, targetStatus));
  const skipped = contracts
    .filter((c) => !isValidContractTransition(c.status, targetStatus))
    .map((c) => c.id);
  // ids the caller passed that weren't found in their org (also skipped).
  const foundIds = new Set(contracts.map((c) => c.id));
  const notFound = ids.filter((id) => !foundIds.has(id));

  if (eligible.length === 0) {
    throw new Error(
      "None of the selected contracts can move to the requested status. Please check their current statuses.",
    );
  }

  await db.$transaction(async (tx) => {
    for (const c of eligible) {
      await tx.contract.update({
        where: { id: c.id },
        data: {
          status: targetStatus,
          ...(targetStatus === "SIGNED" ? { signedAt: new Date() } : {}),
        },
      });

      // Side-effects mirror updateContractStatus so unit/lease/customer state
      // stays consistent for the transitions exposed in the bulk toolbar.
      if (targetStatus === "SIGNED") {
        if (c.type === "SALE") {
          await tx.unit.update({ where: { id: c.unitId }, data: { status: "SOLD" } });
        } else {
          await tx.unit.update({ where: { id: c.unitId }, data: { status: "RENTED" } });
          await tx.customer.update({ where: { id: c.customerId }, data: { status: "ACTIVE_TENANT" } });
          if (c.leaseId) {
            await tx.lease.update({ where: { id: c.leaseId }, data: { status: "ACTIVE" } });
          }
        }
      }

      if (targetStatus === "CANCELLED" || targetStatus === "VOID") {
        const currentUnit = await tx.unit.findUnique({ where: { id: c.unitId } });
        if (currentUnit && (currentUnit.status === "SOLD" || currentUnit.status === "RENTED")) {
          await tx.unit.update({ where: { id: c.unitId }, data: { status: "AVAILABLE" } });
        }
        if (c.leaseId) {
          await tx.lease.update({ where: { id: c.leaseId }, data: { status: "TERMINATED" } });
        }
      }
    }
  });

  // One audit event for the whole batch (§ — bulk = single event).
  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "UPDATE",
    resource: "Contract",
    metadata: {
      bulk: true,
      targetStatus,
      updatedIds: eligible.map((c) => c.id),
      updatedCount: eligible.length,
      skippedIds: [...skipped, ...notFound],
    },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.contracts);
  revalidatePath(ROUTES.units);
  return {
    updatedCount: eligible.length,
    skippedCount: skipped.length + notFound.length,
    skippedIds: [...skipped, ...notFound],
  };
}

/**
 * Bulk delete contracts (CX-010) — DRAFT-only, server-enforced.
 *
 * Any non-DRAFT id in the batch makes the whole call throw (no partial delete of
 * a mixed selection), matching deleteContract's single-row rule. Org scope via
 * the findMany filter; requires contracts:delete; one atomic transaction; one
 * audit event. Linked leases + their installments are removed first (same
 * unlink-then-delete order as deleteContract).
 */
export async function bulkDeleteContracts(ids: string[]) {
  const session = await requirePermission("contracts:delete");

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("No contracts were selected. Please select at least one contract.");
  }

  const contracts = await db.contract.findMany({
    where: { id: { in: ids }, customer: { organizationId: session.organizationId } },
    select: { id: true, status: true, leaseId: true },
  });

  const foundIds = new Set(contracts.map((c) => c.id));
  const notFound = ids.filter((id) => !foundIds.has(id));
  if (notFound.length > 0) {
    throw new Error("Some selected contracts could not be found or you don't have access to them.");
  }

  // DRAFT-only — reject the whole batch if any contract is not a draft.
  const nonDraft = contracts.filter((c) => c.status !== "DRAFT");
  if (nonDraft.length > 0) {
    throw new Error("Only draft contracts can be deleted. Use Cancel or Void for active contracts.");
  }

  await db.$transaction(async (tx) => {
    for (const c of contracts) {
      if (c.leaseId) {
        await tx.rentInstallment.deleteMany({ where: { leaseId: c.leaseId } });
        await tx.contract.update({ where: { id: c.id }, data: { leaseId: null } });
        await tx.lease.delete({ where: { id: c.leaseId } });
      }
      await tx.contract.delete({ where: { id: c.id } });
    }
  });

  logAuditEvent({
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    action: "DELETE",
    resource: "Contract",
    metadata: { bulk: true, deletedIds: contracts.map((c) => c.id), deletedCount: contracts.length },
    organizationId: session.organizationId,
  });

  revalidatePath(ROUTES.contracts);
  revalidatePath(ROUTES.units);
  return { deletedCount: contracts.length };
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

  revalidatePath(routeToContract(contractId));
  return serialize(updated);
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

  revalidatePath(routeToContract(contractId));
  return serialize(updated);
}

