import type { Workout } from "@/types/workout";

/**
 * The routines you actually do: past workouts grouped by name (case-insensitive),
 * most frequent first. Each carries its latest session, the version to repeat.
 */
export function topRoutines(workouts: Workout[], limit = 3): { count: number; latest: Workout }[] {
  const groups = new Map<string, { count: number; latest: Workout }>();
  for (const w of workouts) {
    const key = w.name.trim().toLowerCase();
    if (!key) continue;
    const existing = groups.get(key);
    if (!existing) groups.set(key, { count: 1, latest: w });
    else {
      existing.count += 1;
      if (w.date.getTime() > existing.latest.date.getTime()) existing.latest = w;
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
