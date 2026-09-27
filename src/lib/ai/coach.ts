"use client";

import type { Workout } from "@/types/workout";
import type { Units } from "@/types/user";
import { computePRs } from "@/lib/analytics/personal-records";
import { daysThisWeek, goalStreak } from "@/lib/analytics/goal";
import { displayWeight } from "@/lib/units/converter";
import { formatDuration } from "@/lib/utils";
import type { MuscleStat } from "./workout-builder";

export { MEMORY_MARKER, memoryEdits, visibleReply } from "./memory-line";

/**
 * Everything the coach needs, computed on the device so it can quote exact
 * numbers (and stays within the request limit): ~1-3k characters.
 */
export function coachContext(input: {
  workouts: Workout[];
  stats: MuscleStat[];
  goal: number;
  units: Units;
  memory: string[];
  bodyweight?: { trend: number; ratePerWeek: number | null } | null;
  now?: Date;
}): string {
  const { workouts, stats, goal, units, memory } = input;
  const now = input.now ?? new Date();
  const w = (kg: number) => (kg > 0 ? `${displayWeight(kg, units, 1)}` : "BW");
  const lines: string[] = [];
  lines.push(`today: ${now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}; units: ${units}`);
  const streak = goalStreak(workouts, goal, now);
  lines.push(`weekly goal: ${goal} training days; trained this week: ${daysThisWeek(workouts, now)} days; goal streak: ${streak.weeks} weeks`);
  lines.push(
    `this week, working sets per muscle (done/target, last trained): ${stats
      .filter((s) => s.target > 0 || s.done > 0)
      .map((s) => `${s.muscle} ${s.done}/${s.target} (${s.daysSince === null ? "not in 3 wks" : s.daysSince === 0 ? "today" : `${s.daysSince}d ago`})`)
      .join(", ")}`,
  );
  const recent = [...workouts].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  if (recent.length) {
    lines.push("recent sessions:");
    for (const s of recent) {
      const ex = s.exercises
        .map((e) => {
          const work = e.sets.filter((x) => !x.warmup);
          const rpe = work.map((x) => x.rpe).filter((r): r is number => typeof r === "number");
          return `${e.name} ${work.map((x) => `${w(x.kg)}×${x.reps}`).join(", ")}${rpe.length ? ` @RPE ${Math.max(...rpe)}` : ""}`;
        })
        .join("; ");
      lines.push(`- ${s.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} ${s.name}${s.durationSec ? ` (${formatDuration(s.durationSec)})` : ""}: ${ex}`.slice(0, 420));
    }
  } else lines.push("recent sessions: none logged yet");
  const prs = computePRs(workouts).slice(0, 10);
  if (prs.length) lines.push(`best sets (heaviest; est 1RM): ${prs.map((p) => `${p.name} ${w(p.kg)}×${p.reps} (${Math.round(displayWeight(p.estimated1RM, units))})`).join("; ")}`);
  if (input.bodyweight) {
    const r = input.bodyweight.ratePerWeek;
    lines.push(`bodyweight trend: ${displayWeight(input.bodyweight.trend, units, 1)} ${units}${r !== null ? `, ${r > 0 ? "+" : ""}${displayWeight(r, units, 2)} ${units}/week` : ""}`);
  }
  const data = `<data>\n${lines.join("\n")}\n</data>`;
  const mem = `<memory>\n${memory.length ? memory.map((m) => `- ${m}`).join("\n") : "(nothing yet)"}\n</memory>`;
  return `${data}\n${mem}`.slice(0, 11_500);
}
