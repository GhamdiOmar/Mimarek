/**
 * radial-geometry.ts — framework-agnostic layout math for the CircleMenu.
 *
 * Pure functions only (no React, no framer-motion) so the wheel can render
 * its positions without any animation library and the math is unit-testable.
 *
 * Coordinate system: screen pixels, y-axis pointing DOWN (CSS default).
 *   angle 0°   → right (+x)
 *   angle 90°  → down  (+y)
 *   angle 180° → left  (-x)
 *   angle 270° (= -90°) → up (-y)
 *
 * "Up" is therefore -90°, which is why a bottom-anchored half-wheel sweeps the
 * (180° … 360°) arc — that is the visually-upper semicircle in y-down space.
 */

export type RadialVariant = "full" | "half";

export interface RadialNode {
  /** x offset from the center, in px */
  x: number;
  /** y offset from the center, in px (positive = down) */
  y: number;
  /** the placement angle in degrees, screen-space (y-down) */
  angleDeg: number;
}

export interface RadialLayoutOptions {
  /** distance from center to each node center, in px */
  radius: number;
  /** "full" = 360° wheel (desktop); "half" = 180° bottom-anchored fan (mobile) */
  variant: RadialVariant;
  /** mirror the angular order for RTL (Arabic) */
  rtl?: boolean;
  /**
   * For "half": degrees of padding kept clear of the horizontal edges so wedges
   * never sit on the occluded horizon line. Ignored for "full". Default 14°.
   */
  padDeg?: number;
}

const DEG2RAD = Math.PI / 180;

/** Place `count` nodes around a center per the given options. */
export function computeRadialLayout(
  count: number,
  opts: RadialLayoutOptions,
): RadialNode[] {
  if (count <= 0) return [];
  const { radius, variant, rtl = false } = opts;

  const nodes: RadialNode[] = [];

  if (variant === "full") {
    // Even distribution around 360°, first node at top (-90°).
    const step = 360 / count;
    for (let i = 0; i < count; i++) {
      // LTR sweeps clockwise (increasing angle in y-down space); RTL mirrors.
      const angleDeg = -90 + (rtl ? -1 : 1) * i * step;
      nodes.push(toNode(angleDeg, radius));
    }
    return nodes;
  }

  // variant === "half": bottom-anchored 180° fan across the upper semicircle.
  const pad = opts.padDeg ?? 14;
  const arc = 180 - 2 * pad; // usable sweep
  const cell = arc / count; // centered cells → equal margins at both edges
  for (let i = 0; i < count; i++) {
    // LTR: left → right (i=0 near 180°). RTL: right → left (i=0 near 360°).
    const angleDeg = rtl
      ? 360 - pad - (i + 0.5) * cell
      : 180 + pad + (i + 0.5) * cell;
    nodes.push(toNode(angleDeg, radius));
  }
  return nodes;
}

function toNode(angleDeg: number, radius: number): RadialNode {
  const rad = angleDeg * DEG2RAD;
  return {
    x: Math.cos(rad) * radius,
    y: Math.sin(rad) * radius,
    angleDeg,
  };
}

/**
 * Responsive sizing for the wheel. Keeps wedge targets ≥ 44×44 (§6.5 / §6.14.3)
 * and the radius proportional to the viewport so the fan never clips.
 */
export function radialDimensions(opts: {
  variant: RadialVariant;
  viewportW: number;
  viewportH: number;
  count: number;
}): { radius: number; nodeSize: number } {
  const { variant, viewportW, viewportH, count } = opts;
  const minSide = Math.min(viewportW, viewportH);

  // Node (wedge) diameter — never below the 44px touch-target floor.
  const nodeSize = Math.max(
    56,
    Math.min(84, Math.round(minSide / (variant === "half" ? 7 : 8))),
  );

  // Radius scales with viewport but is bounded so dense rings still breathe.
  // Half-wheel gets a larger factor so labels don't collide at the top of the arc.
  const base = variant === "half" ? minSide * 0.42 : minSide * 0.3;
  // More items → push the ring out a touch so nodes don't overlap.
  const crowdBump = count > 6 ? (count - 6) * 6 : 0;
  const radius = Math.round(
    Math.max(110, Math.min(variant === "half" ? 260 : 240, base + crowdBump)),
  );

  return { radius, nodeSize };
}
