/**
 * One palette for every chart in Vesper.
 *
 * Charts are the place a design system quietly falls apart: each page picks its own
 * greens and suddenly the product looks assembled rather than designed. These are the
 * only colours a chart may use, and they are the same hues the rest of the UI uses —
 * forest for the primary series, sand and gold for secondary, rose for anything wrong.
 */

export const chartColors = {
  /** Primary series — the deep forest green of the brand mark. */
  forest: "#2f6b57",
  forestSoft: "#a8c3b4",
  /** Confidence bands, area fills: forest at low opacity, pre-flattened for crisp edges. */
  band: "#dbe8e1",
  sand: "#c9a87c",
  gold: "#c59a2a",
  clay: "#b08b6a",
  rose: "#c6564b",
  slate: "#8a958f",
} as const;

/** Categorical order for donuts, stacked bars and multi-series lines. */
export const categorical = [
  chartColors.forest,
  chartColors.gold,
  chartColors.forestSoft,
  chartColors.sand,
  chartColors.rose,
  chartColors.slate,
] as const;

/** Axis, grid and tooltip props shared by every Recharts surface. */
export const axisProps = {
  tick: { fill: "#6b7770", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = {
  stroke: "#eceae4",
  strokeDasharray: "3 3",
  vertical: false,
} as const;

export const tooltipProps = {
  cursor: { stroke: "#d8d5cd", strokeWidth: 1 },
  contentStyle: {
    borderRadius: 10,
    border: "1px solid #eceae4",
    boxShadow: "0 8px 24px -8px rgba(31,42,36,0.14)",
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: { color: "#1e2a24", fontWeight: 600, marginBottom: 2 },
} as const;

/** Compact Indian-numbering money, the way the reference dashboard writes it: ₹14.2 L. */
export function formatLakh(amount: number): string {
  if (Math.abs(amount) >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(1)} Cr`;
  if (Math.abs(amount) >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1)} L`;
  if (Math.abs(amount) >= 1_000) return `₹${(amount / 1_000).toFixed(1)} K`;
  return `₹${amount}`;
}
