import { describe, it, expect } from "vitest";
import { CONTRACT_TRANSITIONS, isValidContractTransition } from "./state-machine";

const ALL_STATUSES = Object.keys(CONTRACT_TRANSITIONS);

describe("isValidContractTransition", () => {
  describe("legal transitions", () => {
    it("allows DRAFT -> SENT", () => {
      expect(isValidContractTransition("DRAFT", "SENT")).toBe(true);
    });
    it("allows DRAFT -> SIGNED", () => {
      expect(isValidContractTransition("DRAFT", "SIGNED")).toBe(true);
    });
    it("allows DRAFT -> CANCELLED", () => {
      expect(isValidContractTransition("DRAFT", "CANCELLED")).toBe(true);
    });
    it("allows SENT -> SIGNED", () => {
      expect(isValidContractTransition("SENT", "SIGNED")).toBe(true);
    });
    it("allows SENT -> CANCELLED", () => {
      expect(isValidContractTransition("SENT", "CANCELLED")).toBe(true);
    });
    it("allows SIGNED -> VOID", () => {
      expect(isValidContractTransition("SIGNED", "VOID")).toBe(true);
    });
  });

  describe("illegal and reverse transitions", () => {
    it("rejects SENT -> DRAFT", () => {
      expect(isValidContractTransition("SENT", "DRAFT")).toBe(false);
    });
    it("rejects SIGNED -> DRAFT", () => {
      expect(isValidContractTransition("SIGNED", "DRAFT")).toBe(false);
    });
    it("rejects SIGNED -> SENT", () => {
      expect(isValidContractTransition("SIGNED", "SENT")).toBe(false);
    });
    it("rejects DRAFT -> VOID", () => {
      expect(isValidContractTransition("DRAFT", "VOID")).toBe(false);
    });
    it("rejects SENT -> VOID", () => {
      expect(isValidContractTransition("SENT", "VOID")).toBe(false);
    });
  });

  describe("terminal states", () => {
    it("CANCELLED allows no transitions", () => {
      for (const to of ALL_STATUSES.filter((s) => s !== "CANCELLED")) {
        expect(isValidContractTransition("CANCELLED", to)).toBe(false);
      }
    });
    it("VOID allows no transitions", () => {
      for (const to of ALL_STATUSES.filter((s) => s !== "VOID")) {
        expect(isValidContractTransition("VOID", to)).toBe(false);
      }
    });
  });

  describe("unknown statuses", () => {
    it("rejects unknown from-status FOO -> SENT", () => {
      expect(isValidContractTransition("FOO", "SENT")).toBe(false);
    });
    it("rejects unknown to-status DRAFT -> FOO", () => {
      expect(isValidContractTransition("DRAFT", "FOO")).toBe(false);
    });
  });

  describe("same-state transitions", () => {
    it("rejects DRAFT -> DRAFT", () => {
      expect(isValidContractTransition("DRAFT", "DRAFT")).toBe(false);
    });
  });
});
