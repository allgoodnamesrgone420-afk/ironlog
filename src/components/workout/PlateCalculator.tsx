"use client";

import { useMemo } from "react";
import { platesPerSide, KG_PLATES, LB_PLATES } from "@/lib/data/plate-calc";
import { useUnits } from "@/providers/UnitsProvider";
import { fromKg, toKg } from "@/lib/units/converter";

interface Props {
  /** Target weight in kg */
  targetKg: number;
  barbellKg?: number;
}

const PLATE_COLORS: Record<number, string> = {
  25: "#ef4444", 20: "#3b82f6", 15: "#eab308", 10: "#10b981", 5: "#ffffff",
  2.5: "#64748b", 1.25: "#94a3b8",
  45: "#ef4444", 35: "#3b82f6",
};

export function PlateCalculator({ targetKg, barbellKg = 20 }: Props) {
  const { units } = useUnits();
  const plateSet = units === "kg" ? KG_PLATES : LB_PLATES.map((p) => Number((p * 0.45359237).toFixed(3)));

  const { perSide, actualKg, achievable } = useMemo(
    () => platesPerSide(targetKg, barbellKg, units === "kg" ? KG_PLATES : plateSet),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetKg, barbellKg, units],
  );

  if (targetKg <= 0) return null;

  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">Plates / side</span>
        <span className={achievable ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
          {achievable ? `${fromKg(actualKg, units).toFixed(1)} ${units}` : `≈ ${fromKg(actualKg, units).toFixed(1)} ${units}`}
        </span>
      </div>
      {perSide.length === 0 ? (
        <div className="text-zinc-500">Bar only ({fromKg(barbellKg, units).toFixed(1)} {units})</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {perSide.map((p) => {
            const displayWeight = fromKg(toKg(p.weight, units), units);
            return Array.from({ length: p.count }).map((_, i) => (
              <span
                key={`${p.weight}-${i}`}
                className="px-2 py-1 rounded font-mono font-bold text-[11px] border"
                style={{
                  backgroundColor: PLATE_COLORS[p.weight] ?? "#9ca3af",
                  color: p.weight === 5 ? "#000" : "#fff",
                  borderColor: "rgba(0,0,0,0.1)",
                }}
              >
                {displayWeight % 1 === 0 ? displayWeight.toFixed(0) : displayWeight.toFixed(2)}
              </span>
            ));
          })}
        </div>
      )}
    </div>
  );
}
