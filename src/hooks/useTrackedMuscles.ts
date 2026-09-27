"use client";

import { readSetting, useSetting, type SettingDef } from "@/lib/settings";
import { DEFAULT_TARGETS, type DisplayMuscle } from "./useMuscleTargets";

/** Which muscles appear on the dashboard balance. Default: the classic 7. */
export const DEFAULT_TRACKED: DisplayMuscle[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "legs",
  "core",
];

/** Keeps known muscle names only, without duplicates, in their original order. */
export function normalizeTracked(value: unknown): DisplayMuscle[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const known = new Set(Object.keys(DEFAULT_TARGETS));
  return [...new Set(value)].filter((m): m is DisplayMuscle => typeof m === "string" && known.has(m));
}

export const TRACKED_SETTING: SettingDef<DisplayMuscle[]> = {
  key: "ironlog:trackedMuscles",
  fallback: DEFAULT_TRACKED,
  parse: (raw) => normalizeTracked(JSON.parse(raw)),
  serialize: (v) => JSON.stringify(v),
};

/** Shared by every caller, so the Settings editors and the dashboard stay in step. */
export function useTrackedMuscles() {
  const [tracked, write] = useSetting(TRACKED_SETTING);

  const toggle = (m: DisplayMuscle) => {
    const current = readSetting(TRACKED_SETTING);
    write(current.includes(m) ? current.filter((x) => x !== m) : [...current, m]);
  };

  const reset = () => write(null);

  return { tracked, toggle, reset };
}
