import { describe, it, expect } from "vitest";
import { computeNextRunDate } from "./recurrence";

// Fixed anchor date: 2026-03-15 (local time)
const FROM = new Date(2026, 2, 15);

describe("computeNextRunDate", () => {
  describe("each recurrence type from 2026-03-15 with interval 1", () => {
    it("DAILY -> 2026-03-16", () => {
      expect(computeNextRunDate("DAILY", 1, FROM)).toEqual(new Date(2026, 2, 16));
    });
    it("WEEKLY -> 2026-03-22", () => {
      expect(computeNextRunDate("WEEKLY", 1, FROM)).toEqual(new Date(2026, 2, 22));
    });
    it("BIWEEKLY -> 2026-03-29", () => {
      expect(computeNextRunDate("BIWEEKLY", 1, FROM)).toEqual(new Date(2026, 2, 29));
    });
    it("MONTHLY -> 2026-04-15", () => {
      expect(computeNextRunDate("MONTHLY", 1, FROM)).toEqual(new Date(2026, 3, 15));
    });
    it("QUARTERLY -> 2026-06-15", () => {
      expect(computeNextRunDate("QUARTERLY", 1, FROM)).toEqual(new Date(2026, 5, 15));
    });
    it("SEMI_ANNUAL -> 2026-09-15", () => {
      expect(computeNextRunDate("SEMI_ANNUAL", 1, FROM)).toEqual(new Date(2026, 8, 15));
    });
    it("ANNUAL -> 2027-03-15", () => {
      expect(computeNextRunDate("ANNUAL", 1, FROM)).toEqual(new Date(2027, 2, 15));
    });
  });

  describe("interval > 1", () => {
    it("WEEKLY interval 2 = 14 days -> 2026-03-29", () => {
      expect(computeNextRunDate("WEEKLY", 2, FROM)).toEqual(new Date(2026, 2, 29));
    });
    it("MONTHLY interval 3 -> 2026-06-15", () => {
      expect(computeNextRunDate("MONTHLY", 3, FROM)).toEqual(new Date(2026, 5, 15));
    });
    it("DAILY interval 10 -> 2026-03-25", () => {
      expect(computeNextRunDate("DAILY", 10, FROM)).toEqual(new Date(2026, 2, 25));
    });
  });

  describe("JS date quirks (pinned current behavior, not 'fixed')", () => {
    it("MONTHLY from Jan 31 2026 rolls over: Feb 31 -> Mar 3 2026", () => {
      // setMonth(1) on day 31 produces Feb 31, which JS normalizes to Mar 3
      // (2026 is not a leap year: 31 - 28 = 3).
      const result = computeNextRunDate("MONTHLY", 1, new Date(2026, 0, 31));
      expect(result).toEqual(new Date(2026, 2, 3));
    });
    it("ANNUAL from Feb 29 2024 -> Mar 1 2025 (no Feb 29 in 2025)", () => {
      // setFullYear(2025) on Feb 29 produces the nonexistent Feb 29 2025,
      // which JS normalizes to Mar 1 2025.
      const result = computeNextRunDate("ANNUAL", 1, new Date(2024, 1, 29));
      expect(result).toEqual(new Date(2025, 2, 1));
    });
  });

  describe("unknown recurrence type", () => {
    it("FORTNIGHTLY falls through to the default case (behaves like MONTHLY)", () => {
      const unknown = computeNextRunDate("FORTNIGHTLY", 1, FROM);
      const monthly = computeNextRunDate("MONTHLY", 1, FROM);
      expect(unknown).toEqual(monthly);
      expect(unknown).toEqual(new Date(2026, 3, 15));
    });
  });

  describe("input immutability", () => {
    it("does not mutate the input date", () => {
      const input = new Date(2026, 2, 15);
      const before = input.getTime();
      computeNextRunDate("MONTHLY", 1, input);
      expect(input.getTime()).toBe(before);
    });
  });
});
