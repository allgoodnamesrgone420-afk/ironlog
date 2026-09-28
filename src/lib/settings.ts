"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Units } from "@/types/user";

/**
 * Per-user preferences, kept in localStorage for an instant start and shared by
 * every component that reads them: a write notifies all subscribers in this tab,
 * and the `storage` event covers other tabs. SettingsSync mirrors them to the
 * Firestore profile so they follow the account across devices.
 */

export interface SettingDef<T> {
  key: string;
  fallback: T;
  /** Returns undefined for values that aren't valid (the fallback is used). */
  parse: (raw: string) => T | undefined;
  serialize: (value: T) => string;
}

const EVENT = "ironlog:settings";
// Used when localStorage is unavailable (private mode), so changes still apply for the session.
const memory = new Map<string, string | null>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Current value (stable reference while the stored string is unchanged). */
export function readSetting<T>(def: SettingDef<T>): T {
  const raw = readRaw(def.key);
  const hit = cache.get(def.key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value = def.fallback;
  if (raw !== null) {
    try {
      value = def.parse(raw) ?? def.fallback;
    } catch {
      value = def.fallback;
    }
  }
  cache.set(def.key, { raw, value });
  return value;
}

/** Store a value, or `null` to go back to the default. */
export function writeSetting<T>(def: SettingDef<T>, value: T | null) {
  const raw = value === null ? null : def.serialize(value);
  try {
    if (raw === null) localStorage.removeItem(def.key);
    else localStorage.setItem(def.key, raw);
    memory.delete(def.key);
  } catch {
    memory.set(def.key, raw);
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useSetting<T>(def: SettingDef<T>): [T, (value: T | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readSetting(def),
    () => def.fallback,
  );
  const set = useCallback((next: T | null) => writeSetting(def, next), [def]);
  return [value, set];
}

/* ------------------------------ definitions ------------------------------ */

export const UNITS_SETTING: SettingDef<Units> = {
  key: "ironlog:units",
  fallback: "kg",
  parse: (raw) => (raw === "kg" || raw === "lb" ? raw : undefined),
  serialize: (v) => v,
};

export const REST_TIMER_SETTING: SettingDef<boolean> = {
  key: "ironlog:restTimerEnabled",
  fallback: true,
  parse: (raw) => (raw === "true" ? true : raw === "false" ? false : undefined),
  serialize: (v) => String(v),
};

/** Bar weight in kg; null means the standard bar for the unit system (20 kg / 45 lb). */
export const BARBELL_SETTING: SettingDef<number | null> = {
  key: "ironlog:barbellKg",
  fallback: null,
  parse: (raw) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 && n <= 50 ? n : undefined;
  },
  serialize: (v) => String(v),
};

/** Training days per week the streak and report card measure against. */
export const WEEKLY_GOAL_SETTING: SettingDef<number> = {
  key: "ironlog:weeklyGoal",
  fallback: 3,
  parse: (raw) => {
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= 7 ? n : undefined;
  },
  serialize: (v) => String(v),
};

/** How many exercises the AI builder plans; null means Auto (the lifter's usual session size). */
export const BUILDER_EXERCISES_SETTING: SettingDef<number | null> = {
  key: "ironlog:builderExercises",
  fallback: null,
  parse: (raw) => {
    const n = Number(raw);
    return Number.isInteger(n) && n >= 3 && n <= 10 ? n : undefined;
  },
  serialize: (v) => String(v),
};
