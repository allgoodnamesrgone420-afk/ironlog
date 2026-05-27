import type { Workout, MuscleGroup } from "@/types/workout";
import { EXERCISE_LIBRARY, findExercise } from "@/lib/data/exercises";

export type MuscleVolume = Record<MuscleGroup, number>;

const empty: MuscleVolume = {
  chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0, forearms: 0,
  core: 0, quads: 0, hamstrings: 0, glutes: 0, calves: 0, cardio: 0,
};

/**
 * Sum sets per muscle group for the given workouts. Secondary muscles count for half.
 */
export function muscleSetsThisWeek(workouts: Workout[]): MuscleVolume {
  const totals: MuscleVolume = { ...empty };
  for (const w of workouts) {
    for (const ex of w.exercises ?? []) {
      const def = findExercise(ex.name);
      const numSets = ex.sets?.filter((s) => s.completed).length ?? 0;
      if (!def || numSets === 0) continue;
      for (const m of def.primary) totals[m] += numSets;
      for (const m of def.secondary ?? []) totals[m] += numSets * 0.5;
    }
  }
  return totals;
}

/**
 * Returns 0..1 intensity per muscle group, normalized to the busiest one.
 * Used by the body heatmap.
 */
export function normalize(totals: MuscleVolume): MuscleVolume {
  const max = Math.max(...Object.values(totals), 1);
  const out = { ...empty };
  for (const k of Object.keys(totals) as MuscleGroup[]) {
    out[k] = totals[k] / max;
  }
  return out;
}

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest", back: "Back", shoulders: "Shoulders", biceps: "Biceps",
  triceps: "Triceps", forearms: "Forearms", core: "Core", quads: "Quads",
  hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves", cardio: "Cardio",
};

export { EXERCISE_LIBRARY };
