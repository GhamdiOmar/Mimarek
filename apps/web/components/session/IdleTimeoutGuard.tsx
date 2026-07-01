"use client";

import * as React from "react";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { Button, ResponsiveDialog } from "@repo/ui";
import { useSession } from "../SimpleSessionProvider";
import { useLanguage } from "../LanguageProvider";
import { useIdleTimeout } from "../../hooks/useIdleTimeout";
import { getIdleTimeoutMinutes, IDLE_WARNING_MINUTES } from "../../lib/idle-timeout-config";
import { recordIdleTimeout } from "../../app/actions/session-audit";

/**
 * Session-inactivity-timeout Phase 1 (client-side idle guard) — mounted once
 * inside every authenticated shell (`/dashboard/**`, `/portal/**`).
 * See `future-plans/session-inactivity-timeout-gap-action-plan.md`.
 *
 * No-op for unauthenticated sessions and never mutates `tokenVersion` — an
 * idle timeout must only clear the CURRENT browser's session, never every
 * device (see AGENTS.md).
 */
export default function IdleTimeoutGuard() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();

  const role = session?.user?.role as string | undefined;

  const handleTimeout = React.useCallback(() => {
    // Fire-and-forget — never block or gate the sign-out on the audit write (IDLE-011).
    void recordIdleTimeout({ idleMinutes: getIdleTimeoutMinutes(role) });
    void nextAuthSignOut({ callbackUrl: "/auth/login?reason=idle" });
  }, [role]);

  const { warning, secondsLeft, stayActive, signOutNow } = useIdleTimeout({
    timeoutMinutes: getIdleTimeoutMinutes(role),
    warningMinutes: IDLE_WARNING_MINUTES,
    onTimeout: handleTimeout,
  });

  if (status !== "authenticated" || !session?.user) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const countdownLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <ResponsiveDialog
      open={warning}
      onOpenChange={(open) => {
        if (!open) stayActive();
      }}
      title={t("تنبيه بسبب عدم النشاط", "You've been idle")}
      description={t(
        "لم يتم رصد أي نشاط منذ فترة. لحماية حسابك، سيقوم معمارك بتسجيل خروجك خلال دقيقتين.",
        "You have been inactive for a while. For security, Mimarek will sign you out in 2 minutes.",
      )}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={signOutNow}>
            {t("تسجيل الخروج الآن", "Sign out now")}
          </Button>
          <Button variant="primary" onClick={stayActive}>
            {t("البقاء مسجلاً", "Stay signed in")}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">
        {t("سيتم تسجيل خروجك خلال", "You will be signed out in")}{" "}
        {/* The ticking value is decorative for screen readers — announcing it
            every second would spam them for the full 2-minute window. The
            dialog's `description` (read once on open) already states the
            2-minute deadline, so the counter is aria-hidden. */}
        <span className="font-mono font-semibold text-foreground" dir="ltr" aria-hidden="true">
          {countdownLabel}
        </span>
      </p>
    </ResponsiveDialog>
  );
}
