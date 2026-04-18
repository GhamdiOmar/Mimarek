import * as React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "../lib/utils";

export type DirectionalIconProps = LucideProps & {
  icon: LucideIcon;
};

export function DirectionalIcon({
  icon: Icon,
  className,
  ...rest
}: DirectionalIconProps) {
  return <Icon className={cn("icon-directional", className)} {...rest} />;
}
