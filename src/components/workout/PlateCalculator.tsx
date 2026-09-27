"use client";

import { useMemo } from "react";
import { platesPerSide, KG_PLATES, LB_PLATES } from "@/lib/data/plate-calc";
import { useUnits } from "@/providers/UnitsProvider";
import { displayWeight } from "@/lib/units/converter";

interface Props {
  /** Target weight in kg */
  targetKg: number;
  /** Bar weight in kg */
  barbellKg: number;
}

/** Competition colours; pound plates borrow the colour of their kg equivalent (45 lb ≈ 20 kg). */
const PLATE_COLORS: Record<"kg" | "lb", Record<number, string>> = {
  kg: { 25: "#ef4444", 20: "#3b82f6", 15: "#eab308", 10: "#22c55e", 5: "#ffffff", 2.5: "#64748b", 1.25: "#cbd5e1" },
  lb: { 45: "#3b82f6", 35: "#eab308", 25: "#22c55e", 10: "#ffffff", 5: "#64748b", 2.5: "#cbd5e1" },
};
const DARK_TEXT = new Set(["#ffffff", "#eab308", "#cbd5e1"]);

export function PlateCalculator({ targetKg, barbellKg }: Props) {
  const { units } = useUnits();
  // Work in the lifter's own unit so pound gyms get 45s and 25s, not converted kg plates.
  const target = displayWeight(targetKg, units);
  const bar = displayWeight(barbellKg, units);

  const { perSide, actual, achievable } = useMemo(
    () => platesPerSide(target, bar, units === "kg" ? KG_PLATES : LB_PLATES),
    [target, bar, units],
  );

  if (targetKg <= 0) return null;

  const fmt = (n: number) => String(Math.round(n * 100) / 100);

  return (
    <div className="border border-line-soft bg-elevated/60 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="label">Plates / side</span>
        <span className={`num font-bold ${achievable ? "text-ok" : "text-warn"}`}>
          {achievable ? "" : "≈ "}
          {fmt(actual)} {units}
        </span>
      </div>
      {perSide.length === 0 ? (
        <div className="text-ink-2">
          Bar only ({fmt(bar)} {units})
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {perSide.map((p) => {
            const color = PLATE_COLORS[units][p.weight] ?? "#9ca3af";
            return Array.from({ length: p.count }).map((_, i) => (
              <span
                key={`${p.weight}-${i}`}
                className="num inline-flex min-w-[34px] items-center justify-center border border-black/25 px-1.5 py-1 text-[11px] font-extrabold"
                style={{ backgroundColor: color, color: DARK_TEXT.has(color) ? "#0d0d0d" : "#fff" }}
              >
                {fmt(p.weight)}
              </span>
            ));
          })}
        </div>
      )}
    </div>
  );
}
