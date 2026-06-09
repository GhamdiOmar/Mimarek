import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

/**
 * Alert — variant × appearance model (v4.11 Phase 3).
 *
 * Retokenized from the 21st.dev reference to Mimaric semantic tokens (no
 * zinc/violet/yellow literals): variant = neutral | primary | destructive |
 * success | info | warning; appearance = solid | outline | light (soft tint).
 * `light` is the default and matches the §6.11.2 banner taxonomy (soft bg +
 * colored icon + readable foreground). Icon is positioned with logical props so
 * it sits on the leading edge in both LTR and RTL.
 *
 * Back-compat: the legacy `variant="default"` and `variant="destructive"` still
 * work for existing consumers.
 */
const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:start-4 [&>svg]:top-4 [&>svg~*]:ps-7",
  {
    variants: {
      variant: {
        default: "",
        primary: "",
        destructive: "",
        success: "",
        info: "",
        warning: "",
      },
      appearance: {
        solid: "",
        outline: "",
        light: "",
      },
    },
    compoundVariants: [
      /* neutral */
      { variant: "default", appearance: "solid", className: "border-transparent bg-muted text-foreground [&>svg]:text-foreground" },
      { variant: "default", appearance: "outline", className: "border-border bg-card text-foreground [&>svg]:text-foreground" },
      { variant: "default", appearance: "light", className: "border-border bg-muted/50 text-foreground [&>svg]:text-muted-foreground" },

      /* primary */
      { variant: "primary", appearance: "solid", className: "border-transparent bg-primary text-primary-foreground [&>svg]:text-primary-foreground" },
      { variant: "primary", appearance: "outline", className: "border-primary/40 bg-card text-foreground [&>svg]:text-primary" },
      { variant: "primary", appearance: "light", className: "border-primary/20 bg-primary/10 text-foreground [&>svg]:text-primary" },

      /* destructive */
      { variant: "destructive", appearance: "solid", className: "border-transparent bg-destructive text-destructive-foreground [&>svg]:text-destructive-foreground" },
      { variant: "destructive", appearance: "outline", className: "border-destructive/40 bg-card text-destructive [&>svg]:text-destructive" },
      { variant: "destructive", appearance: "light", className: "border-destructive/20 bg-destructive/10 text-foreground [&>svg]:text-destructive" },

      /* success */
      { variant: "success", appearance: "solid", className: "border-transparent bg-success text-success-foreground [&>svg]:text-success-foreground" },
      { variant: "success", appearance: "outline", className: "border-success/40 bg-card text-success [&>svg]:text-success" },
      { variant: "success", appearance: "light", className: "border-success/20 bg-success/10 text-foreground [&>svg]:text-success" },

      /* info */
      { variant: "info", appearance: "solid", className: "border-transparent bg-info text-info-foreground [&>svg]:text-info-foreground" },
      { variant: "info", appearance: "outline", className: "border-info/40 bg-card text-info [&>svg]:text-info" },
      { variant: "info", appearance: "light", className: "border-info/20 bg-info/10 text-foreground [&>svg]:text-info" },

      /* warning */
      { variant: "warning", appearance: "solid", className: "border-transparent bg-warning text-warning-foreground [&>svg]:text-warning-foreground" },
      { variant: "warning", appearance: "outline", className: "border-warning/40 bg-card text-warning [&>svg]:text-warning" },
      { variant: "warning", appearance: "light", className: "border-warning/20 bg-warning/10 text-foreground [&>svg]:text-warning" },
    ],
    defaultVariants: {
      variant: "default",
      appearance: "light",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, appearance, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant, appearance }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription, alertVariants }
