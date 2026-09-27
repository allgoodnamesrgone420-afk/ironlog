"use client";

import { REST_TIMER_SETTING, useSetting } from "@/lib/settings";

/** Whether the rest timer should auto-start on set completion. Default: on. */
export function useRestTimerEnabled() {
  const [enabled, setEnabled] = useSetting(REST_TIMER_SETTING);
  return { enabled, setEnabled: (v: boolean) => setEnabled(v) };
}
