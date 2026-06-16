/**
 * Settable NextAuth session for runtime server-action tests.
 *
 * The actions under test call the REAL `requirePermission` /
 * `getSessionWithPermissions` from `lib/auth-helpers`, which in turn call
 * `auth()` from `apps/web/auth.ts`. We mock ONLY that `auth.ts` module so the
 * real guard chain (permission check + §8 audience check + org-context check)
 * runs against a session we control — i.e. we test the production guards, not a
 * reimplementation.
 *
 * Usage (in a test file, before importing any action):
 *
 *   vi.mock("../auth", () => import("./helpers/session-mock"));  // path relative to the action
 *   // or, when the test lives in __tests__:
 *   vi.mock("../../auth", () => ({ auth: mockAuth }));
 *
 * Because vi.mock is hoisted, the cleanest pattern is to import `setSession`
 * here and have the mock factory return `{ auth }` from this module.
 */

export type MockUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  organizationId: string | null;
};

let current: { user: MockUser } | null = null;

/** Set (or clear) the session that the next `auth()` call will return. */
export function setSession(user: MockUser | null): void {
  current = user ? { user } : null;
}

/** Convenience: a tenant ADMIN bound to the given org (holds all tenant perms). */
export function tenantAdmin(organizationId: string, overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: `user_${organizationId}`,
    email: `admin@${organizationId}.test`,
    name: "Test Admin",
    role: "ADMIN",
    organizationId,
    ...overrides,
  };
}

/** The mocked NextAuth `auth()` — returns the session set via setSession(). */
export async function auth() {
  return current;
}

// Stubs so a `import { signIn } from "../auth"` elsewhere doesn't explode if pulled in.
export const signIn = async () => undefined;
export const signOut = async () => undefined;
export const handlers = {};
