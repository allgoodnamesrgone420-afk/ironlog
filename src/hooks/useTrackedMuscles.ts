"use client";

import { useEffect, useState } from "react";
import type { DisplayMuscle } from "./useMuscleTargets";

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

const KEY = "ironlog:trackedMuscles";

export function useTrackedMuscles() {
  const [tracked, setTracked] = useState<DisplayMuscle[]>(DEFAULT_TRACKED);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setTracked(parsed.filter((m): m is DisplayMuscle => typeof m === "string"));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const persist = (next: DisplayMuscle[]) => {
    setTracked(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
  };

  const toggle = (m: DisplayMuscle) => {
    const next = tracked.includes(m) ? tracked.filter((x) => x !== m) : [...tracked, m];
    persist(next);
  };

  const reset = () => {
    persist(DEFAULT_TRACKED);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  };

  return { tracked, toggle, reset, hydrated };
}
