export type Units = "kg" | "lb";
export type Theme = "light" | "dark" | "system";

/** Preferences mirrored to the profile so they follow the account across devices. */
export interface SyncedSettings {
  units: Units;
  theme: Theme;
  /** Bar weight in kg; null means the standard bar for the unit system (20 kg / 45 lb). */
  barbellKg: number | null;
  restTimerEnabled: boolean;
  trackedMuscles: string[];
  muscleTargets: Record<string, number>;
  /** Training days per week (1-7). */
  weeklyGoal: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  units: Units;
  theme: Theme;
  /** Workouts per week target */
  weeklyGoal: number;
  /** Default rest time in seconds */
  defaultRestSec: number;
  /** Barbell weight in kg (20 for Olympic, 15 for women's, etc.) */
  barbellKg: number;
  createdAt: Date;
  /** Written by SettingsSync; absent until the account's first sync. */
  settings?: SyncedSettings;
  /** Short facts the coach learned in chat (preferences, equipment, injuries). */
  coachMemory?: MemoryFact[];
}

export interface MemoryFact {
  text: string;
  /** When it was learned (ms epoch). */
  at: number;
}
