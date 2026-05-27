"use client";

import { useMemo } from "react";
import type { Workout, MuscleGroup } from "@/types/workout";
import { findExercise } from "@/lib/data/exercises";
import { startOfWeek } from "@/lib/utils";

interface MuscleRow {
  key: MuscleGroup | "legs";
  label: string;
  matches: MuscleGroup[];
  color: string;
  target: number;
}

const ROWS: MuscleRow[] = [
  { key: "chest", label: "Chest", matches: ["chest"], color: "#ef4444", target: 12 },
  { key: "back", label: "Back", matches: ["back"], color: "#3b82f6", target: 14 },
  { key: "shoulders", label: "Shoulders", matches: ["shoulders"], color: "#a855f7", target: 8 },
  { key: "biceps", label: "Biceps", matches: ["biceps"], color: "#ec4899", target: 8 },
  { key: "triceps", label: "Triceps", matches: ["triceps"], color: "#f97316", target: 8 },
  { key: "legs", label: "Legs", matches: ["quads", "hamstrings", "glutes", "calves"], color: "#22c55e", target: 16 },
  { key: "core", label: "Core", matches: ["core"], color: "#eab308", target: 6 },
];

export function MuscleBalance({ workouts }: { workouts: Workout[] }) {
  const counts = useMemo(() => {
    const start = startOfWeek();
    const thisWeek = workouts.filter((w) => w.date >= start);
    const out: Record<string, number> = {};
    for (const r of ROWS) out[r.key] = 0;

    for (const w of thisWeek) {
      for (const ex of w.exercises ?? []) {
        const def = findExercise(ex.name);
        if (!def) continue;
        const completed = ex.sets.filter((s) => s.completed).length;
        if (completed === 0) continue;

        for (const r of ROWS) {
          if (def.primary.some((m) => r.matches.includes(m))) {
            out[r.key]! += completed;
          } else if ((def.secondary ?? []).some((m) => r.matches.includes(m))) {
            out[r.key]! += completed * 0.5;
          }
        }
      }
    }
    return out;
  }, [workouts]);

  const totalSets = ROWS.reduce((a, r) => a + (counts[r.key] ?? 0), 0);

  return (
    <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Muscle balance</h3>
          <p className="text-xs text-zinc-500">Working sets this week</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-zinc-900 dark:text-white leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
            {Math.round(totalSets)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-0.5">Total sets</div>
        </div>
      </div>

      <ul className="space-y-3">
        {ROWS.map((r) => {
          const value = Math.round(counts[r.key] ?? 0);
          const pct = Math.min(100, Math.round((value / r.target) * 100));
          const isOver = value >= r.target;
          return (
            <li key={r.key} className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{r.label}</span>
                  <span
                    className="text-xs"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    <span className={isOver ? "text-emerald-500 font-bold" : "text-zinc-700 dark:text-zinc-300 font-semibold"}>
                      {value}
                    </span>
                    <span className="text-zinc-400 dark:text-zinc-600"> / {r.target}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: r.color }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
