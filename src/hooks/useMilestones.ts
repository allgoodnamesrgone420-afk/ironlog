"use client";

import { useMemo } from "react";
import type { Workout } from "@/types/workout";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { useUnits } from "@/providers/UnitsProvider";
import { WEEKLY_GOAL_SETTING, useSetting } from "@/lib/settings";
import { computeMilestones } from "@/lib/analytics/milestones";

/** Every milestone, earned or not, from the workouts the page already has. */
export function useMilestones(workouts: Workout[]) {
  const { units } = useUnits();
  const [goal] = useSetting(WEEKLY_GOAL_SETTING);
  const bodyweightKg = useLatestBodyweight();
  const milestones = useMemo(
    () => computeMilestones(workouts, { units, goal, bodyweightKg }),
    [workouts, units, goal, bodyweightKg],
  );
  return { milestones, bodyweightKg };
}
