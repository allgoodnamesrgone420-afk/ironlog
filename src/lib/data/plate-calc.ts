/**
 * Plate calculator. Given a target weight and barbell weight, returns
 * the plates needed PER SIDE (greedy bin-packing on available plates).
 */

export const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

export interface PlateBreakdown {
  perSide: { weight: number; count: number }[];
  achievable: boolean;
  /** Actual barbell loaded weight (may differ from target by ≤ smallest plate × 2) */
  actualKg: number;
}

export function platesPerSide(
  targetKg: number,
  barbellKg: number,
  plateSet: number[] = KG_PLATES,
): PlateBreakdown {
  const loadKg = targetKg - barbellKg;
  if (loadKg <= 0) return { perSide: [], achievable: targetKg === barbellKg, actualKg: barbellKg };

  let remainingPerSide = loadKg / 2;
  const breakdown: { weight: number; count: number }[] = [];

  for (const plate of plateSet) {
    if (remainingPerSide >= plate) {
      const count = Math.floor(remainingPerSide / plate);
      breakdown.push({ weight: plate, count });
      remainingPerSide -= plate * count;
    }
  }

  const loadedPerSide = breakdown.reduce((acc, p) => acc + p.weight * p.count, 0);
  const actualKg = barbellKg + loadedPerSide * 2;

  return {
    perSide: breakdown,
    achievable: Math.abs(actualKg - targetKg) < 0.5,
    actualKg,
  };
}
