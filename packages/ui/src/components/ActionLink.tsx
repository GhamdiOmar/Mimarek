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
    const renderIcon = (Icon: LucideIcon) =>
      directional ? (
        <DirectionalIcon icon={Icon} className="h-4 w-4 shrink-0" />
      ) : (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      );

    // `asChild` composes with a caller-provided element (e.g. next/link).
    // Radix Slot requires EXACTLY ONE child, so inject any leading/trailing
    // icons INSIDE that child rather than as siblings — otherwise Slot throws
    // "React.Children.only expected to receive a single React element child".
    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{
        children?: React.ReactNode;
      }>;
      return (
        <Slot
          ref={ref}
          className={cn(actionLinkVariants(), className)}
          {...rest}
        >
          {React.cloneElement(
            child,
            undefined,
            <>
              {LeadingIcon && renderIcon(LeadingIcon)}
              {child.props.children}
              {TrailingIcon && renderIcon(TrailingIcon)}
            </>
          )}
        </Slot>
      );
    }

    return (
      <a
        ref={ref}
        href={href}
        className={cn(actionLinkVariants(), className)}
        {...rest}
      >
        {LeadingIcon && renderIcon(LeadingIcon)}
        {children}
        {TrailingIcon && renderIcon(TrailingIcon)}
      </a>
    );
  }
);
ActionLink.displayName = "ActionLink";

export { ActionLink };
