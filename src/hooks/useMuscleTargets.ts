"use client";

import { readSetting, useSetting, type SettingDef } from "@/lib/settings";

/** All muscles a user can track on the dashboard. "legs" is an aggregate of quads+hams+glutes+calves. */
export type DisplayMuscle =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "core"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "legs"
  | "cardio";

export type MuscleTargets = Record<DisplayMuscle, number>;

export const DEFAULT_TARGETS: MuscleTargets = {
  chest: 12,
  back: 14,
  shoulders: 8,
  biceps: 8,
  triceps: 8,
  forearms: 4,
  core: 6,
  quads: 10,
  hamstrings: 8,
  glutes: 10,
  calves: 6,
  legs: 16,
  cardio: 3,
};

const clampTarget = (n: number) => Math.max(0, Math.min(50, Math.round(n)));

/** Fills missing muscles with defaults and drops anything invalid. */
export function normalizeTargets(value: unknown): MuscleTargets {
  const out = { ...DEFAULT_TARGETS };
  if (value && typeof value === "object") {
    for (const k of Object.keys(DEFAULT_TARGETS) as DisplayMuscle[]) {
      const n = (value as Record<string, unknown>)[k];
      if (typeof n === "number" && Number.isFinite(n)) out[k] = clampTarget(n);
    }
  }
  return out;
}

export const TARGETS_SETTING: SettingDef<MuscleTargets> = {
  key: "ironlog:muscleTargets",
  fallback: DEFAULT_TARGETS,
  parse: (raw) => normalizeTargets(JSON.parse(raw)),
  serialize: (v) => JSON.stringify(v),
};

export function useMuscleTargets() {
  const [targets, write] = useSetting(TARGETS_SETTING);

  // Read the latest stored value so quick repeated taps don't overwrite each other.
  const set = (muscle: DisplayMuscle, value: number) =>
    write({ ...readSetting(TARGETS_SETTING), [muscle]: clampTarget(value) });

  const reset = () => write(null);

  return { targets, set, reset };
}
