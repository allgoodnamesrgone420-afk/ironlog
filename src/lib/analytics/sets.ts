import type { WorkoutSet } from "@/types/workout";

/**
 * Sets that count toward totals and records: completed and not a warm-up.
 * Warm-ups are still logged (and shown), just left out of volume, set counts,
 * muscle balance and PRs.
 */
export const isWorkSet = (s: Pick<WorkoutSet, "completed" | "warmup">) => s.completed && !s.warmup;

export const workSets = (sets: WorkoutSet[] | undefined) => (sets ?? []).filter(isWorkSet);
