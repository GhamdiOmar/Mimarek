"use client";

import * as React from "react";
import {
  Trash2,
  Phone,
  Mail,
  MessageCircle,
  MoreVertical,
  ArrowRightLeft,
} from "lucide-react";
import {
  Button,
  IconButton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@repo/ui";
import { maskPhone } from "@/lib/pii-masking";
import { toWhatsAppNumber } from "@/lib/phone";
import { PIPELINE_STAGES, SOURCE_LABELS } from "./crm-config";

// ─── Kanban Card ──────────────────────────────────────────────────────────────

/**
 * Masked + serialized customer payload as it reaches the Kanban from
 * `getCustomers()` — PII fields are masked strings (or raw when `showPii`),
 * Decimals/dates are serialized, and the server adds `contactPhoneE164`.
 * Typed to exactly the fields this card reads.
 */
type KanbanCustomer = {
  id: string;
  name: string;
  nameArabic?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  budget?: number | string | null;
  agent?: { id?: string; name?: string | null; email?: string | null } | null;
  contactPhoneE164?: string | null;
  stageEnteredAt?: string | Date | null;
  createdAt?: string | Date | null;
  // Index signature mirrors the caller's (CrmView) masked-row type so the
  // typed props accept its rows; declared keys above still take precedence.
  [key: string]: unknown;
};

export function KanbanCard({
  customer,
  lang,
  showPii,
  onDragStart,
  onViewProfile,
  onDelete,
  canDelete,
  onMoveToStage,
  currentStage,
}: {
  customer: KanbanCustomer;
  lang: "ar" | "en";
  showPii: boolean;
  onDragStart: (e: React.DragEvent, customerId: string) => void;
  onViewProfile: (customer: KanbanCustomer) => void;
  onDelete: (customer: KanbanCustomer) => void;
  canDelete: boolean;
  onMoveToStage: (customerId: string, stage: string) => void;
  currentStage: string;
}) {
  // Contact controls: use the precomputed contactPhoneE164 from the server action.
  // null means masked/invalid → omit the control entirely (never disable, per Roselli).
  const contactPhoneE164: string | null = customer.contactPhoneE164 ?? null;
  const waNumber: string | null = toWhatsAppNumber(contactPhoneE164);
  const email = typeof customer.email === "string" ? customer.email : "";
  const hasEmail = email.length > 0 && email.includes("@") && !email.startsWith("*");

  const initials =
    (typeof customer.name === "string" ? customer.name : "")
      .trim()
      .split(/\s+/)
      .map((w: string) => w.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "؟";

  // Owner avatar — agent initials using the same helper pattern
  const agentInitials = customer.agent?.name
    ? (customer.agent?.name as string)
        .trim()
        .split(/\s+/)
        .map((w: string) => w.charAt(0))
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "؟"
    : null;

  // Time-in-stage chip — days since stageEnteredAt (fall back to createdAt, crash-safe)
  const stageRefDate: Date | null = (() => {
    const raw = customer.stageEnteredAt ?? customer.createdAt ?? null;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  })();
  const daysInStage: number | null = stageRefDate
    ? Math.floor((Date.now() - stageRefDate.getTime()) / 86_400_000)
    : null;
  // Threshold coloring via CSS variable tokens only — no dark: utilities, no hardcoded hex
  const stageDayClass =
    daysInStage === null
      ? null
      : daysInStage <= 7
        ? "bg-muted text-muted-foreground"
        : daysInStage <= 14
          ? "bg-warning/15 text-warning-strong"
          : "bg-destructive/15 text-destructive";
  const stageDayLabel =
    daysInStage === null
      ? null
      : lang === "ar"
        ? `${daysInStage} يوم`
        : `${daysInStage}d`;

  const openProfile = () => onViewProfile(customer);
  const viewLabel =
    lang === "ar" ? `عرض ملف ${customer.name}` : `View ${customer.name}`;

  // Other stages the card can be moved to (keyboard/SR path — redundant-click pattern)
  const moveTargetStages = PIPELINE_STAGES.filter((s) => s.key !== currentStage);

  return (
    // a11y: plain draggable container with no role/tabIndex/aria-label.
    // The card title <button> is the single accessible open-profile affordance.
    // Container onClick forwards to openProfile ONLY when the click did NOT
    // originate on another interactive control (redundant-click card pattern,
    // Heydon Pickering / inclusive-components). This eliminates the axe
    // nested-interactive violation while preserving pointer-convenience.
    <div
      draggable
      onDragStart={(e) => onDragStart(e, customer.id)}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a,button,[role='menuitem']")) {
          openProfile();
        }
      }}
      className="group relative rounded-lg border border-border bg-card card-quiet p-3.5 cursor-grab active:cursor-grabbing hover:border-primary/30 hover:bg-card-hover transition-[background-color,border-color]"
    >
      {/* Name + avatar + overflow (move/delete actions) */}
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          {/* Card title IS the single accessible open-profile control — §6.6.0 Scenario 1.
              variant="link" with explicit overrides so the title renders as an unpadded,
              auto-height, full-width, start-aligned, truncating control (tailwind-merge
              resolves the conflicting Button base utilities, last-wins). */}
          <Button
            type="button"
            variant="link"
            onClick={(e) => {
              e.stopPropagation();
              openProfile();
            }}
            className="block h-auto w-full p-0 text-start font-semibold text-sm text-foreground no-underline truncate hover:text-primary hover:no-underline focus-visible:ring-ring/50 focus-visible:ring-offset-0 rounded-sm"
            aria-label={viewLabel}
            title={customer.name}
          >
            {customer.name}
          </Button>
          {customer.nameArabic && customer.nameArabic !== customer.name && (
            <p className="text-[11px] text-muted-foreground truncate" aria-hidden="true">
              {customer.nameArabic}
            </p>
          )}
        </div>
        {/* Overflow menu: move + delete — keyboard/SR path for drag outcomes */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              icon={MoreVertical}
              aria-label={lang === "ar" ? "خيارات" : "Options"}
              variant="ghost"
              className="relative z-10 -me-1.5 -mt-1.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Move-to items: one per other stage (keyboard/SR equivalent of drag) */}
            {moveTargetStages.map((stage) => (
              <DropdownMenuItem
                key={stage.key}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveToStage(customer.id, stage.key);
                }}
              >
                <ArrowRightLeft className="me-2 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {lang === "ar"
                  ? `نقل إلى ${stage.label.ar}`
                  : `Move to ${stage.label.en}`}
              </DropdownMenuItem>
            ))}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(customer);
                  }}
                >
                  <Trash2 className="me-2 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {lang === "ar" ? "حذف" : "Delete"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Deal value — the prominence anchor */}
      {customer.budget ? (
        <p
          dir="ltr"
          className="number-ltr mt-2.5 text-base font-bold tabular-nums text-foreground"
        >
          {Number(customer.budget).toLocaleString(
            lang === "ar" ? "ar-SA-u-nu-latn" : "en-SA",
          )}
          <span className="ms-1 text-xs font-normal text-muted-foreground">
            {lang === "ar" ? "ر.س" : "SAR"}
          </span>
        </p>
      ) : null}

      {/* Meta: phone + source */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {customer.phone ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate font-mono" dir="ltr">
              {showPii ? customer.phone : maskPhone(customer.phone)}
            </span>
          </span>
        ) : (
          <span />
        )}
        {customer.source && SOURCE_LABELS[customer.source] && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {(SOURCE_LABELS[customer.source] as { ar: string; en: string })[lang]}
          </span>
        )}
      </div>

      {/* Premium signals row: time-in-stage chip + owner avatar */}
      {(stageDayLabel !== null || agentInitials !== null) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {/* Time-in-stage chip */}
          {stageDayLabel !== null && stageDayClass !== null ? (
            <span
              dir="ltr"
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${stageDayClass}`}
              title={
                lang === "ar"
                  ? `الوقت في هذه المرحلة: ${stageDayLabel}`
                  : `Time in stage: ${stageDayLabel}`
              }
              aria-label={
                lang === "ar"
                  ? `الوقت في المرحلة ${stageDayLabel}`
                  : `Time in stage ${stageDayLabel}`
              }
            >
              {stageDayLabel}
            </span>
          ) : (
            <span />
          )}

          {/* Owner (agent) avatar */}
          {agentInitials !== null && (
            <span
              aria-label={
                lang === "ar"
                  ? `المسؤول: ${customer.agent?.name}`
                  : `Owner: ${customer.agent?.name}`
              }
              title={
                lang === "ar"
                  ? `المسؤول: ${customer.agent?.name}`
                  : `Owner: ${customer.agent?.name}`
              }
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-success-strong text-[9px] font-semibold"
            >
              {agentInitials}
            </span>
          )}
        </div>
      )}

      {/* Quick-contact rail — omitted entirely when no valid contactPhoneE164 and no email.
          Controls are <a> siblings (not nested in a button), so no nested-interactive issue. */}
      {(contactPhoneE164 !== null || hasEmail) && (
        <div
          className="relative z-10 mt-2.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {contactPhoneE164 !== null && (
            <a
              href={`tel:${contactPhoneE164}`}
              aria-label={lang === "ar" ? "اتصال هاتفي" : "Call phone"}
              title={lang === "ar" ? "اتصال" : "Call"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
          )}
          {waNumber !== null && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={lang === "ar" ? "فتح واتساب" : "Open WhatsApp"}
              title={lang === "ar" ? "واتساب" : "WhatsApp"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
          {hasEmail && (
            <a
              href={`mailto:${email}`}
              aria-label={lang === "ar" ? "إرسال بريد إلكتروني" : "Send email"}
              title={lang === "ar" ? "بريد إلكتروني" : "Email"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
