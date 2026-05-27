"use client";

import { useMemo, useState } from "react";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useUnits } from "@/providers/UnitsProvider";
import { fromKg } from "@/lib/units/converter";
import { estimate1RM } from "@/lib/analytics/onerm";
import { workoutSetCount, workoutVolume } from "@/lib/analytics/volume";
import { startOfWeek, daysAgo } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart3, TrendingUp, Flame, Calendar } from "lucide-react";

/** Per-exercise 1RM progression over time. */
function ProgressionChart({ data, color = "#3b82f6" }: { data: { date: Date; v: number }[]; color?: string }) {
  if (data.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-zinc-500 italic">
        Need at least 2 sessions to draw a trend.
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.v));
  const min = Math.min(...data.map((d) => d.v));
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const y = (v: number) => 100 - ((v - min) / range) * 90 - 5;
  const points = data.map((d, i) => `${x(i)},${y(d.v)}`).join(" ");
  const area = `0,100 ${points} 100,100`;
  return (
    <svg viewBox="0 0 100 100" className="w-full h-32" preserveAspectRatio="none">
      <defs>
        <linearGradient id="prog-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#prog-grad)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.v)} r="1" fill={color} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export default function StatsPage() {
  const { workouts, loading } = useWorkouts();
  const { units } = useUnits();

  // Exercises that show up most often, for the picker
  const exercises = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of workouts) for (const ex of w.exercises) counts.set(ex.name, (counts.get(ex.name) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [workouts]);

  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? exercises[0] ?? null;

  // Best 1RM per session for the picked exercise
  const progression = useMemo(() => {
    if (!selected) return [];
    const rows: { date: Date; v: number }[] = [];
    const sorted = [...workouts].sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const w of sorted) {
      let best = 0;
      for (const ex of w.exercises) {
        if (ex.name === selected) {
          for (const s of ex.sets) {
            if (!s.completed) continue;
            const est = estimate1RM(s.kg, s.reps);
            if (est > best) best = est;
          }
        }
      }
      if (best > 0) rows.push({ date: w.date, v: fromKg(best, units) });
    }
    return rows;
  }, [workouts, selected, units]);

  // Last 12 weeks of volume
  const weekly = useMemo(() => {
    const buckets: { label: string; kg: number; date: Date }[] = [];
    const cursor = startOfWeek();
    for (let i = 11; i >= 0; i--) {
      const start = new Date(cursor);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const vol = workouts
        .filter((w) => w.date >= start && w.date < end)
        .reduce((a, w) => a + w.totalVolume, 0);
      buckets.push({
        label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        kg: vol,
        date: start,
      });
    }
    return buckets;
  }, [workouts]);

  const totals = useMemo(() => {
    const sessions = workouts.length;
    const sets = workouts.reduce((a, w) => a + workoutSetCount(w), 0);
    const volume = workouts.reduce((a, w) => a + workoutVolume(w), 0);
    return { sessions, sets, volume };
  }, [workouts]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-60 rounded-3xl" />
        <Skeleton className="h-60 rounded-3xl" />
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Stats</h1>
        <EmptyState
          icon={<BarChart3 className="w-6 h-6" />}
          title="No data to chart yet"
          description="Log a few workouts and your progression curves will appear here."
        />
      </div>
    );
  }

  const weeklyMax = Math.max(...weekly.map((w) => w.kg), 1);

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Stats</h1>

      {/* Lifetime totals */}
      <div className="grid grid-cols-3 gap-2">
        <TotalCard icon={<Flame className="w-4 h-4" />} label="Sessions" value={totals.sessions.toString()} color="text-amber-500 dark:text-amber-400" bg="bg-amber-500/10" />
        <TotalCard icon={<TrendingUp className="w-4 h-4" />} label="Sets" value={totals.sets.toString()} color="text-brand-600 dark:text-brand-400" bg="bg-brand-500/10" />
        <TotalCard
          icon={<BarChart3 className="w-4 h-4" />}
          label={`Volume (${units})`}
          value={Math.round(fromKg(totals.volume, units) / 1000).toLocaleString() + "k"}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-500/10"
        />
      </div>

      {/* Per-exercise 1RM progression */}
      <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Estimated 1RM</h3>
            <p className="text-xs text-zinc-500">Top set per session, Epley + Brzycki</p>
          </div>
          {exercises.length > 0 && (
            <select
              value={selected ?? ""}
              onChange={(e) => setPicked(e.target.value)}
              className="bg-zinc-100 dark:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 max-w-[150px]"
            >
              {exercises.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
          )}
        </div>
        {progression.length > 0 && (
          <div className="flex items-baseline gap-2 mb-2">
            <span
              className="text-3xl font-bold text-zinc-900 dark:text-white leading-none"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {progression[progression.length - 1]!.v.toFixed(0)}
            </span>
            <span className="text-xs text-zinc-500 font-semibold">{units}</span>
            {progression.length > 1 && (() => {
              const first = progression[0]!.v;
              const last = progression[progression.length - 1]!.v;
              const delta = last - first;
              if (Math.abs(delta) < 0.5) return null;
              return (
                <span
                  className={`text-xs font-bold ml-2 ${delta > 0 ? "text-emerald-500" : "text-red-500"}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {delta > 0 ? "+" : ""}{delta.toFixed(0)} {units} all-time
                </span>
              );
            })()}
          </div>
        )}
        <ProgressionChart data={progression} />
      </section>

      {/* 12-week volume */}
      <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Weekly volume</h3>
            <p className="text-xs text-zinc-500">Last 12 weeks</p>
          </div>
        </div>
        <div className="flex items-end justify-between gap-1 h-32">
          {weekly.map((w, i) => {
            const v = fromKg(w.kg, units);
            const h = (w.kg / weeklyMax) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${w.label}: ${Math.round(v)} ${units}`}>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-t-md relative overflow-hidden" style={{ height: "100%" }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-brand-700 to-brand-500 rounded-t-md transition-all duration-500 group-hover:from-brand-600 group-hover:to-brand-400"
                    style={{ height: `${Math.max(2, h)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-600 mt-2">
          <span>{weekly[0]?.label}</span>
          <span>{weekly[weekly.length - 1]?.label}</span>
        </div>
      </section>

      {/* Frequency calendar */}
      <FrequencyCalendar workouts={workouts} />
    </div>
  );
}

function TotalCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-3">
      <div className={`p-1.5 rounded-lg inline-flex ${bg} ${color}`}>{icon}</div>
      <div className="text-xl font-bold text-zinc-900 dark:text-white mt-2 leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-1">{label}</div>
    </div>
  );
}

function FrequencyCalendar({ workouts }: { workouts: { date: Date }[] }) {
  // 84-day grid (12 weeks × 7 days). Each cell colored by # of workouts that day.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of workouts) {
      const k = new Date(w.date).toISOString().slice(0, 10);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cells: { key: string; count: number; date: Date }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      cells.push({ key: k, count: map.get(k) ?? 0, date: d });
    }
    return cells;
  }, [workouts]);

  const color = (n: number) => {
    if (n === 0) return "bg-zinc-100 dark:bg-zinc-800";
    if (n === 1) return "bg-brand-500/40";
    if (n === 2) return "bg-brand-500/70";
    return "bg-brand-500";
  };

  const latest = workouts[0];

  return (
    <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> Training frequency
          </h3>
          <p className="text-xs text-zinc-500">Last 12 weeks</p>
        </div>
        {latest && (
          <div className="text-right">
            <div className="text-xs text-zinc-500">Last session</div>
            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{daysAgo(latest.date)}</div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-12 grid-rows-7 grid-flow-col gap-1">
        {counts.map((c) => (
          <div
            key={c.key}
            title={`${c.date.toLocaleDateString()} · ${c.count}`}
            className={`aspect-square rounded-sm ${color(c.count)}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-1 mt-3 text-[10px] text-zinc-500">
        <span>Less</span>
        <span className="w-2.5 h-2.5 rounded-sm bg-zinc-100 dark:bg-zinc-800" />
        <span className="w-2.5 h-2.5 rounded-sm bg-brand-500/40" />
        <span className="w-2.5 h-2.5 rounded-sm bg-brand-500/70" />
        <span className="w-2.5 h-2.5 rounded-sm bg-brand-500" />
        <span>More</span>
      </div>
    </section>
  );
}
