"use client";

import { useSeen } from "@/hooks/useSeen";
import { fromKg } from "@/lib/units/converter";
import type { TrendPoint } from "@/lib/analytics/weight";
import type { Units } from "@/types/user";

/**
 * Weigh-ins as small squares with the smoothed trend as a solid line, one
 * point per day. Markers are HTML so they stay square as the SVG stretches.
 */
export function WeightTrendChart({ series, units, height = 160 }: { series: TrendPoint[]; units: Units; height?: number }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const pts = series.map((p) => ({ date: p.date, raw: p.kg === null ? null : fromKg(p.kg, units), trend: fromKg(p.trend, units) }));
  const values = pts.flatMap((p) => (p.raw === null ? [p.trend] : [p.trend, p.raw]));
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const n = Math.max(1, pts.length - 1);
  const x = (i: number) => (i / n) * 100;
  const y = (v: number) => 92 - ((v - min) / range) * 84;
  const line = pts.map((p, i) => `${x(i)},${y(p.trend)}`).join(" ");

  return (
    <div>
      <div className="num mb-1 flex justify-between text-[10px] text-ink-3">
        <span>High {max.toFixed(1)}</span>
        <span>Low {min.toFixed(1)}</span>
      </div>
      <div ref={ref} data-seen={seen} className="wipe-in relative" style={{ height }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
          {[25, 50, 75].map((p) => (
            <line key={p} x1="0" x2="100" y1={p} y2={p} style={{ stroke: "rgb(var(--line-soft))" }} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <polyline points={line} fill="none" style={{ stroke: "rgb(var(--ink))" }} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {pts.map((p, i) =>
          p.raw === null ? null : (
            <span
              key={p.date}
              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-violet"
              style={{ left: `${x(i)}%`, top: `${y(p.raw)}%` }}
              aria-hidden
            />
          ),
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-3">
        <span>{new Date(`${pts[0]?.date}T00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        <span>{new Date(`${pts[pts.length - 1]?.date}T00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-[3px] border-ink" aria-hidden="true" /> Trend
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 bg-violet" aria-hidden="true" /> Weigh-in
        </span>
      </div>
    </div>
  );
}
