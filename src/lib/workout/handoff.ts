"use client";

import type { Exercise, MuscleGroup } from "@/types/workout";

/** A workout built elsewhere (the coach) waiting to be opened in the logger. */
export interface HandoffWorkout {
  name: string;
  exercises: Exercise[];
  targetMuscles?: MuscleGroup[];
}

const KEY = "ironlog:handoff";

/** Keeps a workout for the logger to pick up; open `/log?handoff=1` next. */
export function stashWorkout(w: HandoffWorkout) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    /* storage unavailable: the logger simply won't find it */
  }
}

/** Returns the waiting workout once, then forgets it. */
export function takeStashedWorkout(): HandoffWorkout | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as HandoffWorkout;
    return Array.isArray(w?.exercises) && w.exercises.length > 0 ? w : null;
  } catch {
    return null;
  }
}
