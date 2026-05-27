"use client";

import { Trophy, TrendingUp } from "lucide-react";
import type { PRRow } from "@/lib/analytics/personal-records";
import { useUnits } from "@/providers/UnitsProvider";
import { fromKg } from "@/lib/units/converter";

export function PRCards({ records }: { records: PRRow[] }) {
  const { units } = useUnits();

  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400" /> Personal records
        </h3>
        {records.length > 0 && (
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
            {records.length} lifts
          </span>
        )}
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-6 text-center">
          <Trophy className="w-6 h-6 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">No PRs yet. Complete a heavy set.</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
          {records.slice(0, 10).map((r, idx) => {
            const displayKg = fromKg(r.kg, units);
            const displayDelta = r.deltaKg ? fromKg(r.deltaKg, units) : 0;
            return (
              <div
                key={r.name}
                className="shrink-0 w-[180px] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-4 relative overflow-hidden"
              >
                {idx === 0 && (
                  <div className="absolute top-2 right-2 text-[9px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Top
                  </div>
                )}
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold truncate pr-10">
                  {r.name}
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span
                    className="text-3xl font-bold text-zinc-900 dark:text-white leading-none"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {Number.isInteger(displayKg) ? displayKg.toFixed(0) : displayKg.toFixed(1)}
                  </span>
                  <span className="text-xs text-zinc-500 font-semibold">{units}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  × {r.reps} <span className="text-zinc-300 dark:text-zinc-600">·</span> est{" "}
                  <span className="text-zinc-700 dark:text-zinc-300 font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {Math.round(fromKg(r.estimated1RM, units))} {units}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">
                    {r.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  {typeof r.deltaKg === "number" && r.deltaKg > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="w-3 h-3" />+{displayDelta.toFixed(0)} {units}
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
