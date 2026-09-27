"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Units } from "@/types/user";
import { UNITS_SETTING, useSetting } from "@/lib/settings";

interface UnitsState {
  units: Units;
  setUnits: (u: Units) => void;
}

const UnitsCtx = createContext<UnitsState>({ units: "kg", setUnits: () => {} });

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [units, setUnits] = useSetting(UNITS_SETTING);
  return <UnitsCtx.Provider value={{ units, setUnits }}>{children}</UnitsCtx.Provider>;
}

export function useUnits() {
  return useContext(UnitsCtx);
}
