"use client";

import { Flame, Dumbbell, Trophy } from "lucide-react";
import type { Workout } from "@/types/workout";
import { useMemo } from "react";
import { startOfWeek } from "@/lib/utils";
import { workoutSetCount } from "@/lib/analytics/volume";
import { computePRs } from "@/lib/analytics/personal-records";

interface Props {
  workouts: Workout[];
  streak: number;
}

export function StatStrip({ workouts, streak }: Props) {
  const stats = useMemo(() => {
    const start = startOfWeek();
    const thisWeek = workouts.filter((w) => w.date >= start);
    const sets = thisWeek.reduce((a, w) => a + workoutSetCount(w), 0);
    const prs = computePRs(thisWeek).length;
    return { sessions: thisWeek.length, sets, prs };
  }, [workouts]);

  const items = [
    { icon: Flame, label: "Streak", value: streak, suffix: streak === 1 ? "wk" : "wks", color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10" },
    { icon: Dumbbell, label: "Sets", value: stats.sets, suffix: "this wk", color: "text-brand-600 dark:text-brand-400", bg: "bg-brand-500/10" },
    { icon: Trophy, label: "PRs", value: stats.prs, suffix: "this wk", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-3 flex flex-col items-start"
        >
          <div className={`p-1.5 rounded-lg ${it.bg} ${it.color} mb-2`}>
            <it.icon className="w-4 h-4" strokeWidth={2.5} />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
            {it.value}
            <span className="text-xs text-zinc-500 font-semibold ml-1">{it.suffix}</span>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-1">
            {it.label}
          </div>
        </div>
      ))}
    </div>
  );
}
