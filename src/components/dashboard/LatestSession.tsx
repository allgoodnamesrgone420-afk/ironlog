"use client";

import Link from "next/link";
import { Repeat, ArrowRight, Clock } from "lucide-react";
import type { Workout } from "@/types/workout";
import { useUnits } from "@/providers/UnitsProvider";
import { formatWeight } from "@/lib/units/converter";
import { workoutSetCount } from "@/lib/analytics/volume";
import { daysAgo } from "@/lib/utils";

export function LatestSession({ workout }: { workout: Workout }) {
  const { units } = useUnits();
  const preview = workout.exercises.slice(0, 3);

  return (
    <Link
      href={`/log?repeat=${workout.id}`}
      className="block group rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-5 hover:border-brand-400 dark:hover:border-brand-500/40 transition-colors"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400 font-bold">
          Last session
        </p>
        <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium">
          <Clock className="w-3 h-3" /> {daysAgo(workout.date)}
        </span>
      </div>

      <h3 className="text-xl font-bold text-zinc-900 dark:text-white mt-1">{workout.name}</h3>

      <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          <strong className="text-zinc-800 dark:text-zinc-200" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatWeight(workout.totalVolume, units, 0)}
          </strong>{" "}
          volume
        </span>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span>
          <strong className="text-zinc-800 dark:text-zinc-200">{workout.exercises.length}</strong> exercises
        </span>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span>
          <strong className="text-zinc-800 dark:text-zinc-200">{workoutSetCount(workout)}</strong> sets
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {preview.map((ex) => (
            <span
              key={ex.id}
              className="text-[11px] text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-1 rounded-md truncate"
            >
              {ex.name}
            </span>
          ))}
          {workout.exercises.length > 3 && (
            <span className="text-[11px] text-zinc-500 px-2 py-1">
              +{workout.exercises.length - 3} more
            </span>
          )}
        </div>
        <span className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1 shrink-0 group-hover:translate-x-0.5 transition-transform">
          <Repeat className="w-3.5 h-3.5" /> Repeat
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
