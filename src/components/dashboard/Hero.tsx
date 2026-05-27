"use client";

import { useMemo } from "react";
import type { Workout } from "@/types/workout";
import { startOfWeek } from "@/lib/utils";
import { Flame } from "lucide-react";

interface Props {
  name: string;
  workouts: Workout[];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
}

export function Hero({ name, workouts }: Props) {
  const { days, trainedThisWeek, currentDayStreak } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const trainedSet = new Set(
      workouts.map((w) => {
        const d = new Date(w.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      }),
    );

    const start = startOfWeek(new Date(today));
    start.setHours(0, 0, 0, 0);

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const isFuture = d.getTime() > today.getTime();
      const isToday = d.getTime() === today.getTime();
      return {
        label: d.toLocaleDateString(undefined, { weekday: "narrow" }),
        isTrained: trainedSet.has(d.getTime()),
        isToday,
        isFuture,
      };
    });

    // consecutive trained days ending today (or yesterday if today is rest)
    let streak = 0;
    const cursor = new Date(today);
    if (!trainedSet.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
    while (trainedSet.has(cursor.getTime())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return {
      days,
      trainedThisWeek: days.filter((d) => d.isTrained).length,
      currentDayStreak: streak,
    };
  }, [workouts]);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-black border border-zinc-800/60 shadow-xl p-5">
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-brand-600/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-10 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">
          {greeting()}, {name}
        </p>

        <div className="flex items-baseline gap-3 mt-3">
          <span
            className="text-5xl font-bold text-white leading-none"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {currentDayStreak}
          </span>
          <span className="text-sm text-zinc-400 font-semibold flex items-center gap-1">
            {currentDayStreak > 0 && <Flame className="w-3.5 h-3.5 text-amber-400" />}
            day{currentDayStreak === 1 ? "" : "s"} {currentDayStreak === 0 ? "off" : "streak"}
          </span>
        </div>

        <div className="flex gap-1.5 mt-5">
          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <span
                className={`text-[10px] font-bold uppercase ${
                  d.isToday ? "text-white" : "text-zinc-500"
                }`}
              >
                {d.label}
              </span>
              <div
                className={`w-full h-2 rounded-full transition-colors ${
                  d.isTrained
                    ? "bg-emerald-500"
                    : d.isFuture
                      ? "bg-zinc-800/50"
                      : d.isToday
                        ? "bg-zinc-700 ring-1 ring-zinc-500"
                        : "bg-zinc-800"
                }`}
              />
            </div>
          ))}
        </div>

        <p className="text-xs text-zinc-500 mt-4">
          <span className="text-zinc-300 font-semibold">{trainedThisWeek}</span> of 7 days this week
        </p>
      </div>
    </section>
  );
}
