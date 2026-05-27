"use client";

import { useEffect, useState } from "react";

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

const KEY = "ironlog:muscleTargets";

export function useMuscleTargets() {
  const [targets, setTargets] = useState<MuscleTargets>(DEFAULT_TARGETS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MuscleTargets>;
        setTargets({ ...DEFAULT_TARGETS, ...parsed });
      }
    } catch {
      // ignore corrupt value
    }
    setHydrated(true);
  }, []);

  const set = (muscle: DisplayMuscle, value: number) => {
    setTargets((prev) => {
      const next = { ...prev, [muscle]: Math.max(0, Math.min(50, Math.round(value))) };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  };

  const reset = () => {
    setTargets(DEFAULT_TARGETS);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  };

  return { targets, set, reset, hydrated };
}
