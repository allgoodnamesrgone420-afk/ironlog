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
