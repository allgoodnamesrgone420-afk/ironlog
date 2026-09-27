import type { Exercise, WorkoutSet } from "@/types/workout";
import { uid } from "@/lib/utils";

/**
 * Pure edits on an exercise list, shared by the logger and the past-workout
 * editor. Each returns a new list and leaves the input untouched.
 */

export function blankExercise(name = "", completed = false): Exercise {
  return {
    id: uid(),
    name,
    notes: "",
    restSec: 90,
    sets: [{ id: uid(), kg: 0, reps: 0, completed }],
  };
}

/** Consecutive exercises sharing a supersetId form one group (a lone exercise is a group of one). */
export function groupBySupersets(exercises: Exercise[]): Exercise[][] {
  const groups: Exercise[][] = [];
  for (const ex of exercises) {
    const current = groups[groups.length - 1];
    const prev = current?.[current.length - 1];
    if (current && ex.supersetId && prev?.supersetId === ex.supersetId) current.push(ex);
    else groups.push([ex]);
  }
  return groups;
}

/** Moves a whole group (single exercise or full superset) from one position to another. */
export function moveGroup(list: Exercise[], from: number, to: number): Exercise[] {
  const groups = groupBySupersets(list);
  if (from === to || from < 0 || to < 0 || from >= groups.length || to >= groups.length) return list;
  const [moved] = groups.splice(from, 1);
  groups.splice(to, 0, moved!);
  return groups.flat();
}

/** Adds a blank exercise right after `afterId`, joined to it as a superset. */
export function addToSuperset(list: Exercise[], afterId: string, supersetId?: string | null, completed = false): Exercise[] {
  const sid = supersetId ?? uid();
  return list.flatMap((ex) => (ex.id === afterId ? [{ ...ex, supersetId: sid }, { ...blankExercise("", completed), supersetId: sid }] : [ex]));
}

export const patchExercise = (list: Exercise[], id: string, patch: Partial<Exercise>) =>
  list.map((e) => (e.id === id ? { ...e, ...patch } : e));

export const removeExercise = (list: Exercise[], id: string) => list.filter((e) => e.id !== id);

/** Appends a set that copies the last one's weight and reps. */
export function appendSet(list: Exercise[], exId: string, completed = false): Exercise[] {
  return list.map((e) => {
    if (e.id !== exId) return e;
    const prev = e.sets[e.sets.length - 1];
    return { ...e, sets: [...e.sets, { id: uid(), kg: prev?.kg ?? 0, reps: prev?.reps ?? 0, completed }] };
  });
}

export const patchSet = (list: Exercise[], exId: string, setId: string, patch: Partial<WorkoutSet>) =>
  list.map((e) => (e.id !== exId ? e : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));

export const removeSet = (list: Exercise[], exId: string, setId: string) =>
  list.map((e) => (e.id !== exId ? e : { ...e, sets: e.sets.filter((s) => s.id !== setId) }));

/** Most recent non-empty notes for an exercise name across past workouts. */
export function findPastNote(workouts: { date: Date; exercises: Exercise[] }[], name: string): string | undefined {
  const target = name.trim().toLowerCase();
  if (!target) return undefined;
  const sorted = [...workouts].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const w of sorted) {
    for (const ex of w.exercises) {
      if (ex.name.trim().toLowerCase() === target && ex.notes?.trim()) return ex.notes;
    }
  }
  return undefined;
}
