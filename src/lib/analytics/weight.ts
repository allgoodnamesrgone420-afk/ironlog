/**
 * Weigh-ins and the smoothed trend, ported from Bite. The trend is an
 * exponential moving average (like a ~10-day average that never jumps), so a
 * salty dinner or a big water day doesn't read as fat gained. Pure.
 */
import { addDays, dayKey } from "./goal";

/** Smoothing for the trend line. */
export const TREND_ALPHA = 0.1;

export type Weights = Record<string, number>;
export type TrendPoint = { date: string; kg: number | null; trend: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One point per day from the first weigh-in to `until`: the raw weight on weigh-in days, the trend every day. */
export function trendSeries(weights: Weights, until: string): TrendPoint[] {
  const dates = Object.keys(weights)
    .filter((d) => d <= until)
    .sort();
  if (!dates.length) return [];
  const out: TrendPoint[] = [];
  let trend = weights[dates[0]!]!;
  for (let d = dates[0]!; d <= until; d = addDays(d, 1)) {
    const kg = weights[d] ?? null;
    if (kg !== null) trend += TREND_ALPHA * (kg - trend);
    out.push({ date: d, kg, trend: round2(trend) });
  }
  return out;
}

/** Least-squares slope (y per x); null with fewer than 2 distinct x values. */
function slope(points: { x: number; y: number }[]): number | null {
  if (points.length < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const my = points.reduce((s, p) => s + p.y, 0) / points.length;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

const dayIndex = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86_400_000);

/** Weekly rate of change (kg/week) from weigh-ins in the last `days` days; null without enough data. */
export function weeklyRate(weights: Weights, today: string, days = 28): number | null {
  const from = addDays(today, -days);
  const pts = Object.entries(weights)
    .filter(([d]) => d >= from && d <= today)
    .map(([d, kg]) => ({ x: dayIndex(d), y: kg }));
  const span = pts.length ? Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)) : 0;
  if (pts.length < 3 || span < 7) return null;
  const s = slope(pts);
  return s === null ? null : round2(s * 7);
}

/** Weigh-ins by day from body metrics (the latest entry of a day wins). */
export function weightsFromMetrics(metrics: { date: Date; weightKg?: number }[]): Weights {
  const out: Weights = {};
  const latest: Record<string, number> = {};
  for (const m of metrics) {
    if (typeof m.weightKg !== "number" || !(m.weightKg > 0)) continue;
    const key = dayKey(m.date);
    const t = m.date.getTime();
    if (latest[key] === undefined || t >= latest[key]) {
      latest[key] = t;
      out[key] = m.weightKg;
    }
  }
  return out;
}
