"use client";

import type { Workout } from "@/types/workout";
import type { TrainingWeek } from "@/lib/analytics/streak";
import { daysAgo } from "@/lib/utils";

interface Props {
  week: TrainingWeek;
  /** Most recent workout, if any. */
  last?: Workout;
}

/** Lime headline block: days trained this week, Monday → Sunday. */
export function Hero({ week, last }: Props) {
  const { days, trainedThisWeek } = week;
  return (
    <section className="plunk face-lime p-5" style={{ ["--d" as string]: "6px" }} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">Days trained · this week</p>
        <p className="num text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">
          {Math.round((trainedThisWeek / 7) * 100)}% of week
        </p>
      </div>

      <p className="hero-num num mt-3 text-[88px]">
        {trainedThisWeek}
        <span className="ml-1 text-[40px] opacity-50">/7</span>
      </p>

      <p className="mt-2 truncate text-sm font-semibold opacity-80">
        {last ? `Last session ${daysAgo(last.date).toLowerCase()} · ${last.name}` : "No sessions yet. Tap Log to start one."}
      </p>

      <div className="mt-4 grid grid-cols-7 gap-1.5" role="img" aria-label={`Trained ${trainedThisWeek} of 7 days this week`}>
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              className={`h-2.5 w-full ${
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
