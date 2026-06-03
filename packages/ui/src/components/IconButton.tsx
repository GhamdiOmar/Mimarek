"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "./Button";
import { DirectionalIcon } from "./DirectionalIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../primitives/tooltip";

export interface IconButtonProps
  extends Omit<ButtonProps, "aria-label" | "children"> {
  /** The Lucide icon to render (required) */
  icon: LucideIcon;
  /** Accessible label — required for icon-only buttons (WCAG 1.1.1) */
  "aria-label": string;
  /** Tooltip text; defaults to aria-label when omitted */
  tooltip?: string;
  /** When true, wraps the icon in DirectionalIcon so it mirrors in RTL */
  directional?: boolean;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon: Icon,
      "aria-label": ariaLabel,
      tooltip,
      directional = false,
      variant = "ghost",
      size = "icon",
      className,
      ...rest
    },
    ref
  ) => {
    const tooltipText = tooltip ?? ariaLabel;

    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={ref}
              variant={variant}
              size={size}
              className={className}
              aria-label={ariaLabel}
              {...rest}
            >
              {directional ? (
                <DirectionalIcon icon={Icon} className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);
IconButton.displayName = "IconButton";

export { IconButton };
