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
    <section className="plunk face-card p-4" style={{ ["--d" as string]: "4px" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Muscle balance</p>
          <p className="text-xs text-ink-2">Working sets this week</p>
        </div>
        <div className="text-right">
          <p className="num text-2xl font-extrabold leading-none">{Math.round(totalSets)}</p>
          <p className="label mt-1">Total sets</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink-3">Pick muscles to track in Settings → Tracked muscles.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => {
            const value = Math.round(counts[r.key] ?? 0);
            const target = targets[r.key];
            const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
            const isOver = target > 0 && value >= target;
            return (
              <li key={r.key}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: r.color }} aria-hidden />
                    <span className="truncate">{r.label}</span>
                  </span>
                  <span className="num shrink-0 text-xs">
                    <span className={isOver ? "font-bold text-ok" : "font-semibold"}>
                      {isOver && "✓ "}
                      {value}
                    </span>
                    <span className="text-ink-3"> / {target}</span>
                  </span>
                </div>
                <div
                  className="mt-1 h-2 bg-elevated"
                  role="progressbar"
                  aria-label={`${r.label} sets`}
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={target}
                >
                  <div className="bar-anim h-full" style={{ width: `${pct}%`, backgroundColor: r.color }} />
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
