import type { Workout, Exercise } from "@/types/workout";

export function exerciseVolume(ex: Exercise): number {
  return (ex.sets ?? []).reduce((acc, s) => {
    const kg = Number.isFinite(s.kg) ? s.kg : 0;
    const reps = Number.isFinite(s.reps) ? s.reps : 0;
    return acc + kg * reps;
  }, 0);
}

export function workoutVolume(w: Pick<Workout, "exercises">): number {
  return (w.exercises ?? []).reduce((acc, ex) => acc + exerciseVolume(ex), 0);
}

export function workoutSetCount(w: Pick<Workout, "exercises">): number {
  return (w.exercises ?? []).reduce((acc, ex) => acc + (ex.sets?.length ?? 0), 0);
}
