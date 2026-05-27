"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Units } from "@/types/user";

interface UnitsState {
  units: Units;
  setUnits: (u: Units) => void;
}

const UnitsCtx = createContext<UnitsState>({ units: "kg", setUnits: () => {} });
const STORAGE_KEY = "ironlog:units";

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [units, setUnitsState] = useState<Units>("kg");

  useEffect(() => {
    const stored = typeof window !== "undefined" && (localStorage.getItem(STORAGE_KEY) as Units | null);
    if (stored === "kg" || stored === "lb") setUnitsState(stored);
  }, []);

  const setUnits = (u: Units) => {
    setUnitsState(u);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, u);
  };

  return <UnitsCtx.Provider value={{ units, setUnits }}>{children}</UnitsCtx.Provider>;
}

export function useUnits() {
  return useContext(UnitsCtx);
}
