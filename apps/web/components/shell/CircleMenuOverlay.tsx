"use client";

/**
 * CircleMenuOverlay — the radial navigation surface (v4.11 Phase 2).
 *
 * Loaded lazily by CircleMenu (next/dynamic, ssr:false) so framer-motion lands
 * in its own chunk and never ships in the initial dashboard bundle.
 *
 * A11y model (per APG / Adrian Roselli — site nav must NOT use role="menu"):
 *   • overlay = role="dialog" aria-modal (it covers the screen + traps focus)
 *   • inside = a real <nav><ul> of LINKS; category hubs are disclosure buttons
 *     (aria-expanded / aria-controls), not menuitems
 *   • Tab / Shift+Tab cycle in DOM order, trapped; Escape ladders (child→hub→close);
 *     focus returns to the launcher on close; arrow keys are a spatial enhancement.
 *   • reduced-motion → instant positions, no fan-out stagger.
 * RTL: angular order mirrors and ArrowLeft/Right swap; numbers/clocks never mirror.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import {
  LayoutGrid, ClipboardList, Wallet, Users, Building2, TrendingUp, FileText,
  Store, Tags, CreditCard, ReceiptText, Wrench, BarChart3, Receipt, ShieldCheck, SearchCheck,
  Mail, TicketCheck, ShieldAlert, Settings, CalendarCheck, Gauge, HelpCircle,
  DatabaseBackup, X, ArrowLeft, type LucideIcon,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button, DirectionalIcon } from "@repo/ui";
import { useLanguage } from "../LanguageProvider";
import { resolveRadialGroups, type RadialChild, type ResolvedRadialGroup } from "./radial-groups";
import { computeRadialLayout, radialDimensions, type RadialVariant } from "./radial-geometry";

const ICONS: Record<string, LucideIcon> = {
  LayoutGrid, ClipboardList, Wallet, Users, Building2, TrendingUp, FileText,
  Store, Tags, CreditCard, ReceiptText, Wrench, BarChart3, Receipt, ShieldCheck, SearchCheck,
  Mail, TicketCheck, ShieldAlert, Settings, CalendarCheck, Gauge, HelpCircle,
  DatabaseBackup,
};

const COACHMARK_KEY = "mimaric.circlemenu.coachmark.v1";

interface OverlayProps {
  onClose: () => void;
  userRole: string;
}

export default function CircleMenuOverlay({ onClose, userRole }: OverlayProps) {
  const { lang, t } = useLanguage();
  const rtl = lang === "ar";
  const pathname = usePathname();
  const reduce = useReducedMotion() ?? false;

  const groups = React.useMemo(() => resolveRadialGroups(userRole), [userRole]);
  const singleGroup = groups.length <= 1;

  // Two-level state. A single-group role (platform staff) opens straight to its children.
  const [activeId, setActiveId] = React.useState<string | null>(
    singleGroup ? (groups[0]?.id ?? null) : null,
  );
  const level: 0 | 1 = activeId ? 1 : 0;
  const activeGroup = groups.find((g) => g.id === activeId) ?? null;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const nodeRefs = React.useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);

  // Capture the launcher that opened us and return focus to it on close (WCAG 2.2 —
  // runs before the focus-first-node effect below, so it grabs the trigger, not a wedge).
  const triggerRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    return () => triggerRef.current?.focus?.();
  }, []);

  // ── Viewport (drives full vs half wheel + responsive radius) ───────────────
  const [vp, setVp] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const isMobile = vp.w > 0 && vp.w < 768;
  const variant: RadialVariant = isMobile ? "half" : "full";

  // ── First-run coachmark ────────────────────────────────────────────────────
  const [showCoach, setShowCoach] = React.useState(false);
  React.useEffect(() => {
    try {
      if (!window.localStorage.getItem(COACHMARK_KEY)) setShowCoach(true);
    } catch {
      /* private mode — skip */
    }
  }, []);
  const dismissCoach = React.useCallback(() => {
    setShowCoach(false);
    try {
      window.localStorage.setItem(COACHMARK_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  // ── Body scroll lock while open ────────────────────────────────────────────
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ── Focus on first ring node when level changes; restore on unmount ─────────
  React.useEffect(() => {
    const id = window.setTimeout(() => nodeRefs.current[0]?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [level, activeId]);

  // Ring contents for the current level.
  const ringItems: Array<ResolvedRadialGroup | RadialChild> =
    level === 0 ? groups : (activeGroup?.children ?? []);
  const count = ringItems.length;
  const { radius, nodeSize } = radialDimensions({
    variant,
    viewportW: vp.w || 1200,
    viewportH: vp.h || 800,
    count,
  });
  const positions = computeRadialLayout(count, { radius, variant, rtl });

  const back = React.useCallback(() => {
    if (level === 1 && !singleGroup) setActiveId(null);
    else onClose();
  }, [level, singleGroup, onClose]);

  // ── Keyboard: Escape ladder, focus trap, arrow-ring enhancement ────────────
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      back();
      return;
    }

    if (e.key === "Tab") {
      // Trap focus within the overlay (DOM-order cycling — APG link model).
      const focusables = getFocusable(containerRef.current);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }

    const arrowKeys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!arrowKeys.includes(e.key) || count === 0) return;
    const idx = nodeRefs.current.findIndex((n) => n === document.activeElement);
    if (idx === -1) return;
    e.preventDefault();
    let next = idx;
    // RTL swaps the horizontal pair only; vertical never flips.
    const fwd = rtl ? "ArrowLeft" : "ArrowRight";
    const bwd = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === fwd || e.key === "ArrowDown") next = (idx + 1) % count;
    else if (e.key === bwd || e.key === "ArrowUp") next = (idx - 1 + count) % count;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = count - 1;
    nodeRefs.current[next]?.focus();
  };

  const isChildActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  const isGroupActive = (g: ResolvedRadialGroup) => g.children.some((c) => isChildActive(c.href));

  const dialogLabel = t("التنقل الرئيسي", "Main navigation");
  const centerLabel =
    level === 1 && !singleGroup ? t("رجوع", "Back") : t("إغلاق القائمة", "Close menu");

  // Anchor: viewport center (full) or bottom-center thumb zone (half).
  const anchorStyle: React.CSSProperties = isMobile
    ? { left: "50%", bottom: "calc(116px + env(safe-area-inset-bottom))", top: "auto" }
    : { left: "50%", top: "50%" };

  nodeRefs.current = [];

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        onKeyDown={onKeyDown}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.18 }}
        className="fixed inset-0 z-[1050]"
      >
        {/* Backdrop (presentational — Escape and the center control close via keyboard) */}
        <div
          aria-hidden="true"
          onClick={onClose}
          className="absolute inset-0 bg-overlay/70 backdrop-blur-md"
        />

        {/* Hint — the accessible cmdk twin is always available */}
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center px-4">
          <span className="rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            {level === 1 && activeGroup
              ? activeGroup.label[lang]
              : t("اضغط ⌘K للبحث في أي مكان", "Press ⌘K to search anywhere")}
          </span>
        </div>

        {/* Wheel anchor */}
        <nav aria-label={dialogLabel} className="absolute" style={anchorStyle}>
          {/* Center control (close / back) */}
          <div
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: 0, top: 0 }}
          >
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={back}
              aria-label={centerLabel}
              className="rounded-full shadow-md hover:border-primary/40 hover:bg-card-hover"
              style={{ width: 64, height: 64 }}
            >
              {level === 1 && !singleGroup ? (
                <DirectionalIcon icon={ArrowLeft} className="h-6 w-6" />
              ) : (
                <X className="h-6 w-6" aria-hidden="true" />
              )}
            </Button>
          </div>

          {/* Ring nodes — links (children) or disclosure buttons (hubs) */}
          <ul className="contents">
            {ringItems.map((item, i) => {
              const pos = positions[i] ?? { x: 0, y: 0 };
              const Icon = ICONS[item.icon] ?? LayoutGrid;
              const label = item.label[lang];

              const isGroupLevel = level === 0;
              const child = item as RadialChild;
              const grp = item as ResolvedRadialGroup;
              const active = isGroupLevel ? isGroupActive(grp) : isChildActive(child.href);

              return (
                <m.li
                  key={isGroupLevel ? grp.id : child.href}
                  className="absolute"
                  style={{ left: 0, top: 0 }}
                  initial={reduce ? false : { opacity: 0, x: 0, y: 0, scale: 0.4 }}
                  animate={{ opacity: 1, x: pos.x, y: pos.y, scale: 1 }}
                  transition={{
                    delay: reduce ? 0 : i * 0.03,
                    duration: reduce ? 0 : 0.26,
                    ease: [0, 0, 0.2, 1],
                  }}
                >
                  <div className="flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                    {isGroupLevel ? (
                      <Button
                        ref={(el) => {
                          nodeRefs.current[i] = el;
                        }}
                        type="button"
                        variant={active ? "primary" : "secondary"}
                        size="icon"
                        data-radial-hub={grp.id}
                        aria-haspopup="dialog"
                        aria-expanded={false}
                        aria-current={active ? "true" : undefined}
                        aria-label={label}
                        onClick={() => setActiveId(grp.id)}
                        className="rounded-full shadow-sm hover:border-primary/40"
                        style={{ width: nodeSize, height: nodeSize }}
                      >
                        <Icon className="h-6 w-6" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                      </Button>
                    ) : (
                      <Link
                        ref={(el) => {
                          nodeRefs.current[i] = el;
                        }}
                        href={child.href}
                        // Don't prefetch every dashboard the moment the radial nav
                        // opens — sibling dashboards each fire real DB work against
                        // the remote pooler and compete for connections (prefetch
                        // storm). Navigation still loads on click.
                        prefetch={false}
                        data-radial-child={child.href}
                        aria-current={active ? "page" : undefined}
                        aria-label={label}
                        onClick={onClose}
                        className={cn(
                          "flex items-center justify-center rounded-full border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-card-hover",
                        )}
                        style={{ width: nodeSize, height: nodeSize }}
                      >
                        <Icon className="h-6 w-6" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                      </Link>
                    )}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none mt-1.5 block max-w-[88px] truncate text-center text-[11px] font-medium",
                        active ? "text-primary" : "text-foreground/80",
                      )}
                    >
                      {label}
                    </span>
                  </div>
                </m.li>
              );
            })}
          </ul>
        </nav>

        {/* First-run coachmark */}
        {showCoach && (
          <div className="absolute inset-x-0 bottom-8 flex justify-center px-4 md:bottom-12">
            <div className="pointer-events-auto max-w-sm rounded-xl border border-border bg-card p-4 text-center shadow-modal">
              <p className="text-sm font-semibold text-foreground">
                {t("جديد: التنقل الدائري", "New: radial navigation")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  "اختر قسمًا ثم صفحة. اضغط Esc للرجوع أو ⌘K للبحث.",
                  "Pick a section, then choose a page. Press Esc to go back, or ⌘K to search.",
                )}
              </p>
              <Button type="button" size="sm" onClick={dismissCoach} className="mt-3">
                {t("فهمت", "Got it")}
              </Button>
            </div>
          </div>
        )}
      </m.div>
    </LazyMotion>
  );
}

/** Visible, focusable elements inside the overlay, in DOM order. */
function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  const sel =
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter(
    (el) => el.tabIndex !== -1 && el.offsetParent !== null,
  );
}
