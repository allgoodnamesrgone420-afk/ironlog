"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { subscribeToProfile, upsertProfile } from "@/lib/firebase/repository";
import { BARBELL_SETTING, REST_TIMER_SETTING, UNITS_SETTING, WEEKLY_GOAL_SETTING, useSetting, writeSetting } from "@/lib/settings";
import { TARGETS_SETTING, normalizeTargets } from "@/hooks/useMuscleTargets";
import { DEFAULT_TRACKED, TRACKED_SETTING, normalizeTracked } from "@/hooks/useTrackedMuscles";
import type { SyncedSettings } from "@/types/user";

/** Same shape and key order for local and remote values, so they compare as JSON. */
function normalize(s: Partial<SyncedSettings>): SyncedSettings {
  return {
    units: s.units === "lb" ? "lb" : "kg",
    theme: s.theme === "light" || s.theme === "dark" ? s.theme : "system",
    barbellKg: typeof s.barbellKg === "number" && s.barbellKg > 0 && s.barbellKg <= 50 ? s.barbellKg : null,
    restTimerEnabled: s.restTimerEnabled !== false,
    trackedMuscles: normalizeTracked(s.trackedMuscles) ?? DEFAULT_TRACKED,
    muscleTargets: normalizeTargets(s.muscleTargets),
    weeklyGoal: typeof s.weeklyGoal === "number" && Number.isInteger(s.weeklyGoal) && s.weeklyGoal >= 1 && s.weeklyGoal <= 7 ? s.weeklyGoal : 3,
  };
}

/**
 * Keeps preferences in step with the Firestore profile so they follow the
 * account across devices. An account's first sync uploads this device's
 * choices; after that, remote changes apply here and local changes are saved.
 */
export function SettingsSync() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [units] = useSetting(UNITS_SETTING);
  const [barbellKg] = useSetting(BARBELL_SETTING);
  const [restTimerEnabled] = useSetting(REST_TIMER_SETTING);
  const [trackedMuscles] = useSetting(TRACKED_SETTING);
  const [muscleTargets] = useSetting(TARGETS_SETTING);
  const [weeklyGoal] = useSetting(WEEKLY_GOAL_SETTING);

  const local = useMemo(
    () => normalize({ units, theme, barbellKg, restTimerEnabled, trackedMuscles, muscleTargets, weeklyGoal }),
    [units, theme, barbellKg, restTimerEnabled, trackedMuscles, muscleTargets, weeklyGoal],
  );

  // Latest values for the Firestore callback, without resubscribing on every change.
  const localRef = useRef(local);
  const setThemeRef = useRef(setTheme);
  useEffect(() => {
    localRef.current = local;
    setThemeRef.current = setTheme;
  });

  /** JSON of the settings last seen in (or sent to) Firestore. */
  const synced = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  // Remote → this device.
  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, (profile) => {
      const current = localRef.current;
      // Accounts made before the weekly goal was a setting keep the one chosen at sign-up.
      const legacyGoal = profile?.weeklyGoal;
      if (!profile?.settings) {
        const first = normalize({ ...current, weeklyGoal: legacyGoal ?? current.weeklyGoal });
        synced.current = JSON.stringify(first);
        if (first.weeklyGoal !== current.weeklyGoal) writeSetting(WEEKLY_GOAL_SETTING, first.weeklyGoal);
        void upsertProfile(user.uid, { settings: first }).catch(() => {});
      } else {
        // Settings saved before a field existed lack it, hence Partial.
        const next = normalize({ weeklyGoal: legacyGoal, ...(profile.settings as Partial<SyncedSettings>) });
        synced.current = JSON.stringify(next);
        if (next.units !== current.units) writeSetting(UNITS_SETTING, next.units);
        if (next.theme !== current.theme) setThemeRef.current(next.theme);
        if (next.barbellKg !== current.barbellKg) writeSetting(BARBELL_SETTING, next.barbellKg);
        if (next.restTimerEnabled !== current.restTimerEnabled) writeSetting(REST_TIMER_SETTING, next.restTimerEnabled);
        if (JSON.stringify(next.trackedMuscles) !== JSON.stringify(current.trackedMuscles)) {
          writeSetting(TRACKED_SETTING, normalizeTracked(next.trackedMuscles) ?? DEFAULT_TRACKED);
        }
        if (JSON.stringify(next.muscleTargets) !== JSON.stringify(current.muscleTargets)) {
          writeSetting(TARGETS_SETTING, normalizeTargets(next.muscleTargets));
        }
        if (next.weeklyGoal !== current.weeklyGoal) writeSetting(WEEKLY_GOAL_SETTING, next.weeklyGoal);
      }
      setReady(true);
    });
  }, [user]);

  // This device → remote, once the first snapshot has been handled.
  useEffect(() => {
    if (!user || !ready) return;
    const json = JSON.stringify(local);
    if (json === synced.current) return;
    synced.current = json;
    void upsertProfile(user.uid, { settings: local }).catch(() => {});
  }, [user, ready, local]);

  return null;
}
