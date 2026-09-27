"use client";

import { Trophy, TrendingUp } from "lucide-react";
import type { PRRow } from "@/lib/analytics/personal-records";
import { useUnits } from "@/providers/UnitsProvider";
import { fromKg } from "@/lib/units/converter";

export function PRCards({ records }: { records: PRRow[] }) {
  const { units } = useUnits();

  return (
    <section className="space-y-3" aria-label="Personal records">
      <div className="flex items-baseline justify-between">
        <p className="label flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5" /> Personal records
        </p>
        {records.length > 0 && <p className="num text-[11px] font-semibold text-ink-3">{records.length} lifts</p>}
      </div>

      {records.length === 0 ? (
        <div className="card p-5 text-center">
          <p className="text-sm text-ink-2">No PRs yet. Complete a heavy set.</p>
        </div>
      ) : (
        // Bottom padding leaves room for each card's 3D edge inside the scroller.
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-2 lg:mx-0 lg:px-0">
          {records.slice(0, 10).map((r, idx) => {
            const displayKg = fromKg(r.kg, units);
            const displayDelta = r.deltaKg ? fromKg(r.deltaKg, units) : 0;
            return (
              <div key={r.name} className="plunk face-card w-[168px] shrink-0 p-4" style={{ ["--d" as string]: "4px" }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="label truncate">{r.name}</p>
                  {idx === 0 && <span className="tag solid shrink-0 bg-[#ffb800] text-on-accent">Top</span>}
                </div>
                <p className="num mt-2 text-3xl font-extrabold tracking-tight">
                  {Number.isInteger(displayKg) ? displayKg.toFixed(0) : displayKg.toFixed(1)}
                  <span className="ml-1 text-xs font-semibold text-ink-3">{units}</span>
                </p>
                <p className="num mt-1 text-xs text-ink-2">
                  × {r.reps} · est{" "}
                  <span className="font-bold text-ink">
                    {Math.round(fromKg(r.estimated1RM, units))} {units}
                  </span>
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-ink-3">{r.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  {typeof r.deltaKg === "number" && r.deltaKg > 0 && (
                    <span className="num flex items-center gap-0.5 font-bold text-ok">
                      <TrendingUp className="h-3 w-3" />+{displayDelta.toFixed(0)} {units}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
