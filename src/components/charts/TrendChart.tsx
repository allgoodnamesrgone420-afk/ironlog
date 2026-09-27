"use client";

import { useSeen } from "@/hooks/useSeen";

/**
 * Flat NeoPop line chart: an ink line with square markers. Markers are HTML so
 * they stay square while the SVG stretches to the container.
 */
export function TrendChart({ data, spread = 0.9 }: { data: { date: Date; v: number }[]; spread?: number }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const max = Math.max(...data.map((d) => d.v));
  const min = Math.min(...data.map((d) => d.v));
  const range = max - min || 1;
  const pad = ((1 - spread) / 2) * 100;
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const y = (v: number) => 100 - pad - ((v - min) / range) * spread * 100;
  const points = data.map((d, i) => `${x(i)},${y(d.v)}`).join(" ");
  return (
    <div ref={ref} data-seen={seen} className="wipe-in relative h-32">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
        {[25, 50, 75].map((p) => (
          <line key={p} x1="0" x2="100" y1={p} y2={p} style={{ stroke: "rgb(var(--line-soft))" }} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <polyline
          points={points}
          fill="none"
          style={{ stroke: "rgb(var(--ink))" }}
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {data.map((d, i) => (
        <span
          key={i}
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-violet ring-2 ring-surface"
          style={{ left: `${x(i)}%`, top: `${y(d.v)}%` }}
          aria-hidden
        />
      ))}
    </div>
  );
}
