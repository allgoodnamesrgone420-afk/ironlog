"use client";

import Link from "next/link";
import { BicepsFlexed, ChevronRight, Dumbbell, Flame, Trophy, Weight, type LucideIcon } from "lucide-react";
import type { Units } from "@/types/user";
import { displayWeight, fromKg } from "@/lib/units/converter";
import { milestoneProgress, type Milestone, type MilestoneFamily } from "@/lib/analytics/milestones";

/** Look and name of each family. Faces are the NeoPop accents (see globals.css). */
export const FAMILY: Record<MilestoneFamily, { label: string; icon: LucideIcon; face: string; color: string }> = {
  sessions: { label: "Sessions", icon: Dumbbell, face: "face-lime", color: "rgb(var(--lime))" },
  volume: { label: "Weight lifted", icon: Weight, face: "face-blue", color: "#6c8cff" },
  records: { label: "Records", icon: Trophy, face: "face-yellow", color: "#ffb800" },
  streak: { label: "Streaks", icon: Flame, face: "face-pink", color: "#ff6f9a" },
  strength: { label: "Strength", icon: BicepsFlexed, face: "face-violet", color: "rgb(var(--violet))" },
};

const LIFT_VERB: Record<string, string> = { "Barbell Bench Press": "Bench", "Back Squat": "Squat", Deadlift: "Deadlift" };

/** 12,000 → "12k", 1,500,000 → "1.5M". */
const compact = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${+(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(Math.round(n));

/**
 * Title, badge face text, one-line detail and progress for a milestone.
 * `progress` is the full phrase; `tile` the compact one under a grid badge.
 */
export function milestoneCopy(m: Milestone, units: Units, bodyweightKg?: number) {
  const t = m.target;
  switch (m.family) {
    case "sessions":
      return {
        title: t === 1 ? "First session" : `${t} sessions`,
        short: String(t),
        detail: t === 1 ? "Finish your first workout." : `Finish ${t} workouts.`,
        progress: `${Math.min(m.current, t)} of ${t}`,
        tile: `${Math.min(m.current, t)}/${t}`,
      };
    case "volume": {
      const goal = Math.round(fromKg(t, units));
      return {
        title: `${compact(goal)} ${units} lifted`,
        short: compact(goal),
        detail: `Lift ${goal.toLocaleString()} ${units} in total, across every working set.`,
        progress: `${compact(fromKg(Math.min(m.current, t), units))} of ${compact(goal)} ${units}`,
        tile: `${compact(fromKg(Math.min(m.current, t), units))}/${compact(goal)}`,
      };
    }
    case "records":
      return {
        title: t === 1 ? "First record" : `${t} records`,
        short: String(t),
        detail: t === 1 ? "Beat your best on any lift." : `Set ${t} personal records.`,
        progress: `${Math.min(m.current, t)} of ${t}`,
        tile: `${Math.min(m.current, t)}/${t}`,
      };
    case "streak":
      return {
        title: `${t}-week streak`,
        short: `${t}wk`,
        detail: `Hit your weekly training goal ${t} weeks in a row.`,
        progress: `On ${Math.min(m.current, t)} of ${t} weeks now`,
        tile: `${Math.min(m.current, t)}/${t} wks`,
      };
    case "strength": {
      const verb = LIFT_VERB[m.lift ?? ""] ?? m.lift ?? "Lift";
      const goalKg = bodyweightKg ? t * bodyweightKg : 0;
      return {
        title: t === 1 ? `${verb} your bodyweight` : `${verb} ${t}× bodyweight`,
        short: `${t}×`,
        detail: `One working set of ${m.lift} at ${t === 1 ? "" : `${t}× `}your bodyweight${
          goalKg ? ` (${displayWeight(goalKg, units, 1)} ${units})` : ""
        }, any reps.`,
        progress: m.needsBodyweight
          ? "Log your bodyweight to track"
          : `Best ${displayWeight(m.current * (bodyweightKg ?? 0), units, 1)} of ${displayWeight(goalKg, units, 1)} ${units}`,
        tile: m.needsBodyweight
          ? "Needs bodyweight"
          : `${displayWeight(m.current * (bodyweightKg ?? 0), units, 0)}/${displayWeight(goalKg, units, 0)} ${units}`,
      };
    }
  }
}

/**
 * A milestone as a square tile: an extruded block in its family colour once
 * earned, a dashed outline with a progress bar while locked.
 */
export function MilestoneTile({ m, label, size = "md", shine = false }: {
  m: Milestone;
  /** The tier on the face ("10", "250k", "1.5×"), so a family's badges tell apart. */
  label?: string;
  size?: "sm" | "md" | "lg";
  shine?: boolean;
}) {
  const fam = FAMILY[m.family];
  const Icon = fam.icon;
  const big = size === "lg";
  // Small tiles sit beside their own progress bar: just the icon.
  const small = size === "sm";
  const short = small ? null : label;
  const iconSize = big ? "h-12 w-12" : small ? "h-5 w-5" : "h-7 w-7";
  if (m.earned) {
    return (
      <span
        className={`plunk ${fam.face} flex aspect-square w-full flex-col items-center justify-center gap-1`}
        style={{ ["--d" as string]: big ? "6px" : small ? "3px" : "4px" }}
      >
        {/* The sweep sits in its own clipped layer: the plunk edges live outside the box. */}
        {shine && (
          <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <span className="shine absolute inset-y-0 w-1/2" />
          </span>
        )}
        <Icon className={iconSize} strokeWidth={2.5} />
        {short && <span className={`num font-extrabold leading-none ${big ? "text-xl" : "text-sm"}`}>{short}</span>}
      </span>
    );
  }
  const pct = milestoneProgress(m) * 100;
  return (
    <span className="relative flex aspect-square w-full flex-col items-center justify-center gap-1 border border-dashed border-line bg-surface text-ink-3">
      <Icon className={iconSize} strokeWidth={2} style={small ? { color: fam.color } : undefined} />
      {short && <span className={`num font-extrabold leading-none ${big ? "text-xl" : "text-sm"}`}>{short}</span>}
      {/* Only grid tiles carry a bar: small ones sit beside a bar, the big one sits above one. */}
      {size === "md" && (
        <span className="absolute inset-x-2 bottom-2 h-1 bg-line-soft" aria-hidden="true">
          <span className="grow-x block h-full" style={{ width: `${pct}%`, backgroundColor: fam.color }} />
        </span>
      )}
    </span>
  );
}

/** Home: the closest milestone still to earn, with how far along you are. */
export function NextMilestoneCard({ m, units, bodyweightKg, earned, total }: {
  m: Milestone;
  units: Units;
  bodyweightKg?: number;
  earned: number;
  total: number;
}) {
  const copy = milestoneCopy(m, units, bodyweightKg);
  const fam = FAMILY[m.family];
  return (
    <Link href="/milestones" className="card flex items-center gap-3 p-3 transition-colors hover:bg-elevated" aria-label={`Next milestone: ${copy.title}, ${copy.progress}. ${earned} of ${total} earned.`}>
      <span className="w-11 shrink-0">
        <MilestoneTile m={m} size="sm" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="label">Next milestone</span>
          <span className="num text-[11px] font-semibold text-ink-3">
            {earned}/{total} earned
          </span>
        </span>
        <span className="block truncate font-bold">{copy.title}</span>
        <span className="mt-1.5 block h-1.5 bg-line-soft">
          <span
            className="grow-x block h-full"
            style={{ width: `${milestoneProgress(m) * 100}%`, backgroundColor: fam.color, ["--delay" as string]: "200ms" }}
          />
        </span>
        <span className="num mt-1 block truncate text-xs text-ink-2">{copy.progress}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
    </Link>
  );
}

// Sparks for the unlock burst: 10 directions round the badge.
const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
  const r = i % 2 ? 64 : 48;
  return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r), color: ["rgb(var(--lime))", "#ffb800", "rgb(var(--violet))", "rgb(var(--pink))", "#6c8cff"][i % 5] };
});

/**
 * Workout summary: milestones this session earned. Just after finishing
 * (`celebrate`), each badge drops in with a burst; later visits just list them.
 */
export function MilestonesUnlocked({ list, units, bodyweightKg, celebrate }: {
  list: Milestone[];
  units: Units;
  bodyweightKg?: number;
  celebrate: boolean;
}) {
  if (list.length === 0) return null;
  return (
    <section className="card border-l-[6px] border-l-violet p-4" aria-label="Milestones earned">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label text-violet">{list.length === 1 ? "Milestone unlocked" : `${list.length} milestones unlocked`}</p>
        <Link href="/milestones" className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-2 underline decoration-violet decoration-2 underline-offset-4">
          All
        </Link>
      </div>
      <ul className="mt-3 space-y-3">
        {list.map((m, i) => {
          const copy = milestoneCopy(m, units, bodyweightKg);
          return (
            <li key={m.id} className="flex items-center gap-4">
              <span
                className={`relative w-16 shrink-0 ${celebrate ? "unlock-drop" : ""}`}
                style={{ ["--i" as string]: i }}
              >
                <MilestoneTile m={m} label={copy.short} shine={celebrate} />
                {celebrate && (
                  <span className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
                    {SPARKS.map((s, k) => (
                      <span
                        key={k}
                        className="unlock-spark absolute h-1.5 w-1.5"
                        style={{
                          backgroundColor: s.color,
                          ["--sx" as string]: `${s.x}px`,
                          ["--sy" as string]: `${s.y}px`,
                          ["--i" as string]: i,
                        }}
                      />
                    ))}
                  </span>
                )}
              </span>
              <span className={`min-w-0 ${celebrate ? "unlock-text" : ""}`} style={{ ["--i" as string]: i }}>
                <span className="block font-extrabold leading-tight">{copy.title}</span>
                <span className="mt-0.5 block text-xs text-ink-2">{copy.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {celebrate && (
        <span className="sr-only" role="status">
          {list.length === 1 ? "Milestone unlocked" : `${list.length} milestones unlocked`}
        </span>
      )}
    </section>
  );
}
