"use client";

/**
 * CircleMenu — radial navigation launcher (v4.11 Phase 2).
 *
 * Controlled by DashboardClientLayout. Replaces the desktop sidebar and the
 * mobile bottom tabs; the cmdk CommandPalette (⌘K) remains the always-available
 * accessible/keyboard twin so navigation can never fail.
 *
 * Triggers:
 *   • Desktop + mobile top bar → the existing "menu" button (rewired to onOpenChange).
 *   • Mobile → a thumb-reachable bottom-center launcher rendered here.
 * The heavy wheel (framer-motion) is code-split via next/dynamic and only loads
 * when the menu is first opened.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { LayoutGrid } from "lucide-react";
import { Button } from "@repo/ui";
import { useLanguage } from "../LanguageProvider";

const CircleMenuOverlay = dynamic(() => import("./CircleMenuOverlay"), {
  ssr: false,
});

interface CircleMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: string;
}

export function CircleMenu({ open, onOpenChange, userRole }: CircleMenuProps) {
  const { t, lang } = useLanguage();

  return (
    <>
      {/* Floating launcher — thumb-reachable bottom-center on every breakpoint, labelled
          for discoverability. Wrapper centers so the Button's active:scale never fights a translate. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 flex justify-center">
        <Button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={t("فتح قائمة التنقل", "Open navigation menu")}
          onClick={() => onOpenChange(true)}
          className="pointer-events-auto h-12 gap-2 rounded-full px-5 shadow-lg"
        >
          <LayoutGrid className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-semibold">{t("القائمة", "Menu")}</span>
        </Button>
      </div>

      {open && (
        <CircleMenuOverlay onClose={() => onOpenChange(false)} userRole={userRole} />
      )}
    </>
  );
}
