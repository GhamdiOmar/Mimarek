import Image from "next/image";
import { cn } from "@repo/ui/lib/utils";

type Lockup = "horizontal" | "primary" | "icon";

interface MimarekLogoProps {
  /**
   * Force a color treatment:
   *  - "light" → teal icon + navy wordmark (for light backgrounds)
   *  - "dark"  → teal icon + white wordmark (for dark backgrounds)
   * Omit to auto-adapt to the active theme (light SVG in light mode, on-dark in dark mode).
   */
  variant?: "light" | "dark";
  /** Logo lockup: horizontal (default), stacked primary, or icon mark only. */
  lockup?: Lockup;
  width?: number;
  className?: string;
  priority?: boolean;
}

// height / width, derived from each delivered SVG viewBox
const ASPECT: Record<Lockup, number> = {
  horizontal: 90.04 / 330.53,
  primary: 267 / 321.76,
  icon: 239.82 / 209.07,
};

const ALT = "Mimarek — معمارك";

function LogoImg({
  lockup,
  suffix,
  width,
  priority,
  className,
}: {
  lockup: Lockup;
  suffix: "light" | "ondark";
  width: number;
  priority: boolean;
  className?: string;
}) {
  return (
    <Image
      src={`/assets/brand/mimarek-${lockup}-${suffix}.svg`}
      alt={ALT}
      width={width}
      height={Math.round(width * ASPECT[lockup])}
      priority={priority}
      unoptimized
      className={cn("object-contain", className)}
    />
  );
}

export function MimarekLogo({
  variant,
  lockup = "horizontal",
  width = 160,
  className = "",
  priority = true,
}: MimarekLogoProps) {
  // Forced treatment
  if (variant) {
    return (
      <LogoImg
        lockup={lockup}
        suffix={variant === "dark" ? "ondark" : "light"}
        width={width}
        priority={priority}
        className={className}
      />
    );
  }

  // Theme-adaptive: render both, toggle by the `.dark` class on <html>
  return (
    <>
      <LogoImg lockup={lockup} suffix="light" width={width} priority={priority} className={cn(className, "dark:hidden")} />
      <LogoImg lockup={lockup} suffix="ondark" width={width} priority={priority} className={cn(className, "hidden dark:block")} />
    </>
  );
}
