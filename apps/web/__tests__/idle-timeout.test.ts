import { describe, it, expect } from "vitest";
import {
  IDLE_TIMEOUT_MINUTES_BY_ROLE,
  IDLE_TIMEOUT_MINUTES_STRICTEST,
  IDLE_WARNING_MINUTES,
  getIdleTimeoutMinutes,
  evaluateIdleState,
} from "../lib/idle-timeout-config";

const MIN = 60_000;

describe("getIdleTimeoutMinutes — role → minutes", () => {
  it("maps each known role to its configured tier", () => {
    expect(getIdleTimeoutMinutes("SYSTEM_ADMIN")).toBe(15);
    expect(getIdleTimeoutMinutes("SYSTEM_SUPPORT")).toBe(15);
    expect(getIdleTimeoutMinutes("ADMIN")).toBe(30);
    expect(getIdleTimeoutMinutes("MANAGER")).toBe(30);
    expect(getIdleTimeoutMinutes("FINANCE")).toBe(30);
    expect(getIdleTimeoutMinutes("AGENT")).toBe(45);
    expect(getIdleTimeoutMinutes("LEASING")).toBe(45);
    expect(getIdleTimeoutMinutes("TECHNICIAN")).toBe(45);
    expect(getIdleTimeoutMinutes("USER")).toBe(60);
  });

  it("every mapped value matches the exported table (no drift)", () => {
    for (const [role, minutes] of Object.entries(IDLE_TIMEOUT_MINUTES_BY_ROLE)) {
      expect(getIdleTimeoutMinutes(role)).toBe(minutes);
    }
  });

  it("fails SECURE for an unknown role — strictest tier, never the longest", () => {
    expect(getIdleTimeoutMinutes("SOME_FUTURE_ROLE")).toBe(IDLE_TIMEOUT_MINUTES_STRICTEST);
    expect(getIdleTimeoutMinutes("SOME_FUTURE_ROLE")).toBe(15);
    expect(getIdleTimeoutMinutes("")).toBe(15);
  });

  it("fails SECURE for an undefined role", () => {
    expect(getIdleTimeoutMinutes(undefined)).toBe(15);
  });

  it("does not treat inherited Object.prototype keys as roles", () => {
    // Guards against a `"toString" in obj`-style false positive.
    expect(getIdleTimeoutMinutes("toString")).toBe(15);
    expect(getIdleTimeoutMinutes("constructor")).toBe(15);
  });
});

describe("evaluateIdleState — pure idle decision", () => {
  const timeoutMs = 30 * MIN;
  const warningLeadMs = IDLE_WARNING_MINUTES * MIN; // 2 min

  it("is neither warning nor timed out well before the deadline", () => {
    expect(evaluateIdleState(0, timeoutMs, warningLeadMs)).toEqual({
      timedOut: false,
      warning: false,
      secondsLeft: 0,
    });
    expect(evaluateIdleState(10 * MIN, timeoutMs, warningLeadMs).warning).toBe(false);
  });

  it("enters the warning window exactly at (timeout − warningLead)", () => {
    const justBefore = evaluateIdleState(28 * MIN - 1, timeoutMs, warningLeadMs);
    expect(justBefore.warning).toBe(false);

    const atWarning = evaluateIdleState(28 * MIN, timeoutMs, warningLeadMs);
    expect(atWarning.warning).toBe(true);
    expect(atWarning.timedOut).toBe(false);
    // 2 minutes remain at the moment the warning opens.
    expect(atWarning.secondsLeft).toBe(120);
  });

  it("counts down whole seconds inside the warning window", () => {
    // 90s before the deadline.
    const state = evaluateIdleState(timeoutMs - 90_000, timeoutMs, warningLeadMs);
    expect(state.warning).toBe(true);
    expect(state.secondsLeft).toBe(90);
  });

  it("times out at (and past) the deadline, and never reports negative seconds", () => {
    const atDeadline = evaluateIdleState(timeoutMs, timeoutMs, warningLeadMs);
    expect(atDeadline.timedOut).toBe(true);
    expect(atDeadline.warning).toBe(false);
    expect(atDeadline.secondsLeft).toBe(0);

    const past = evaluateIdleState(timeoutMs + 5 * MIN, timeoutMs, warningLeadMs);
    expect(past.timedOut).toBe(true);
    expect(past.secondsLeft).toBe(0);
  });

  it("catches up correctly when the tab was frozen past the deadline (sleeping-laptop case)", () => {
    // The wall-clock jumped far past the deadline while the interval was throttled.
    const state = evaluateIdleState(timeoutMs * 4, timeoutMs, warningLeadMs);
    expect(state.timedOut).toBe(true);
  });

  it("is inert when timeoutMs <= 0 (disabled / unknown config)", () => {
    expect(evaluateIdleState(999 * MIN, 0, warningLeadMs)).toEqual({
      timedOut: false,
      warning: false,
      secondsLeft: 0,
    });
  });

  it("handles a warning lead ≥ timeout without going negative (whole window is a warning)", () => {
    // warningLead longer than the timeout — warningAt clamps to 0, so it warns from t=0.
    const state = evaluateIdleState(1_000, 60_000, 120_000);
    expect(state.warning).toBe(true);
    expect(state.secondsLeft).toBe(59);
  });
});
