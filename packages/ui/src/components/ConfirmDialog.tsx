"use client";

import * as React from "react";
import { Button } from "./Button";
import { ResponsiveDialog } from "./mobile/ResponsiveDialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** "destructive" renders the confirm button with the destructive variant. Defaults to "default". */
  variant?: "destructive" | "default";
}

/**
 * ConfirmDialog — accessible, bilingual confirm prompt.
 *
 * Renders as a modal on desktop (≥768px) and a bottom sheet on mobile, via
 * ResponsiveDialog. Colors are driven entirely by CSS variables (no `dark:`
 * utilities) so both themes work automatically.
 *
 * Usage:
 *   const [open, setOpen] = React.useState(false);
 *   const [pending, setPending] = React.useState<() => void>(() => () => {});
 *
 *   function askConfirm(action: () => void) {
 *     setPending(() => action);
 *     setOpen(true);
 *   }
 *
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Are you sure?"
 *     confirmLabel="Delete"
 *     cancelLabel="Cancel"
 *     onConfirm={pending}
 *     variant="destructive"
 *   />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  variant = "default",
}: ConfirmDialogProps) {
  function handleConfirm() {
    onOpenChange(false);
    onConfirm();
  }

  function handleCancel() {
    onOpenChange(false);
  }

  const footer = (
    /*
     * RTL note: `flex-row-reverse` on `[dir=rtl]` is handled at the layout
     * level — we use `gap-2` and rely on logical flow. The primary action
     * (confirm) is placed second in DOM order so it is the leading-edge
     * button in RTL (right side) and the trailing-edge button in LTR (right
     * side), matching §6.6.4 Cancel + primary pattern.
     */
    <div className="flex items-center justify-end gap-2 w-full flex-wrap">
      <Button variant="secondary" size="md" onClick={handleCancel}>
        {cancelLabel}
      </Button>
      <Button
        variant={variant === "destructive" ? "destructive" : "primary"}
        size="md"
        onClick={handleConfirm}
      >
        {confirmLabel}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={footer}
      contentClassName="max-w-md"
    >
      {/* No extra body content — title + description + footer are sufficient. */}
      <div />
    </ResponsiveDialog>
  );
}
