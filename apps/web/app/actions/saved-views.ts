"use server";

import { db, Prisma } from "@repo/db";
import { z } from "zod";
import { getSessionWithPermissions } from "../../lib/auth-helpers";

// ─── Saved DataTable views (CX-014) ─────────────────────────────────────────────
//
// Personal, DB-backed view configs for the shared DataTable. Every query is scoped
// by BOTH organizationId AND userId — a user may only read/write their OWN views,
// never another user's and never another tenant's (no cross-user, no cross-tenant).
// `isShared` exists on the model for a future org-wide-views feature; it is ignored
// in these queries for now (personal-only).
//
// `getSessionWithPermissions()` returns a tenant session (throws for org-less /
// system users), giving us a non-null organizationId + userId to scope on.

const TABLE_KEY_MAX = 64;
const VIEW_NAME_MAX = 80;

const tableKeySchema = z.string().trim().min(1).max(TABLE_KEY_MAX);
const viewNameSchema = z.string().trim().min(1).max(VIEW_NAME_MAX);

const createInputSchema = z.object({
  tableKey: tableKeySchema,
  name: viewNameSchema,
  config: z.unknown(),
});

const updateInputSchema = z.object({
  id: z.string().min(1),
  name: viewNameSchema.optional(),
  config: z.unknown().optional(),
});

export type SavedTableViewDTO = {
  id: string;
  tableKey: string;
  name: string;
  config: unknown;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Personal views for the current user+org+tableKey, ordered by name. */
export async function getSavedViews(tableKey: string): Promise<SavedTableViewDTO[]> {
  const key = tableKeySchema.parse(tableKey);
  const session = await getSessionWithPermissions();

  const views = await db.savedTableView.findMany({
    where: {
      organizationId: session.organizationId,
      userId: session.userId,
      tableKey: key,
    },
    orderBy: { name: "asc" },
  });

  return JSON.parse(JSON.stringify(views)) as SavedTableViewDTO[];
}

/** Create a personal view owned by the current user+org. */
export async function createSavedView(input: {
  tableKey: string;
  name: string;
  config: unknown;
}): Promise<SavedTableViewDTO> {
  const { tableKey, name, config } = createInputSchema.parse(input);
  const session = await getSessionWithPermissions();

  const created = await db.savedTableView.create({
    data: {
      organizationId: session.organizationId,
      userId: session.userId,
      tableKey,
      name,
      config: (config ?? {}) as Prisma.InputJsonValue,
    },
  });

  return JSON.parse(JSON.stringify(created)) as SavedTableViewDTO;
}

/** Update name/config of a view the current user owns (own + same org only). */
export async function updateSavedView(input: {
  id: string;
  name?: string;
  config?: unknown;
}): Promise<SavedTableViewDTO> {
  const { id, name, config } = updateInputSchema.parse(input);
  const session = await getSessionWithPermissions();

  // Scope the update to the caller's own row in their org. `updateMany` returns a
  // count rather than throwing on a no-match, so we can reject cross-user/-tenant
  // writes explicitly instead of leaking another row's existence.
  const result = await db.savedTableView.updateMany({
    where: {
      id,
      organizationId: session.organizationId,
      userId: session.userId,
    },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(config !== undefined ? { config: config as Prisma.InputJsonValue } : {}),
    },
  });

  if (result.count === 0) {
    throw new Error("Saved view not found");
  }

  const updated = await db.savedTableView.findFirstOrThrow({
    where: {
      id,
      organizationId: session.organizationId,
      userId: session.userId,
    },
  });

  return JSON.parse(JSON.stringify(updated)) as SavedTableViewDTO;
}

/** Delete a view the current user owns (own + same org only). */
export async function deleteSavedView(id: string): Promise<{ success: true }> {
  const viewId = z.string().min(1).parse(id);
  const session = await getSessionWithPermissions();

  const result = await db.savedTableView.deleteMany({
    where: {
      id: viewId,
      organizationId: session.organizationId,
      userId: session.userId,
    },
  });

  if (result.count === 0) {
    throw new Error("Saved view not found");
  }

  return { success: true };
}
