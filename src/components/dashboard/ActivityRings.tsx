"use client";

import { useMemo } from "react";
import type { Workout, MuscleGroup } from "@/types/workout";
import { findExercise } from "@/lib/data/exercises";
import { startOfWeek } from "@/lib/utils";

interface RingDef {
  key: "push" | "pull" | "legs";
  label: string;
  muscles: MuscleGroup[];
  color: string;
  bg: string;
  target: number;
}

const RINGS: RingDef[] = [
  { key: "push", label: "Push", muscles: ["chest", "shoulders", "triceps"], color: "#f97316", bg: "rgba(249, 115, 22, 0.18)", target: 14 },
  { key: "pull", label: "Pull", muscles: ["back", "biceps", "forearms"], color: "#22c55e", bg: "rgba(34, 197, 94, 0.18)", target: 14 },
  { key: "legs", label: "Legs", muscles: ["quads", "hamstrings", "glutes", "calves"], color: "#3b82f6", bg: "rgba(59, 130, 246, 0.18)", target: 14 },
];

/** Apple-Fitness-style 3 concentric rings showing weekly push/pull/leg set volume vs target. */
export function ActivityRings({ workouts }: { workouts: Workout[] }) {
  const counts = useMemo(() => {
    const start = startOfWeek();
    const thisWeek = workouts.filter((w) => w.date >= start);
    const out = { push: 0, pull: 0, legs: 0 };
    for (const w of thisWeek) {
      for (const ex of w.exercises ?? []) {
        const def = findExercise(ex.name);
        if (!def) continue;
        const completed = ex.sets.filter((s) => s.completed).length;
        if (completed === 0) continue;
        for (const ring of RINGS) {
          if (def.primary.some((m) => ring.muscles.includes(m))) {
            out[ring.key] += completed;
            break;
          }
        }
      }
    }
    return out;
  }, [workouts]);

  // Three rings, outermost = push, then pull, then legs (innermost)
  const sizes = [
    { r: 86, sw: 12 },
    { r: 64, sw: 12 },
    { r: 42, sw: 12 },
  ];

  return (
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800/60 p-5 flex items-center gap-5">
      <div className="relative w-[200px] h-[200px] shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          {RINGS.map((ring, i) => {
            const { r, sw } = sizes[i]!;
            const c = 2 * Math.PI * r;
            const value = counts[ring.key];
            const pct = Math.min(1.05, value / ring.target);
            const dash = c * Math.min(1, pct);
            return (
              <g key={ring.key}>
                <circle cx="100" cy="100" r={r} fill="none" stroke={ring.bg} strokeWidth={sw} />
                <circle
                  cx="100"
                  cy="100"
                  r={r}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={sw}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${c}`}
                  className="transition-all duration-700"
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex-1 space-y-3">
        <div>
          <h3 className="font-bold text-white text-sm">This week</h3>
          <p className="text-xs text-zinc-500">Working sets by movement</p>
        </div>
        {RINGS.map((ring) => {
          const value = counts[ring.key];
          const pct = Math.min(100, Math.round((value / ring.target) * 100));
          return (
            <div key={ring.key} className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ring.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-semibold text-zinc-200">{ring.label}</span>
                  <span className="text-xs text-zinc-500" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {value}<span className="text-zinc-600"> / {ring.target}</span>
                  </span>
                </div>
                <div className="h-1 rounded-full bg-zinc-800 mt-1 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: ring.color }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
