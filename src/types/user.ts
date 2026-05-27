export type Units = "kg" | "lb";
export type Theme = "light" | "dark" | "system";

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
}
