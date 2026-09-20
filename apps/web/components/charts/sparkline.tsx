import * as React from "react";

/**
 * A bare trend line for KPI tiles.
 *
 * Hand-rolled SVG rather than Recharts: four of these sit on the dashboard above the
 * fold, and they carry no axes, tooltip or legend worth a chart runtime.
 */
export function Sparkline({
  data,
  color,
  width = 72,
  height = 28,
  className,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  // A flat series would divide by zero; draw it down the middle instead.
  const span = max - min || 1;
  const pad = 2;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  // Catmull-Rom style smoothing, kept mild so the line stays honest about its values.
  const d = points.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = points[i - 1];
    const cx = (px + x) / 2;
    return `${acc} C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  }, "");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d={d} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
