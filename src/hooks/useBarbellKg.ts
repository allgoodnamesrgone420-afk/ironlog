"use client";

import { BARBELL_SETTING, useSetting } from "@/lib/settings";
import { defaultBarKg } from "@/lib/units/converter";
import { useUnits } from "@/providers/UnitsProvider";

/** The lifter's bar weight in kg (defaults to 20 kg, or 45 lb in pound mode). */
export function useBarbellKg() {
  const { units } = useUnits();
  const [stored, setBarbellKg] = useSetting(BARBELL_SETTING);
  return { barbellKg: stored ?? defaultBarKg(units), isDefault: stored === null, setBarbellKg };
}
