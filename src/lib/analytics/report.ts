/**
 * Weekly report card (Monday to Sunday), computed on the device from the
 * workout log. Ported from Bite's report card; pure, so it's easy to test.
 */
import type { MuscleGroup, Workout } from "@/types/workout";
import type { Units } from "@/types/user";
import { addDays, dayKey, goalStreak, parseKey, trainedDaysByWeek, weekKey } from "./goal";
import { workoutSetCount, workoutVolume } from "./volume";
import { beats, prsInWorkout, type WorkoutPR } from "./personal-records";
import { MUSCLE_LABELS, muscleSetsThisWeek } from "./muscle-groups";
import { fromKg } from "@/lib/units/converter";

export interface ReportDay {
  key: string;
  sessions: string[];
}

export interface ReportMuscle {
  muscle: MuscleGroup;
  done: number;
  target: number;
}

export interface WeekReport {
  start: string;
  end: string;
  /** The week isn't over yet (it's the current week). */
  partial: boolean;
  days: ReportDay[];
  daysTrained: number;
  goal: number;
  hit: boolean;
  sessions: number;
  sets: number;
  volumeKg: number;
  minutes: number;
  prs: WorkoutPR[];
  muscles: ReportMuscle[];
  streak: { weeks: number; frozenThisWeek: boolean };
  vsPrev: { sets: number; volumePct: number | null } | null;
  focus: { title: string; detail: string } | null;
  wins: string[];
}

/** localStorage key: the report week last opened, so the Home banner stops showing. */
export const REPORT_SEEN_KEY = "ironlog:reportSeen";

/** Which week to show by default: this week on Sunday, otherwise last week (as in Bite). */
export function defaultReportWeek(today: Date): string {
  const monday = weekKey(today);
  return today.getDay() === 0 ? monday : addDays(monday, -7);
}

const inWeek = (workouts: Workout[], start: string) => {
  const from = parseKey(start).getTime();
  const to = parseKey(addDays(start, 7)).getTime();
  return workouts.filter((w) => w.date.getTime() >= from && w.date.getTime() < to);
};

/** A simple spread of training days for a goal, for the "book it in" nudge. */
const PLAN: Record<number, string> = {
  1: "Wednesday",
  2: "Monday and Thursday",
  3: "Monday, Wednesday and Friday",
  4: "Monday, Tuesday, Thursday and Friday",
  5: "Monday to Friday",
  6: "Monday to Saturday",
  7: "every day",
};

const shortDay = (key: string) => parseKey(key).toLocaleDateString(undefined, { weekday: "short" });

export function buildWeekReport(input: {
  workouts: Workout[];
  start: string;
  goal: number;
  targets: Partial<Record<MuscleGroup, number>>;
  /** Latest bodyweight, so bodyweight sets count toward volume. */
  bodyweightKg?: number;
  today?: Date;
}): WeekReport {
  const { workouts, start, goal, targets, bodyweightKg } = input;
  const today = input.today ?? new Date();
  const end = addDays(start, 6);
  const partial = end >= dayKey(today);
  const week = inWeek(workouts, start).sort((a, b) => a.date.getTime() - b.date.getTime());

  const days: ReportDay[] = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(start, i);
    return { key, sessions: week.filter((w) => dayKey(w.date) === key).map((w) => w.name) };
  });
  const daysTrained = trainedDaysByWeek(week).get(start)?.size ?? 0;
  const sets = week.reduce((n, w) => n + workoutSetCount(w), 0);
  const volumeKg = week.reduce((v, w) => v + workoutVolume(w, bodyweightKg), 0);
  const minutes = Math.round(week.reduce((m, w) => m + (w.durationSec ?? 0), 0) / 60);
  // One record per exercise: when several sessions beat it, the best one counts.
  const prs = [
    ...week
      .flatMap((w) => prsInWorkout(workouts, w))
      .reduce((best, p) => {
        const key = p.name.toLowerCase();
        const cur = best.get(key);
        if (!cur || beats(p, cur)) best.set(key, cur ? { ...p, prev: cur.prev } : p);
        return best;
      }, new Map<string, WorkoutPR>())
      .values(),
  ];

  const totals = muscleSetsThisWeek(week);
  const muscles: ReportMuscle[] = (Object.keys(totals) as MuscleGroup[])
    .map((m) => ({ muscle: m, done: Math.round(totals[m] * 10) / 10, target: targets[m] ?? 0 }))
    .filter((m) => m.target > 0 || m.done > 0)
    .sort((a, b) => (b.target ? b.done / b.target : 9) - (a.target ? a.done / a.target : 9));

  const prev = inWeek(workouts, addDays(start, -7));
  const prevSets = prev.reduce((n, w) => n + workoutSetCount(w), 0);
  const prevVolume = prev.reduce((v, w) => v + workoutVolume(w, bodyweightKg), 0);
  const vsPrev = prev.length && week.length ? { sets: sets - prevSets, volumePct: prevVolume > 0 ? Math.round(((volumeKg - prevVolume) / prevVolume) * 100) : null } : null;

  // Streak as it stood at the end of this week (or today, for the current week).
  const asOf = partial ? today : parseKey(end);
  const s = goalStreak(workouts.filter((w) => w.date <= new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate(), 23, 59, 59)), goal, asOf);
  const streak = { weeks: s.weeks, frozenThisWeek: s.frozen.includes(start) };

  const hit = daysTrained >= goal;
  const behind = muscles.filter((m) => m.target > 0 && m.done < m.target * 0.5).sort((a, b) => a.done / a.target - b.done / b.target);
  const over = muscles.filter((m) => m.target > 0 && m.done > m.target * 1.5);

  let focus: WeekReport["focus"] = null;
  if (week.length > 0) {
    if (!hit && !partial) {
      const plan = PLAN[goal] ?? "most days";
      focus = { title: `Train ${goal} days next week`, detail: `You trained ${daysTrained} of ${goal}. Put them in your calendar now, e.g. ${plan}.` };
    } else if (behind[0]) {
      const m = behind[0];
      focus = {
        title: `Give ${MUSCLE_LABELS[m.muscle].toLowerCase()} more work`,
        detail: `${MUSCLE_LABELS[m.muscle]} got ${m.done} of ${m.target} sets${partial ? " so far" : ""}. ${partial ? "Put it first in your next session." : "Open next week with it, or add two sets to each session."}`,
      };
    } else if (over[0]) {
      const m = over[0];
      focus = {
        title: `Ease off ${MUSCLE_LABELS[m.muscle].toLowerCase()}`,
        detail: `${MUSCLE_LABELS[m.muscle]} got ${m.done} sets against a target of ${m.target}. Spread that effort to lagging muscles and let it recover.`,
      };
    } else {
      focus = { title: "Nudge the main lifts up", detail: "Everything's on target. Add one rep or one small step on your first lift each session." };
    }
  }

  const wins: string[] = [];
  if (hit) wins.push(`Hit your goal: ${daysTrained} of ${goal} days`);
  if (prs.length) wins.push(`${prs.length === 1 ? "New record" : `${prs.length} new records`}: ${prs.slice(0, 2).map((p) => p.name).join(", ")}${prs.length > 2 ? "…" : ""}`);
  const earlier = [1, 2, 3, 4].map((k) => inWeek(workouts, addDays(start, -7 * k)).reduce((v, w) => v + workoutVolume(w, bodyweightKg), 0));
  if (volumeKg > 0 && earlier.filter((v) => v > 0).length >= 2 && earlier.every((v) => volumeKg > v)) wins.push("Most volume in over a month");
  if (streak.weeks >= 2) wins.push(`${streak.weeks}-week streak`);
  const targeted = muscles.filter((m) => m.target > 0);
  if (targeted.length && targeted.every((m) => m.done >= m.target)) wins.push("Every muscle hit its weekly target");

  return { start, end, partial, days, daysTrained, goal, hit, sessions: week.length, sets, volumeKg, minutes, prs, muscles, streak, vsPrev, focus, wins };
}

/** Plain-text version for sharing. */
export function reportText(r: WeekReport, units: Units): string {
  const day = (k: string) => parseKey(k).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const lines = [
    `IronLog · week of ${day(r.start)} to ${day(r.end)}`,
    `Trained ${r.daysTrained}/${r.goal} days${r.hit ? " · goal hit" : ""}${r.streak.weeks > 1 ? ` · ${r.streak.weeks}-week streak` : ""}`,
    `${Math.round(fromKg(r.volumeKg, units)).toLocaleString()} ${units} lifted · ${r.sets} sets${r.prs.length ? ` · ${r.prs.length} PR${r.prs.length === 1 ? "" : "s"}` : ""}`,
  ];
  if (r.focus) lines.push(`Next: ${r.focus.title}`);
  return lines.join("\n");
}

export const reportDayLabel = shortDay;
