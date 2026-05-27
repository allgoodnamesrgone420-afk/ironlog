import type { Workout } from "@/types/workout";
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

/**
 * Computes, for each exercise name, the best top-set ever (highest weight,
 * tiebreak on reps) along with the prior PR delta so we can show progression.
 */
export function computePRs(workouts: Workout[]): PRRow[] {
  type Entry = { kg: number; reps: number; date: Date };
  const history: Record<string, Entry[]> = {};

  // Sort oldest first so deltas can be computed
  const sorted = [...workouts].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const w of sorted) {
    for (const ex of w.exercises ?? []) {
      const name = ex.name?.trim();
      if (!name) continue;
      let best: Entry | null = null;
      for (const s of ex.sets ?? []) {
        if (!s.completed) continue;
        if (!Number.isFinite(s.kg) || !Number.isFinite(s.reps)) continue;
        if (s.kg <= 0) continue;
        if (!best || s.kg > best.kg || (s.kg === best.kg && s.reps > best.reps)) {
          best = { kg: s.kg, reps: s.reps, date: w.date };
        }
      }
      if (best) (history[name] ??= []).push(best);
    }
  }

  const out: PRRow[] = [];
  for (const [name, entries] of Object.entries(history)) {
    let bestSoFar: Entry | null = null;
    let prevPR: Entry | null = null;
    for (const e of entries) {
      if (!bestSoFar || e.kg > bestSoFar.kg || (e.kg === bestSoFar.kg && e.reps > bestSoFar.reps)) {
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
