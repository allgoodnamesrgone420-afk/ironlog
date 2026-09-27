import type { Workout } from "@/types/workout";
import { startOfWeek } from "@/lib/utils";

export interface TrainingWeek {
  /** Monday → Sunday of the current week. */
  days: { label: string; isTrained: boolean; isToday: boolean; isFuture: boolean }[];
  trainedThisWeek: number;
}

export function trainingWeek(workouts: Workout[]): TrainingWeek {
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
    return {
      label: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      isTrained: trainedSet.has(d.getTime()),
      isToday: d.getTime() === today.getTime(),
      isFuture: d.getTime() > today.getTime(),
    };
  });

  return { days, trainedThisWeek: days.filter((d) => d.isTrained).length };
}
