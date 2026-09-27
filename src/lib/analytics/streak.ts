import type { Workout } from "@/types/workout";
import { startOfWeek } from "@/lib/utils";

export function weeklySessionCount(workouts: Workout[]): number {
  const start = startOfWeek();
  return workouts.filter((w) => w.date >= start).length;
}

/**
 * Counts consecutive weeks (going back from this one) that contain ≥1 workout.
 */
export function currentStreakWeeks(workouts: Workout[]): number {
  if (workouts.length === 0) return 0;
  const weeks = new Set<string>();
  for (const w of workouts) {
    const s = startOfWeek(new Date(w.date));
    weeks.add(s.toISOString().slice(0, 10));
  }
  let streak = 0;
  const cursor = startOfWeek();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!weeks.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

export interface TrainingWeek {
  /** Monday → Sunday of the current week. */
  days: { label: string; isTrained: boolean; isToday: boolean; isFuture: boolean }[];
  trainedThisWeek: number;
  /** Consecutive trained days ending today (or yesterday, if today is a rest day). */
  currentDayStreak: number;
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

  let streak = 0;
  const cursor = new Date(today);
  if (!trainedSet.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  while (trainedSet.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { days, trainedThisWeek: days.filter((d) => d.isTrained).length, currentDayStreak: streak };
}
