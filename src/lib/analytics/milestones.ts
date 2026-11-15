import type { Workout } from "@/types/workout";
import type { Units } from "@/types/user";
import { toKg } from "@/lib/units/converter";
import { findExercise } from "@/lib/data/exercises";
import { workoutVolume } from "./volume";
import { isWorkSet } from "./sets";
import { beats } from "./personal-records";
import { goalStreak } from "./goal";

/**
 * Milestones: long-run achievements worked out from the training log alone
 * (nothing is stored). History is replayed oldest first, so each milestone
 * knows the session that earned it; deleting that session takes it back.
 */

export type MilestoneFamily = "sessions" | "volume" | "records" | "streak" | "strength";

export interface Milestone {
  /** Stable id, e.g. "sessions-50". */
  id: string;
  family: MilestoneFamily;
  /** Sessions, volume in kg, records, weeks, or a bodyweight multiple (strength). */
  target: number;
  /** Progress now, in the same unit as `target`. */
  current: number;
  /** Strength only: the lift it counts. */
  lift?: string;
  /** Strength milestones need a logged bodyweight to measure against. */
  needsBodyweight?: boolean;
  /** The session that crossed the line, or null while locked. */
  earned: { at: Date; workoutId: string; workoutName: string } | null;
}

/** Share of the way there, 0 to 1. */
export const milestoneProgress = (m: Milestone) => (m.earned ? 1 : m.target > 0 ? Math.min(1, m.current / m.target) : 0);

const SESSIONS = [1, 10, 25, 50, 100, 250];
const RECORDS = [1, 10, 25, 50, 100];
const STREAK_WEEKS = [2, 4, 8, 12, 26];
/** Round numbers in the lifter's own unit, so pounds users chase 100,000 lb, not 45,359 kg. */
const VOLUME: Record<Units, number[]> = {
  kg: [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
  lb: [25_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000],
};
/** Classic strength standards: one set at this multiple of bodyweight (any reps). */
const STRENGTH = [
  { lift: "Barbell Bench Press", ratio: 1 },
  { lift: "Back Squat", ratio: 1.5 },
  { lift: "Deadlift", ratio: 2 },
];

export function computeMilestones(
  workouts: Workout[],
  opts: { units: Units; goal: number; bodyweightKg?: number },
): Milestone[] {
  const { units, goal, bodyweightKg } = opts;
  const list: Milestone[] = [
    ...SESSIONS.map((t) => blank(`sessions-${t}`, "sessions", t)),
    ...VOLUME[units].map((t) => blank(`volume-${t}${units}`, "volume", toKg(t, units))),
    ...RECORDS.map((t) => blank(`records-${t}`, "records", t)),
    ...STREAK_WEEKS.map((t) => blank(`streak-${t}`, "streak", t)),
    ...STRENGTH.map(({ lift, ratio }) => ({
      ...blank(`strength-${lift.toLowerCase().replace(/\s+/g, "-")}-${ratio}x`, "strength" as const, ratio),
      lift,
      needsBodyweight: !bodyweightKg,
    })),
  ];

  const sorted = [...workouts].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
  const canonical = new Map<string, string | undefined>();
  const liftOf = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!canonical.has(key)) canonical.set(key, findExercise(key)?.name);
    return canonical.get(key);
  };

  const best = new Map<string, { kg: number; reps: number }>();
  const heaviest = new Map<string, number>();
  const sofar: Workout[] = [];
  let sessions = 0;
  let volume = 0;
  let records = 0;
  let streak = 0;

  for (const w of sorted) {
    sofar.push(w);
    sessions++;
    volume += workoutVolume(w, bodyweightKg);

    // Records: the session's best set per exercise beats every earlier session (first attempts don't count).
    const top = new Map<string, { kg: number; reps: number }>();
    for (const ex of w.exercises ?? []) {
      const key = ex.name?.trim().toLowerCase();
      if (!key) continue;
      for (const s of ex.sets ?? []) {
        if (!isWorkSet(s) || !(s.kg > 0)) continue;
        if (beats(s, top.get(key))) top.set(key, { kg: s.kg, reps: s.reps });
        const lift = liftOf(key);
        if (lift && s.reps > 0) heaviest.set(lift, Math.max(heaviest.get(lift) ?? 0, s.kg));
      }
    }
    for (const [key, set] of top) {
      const prev = best.get(key);
      if (prev && beats(set, prev)) records++;
      if (!prev || beats(set, prev)) best.set(key, set);
    }

    // Weeks in a row on goal, as they stood the day of this session.
    streak = Math.max(streak, goalStreak(sofar, goal, w.date).weeks);

    for (const m of list) {
      if (m.earned) continue;
      const now =
        m.family === "sessions"
          ? sessions
          : m.family === "volume"
            ? volume
            : m.family === "records"
              ? records
              : m.family === "streak"
                ? streak
                : bodyweightKg
                  ? (heaviest.get(m.lift!) ?? 0) / bodyweightKg
                  : 0;
      m.current = now;
      if (now >= m.target && !(m.family === "strength" && !bodyweightKg)) {
        m.earned = { at: w.date, workoutId: w.id, workoutName: w.name };
      }
    }
  }

  // A streak still to earn counts the streak you're on now, not the best one you had:
  // "1 of 4 weeks" tells you how far there really is to go.
  const streakNow = goalStreak(sorted, goal).weeks;
  for (const m of list) if (m.family === "streak" && !m.earned) m.current = streakNow;
  return list;
}

function blank(id: string, family: MilestoneFamily, target: number): Milestone {
  return { id, family, target, current: 0, earned: null };
}

/**
 * What to chase next: the locked milestones closest to done, one per family
 * so the list isn't three session counts in a row.
 */
export function nextMilestones(list: Milestone[], limit = 3): Milestone[] {
  const firstLocked = new Map<MilestoneFamily, Milestone>();
  for (const m of list) {
    if (m.earned || m.needsBodyweight || firstLocked.has(m.family)) continue;
    // Strength milestones are separate lifts, not a ladder: take the closest.
    if (m.family === "strength") {
      const others = list.filter((o) => o.family === "strength" && !o.earned);
      const closest = others.reduce((a, b) => (milestoneProgress(b) > milestoneProgress(a) ? b : a), m);
      firstLocked.set("strength", closest);
      continue;
    }
    firstLocked.set(m.family, m);
  }
  return [...firstLocked.values()].sort((a, b) => milestoneProgress(b) - milestoneProgress(a)).slice(0, limit);
}
