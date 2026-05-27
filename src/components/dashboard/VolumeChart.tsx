"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { useUnits } from "@/providers/UnitsProvider";
import { fromKg } from "@/lib/units/converter";

interface Point {
  kg: number;
  label: string;
  date: Date;
}

export function VolumeChart({ data }: { data: Point[] }) {
  const { units } = useUnits();
  const [hover, setHover] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-8 flex flex-col items-center justify-center text-center">
        <BarChart3 className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mb-2" />
        <p className="text-sm text-zinc-500">Log a workout to see trends</p>
      </div>
    );
  }

  const displayVals = data.map((d) => fromKg(d.kg, units));
  const max = Math.max(...displayVals, 1);
  const padding = { top: 10, bottom: 24 };
  const W = 320;
  const H = 140;
  const innerH = H - padding.top - padding.bottom;
  const innerW = W;
  const barW = innerW / data.length - 4;

  const total = displayVals.reduce((a, b) => a + b, 0);
  const avg = total / displayVals.length;
  const focused = hover !== null ? data[hover] : null;

  return (
    <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Volume trend</h3>
          <p className="text-xs text-zinc-500">Last {data.length} sessions</p>
        </div>
        <div className="text-right">
          <p
            className="text-xl font-bold text-zinc-900 dark:text-white leading-none"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {focused ? Math.round(fromKg(focused.kg, units)).toLocaleString() : Math.round(avg).toLocaleString()}
            <span className="text-xs text-zinc-500 font-semibold ml-1">{units}</span>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-0.5">
            {focused ? focused.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Average"}
          </p>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bar-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        <line
          x1="0"
          y1={padding.top + innerH}
          x2={W}
          y2={padding.top + innerH}
          className="stroke-zinc-200 dark:stroke-zinc-700"
          strokeWidth="0.5"
        />
        <line
          x1="0"
          y1={padding.top + innerH - (avg / max) * innerH}
          x2={W}
          y2={padding.top + innerH - (avg / max) * innerH}
          className="stroke-zinc-300 dark:stroke-zinc-600"
          strokeWidth="0.5"
          strokeDasharray="2 3"
        />

        {data.map((d, i) => {
          const v = displayVals[i]!;
          const h = (v / max) * innerH;
          const x = i * (innerW / data.length) + 2;
          const y = padding.top + innerH - h;
          const isHover = hover === i;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, h)}
                rx="3"
                fill="url(#bar-grad)"
                opacity={hover === null || isHover ? 1 : 0.35}
                className="transition-opacity duration-150"
              />
              <rect
                x={x - 2}
                y="0"
                width={barW + 4}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(i)}
              />
            </g>
          );
        })}
      </svg>

      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-600 font-medium mt-1 px-1">
        <span>{data[0]!.label}</span>
        <span>{data[data.length - 1]!.label}</span>
      </div>
    </div>
  );
}
