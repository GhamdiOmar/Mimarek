import * as React from "react";
import { Badge } from "./Badge";
import type { BadgeProps } from "./Badge";

type EntityType = "project" | "contract" | "unit" | "lease" | "maintenance" | "customer" | "invoice" | "reservation";

const statusColorMap: Record<EntityType, Record<string, NonNullable<BadgeProps["variant"]>>> = {
  project: {
    LAND_IDENTIFIED: "info",
    FEASIBILITY_IN_PROGRESS: "pending",
    FEASIBILITY_APPROVED: "success",
    PLANNING_IN_PROGRESS: "info",
    DESIGN_APPROVED: "success",
    PERMITS_OBTAINED: "success",
    OFF_PLAN_LAUNCHED: "info",
    UNDER_CONSTRUCTION: "warning",
    CONSTRUCTION_COMPLETE: "success",
    READY_FOR_HANDOVER: "info",
    HANDED_OVER: "success",
    OPERATIONAL: "available",
    ON_HOLD: "draft",
    CANCELLED: "error",
  },
  contract: {
    DRAFT: "draft",
    SENT: "info",
    SIGNED: "success",
    EXECUTED: "available",
    HANDED_OVER: "success",
    VOIDED: "error",
    CANCELLED: "error",
    EXPIRED: "overdue",
  },
  unit: {
    AVAILABLE: "available",
    RESERVED: "reserved",
    LEASED: "rented",
    SOLD: "sold",
    UNDER_MAINTENANCE: "maintenance",
  },
  lease: {
    ACTIVE: "available",
    PENDING: "pending",
    EXPIRED: "overdue",
    TERMINATED: "error",
    RENEWED: "success",
  },
  maintenance: {
    OPEN: "info",
    ASSIGNED: "pending",
    IN_PROGRESS: "warning",
    ON_HOLD: "draft",
    RESOLVED: "success",
    CLOSED: "available",
  },
  customer: {
    NEW: "info",
    INTERESTED: "pending",
    QUALIFIED: "success",
    VIEWING: "info",
    RESERVED: "reserved",
    CONVERTED: "available",
    LOST: "error",
    ACTIVE_TENANT: "rented",
    PAST_TENANT: "draft",
  },
  invoice: {
    DRAFT: "draft",
    SENT: "info",
    PAID: "success",
    PARTIALLY_PAID: "pending",
    OVERDUE: "overdue",
    CANCELLED: "error",
  },
  reservation: {
    ACTIVE: "available",
    EXPIRED: "overdue",
    CONVERTED: "success",
    CANCELLED: "error",
  },
};

type SemanticVariant = "success" | "warning" | "danger" | "info" | "neutral";

const semanticVariantMap: Record<SemanticVariant, NonNullable<BadgeProps["variant"]>> = {
  success: "success",
  warning: "warning",
  danger: "error",
  info: "info",
  neutral: "default",
};

type EntityStatusBadgeProps = Omit<BadgeProps, "variant"> & {
  entityType: EntityType;
  status: string;
  label?: string;
  variant?: never;
};

type SemanticStatusBadgeProps = Omit<BadgeProps, "variant"> & {
  variant: SemanticVariant;
  label: string;
  entityType?: never;
  status?: never;
};

export type StatusBadgeProps = EntityStatusBadgeProps | SemanticStatusBadgeProps;

function StatusBadge(props: StatusBadgeProps) {
  if ("variant" in props && props.variant) {
    const { variant, label, entityType: _e, status: _s, ...rest } = props as SemanticStatusBadgeProps;
    return (
      <Badge variant={semanticVariantMap[variant]} {...rest}>
        {label}
      </Badge>
    );
  }

  const { entityType, status, label, ...rest } = props as EntityStatusBadgeProps;
  const colorMap = statusColorMap[entityType] || {};
  const badgeVariant = colorMap[status] || "default";
  const displayLabel = label || status.replace(/_/g, " ");

  return (
    <Badge variant={badgeVariant} {...rest}>
      {displayLabel}
    </Badge>
  );
}

export { StatusBadge, statusColorMap };
