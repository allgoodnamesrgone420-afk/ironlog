import type { Units } from "@/types/user";

const KG_PER_LB = 0.45359237;

export function toKg(value: number, from: Units): number {
  return from === "kg" ? value : value * KG_PER_LB;
}

export function fromKg(kg: number, to: Units): number {
  return to === "kg" ? kg : kg / KG_PER_LB;
}

export function formatWeight(kg: number, units: Units, decimals = 1): string {
  const v = fromKg(kg, units);
  // Round to nearest 0.5 in lb, 0.5 in kg too — gyms don't use 0.1 increments
  const rounded = Math.round(v * 2) / 2;
  const str = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(decimals);
  return `${str} ${units}`;
}

export function roundToPlate(kg: number, units: Units): number {
  // Smallest plate increment: 1.25 kg (per side = 2.5 kg total) for kg, 1.25 lb (2.5 lb) for lb
  const inUnits = fromKg(kg, units);
  const inc = units === "kg" ? 2.5 : 5;
  return toKg(Math.round(inUnits / inc) * inc, units);
}
