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
    <div className="border border-line-soft bg-elevated/60 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="label">Plates / side</span>
        <span className={`num font-bold ${achievable ? "text-ok" : "text-warn"}`}>
          {achievable ? `${fromKg(actualKg, units).toFixed(1)} ${units}` : `≈ ${fromKg(actualKg, units).toFixed(1)} ${units}`}
        </span>
      </div>
      {perSide.length === 0 ? (
        <div className="text-ink-2">Bar only ({fromKg(barbellKg, units).toFixed(1)} {units})</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {perSide.map((p) => {
            const displayWeight = fromKg(toKg(p.weight, units), units);
            return Array.from({ length: p.count }).map((_, i) => (
              <span
                key={`${p.weight}-${i}`}
                className="num inline-flex min-w-[34px] items-center justify-center border border-black/25 px-1.5 py-1 text-[11px] font-extrabold"
                style={{
                  backgroundColor: PLATE_COLORS[p.weight] ?? "#9ca3af",
                  color: p.weight === 5 ? "#000" : "#fff",
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
