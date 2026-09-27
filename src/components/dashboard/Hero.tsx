"use client";

import type { Workout } from "@/types/workout";
import type { TrainingWeek } from "@/lib/analytics/streak";
import { daysAgo } from "@/lib/utils";
import { CountUp } from "@/components/ui/CountUp";

interface Props {
  week: TrainingWeek;
  /** Training days per week the user aims for. */
  goal: number;
  /** Most recent workout, if any. */
  last?: Workout;
}

/** Lime headline block: days trained this week against the weekly goal, Monday → Sunday. */
export function Hero({ week, goal, last }: Props) {
  const { days, trainedThisWeek } = week;
  const left = Math.max(0, goal - trainedThisWeek);
  return (
    <section className="plunk face-lime p-5" style={{ ["--d" as string]: "6px" }} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">Days trained · this week</p>
        <p className="num text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">
          {left === 0 ? "Goal hit ✓" : `${left} to go`}
        </p>
      </div>

      <p className="hero-num num mt-3 text-[88px]">
        <CountUp value={trainedThisWeek} />
        <span className="ml-1 text-[40px] opacity-50">/{goal}</span>
      </p>

      <p className="mt-2 truncate text-sm font-semibold opacity-80">
        {last ? `Last session ${daysAgo(last.date).toLowerCase()} · ${last.name}` : "No sessions yet. Tap Log to start one."}
      </p>

      <div className="mt-4 grid grid-cols-7 gap-1.5" role="img" aria-label={`Trained ${trainedThisWeek} days this week, goal ${goal}`}>
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              style={{ ["--delay" as string]: `${120 + i * 60}ms` }}
              className={`grow-x h-2.5 w-full ${
                d.isTrained ? "bg-[#0d0d0d]" : d.isToday ? "bg-black/15 ring-1 ring-inset ring-black/60" : d.isFuture ? "bg-black/[0.07]" : "bg-black/15"
              }`}
            />
            <span className={`text-[10px] font-extrabold uppercase ${d.isToday ? "" : "opacity-60"}`}>{d.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
