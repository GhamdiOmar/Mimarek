"use client";

import * as React from "react";
import { evaluateIdleState } from "../lib/idle-timeout-config";

export interface UseIdleTimeoutOptions {
  /** Minutes of inactivity before `onTimeout` fires. */
  timeoutMinutes: number;
  /** Minutes before timeout when the warning state turns on. */
  warningMinutes: number;
  /** Called when the idle timeout elapses (this tab or a broadcast from another tab). */
  onTimeout: () => void;
  /** BroadcastChannel name used to coordinate tabs in the same browser profile. */
  channelName?: string;
}

export interface UseIdleTimeoutResult {
  /** True once the warning window has been entered (timeoutMinutes - warningMinutes elapsed). */
  warning: boolean;
  /** Seconds remaining until timeout, only meaningful while `warning` is true. */
  secondsLeft: number;
  /** Reset the idle clock (e.g. "Stay signed in") and clear the warning, broadcast to other tabs. */
  stayActive: () => void;
  /** Fire the timeout immediately (e.g. "Sign out now"), bypassing the interval wait. */
  signOutNow: () => void;
}

type BroadcastMessage = { type: "activity" } | { type: "timeout" };

/** How often activity events are coalesced into a `lastActivityAt` write + broadcast. */
const ACTIVITY_THROTTLE_MS = 5_000;
/**
 * How often the idle clock is re-evaluated against wall-clock time. 1s so the
 * warning countdown ticks smoothly per-second and the timeout fires within ~1s
 * of the deadline (the comparison is a couple of cheap ops; the activity-write
 * path stays throttled at ACTIVITY_THROTTLE_MS, so this is not a write storm).
 */
const CHECK_INTERVAL_MS = 1_000;

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
];

/**
 * Reusable idle-timeout hook — no session/role knowledge, no NextAuth import.
 * Params in, callbacks out, so it is independently testable.
 *
 * Wall-clock based: re-derives idle duration from `Date.now() - lastActivityAt`
 * on every check tick, on `visibilitychange`, and on `focus` — never a naive
 * countdown `setTimeout`, so a sleeping laptop or a throttled background tab
 * is handled correctly (IDLE-007).
 *
 * Cross-tab (IDLE-005 / IDLE-006): a `BroadcastChannel` shares activity pings
 * (any tab's activity resets every tab's idle clock) and timeout notices (any
 * tab's timeout signs out every tab immediately — no per-tab grace period).
 */
export function useIdleTimeout({
  timeoutMinutes,
  warningMinutes,
  onTimeout,
  channelName = "mimarek-session-idle",
}: UseIdleTimeoutOptions): UseIdleTimeoutResult {
  const lastActivityAt = React.useRef<number>(Date.now());
  const timedOutRef = React.useRef(false);
  const onTimeoutRef = React.useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const [warning, setWarning] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(0);

  // Mirror `warning` into a ref so the (stable-identity) activity handler can
  // read the current warning state without re-subscribing its listeners.
  const warningRef = React.useRef(false);
  warningRef.current = warning;

  const timeoutMs = Math.max(0, timeoutMinutes) * 60_000;
  const warningLeadMs = Math.max(0, warningMinutes) * 60_000;

  const channelRef = React.useRef<BroadcastChannel | null>(null);

  const fireTimeout = React.useCallback(() => {
    if (timedOutRef.current) return;
    timedOutRef.current = true;
    setWarning(false);
    onTimeoutRef.current();
  }, []);

  const broadcast = React.useCallback((msg: BroadcastMessage) => {
    try {
      channelRef.current?.postMessage(msg);
    } catch {
      // BroadcastChannel unsupported/unavailable — single-tab behavior still works.
    }
  }, []);

  const markActivity = React.useCallback(
    (opts?: { broadcastIt?: boolean }) => {
      lastActivityAt.current = Date.now();
      setWarning(false);
      if (opts?.broadcastIt !== false) broadcast({ type: "activity" });
    },
    [broadcast],
  );

  const stayActive = React.useCallback(() => {
    markActivity();
  }, [markActivity]);

  const signOutNow = React.useCallback(() => {
    broadcast({ type: "timeout" });
    fireTimeout();
  }, [broadcast, fireTimeout]);

  // Throttled DOM activity listeners.
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let lastWrite = 0;
    const handler = () => {
      // Once the warning dialog is up, passive activity must NOT silently reset
      // the clock — the user has to make an explicit choice via the dialog
      // buttons (which call stayActive/signOutNow directly). Otherwise a
      // pointerdown/touchstart on the dialog itself (e.g. reaching for "Stay
      // signed in" on mobile) would dismiss it under the user's finger.
      // Genuine activity in ANOTHER tab still clears the warning via the
      // cross-tab "activity" broadcast, since the user really is present there.
      if (timedOutRef.current || warningRef.current) return;
      const now = Date.now();
      if (now - lastWrite < ACTIVITY_THROTTLE_MS) return;
      lastWrite = now;
      markActivity();
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, handler, { passive: true });
    }
    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, handler);
      }
    };
  }, [markActivity]);

  // Wall-clock idle check — interval + visibilitychange + focus, never a naive
  // countdown setTimeout (IDLE-007: sleeping laptops, throttled background tabs).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (timeoutMs <= 0) return;

    const evaluate = () => {
      if (timedOutRef.current) return;
      const { timedOut, warning: shouldWarn, secondsLeft: left } = evaluateIdleState(
        Date.now() - lastActivityAt.current,
        timeoutMs,
        warningLeadMs,
      );

      if (timedOut) {
        fireTimeout();
        return;
      }

      setWarning(shouldWarn);
      if (shouldWarn) setSecondsLeft(left);
    };

    const interval = window.setInterval(evaluate, CHECK_INTERVAL_MS);
    // `visibilitychange` is dispatched on `document`, not `window` — so the
    // "re-check the instant the tab is shown again" path must listen on
    // `document` (IDLE-007). `focus` correctly fires on `window`.
    document.addEventListener("visibilitychange", evaluate);
    window.addEventListener("focus", evaluate);
    // Evaluate once on mount too, in case of an immediately-stale tab.
    evaluate();

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", evaluate);
      window.removeEventListener("focus", evaluate);
    };
  }, [timeoutMs, warningLeadMs, fireTimeout]);

  // Cross-tab coordination.
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    const onMessage = (event: MessageEvent<BroadcastMessage>) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "activity") {
        markActivity({ broadcastIt: false });
      } else if (data.type === "timeout") {
        fireTimeout();
      }
    };

    channel.addEventListener("message", onMessage);
    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markActivity/fireTimeout are stable useCallback identities; only channelName should re-open the channel.
  }, [channelName]);

  return { warning, secondsLeft, stayActive, signOutNow };
}
