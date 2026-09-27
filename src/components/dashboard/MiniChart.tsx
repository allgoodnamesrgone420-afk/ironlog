"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";

export interface ChartPoint {
  val: number;
  label: string;
  unit?: string;
}

interface Props {
  data: ChartPoint[];
  color?: string;
}

/**
 * Minimal line chart with hover tooltip and pinned latest value, in the flat
 * NeoPop style: ink line, square markers (HTML, so they stay square).
 * Touch-friendly: latest value is always visible (not hover-only) and Y range labels are shown on the left.
 */
export function MiniChart({ data, color = "rgb(var(--violet))" }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  if (!data || data.length < 2) {
    return (
      <div className="flex h-48 flex-col items-center justify-center border border-dashed border-line-soft text-ink-3">
        <BarChart3 className="mb-2 h-8 w-8 opacity-40" />
        <span className="text-xs">Log more workouts to see trends</span>
      </div>
    );
  }

  const padding = 5;
  const max = Math.max(...data.map((d) => d.val));
  const min = Math.min(...data.map((d) => d.val));
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * (100 - padding * 2) + padding;
  const y = (v: number) => 100 - padding - ((v - min) / range) * (100 - padding * 2);
  const points = data.map((d, i) => `${x(i)},${y(d.val)}`).join(" ");
  const latest = data[data.length - 1]!;

  return (
    <div className="w-full">
      <div className="num mb-1.5 flex justify-between px-1 text-xs text-ink-3">
        <span>
          {max.toLocaleString()}
          {latest.unit ? ` ${latest.unit}` : ""}
        </span>
        <span className="font-bold text-ink">
          Latest: {latest.val.toLocaleString()}
          {latest.unit ? ` ${latest.unit}` : ""}
        </span>
      </div>
      <div
        className="relative h-44 w-full select-none"
        onMouseLeave={() => setHover(null)}
        onTouchEnd={() => setTimeout(() => setHover(null), 1500)}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" preserveAspectRatio="none">
          {[20, 40, 60, 80].map((p) => (
            <line
              key={p}
              x1="0"
              y1={p}
              x2="100"
              y2={p}
              style={{ stroke: "rgb(var(--line-soft))" }}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline
            points={points}
            fill="none"
            style={{ stroke: "rgb(var(--ink))" }}
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {data.map((_, i) => (
            <rect
              key={i}
              x={x(i) - 5}
              y="0"
              width="10"
              height="100"
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ))}
        </svg>
        {data.map((d, i) => (
          <span
            key={i}
            className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ring-2 ring-surface ${hover === i ? "h-3 w-3" : "h-2 w-2"}`}
            style={{ left: `${x(i)}%`, top: `${y(d.val)}%`, backgroundColor: color }}
          />
        ))}

        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute whitespace-nowrap border border-line bg-elevated px-2 py-1 text-[10px] shadow-[3px_3px_0_#000]"
            style={{
              left: `${x(hover)}%`,
              top: `${y(data[hover]!.val)}%`,
              transform: "translate(-50%, calc(-100% - 8px))",
            }}
          >
            <strong className="num">{data[hover]!.val.toLocaleString()}</strong> {data[hover]!.unit}
            <div className="text-[9px] text-ink-3">{data[hover]!.label}</div>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex justify-between px-1 text-[10px] font-medium text-ink-3">
        <span>{data[0]!.label}</span>
        <span>{data[data.length - 1]!.label}</span>
      </div>
    </div>
  );
}
