"use server";

import { db } from "@repo/db";
import { getSessionOrThrow } from "../../lib/auth-helpers";

type UserPreferences = {
  landingPage?: string;
};

const ALLOWED_LANDING_PAGES = [
  "/dashboard",
  "/dashboard/projects",
  "/dashboard/units",
  "/dashboard/crm",
  "/dashboard/contracts",
  "/dashboard/leases",
  "/dashboard/finance",
  "/dashboard/maintenance",
  "/dashboard/reports",
  "/dashboard/settings",
];

export async function getUserPreferences(): Promise<UserPreferences> {
  const session = await getSessionOrThrow();
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { preferences: true },
  });
  return (user?.preferences as UserPreferences) ?? {};
}

export async function updateLandingPage(landingPage: string) {
  const session = await getSessionOrThrow();

  if (!ALLOWED_LANDING_PAGES.includes(landingPage)) {
    throw new Error("The selected landing page is not valid. Please choose a different option.");
  }

  const current = await db.user.findUnique({
    where: { id: session.userId },
    select: { preferences: true },
  });

  const prefs = (current?.preferences as UserPreferences) ?? {};

  await db.user.update({
    where: { id: session.userId },
    data: { preferences: { ...prefs, landingPage } },
  });

  return { success: true };
}
