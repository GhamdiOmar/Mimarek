import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStubDb, type Row, type StubDb } from "./helpers/prisma-stub";
import { setSession, auth, signIn, signOut, type MockUser } from "./helpers/session-mock";

// ─────────────────────────────────────────────────────────────────────────────
// SEC-012 — marketplace inquiry must honour the buyer-visible predicate
//   (PUBLISHED + complianceStatus=APPROVED + not-expired + not-self), not just
//   status=PUBLISHED. A PENDING-compliance, expired, or self-owned listing must
//   surface "no longer available". An APPROVED + unexpired one is accepted.
//
// Wired like hardening-wave-a.test.ts: a stub db that honours the where-clause +
// the REAL guards from lib/auth-helpers running against a session we set.
// ─────────────────────────────────────────────────────────────────────────────

const ORG = "org_a"; // buyer org
const SELLER = "org_seller"; // a different seller org

let seed: Record<string, Row[]>;

const { dbHolder, dbProxy } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub holder
  const dbHolder: { stub: any } = { stub: undefined };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub proxy
  const dbProxy = new Proxy({} as any, { get: (_t, model) => dbHolder.stub?.[model] });
  return { dbHolder, dbProxy };
});

vi.mock("@repo/db", async () => {
  const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return { ...prisma, db: dbProxy };
});
vi.mock("../auth", () => ({ auth, signIn, signOut, handlers: {} }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- unstable_cache passthrough
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: any) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Map(), cookies: async () => new Map() }));
// PII crypto is exercised by its own suite — stub here so the inquiry write path
// (encryptCustomerData) doesn't need real keys / env.
vi.mock("../lib/pii-crypto", () => ({
  encryptCustomerData: (d: Record<string, unknown>) => ({ ...d, nationalIdHash: "h", phoneHash: "h", emailHash: "h" }),
  safeDecryptField: (v: unknown) => v,
}));
// Audit is a fire-and-forget side effect — neutralise it so a positive-path
// inquiry doesn't reach for unseeded infra. (notifyOrgAdmins is a LOCAL function
// in marketplace.ts; it self-no-ops when the seller org has no ADMIN/MANAGER
// users seeded, which is the case here, so no mock is needed for it.)
vi.mock("../lib/audit", () => ({ logAuditEvent: () => {} }));

import {
  confirmMarketplaceInterest,
} from "../app/actions/marketplace";
import { buyerVisibleWhere } from "../lib/marketplace/listing-view";

function asSession(id: string, over: Partial<MockUser> = {}): MockUser {
  return { id, email: `${id}@t.test`, name: "U", role: "ADMIN", organizationId: ORG, ...over };
}

const HOUR = 60 * 60 * 1000;

/** A buyer-org admin user row mirrored in the session-mock for SEC-003 re-read. */
function buyerUser(): Row {
  return { id: "u_buyer", role: "ADMIN", organizationId: ORG, name: "Buyer", email: "buyer@t.test", isActive: true, tokenVersion: 0, password: "x" };
}

function listing(over: Partial<Row> = {}): Row {
  return {
    id: "lst_1",
    listingNumber: "ML-2026-AAAAAA",
    sellerOrgId: SELLER,
    status: "PUBLISHED",
    complianceStatus: "APPROVED",
    expiresAt: null,
    interestCount: 0,
    sellerOrgSnapshot: { name: "Seller Co", nameEnglish: "Seller Co", nameArabic: "بائع" },
    ...over,
  };
}

function freshSeed(overListing: Partial<Row> = {}): Record<string, Row[]> {
  return {
    user: [buyerUser()],
    organization: [
      { id: ORG, name: "Buyer Org", nameArabic: "مشتري", nameEnglish: "Buyer Org", crNumber: "1010101010" },
      { id: SELLER, name: "Seller Org", nameArabic: "بائع", nameEnglish: "Seller Org", crNumber: "2020202020" },
    ],
    marketplaceListing: [listing(overListing)],
    marketplaceInquiry: [],
    customer: [],
    notification: [],
    // Rate-limiter counters live here; the limiter UPSERTs via $queryRaw which the
    // stub doesn't implement, but checkRateLimit fails-open on error (non-auth key),
    // so the inquiry path is never blocked by the limiter in these tests.
    rateLimitCounter: [],
  };
}

function seedWith(overListing: Partial<Row> = {}) {
  seed = freshSeed(overListing);
  dbHolder.stub = makeStubDb(seed) as StubDb;
  setSession(asSession("u_buyer"));
}

const VALID_PAYLOAD = { contactName: "Buyer Person", contactPhone: "0551234567", message: "Interested" };

beforeEach(() => {
  seedWith();
});

describe("SEC-012 — buyerVisibleWhere predicate shape", () => {
  it("returns the 4 visibility gates (status, compliance, not-self, expiry OR)", () => {
    const w = buyerVisibleWhere(ORG) as Record<string, unknown>;
    expect(w.status).toBe("PUBLISHED");
    expect(w.complianceStatus).toBe("APPROVED");
    expect(w.sellerOrgId).toEqual({ not: ORG });
    expect(w.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);
  });
});

describe("SEC-012 — confirmMarketplaceInterest honours buyer visibility", () => {
  it("rejects a PUBLISHED but PENDING-compliance listing (not APPROVED)", async () => {
    seedWith({ complianceStatus: "PENDING" });
    await expect(confirmMarketplaceInterest("lst_1", VALID_PAYLOAD)).rejects.toThrow(/no longer available/i);
  });

  it("rejects an APPROVED but expired listing", async () => {
    seedWith({ expiresAt: new Date(Date.now() - HOUR) });
    await expect(confirmMarketplaceInterest("lst_1", VALID_PAYLOAD)).rejects.toThrow(/no longer available/i);
  });

  it("rejects a self-owned listing (seller == buyer) via the not-self gate", async () => {
    seedWith({ sellerOrgId: ORG });
    await expect(confirmMarketplaceInterest("lst_1", VALID_PAYLOAD)).rejects.toThrow(/no longer available/i);
  });

  it("accepts an APPROVED + unexpired + cross-org listing (positive control)", async () => {
    seedWith(); // APPROVED, expiresAt=null, seller != buyer
    await expect(confirmMarketplaceInterest("lst_1", VALID_PAYLOAD)).resolves.toBeTruthy();
    // The inquiry write path ran: interestCount bumped, an inquiry + seller CRM customer exist.
    expect(seed.marketplaceListing![0]!.interestCount).toBe(1);
    expect(seed.marketplaceInquiry!.length).toBe(1);
    expect(seed.customer!.length).toBe(1);
    // Buyer's phone was routed through the encrypt path (stub) on the seller org.
    expect(seed.customer![0]!.organizationId).toBe(SELLER);
    expect(seed.customer![0]!.phoneHash).toBe("h");
  });

  it("accepts an APPROVED listing with a future expiry (unexpired)", async () => {
    seedWith({ expiresAt: new Date(Date.now() + HOUR) });
    await expect(confirmMarketplaceInterest("lst_1", VALID_PAYLOAD)).resolves.toBeTruthy();
  });
});
