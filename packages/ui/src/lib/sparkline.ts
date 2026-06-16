/**
 * sparkline.ts — pure helper shared by KPICard and MobileKPICard.
 *
 * Maps a number[] data series to an SVG path string (`M x,y L x,y …`)
 * that fits within a [0, w] × [0, h] viewport.
 *
 * - Returns `""` when fewer than 2 points are provided (nothing to draw).
 * - Normalises the Y-axis to the local min–max range of the series; a flat
 *   series (max === min) is treated as having a span of 1 to avoid ÷0.
 */
export function buildSparklinePath(
  points: number[],
  w: number,
  h: number,
): string {
  if (points.length < 2) return "";
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const stepX = w / (points.length - 1);
  return points
    .map((p, i) => {
      const x = i * stepX;
      const y = h - ((p - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}
