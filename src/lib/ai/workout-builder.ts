"use client";

import type { Exercise, MuscleGroup, Workout, WorkoutSet } from "@/types/workout";
import type { Units } from "@/types/user";
import type { MuscleTargets } from "@/hooks/useMuscleTargets";
import { findExercise } from "@/lib/data/exercises";
import { MUSCLE_LABELS } from "@/lib/analytics/muscle-groups";
import { isWorkSet } from "@/lib/analytics/sets";
import { lastSessionFor } from "@/lib/analytics/personal-records";
import { roundToPlate, toKg, displayWeight } from "@/lib/units/converter";
import { startOfWeek, uid } from "@/lib/utils";
import { callGemini } from "./gemini-client";
import { WORKOUT_BUILDER_SYSTEM_PROMPT } from "./system-prompts";

export const ALL_MUSCLES: MuscleGroup[] = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms", "core", "quads", "hamstrings", "glutes", "calves", "cardio",
];

/** Muscles a session can be built around (forearms and cardio ride along, they don't lead). */
export const FOCUS_MUSCLES: MuscleGroup[] = ["chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "core"];

const DAY = 86_400_000;

export interface MuscleStat {
  muscle: MuscleGroup;
  /** Working sets this week (secondary muscles count half). */
  done: number;
  target: number;
  /** Whole days since it was last a primary muscle; null if not in the last 3 weeks. */
  daysSince: number | null;
}

function musclesOf(ex: Exercise): { primary: MuscleGroup[]; secondary: MuscleGroup[] } {
  const def = findExercise(ex.name);
  return { primary: def?.primary ?? ex.muscles ?? [], secondary: def?.secondary ?? [] };
}

/** This week's sets against the weekly targets, plus how rested each muscle is. */
export function muscleStatus(workouts: Workout[], targets: MuscleTargets, now = new Date()): MuscleStat[] {
  const weekStart = startOfWeek(now).getTime();
  const done = Object.fromEntries(ALL_MUSCLES.map((m) => [m, 0])) as Record<MuscleGroup, number>;
  const last = {} as Partial<Record<MuscleGroup, number>>;
  for (const w of workouts) {
    const t = w.date.getTime();
    if (now.getTime() - t > 21 * DAY) continue;
    for (const ex of w.exercises ?? []) {
      const sets = (ex.sets ?? []).filter(isWorkSet).length;
      if (!sets) continue;
      const { primary, secondary } = musclesOf(ex);
      for (const m of primary) {
        if (t >= weekStart) done[m] += sets;
        last[m] = Math.max(last[m] ?? 0, t);
      }
      if (t >= weekStart) for (const m of secondary) done[m] += sets * 0.5;
    }
  }
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return ALL_MUSCLES.map((m) => {
    const t = last[m];
    const lastMidnight = t === undefined ? null : new Date(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate()).getTime();
    return {
      muscle: m,
      done: Math.round(done[m] * 10) / 10,
      target: targets[m] ?? 0,
      daysSince: lastMidnight === null ? null : Math.round((midnight - lastMidnight) / DAY),
    };
  });
}

/**
 * The app's own pick for today: the 2-3 muscles furthest behind their weekly
 * target that have had at least a day off. When everything is on track, the
 * ones rested longest.
 */
export function autoFocus(stats: MuscleStat[]): MuscleGroup[] {
  const candidates = stats.filter((s) => FOCUS_MUSCLES.includes(s.muscle) && s.muscle !== "core");
  const rested = candidates.filter((s) => s.daysSince === null || s.daysSince >= 2);
  const pool = rested.length >= 2 ? rested : candidates;
  const behind = (s: MuscleStat) => (s.target > 0 ? Math.max(0, s.target - s.done) / s.target : 0);
  const restedFor = (s: MuscleStat) => (s.daysSince === null ? 30 : s.daysSince);
  const ranked = [...pool].sort((a, b) => behind(b) - behind(a) || restedFor(b) - restedFor(a));
  const top = ranked.filter((s) => behind(s) > 0).slice(0, 3);
  return (top.length >= 2 ? top : ranked.slice(0, 2)).map((s) => s.muscle);
}

export interface BuiltWorkout {
  name: string;
  why?: string;
  targetMuscles: MuscleGroup[];
  exercises: Exercise[];
}

interface AIResponse {
  workoutName?: string;
  why?: string;
  targetMuscles?: string[];
  exercises?: {
    name?: string;
    muscles?: string[];
    notes?: string;
    restSec?: number;
    sets?: { weight?: number; kg?: number; reps?: number; rpe?: number; warmup?: boolean }[];
  }[];
}

const asMuscles = (list: unknown): MuscleGroup[] =>
  Array.isArray(list) ? [...new Set(list.map((m) => String(m).toLowerCase().trim()))].filter((m): m is MuscleGroup => (ALL_MUSCLES as string[]).includes(m)) : [];

/** Everything the model needs, kept well under the request size limit. */
export function builderContext(input: {
  request: string;
  focus: MuscleGroup[];
  auto: boolean;
  workouts: Workout[];
  stats: MuscleStat[];
  memory: string[];
  units: Units;
}): string {
  const { focus, auto, workouts, stats, memory, units } = input;
  const recent = [...workouts].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  const lines: string[] = [];
  lines.push(`TODAY: ${new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}`);
  lines.push(`UNITS: ${units} (give weights in ${units}, in loadable steps of ${units === "kg" ? "2.5 kg" : "5 lb"})`);
  lines.push(
    `TARGET MUSCLES: ${focus.map((m) => MUSCLE_LABELS[m].toLowerCase()).join(", ")}${auto ? " (picked by the app: furthest behind this week and rested)" : " (chosen by the lifter)"}`,
  );
  lines.push("THIS WEEK (working sets done / weekly target, days since last trained):");
  for (const s of stats) {
    if (s.target <= 0 && s.done === 0) continue;
    lines.push(`- ${s.muscle}: ${s.done}/${s.target}, ${s.daysSince === null ? "not in 3 weeks" : s.daysSince === 0 ? "trained today" : `${s.daysSince}d ago`}`);
  }
  if (recent.length) {
    lines.push("RECENT SESSIONS:");
    for (const w of recent) {
      lines.push(`- ${w.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${w.name}: ${w.exercises.map((e) => e.name).join(", ")}`.slice(0, 220));
    }
  }
  const names = [...new Set(workouts.flatMap((w) => w.exercises.map((e) => e.name.trim())).filter(Boolean))].slice(0, 30);
  const tops = names
    .map((n) => {
      const top = lastSessionFor(workouts, n);
      return top ? `${n} ${top.kg > 0 ? `${displayWeight(top.kg, units, 1)} ${units}` : "bodyweight"} × ${top.reps}` : null;
    })
    .filter(Boolean);
  if (tops.length) lines.push(`RECENT TOP SETS: ${tops.join("; ")}`.slice(0, 1400));
  if (memory.length) lines.push(`ABOUT THE LIFTER: ${memory.join("; ")}`.slice(0, 800));
  lines.push(`REQUEST: ${input.request.trim() || "Build today's session."}`);
  return lines.join("\n");
}

/** Asks the model for a session and turns the answer into logger-ready exercises. */
export async function generateWorkout(input: Parameters<typeof builderContext>[0]): Promise<BuiltWorkout> {
  const result = await callGemini<AIResponse>(builderContext(input), WORKOUT_BUILDER_SYSTEM_PROMPT, { jsonMode: true });
  const exercises: Exercise[] = (result?.exercises ?? [])
    .filter((ex) => ex?.name?.trim() && Array.isArray(ex.sets) && ex.sets.length > 0)
    .slice(0, 10)
    .map((ex) => {
      const name = ex.name!.trim().slice(0, 80);
      const muscles = asMuscles(ex.muscles);
      const sets: WorkoutSet[] = ex.sets!.slice(0, 8).map((s) => {
        const raw = Number(s.weight ?? s.kg) || 0;
        const kg = raw > 0 ? roundToPlate(toKg(raw, input.units), input.units) : 0;
        return {
          id: uid(),
          kg,
          reps: Math.max(0, Math.round(Number(s.reps) || 0)),
          rpe: typeof s.rpe === "number" && s.rpe >= 1 && s.rpe <= 10 ? s.rpe : undefined,
          warmup: s.warmup === true ? true : undefined,
          completed: false,
        };
      });
      return {
        id: uid(),
        name,
        notes: ex.notes?.slice(0, 200) ?? "",
        restSec: Math.min(300, Math.max(30, Math.round(Number(ex.restSec) || 90))),
        // Library exercises know their muscles; custom ones keep the model's tags.
        muscles: findExercise(name) ? undefined : muscles,
        sets,
      };
    });
  if (exercises.length === 0) throw new Error("Empty response");
  const targetMuscles = asMuscles(result?.targetMuscles);
  return {
    name: (result?.workoutName ?? "").trim().slice(0, 80) || "AI Workout",
    why: result?.why?.slice(0, 240),
    targetMuscles: targetMuscles.length ? targetMuscles : input.focus,
    exercises,
  };
}

/** Muscles an exercise works, for display (library first, then its tags). */
export function exerciseMuscles(ex: Exercise): MuscleGroup[] {
  const def = findExercise(ex.name);
  return def ? [...def.primary, ...(def.secondary ?? [])] : (ex.muscles ?? []);
}
