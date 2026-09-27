"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { useUnits } from "@/providers/UnitsProvider";
import { fromKg } from "@/lib/units/converter";

interface Point {
  kg: number;
  label: string;
  date: Date;
  name?: string;
}

const H = 140;

export function VolumeChart({ data }: { data: Point[] }) {
  const { units } = useUnits();
  const [hover, setHover] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <section className="card flex flex-col items-center justify-center p-8 text-center">
        <BarChart3 className="mb-2 h-8 w-8 text-ink-3" />
        <p className="text-sm text-ink-2">Log a workout to see trends</p>
      </section>
    );
  }

  const vals = data.map((d) => fromKg(d.kg, units));
  const max = Math.max(...vals, 1);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const focused = hover !== null ? data[hover] : null;
  const shown = hover !== null ? vals[hover]! : avg;
  const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <section className="plunk face-card p-4" style={{ ["--d" as string]: "4px" }} aria-label={`Volume, last ${data.length} sessions`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="label">Volume · last {data.length} sessions</p>
        <p className="num text-[11px] text-ink-3">
          avg {Math.round(avg).toLocaleString()} {units}
        </p>
      </div>

      {/* Readout (hover, tap or keyboard). Fixed height so the chart never shifts under the pointer. */}
      <div className="mt-2 h-14" aria-live="polite">
        <p className="num text-3xl font-extrabold tracking-tight">
          {Math.round(shown).toLocaleString()}
          <span className="ml-1 text-sm font-semibold text-ink-3">{units}</span>
        </p>
        <p className="truncate text-xs text-ink-2">
          {focused ? `${focused.name ?? "Session"} · ${fmtDate(focused.date)}` : "Average per session"}
        </p>
      </div>

      <div className="relative mt-2" style={{ height: H }} onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}>
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-ink/70"
          style={{ bottom: (avg / max) * H }}
          aria-hidden="true"
        />
        <div className="flex h-full items-end gap-[3px]">
          {data.map((d, i) => (
            <button
              key={i}
              type="button"
              className="flex h-full min-w-0 flex-1 items-end"
              onPointerEnter={(e) => e.pointerType === "mouse" && setHover(i)}
              onClick={() => setHover((h) => (h === i ? null : i))}
              aria-label={`${d.name ?? "Session"}, ${fmtDate(d.date)}: ${Math.round(vals[i]!).toLocaleString()} ${units}`}
              aria-pressed={hover === i}
            >
              <span
                className="block w-full bg-blue transition-opacity duration-150"
                style={{ height: Math.max(3, (vals[i]! / max) * H), opacity: hover === null || hover === i ? 1 : 0.35 }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-1.5 flex justify-between text-[10px] text-ink-3">
        <span>{data[0]!.label}</span>
        <span>{data[data.length - 1]!.label}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-blue" aria-hidden="true" /> Session
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-ink" aria-hidden="true" /> Average
        </span>
      </div>
    </section>
  );
}
