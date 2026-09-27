import type { Workout, WorkoutSet } from "@/types/workout";
import { estimate1RM } from "./onerm";

export interface PRRow {
  name: string;
  kg: number;
  reps: number;
  date: Date;
  estimated1RM: number;
  /** kg delta vs previous PR before this one, if any */
  deltaKg?: number;
}

type Entry = { kg: number; reps: number; date: Date };

/** Heavier wins; at the same weight, more reps wins. */
export function beats(a: { kg: number; reps: number }, b: { kg: number; reps: number } | null | undefined): boolean {
  return !b || a.kg > b.kg || (a.kg === b.kg && a.reps > b.reps);
}

/** Best completed, loaded set of one exercise in one workout. */
function bestSet(sets: WorkoutSet[] | undefined, date: Date): Entry | null {
  let best: Entry | null = null;
  for (const s of sets ?? []) {
    if (!s.completed) continue;
    if (!Number.isFinite(s.kg) || !Number.isFinite(s.reps)) continue;
    if (s.kg <= 0) continue;
    if (beats(s, best)) best = { kg: s.kg, reps: s.reps, date };
  }
  return best;
}

/**
 * Computes, for each exercise name, the best top-set ever (highest weight,
 * tiebreak on reps) along with the prior PR delta so we can show progression.
 */
export function computePRs(workouts: Workout[]): PRRow[] {
  const history: Record<string, Entry[]> = {};

  // Sort oldest first so deltas can be computed
  const sorted = [...workouts].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const w of sorted) {
    for (const ex of w.exercises ?? []) {
      const name = ex.name?.trim();
      if (!name) continue;
      const best = bestSet(ex.sets, w.date);
      if (best) (history[name] ??= []).push(best);
    }
  }

  const out: PRRow[] = [];
  for (const [name, entries] of Object.entries(history)) {
    let bestSoFar: Entry | null = null;
    let prevPR: Entry | null = null;
    for (const e of entries) {
      if (beats(e, bestSoFar)) {
        prevPR = bestSoFar;
        bestSoFar = e;
      }
    }
    if (bestSoFar) {
      out.push({
        name,
        kg: bestSoFar.kg,
        reps: bestSoFar.reps,
        date: bestSoFar.date,
        estimated1RM: estimate1RM(bestSoFar.kg, bestSoFar.reps),
        deltaKg: prevPR ? bestSoFar.kg - prevPR.kg : undefined,
      });
    }
  }

  return out.sort((a, b) => b.estimated1RM - a.estimated1RM);
}

/**
 * Returns the most recent set for an exercise (by name) — used for progressive
 * overload hints when the user starts a new session of the same exercise.
 */
export function lastSessionFor(workouts: Workout[], exerciseName: string): { kg: number; reps: number } | null {
  const target = exerciseName.trim().toLowerCase();
  const sorted = [...workouts].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const w of sorted) {
    for (const ex of w.exercises ?? []) {
      if (ex.name?.trim().toLowerCase() === target) {
        const top = (ex.sets ?? [])
          .filter((s) => s.completed)
          .reduce<{ kg: number; reps: number } | null>(
            (acc, s) => (!acc || s.kg > acc.kg ? { kg: s.kg, reps: s.reps } : acc),
            null,
          );
        if (top) return top;
      }
    }
  }
  return null;
}

/**
 * Personal records set since `since`: exercises whose best set in that window
 * beats every set logged before it. First-ever attempts don't count.
 */
export function countPRsSince(workouts: Workout[], since: Date): number {
  const before = new Map<string, Entry>();
  const after = new Map<string, Entry>();
  for (const w of workouts) {
    const bucket = w.date >= since ? after : before;
    for (const ex of w.exercises ?? []) {
      const name = ex.name?.trim();
      if (!name) continue;
      const best = bestSet(ex.sets, w.date);
      if (best && beats(best, bucket.get(name))) bucket.set(name, best);
    }
  }
  let count = 0;
  for (const [name, best] of after) {
    const previous = before.get(name);
    if (previous && beats(best, previous)) count++;
  }
  return count;
}

/** Best set ever logged for an exercise (name matched case-insensitively), or null. */
export function bestSetFor(workouts: Workout[], exerciseName: string): { kg: number; reps: number } | null {
  const target = exerciseName.trim().toLowerCase();
  if (!target) return null;
  let best: Entry | null = null;
  for (const w of workouts) {
    for (const ex of w.exercises ?? []) {
      if (ex.name?.trim().toLowerCase() !== target) continue;
      const b = bestSet(ex.sets, w.date);
      if (b && beats(b, best)) best = b;
    }
  }
  return best ? { kg: best.kg, reps: best.reps } : null;
}
