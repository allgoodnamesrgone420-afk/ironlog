"use client";

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
    { label: "Sets", value: stats.sets, sub: "this week", color: "rgb(var(--blue))" },
    { label: "PRs", value: stats.prs, sub: "this week", color: "rgb(var(--ok))" },
    { label: "Streak", value: streak, sub: streak === 1 ? "week" : "weeks", color: "#ffb800" },
  ];

  return (
    <section className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div key={it.label} className="card border-t-4 p-3" style={{ borderTopColor: it.color }}>
          <p className="label">{it.label}</p>
          <p className="num mt-1 text-2xl font-extrabold tracking-tight">{it.value}</p>
          <p className="whitespace-nowrap text-xs font-semibold text-ink-3">{it.sub}</p>
        </div>
      ))}
    </section>
  );
}
