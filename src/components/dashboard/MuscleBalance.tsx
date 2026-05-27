"use client";

import { useMemo } from "react";
import type { Workout, MuscleGroup } from "@/types/workout";
import { findExercise } from "@/lib/data/exercises";
import { startOfWeek } from "@/lib/utils";
import { useMuscleTargets, type DisplayMuscle } from "@/hooks/useMuscleTargets";
import { useTrackedMuscles } from "@/hooks/useTrackedMuscles";

export interface MuscleRowDef {
  key: DisplayMuscle;
  label: string;
  matches: MuscleGroup[];
  color: string;
}

/** Canonical definition of every selectable muscle row. */
export const ALL_MUSCLE_ROWS: MuscleRowDef[] = [
  { key: "chest", label: "Chest", matches: ["chest"], color: "#ef4444" },
  { key: "back", label: "Back", matches: ["back"], color: "#3b82f6" },
  { key: "shoulders", label: "Shoulders", matches: ["shoulders"], color: "#a855f7" },
  { key: "biceps", label: "Biceps", matches: ["biceps"], color: "#ec4899" },
  { key: "triceps", label: "Triceps", matches: ["triceps"], color: "#f97316" },
  { key: "forearms", label: "Forearms", matches: ["forearms"], color: "#14b8a6" },
  { key: "core", label: "Core", matches: ["core"], color: "#eab308" },
  { key: "quads", label: "Quads", matches: ["quads"], color: "#22c55e" },
  { key: "hamstrings", label: "Hamstrings", matches: ["hamstrings"], color: "#16a34a" },
  { key: "glutes", label: "Glutes", matches: ["glutes"], color: "#84cc16" },
  { key: "calves", label: "Calves", matches: ["calves"], color: "#10b981" },
  { key: "legs", label: "Legs (combined)", matches: ["quads", "hamstrings", "glutes", "calves"], color: "#22c55e" },
  { key: "cardio", label: "Cardio", matches: ["cardio"], color: "#06b6d4" },
];

const ROW_BY_KEY: Record<DisplayMuscle, MuscleRowDef> = Object.fromEntries(
  ALL_MUSCLE_ROWS.map((r) => [r.key, r]),
) as Record<DisplayMuscle, MuscleRowDef>;

export function MuscleBalance({ workouts }: { workouts: Workout[] }) {
  const { targets } = useMuscleTargets();
  const { tracked } = useTrackedMuscles();

  const rows = tracked.map((k) => ROW_BY_KEY[k]).filter(Boolean);

  const counts = useMemo(() => {
    const start = startOfWeek();
    const thisWeek = workouts.filter((w) => w.date >= start);
    const out: Record<string, number> = {};
    for (const r of rows) out[r.key] = 0;

    for (const w of thisWeek) {
      for (const ex of w.exercises ?? []) {
        const completed = ex.sets.filter((s) => s.completed).length;
        if (completed === 0) continue;

        const def = findExercise(ex.name);
        const primary = def?.primary ?? ex.muscles ?? [];
        const secondary = def?.secondary ?? [];

        for (const r of rows) {
          if (primary.some((m) => r.matches.includes(m))) out[r.key]! += completed;
          else if (secondary.some((m) => r.matches.includes(m))) out[r.key]! += completed * 0.5;
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, tracked]);

  const totalSets = rows.reduce((a, r) => a + (counts[r.key] ?? 0), 0);

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

      {rows.length === 0 ? (
        <p className="text-xs text-zinc-500 italic text-center py-4">
          Pick muscles to track in Settings → Tracked muscles.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const value = Math.round(counts[r.key] ?? 0);
            const target = targets[r.key];
            const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
            const isOver = target > 0 && value >= target;
            return (
              <li key={r.key} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{r.label}</span>
                    <span className="text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                      <span className={isOver ? "text-emerald-500 font-bold" : "text-zinc-700 dark:text-zinc-300 font-semibold"}>
                        {value}
                      </span>
                      <span className="text-zinc-400 dark:text-zinc-600"> / {target}</span>
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
      )}
    </section>
  );
}

/** Back-compat: settings still imports this name. */
export const MUSCLE_BALANCE_ROWS = ALL_MUSCLE_ROWS;
