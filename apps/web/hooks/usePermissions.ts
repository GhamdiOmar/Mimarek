"use client";

import { useSession } from "../components/SimpleSessionProvider";
import { hasPermission, type Permission } from "../lib/permissions";

export function usePermissions() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "USER";

  return {
    can: (permission: Permission) => hasPermission(role, permission),
    role,
  };
}
