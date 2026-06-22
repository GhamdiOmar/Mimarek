import { describe, it, expect } from "vitest";
import {
  SYSTEM_ONLY_PERMISSIONS,
  TENANT_SCOPED_PERMISSIONS,
  ROLE_PERMISSIONS,
} from "../lib/permissions";
import { routeGuardForPath } from "../lib/route-guards";

/**
 * §8.4 permission-wiring gate for the two ZATCA permissions. Permission membership
 * in these arrays is exactly what drives requirePermission()'s Layer-3 audience
 * rejection, so asserting the arrays verifies the wiring without session mocking.
 */
describe("ZATCA permission wiring (§8.4)", () => {
  it("zatca:admin is SYSTEM_ONLY → a tenant ADMIN never inherits it; both system roles hold it", () => {
    expect(SYSTEM_ONLY_PERMISSIONS).toContain("zatca:admin");
    // ADMIN = ALL_PERMISSIONS minus SYSTEM_ONLY → must NOT include zatca:admin.
    expect(ROLE_PERMISSIONS.ADMIN).not.toContain("zatca:admin");
    expect(ROLE_PERMISSIONS.SYSTEM_ADMIN).toContain("zatca:admin");
    expect(ROLE_PERMISSIONS.SYSTEM_SUPPORT).toContain("zatca:admin");
  });

  it("zatca:config is TENANT_SCOPED → system roles rejected by Layer 3; tenant ADMIN + FINANCE hold it", () => {
    expect(TENANT_SCOPED_PERMISSIONS).toContain("zatca:config");
    expect(ROLE_PERMISSIONS.ADMIN).toContain("zatca:config");
    expect(ROLE_PERMISSIONS.FINANCE).toContain("zatca:config");
    // SYSTEM_ADMIN technically holds it (ALL_PERMISSIONS), but requirePermission("zatca:config")
    // rejects system roles because it is TENANT_SCOPED — the Layer-3 rule in auth-helpers.
  });

  it("zatca:config is NOT held by MANAGER (R3 — only ADMIN + FINANCE reach /dashboard/settings/zatca)", () => {
    expect(ROLE_PERMISSIONS.MANAGER).not.toContain("zatca:config");
  });

  it("the R3 tenant config route resolves to an EXPLICIT guard, NOT the parent /dashboard/settings", () => {
    // Without an explicit entry, longest-prefix would inherit /dashboard/settings's
    // organization:read — the wrong permission. Assert the dedicated gate.
    const guard = routeGuardForPath("/dashboard/settings/zatca");
    expect(guard).toEqual({ permission: "zatca:config", audience: "tenant" });
    // The parent stays organization:read — proving the explicit entry won the match.
    expect(routeGuardForPath("/dashboard/settings")).toEqual({
      permission: "organization:read",
      audience: "tenant",
    });
  });
});
