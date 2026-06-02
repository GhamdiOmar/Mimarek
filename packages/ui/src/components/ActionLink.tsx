import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { DirectionalIcon } from "./DirectionalIcon";

export const actionLinkVariants = cva(
  "text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm inline-flex items-center gap-1 transition-colors"
);

export interface ActionLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof actionLinkVariants> {
  href?: string;
  /** Icon rendered before the label */
  leadingIcon?: LucideIcon;
  /** Icon rendered after the label */
  trailingIcon?: LucideIcon;
  /** When true, directional icons (leading/trailing) are wrapped in DirectionalIcon for RTL mirroring */
  directional?: boolean;
  /** Render as a child element (e.g. next/link) instead of a plain <a> */
  asChild?: boolean;
}

const ActionLink = React.forwardRef<HTMLAnchorElement, ActionLinkProps>(
  (
    {
      href,
      leadingIcon: LeadingIcon,
      trailingIcon: TrailingIcon,
      directional = false,
      asChild = false,
      className,
      children,
      ...rest
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "a";

    const renderIcon = (Icon: LucideIcon) =>
      directional ? (
        <DirectionalIcon icon={Icon} className="h-4 w-4 shrink-0" />
      ) : (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      );

    return (
      <Comp
        ref={ref}
        href={href}
        className={cn(actionLinkVariants(), className)}
        {...rest}
      >
        {LeadingIcon && renderIcon(LeadingIcon)}
        {children}
        {TrailingIcon && renderIcon(TrailingIcon)}
      </Comp>
    );
  }
);
ActionLink.displayName = "ActionLink";

export { ActionLink };
