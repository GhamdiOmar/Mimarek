import { describe, it, expect } from "vitest";
import type { SubscriptionStatus } from "@prisma/client";
import {
  SUBSCRIPTION_TRANSITIONS,
  isValidSubscriptionTransition,
} from "./subscription-transitions";

const ALL_STATUSES = Object.keys(SUBSCRIPTION_TRANSITIONS) as SubscriptionStatus[];

describe("isValidSubscriptionTransition", () => {
  describe("legal transitions", () => {
    it("allows CANCELED → ACTIVE (resubscribe)", () => {
      expect(isValidSubscriptionTransition("CANCELED", "ACTIVE")).toBe(true);
    });

    it("allows PAUSED → ACTIVE", () => {
      expect(isValidSubscriptionTransition("PAUSED", "ACTIVE")).toBe(true);
    });

    it("allows PAUSED → CANCELED", () => {
      expect(isValidSubscriptionTransition("PAUSED", "CANCELED")).toBe(true);
    });

    it("allows ACTIVE → PAUSED", () => {
      expect(isValidSubscriptionTransition("ACTIVE", "PAUSED")).toBe(true);
    });

    it.each(["ACTIVE", "PAST_DUE", "CANCELED"] as SubscriptionStatus[])(
      "allows TRIALING → %s",
      (to) => {
        expect(isValidSubscriptionTransition("TRIALING", to)).toBe(true);
      }
    );

    it.each(["ACTIVE", "UNPAID", "CANCELED"] as SubscriptionStatus[])(
      "allows PAST_DUE → %s",
      (to) => {
        expect(isValidSubscriptionTransition("PAST_DUE", to)).toBe(true);
      }
    );

    it.each(["ACTIVE", "CANCELED"] as SubscriptionStatus[])(
      "allows UNPAID → %s",
      (to) => {
        expect(isValidSubscriptionTransition("UNPAID", to)).toBe(true);
      }
    );
  });

  describe("illegal transitions", () => {
    it("rejects CANCELED → PAUSED", () => {
      expect(isValidSubscriptionTransition("CANCELED", "PAUSED")).toBe(false);
    });

    it("rejects PAUSED → PAST_DUE", () => {
      expect(isValidSubscriptionTransition("PAUSED", "PAST_DUE")).toBe(false);
    });

    it("rejects ACTIVE → UNPAID", () => {
      expect(isValidSubscriptionTransition("ACTIVE", "UNPAID")).toBe(false);
    });

    it.each(ALL_STATUSES)(
      "rejects %s → TRIALING (nothing may re-enter trial)",
      (from) => {
        expect(isValidSubscriptionTransition(from, "TRIALING")).toBe(false);
      }
    );

    it("rejects same-state ACTIVE → ACTIVE (no-op short-circuit is the caller's job)", () => {
      expect(isValidSubscriptionTransition("ACTIVE", "ACTIVE")).toBe(false);
    });
  });
});
