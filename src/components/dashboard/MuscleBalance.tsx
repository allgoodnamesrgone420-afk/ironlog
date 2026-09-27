"use client";

import { useMemo } from "react";
import type { Workout, MuscleGroup } from "@/types/workout";
import { findExercise } from "@/lib/data/exercises";
import { startOfWeek } from "@/lib/utils";
import { useMuscleTargets, type DisplayMuscle } from "@/hooks/useMuscleTargets";
import { CountUp } from "@/components/ui/CountUp";
import { useTrackedMuscles } from "@/hooks/useTrackedMuscles";
import { useSeen } from "@/hooks/useSeen";

export interface MuscleRowDef {
  key: DisplayMuscle;
  label: string;
  matches: MuscleGroup[];
}

/** Canonical definition of every selectable muscle row. */
export const ALL_MUSCLE_ROWS: MuscleRowDef[] = [
  { key: "chest", label: "Chest", matches: ["chest"] },
  { key: "back", label: "Back", matches: ["back"] },
  { key: "shoulders", label: "Shoulders", matches: ["shoulders"] },
  { key: "biceps", label: "Biceps", matches: ["biceps"] },
  { key: "triceps", label: "Triceps", matches: ["triceps"] },
  { key: "forearms", label: "Forearms", matches: ["forearms"] },
  { key: "core", label: "Core", matches: ["core"] },
  { key: "quads", label: "Quads", matches: ["quads"] },
  { key: "hamstrings", label: "Hamstrings", matches: ["hamstrings"] },
  { key: "glutes", label: "Glutes", matches: ["glutes"] },
  { key: "calves", label: "Calves", matches: ["calves"] },
  { key: "legs", label: "Legs (combined)", matches: ["quads", "hamstrings", "glutes", "calves"] },
  { key: "cardio", label: "Cardio", matches: ["cardio"] },
];

const ROW_BY_KEY: Record<DisplayMuscle, MuscleRowDef> = Object.fromEntries(
  ALL_MUSCLE_ROWS.map((r) => [r.key, r]),
) as Record<DisplayMuscle, MuscleRowDef>;

export function MuscleBalance({ workouts }: { workouts: Workout[] }) {
  const { targets } = useMuscleTargets();
  const { tracked } = useTrackedMuscles();
  const [ref, seen] = useSeen<HTMLElement>();

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
  // Share of the week gone (Mon → Sun), to tell "not yet" from "falling behind".
  const weekDone = Math.min(1, (Date.now() - startOfWeek().getTime()) / (7 * 86_400_000));

  return (
    <section ref={ref} data-seen={seen} className="plunk face-card p-4" style={{ ["--d" as string]: "4px" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Muscle balance</p>
          <p className="text-xs text-ink-2">Working sets this week</p>
        </div>
        <div className="text-right">
          <p className="num text-2xl font-extrabold leading-none">
            <CountUp value={Math.round(totalSets)} start={seen} />
          </p>
          <p className="label mt-1">Total sets</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink-3">Pick muscles to track in Settings → Tracked muscles.</p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {rows.map((r, i) => {
              const value = Math.round(counts[r.key] ?? 0);
              const target = targets[r.key];
              const status = balanceStatus(value, target, weekDone);
              // Scale leaves room past the target so "over" is visible.
              const max = Math.max(target * 1.5, value, 1);
              return (
                <li key={r.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-semibold">{r.label}</span>
                    <span className="num shrink-0 text-xs">
                      {status === "over" && <span className="mr-1.5 font-bold uppercase text-over">↑ over</span>}
                      {status === "behind" && <span className="mr-1.5 font-bold uppercase text-under">↓ behind</span>}
                      <span className={status === "hit" ? "font-extrabold" : "font-semibold"}>
                        {status === "hit" && "✓ "}
                        {value}
                      </span>
                      <span className="text-ink-3"> / {target}</span>
                    </span>
                  </div>
                  <div
                    className="relative mt-1.5 h-2 bg-elevated"
                    role="progressbar"
                    aria-label={`${r.label} sets`}
                    aria-valuenow={value}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(target, value)}
                    aria-valuetext={`${value} of ${target}`}
                  >
                    <div
                      className={`bar-anim grow-x h-full ${status === "over" ? "hatch" : ""}`}
                      style={{ width: `${(value / max) * 100}%`, backgroundColor: STATUS_COLOR[status], ["--delay" as string]: `${i * 50}ms` }}
                    />
                    {target > 0 && (
                      <span className="absolute -bottom-1 -top-1 w-0.5 bg-ink" style={{ left: `calc(${(target / max) * 100}% - 1px)` }} aria-hidden="true" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-0.5 bg-ink" aria-hidden="true" /> Target
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-ink" aria-hidden="true" /> Hit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="hatch h-2.5 w-2.5 bg-over" aria-hidden="true" /> Over 150%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-under" aria-hidden="true" /> Behind pace
            </span>
          </div>
        </>
      )}
    </section>
  );
}

type BalanceStatus = "building" | "hit" | "over" | "behind";

/** Neutral while you build up; colour only when a muscle is well over or falling behind. */
const STATUS_COLOR: Record<BalanceStatus, string> = {
  building: "rgb(var(--ink-3))",
  hit: "rgb(var(--ink))",
  over: "rgb(var(--over))",
  behind: "rgb(var(--under))",
};

function balanceStatus(value: number, target: number, weekDone: number): BalanceStatus {
  if (target <= 0) return "building";
  if (value > target * 1.5) return "over";
  if (value >= target) return "hit";
  // From Wednesday on, flag muscles at under half of where they'd be at an even pace.
  if (weekDone >= 3 / 7 && value < target * weekDone * 0.5) return "behind";
  return "building";
}

/** Back-compat: settings still imports this name. */
export const MUSCLE_BALANCE_ROWS = ALL_MUSCLE_ROWS;
