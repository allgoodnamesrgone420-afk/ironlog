"use client";

import type { Workout } from "@/types/workout";
import { useMemo } from "react";
import { startOfWeek } from "@/lib/utils";
import { workoutSetCount, workoutVolume } from "@/lib/analytics/volume";
import { fromKg } from "@/lib/units/converter";
import { useUnits } from "@/providers/UnitsProvider";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { countPRsSince } from "@/lib/analytics/personal-records";
import { CountUp } from "@/components/ui/CountUp";

interface Props {
  workouts: Workout[];
}

export function StatStrip({ workouts }: Props) {
  const { units } = useUnits();
  const bodyweightKg = useLatestBodyweight();
  const stats = useMemo(() => {
    const start = startOfWeek();
    const thisWeek = workouts.filter((w) => w.date >= start);
    const sets = thisWeek.reduce((a, w) => a + workoutSetCount(w), 0);
    const volume = thisWeek.reduce((a, w) => a + workoutVolume(w, bodyweightKg), 0);
    const prs = countPRsSince(workouts, start);
    return { sessions: thisWeek.length, sets, prs, volume };
  }, [workouts, bodyweightKg]);

  const volume = fromKg(stats.volume, units);
  const items = [
    { label: "Sets", value: stats.sets, sub: "this week", color: "rgb(var(--blue))" },
    { label: "PRs", value: stats.prs, sub: "this week", color: "rgb(var(--ok))" },
    {
      label: "Volume",
      value: volume >= 10_000 ? Math.round(volume / 100) / 10 : Math.round(volume),
      format: volume >= 10_000 ? (n: number) => `${n.toFixed(1)}k` : undefined,
      sub: `${units} this week`,
      color: "#ffb800",
    },
  ];

  return (
    <section className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div key={it.label} className="card border-t-4 p-3" style={{ borderTopColor: it.color }}>
          <p className="label">{it.label}</p>
          <p className="num mt-1 text-2xl font-extrabold tracking-tight">
            <CountUp value={it.value} format={it.format} />
          </p>
          <p className="whitespace-nowrap text-xs font-semibold text-ink-3">{it.sub}</p>
        </div>
      ))}
    </section>
  );
}
