import type { Workout } from "@/types/workout";

/**
 * Weekly goal and streak, with the streak freeze ported from Bite. Bite counts
 * days and forgives one missed day a week; lifting has rest days by design, so
 * here a streak counts weeks that hit the goal (N training days) and one missed
 * week a month is forgiven. Weeks run Monday to Sunday. Pure: dates are local.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for a local date. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Monday of the week containing `d`, as a key. */
export function weekKey(d: Date): string {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dayKey(monday);
}

/** Distinct training days per week (two sessions on one day count once). */
export function trainedDaysByWeek(workouts: Pick<Workout, "date">[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const w of workouts) {
    const wk = weekKey(w.date);
    let days = out.get(wk);
    if (!days) out.set(wk, (days = new Set()));
    days.add(dayKey(w.date));
  }
  return out;
}

export interface GoalStreak {
  /** Weeks in a row the goal was hit (frozen weeks don't add to it). */
  weeks: number;
  /** Week keys (Mondays) forgiven by a freeze, newest first. */
  frozen: string[];
}

/**
 * Consecutive weeks that hit the goal, ending this week (or last week while
 * this one is still in progress). One missed week per calendar month is
 * forgiven, as long as the streak carries on the other side of it.
 */
export function goalStreak(workouts: Pick<Workout, "date">[], goal: number, today = new Date()): GoalStreak {
  const byWeek = trainedDaysByWeek(workouts);
  const hit = (wk: string) => (byWeek.get(wk)?.size ?? 0) >= goal;
  const thisWeek = weekKey(today);
  let cursor = hit(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  let weeks = 0;
  const frozen: string[] = [];
  const usedMonths = new Set<string>();
  for (let i = 0; i < 520; i++) {
    if (hit(cursor)) {
      weeks++;
      cursor = addDays(cursor, -7);
      continue;
    }
    const month = cursor.slice(0, 7);
    const before = addDays(cursor, -7);
    if (usedMonths.has(month) || !hit(before)) break;
    usedMonths.add(month);
    frozen.push(cursor);
    cursor = before;
  }
  return { weeks, frozen };
}

/** Training days so far this week. */
export function daysThisWeek(workouts: Pick<Workout, "date">[], today = new Date()): number {
  return trainedDaysByWeek(workouts).get(weekKey(today))?.size ?? 0;
}
