/**
 * Estimated 1-rep max formulas.
 * Epley is the most common for moderate rep ranges; Brzycki is better for low reps.
 * We use Epley by default and skip if reps > 12 (formula breaks down at high reps).
 */

export function epley(kg: number, reps: number): number {
  if (reps <= 0 || kg <= 0) return 0;
  if (reps === 1) return kg;
  if (reps > 12) return 0;
  return kg * (1 + reps / 30);
}

export function brzycki(kg: number, reps: number): number {
  if (reps <= 0 || reps >= 37 || kg <= 0) return 0;
  return kg * (36 / (37 - reps));
}

export function estimate1RM(kg: number, reps: number): number {
  // Average of both for stability
  const e = epley(kg, reps);
  const b = brzycki(kg, reps);
  if (e === 0 || b === 0) return e || b;
  return (e + b) / 2;
}
