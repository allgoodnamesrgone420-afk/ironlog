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
 * Minimal SVG line chart with hover tooltip and pinned latest value.
 * Touch-friendly: latest value is always visible (not hover-only) and Y range labels are shown on the left.
 */
export function MiniChart({ data, color = "#2563eb" }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  if (!data || data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400">
        <BarChart3 className="w-8 h-8 opacity-30 mb-2" />
        <span className="text-xs italic">Log more workouts to see trends</span>
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
  const areaPoints = `${padding},100 ${points} ${100 - padding},100`;
  const latest = data[data.length - 1]!;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-zinc-400 mb-1.5 px-1">
        <span>{max.toLocaleString()}{latest.unit ? ` ${latest.unit}` : ""}</span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-200">
          Latest: {latest.val.toLocaleString()}{latest.unit ? ` ${latest.unit}` : ""}
        </span>
      </div>
      <div
        className="relative h-44 w-full select-none"
        onMouseLeave={() => setHover(null)}
        onTouchEnd={() => setTimeout(() => setHover(null), 1500)}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`g-${color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[20, 40, 60, 80].map((p) => (
            <line
              key={p}
              x1="0"
              y1={p}
              x2="100"
              y2={p}
              stroke="currentColor"
              className="text-zinc-100 dark:text-zinc-800"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polygon points={areaPoints} fill={`url(#g-${color.replace("#", "")})`} />
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {data.map((d, i) => (
            <g key={i}>
              <rect
                x={x(i) - 5}
                y="0"
                width="10"
                height="100"
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
              />
              <circle cx={x(i)} cy={y(d.val)} r={hover === i ? 2.5 : 1.5} fill={color} vectorEffect="non-scaling-stroke" />
            </g>
          ))}
        </svg>

        {hover !== null && data[hover] && (
          <div
            className="absolute pointer-events-none bg-zinc-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap"
            style={{
              left: `${x(hover)}%`,
              top: `${y(data[hover]!.val)}%`,
              transform: "translate(-50%, calc(-100% - 6px))",
            }}
          >
            <strong>{data[hover]!.val.toLocaleString()}</strong> {data[hover]!.unit}
            <div className="opacity-70 text-[9px]">{data[hover]!.label}</div>
          </div>
        )}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-400 mt-1.5 px-1 font-medium">
        <span>{data[0]!.label}</span>
        <span>{data[data.length - 1]!.label}</span>
      </div>
    </div>
  );
}
