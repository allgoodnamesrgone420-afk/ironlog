"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useUnits } from "@/providers/UnitsProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { fromKg, toKg } from "@/lib/units/converter";
import { estimate1RM } from "@/lib/analytics/onerm";
import { workoutSetCount, workoutVolume } from "@/lib/analytics/volume";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { useSeen } from "@/hooks/useSeen";
import { addBodyMetric, subscribeToBodyMetrics } from "@/lib/firebase/repository";
import type { BodyMetric } from "@/types/workout";
import Link from "next/link";
import { computePRs } from "@/lib/analytics/personal-records";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { CountUp } from "@/components/ui/CountUp";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatsSkeleton } from "@/components/ui/PageSkeletons";
import { MuscleBalance } from "@/components/dashboard/MuscleBalance";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import { PRCards } from "@/components/dashboard/PRCards";
import { BarChart3, Calendar, Scale, Plus } from "lucide-react";

/**
 * Flat NeoPop line chart: an ink line with square markers. Markers are HTML so
 * they stay square while the SVG stretches to the container.
 */
function TrendChart({ data, spread = 0.9 }: { data: { date: Date; v: number }[]; spread?: number }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const max = Math.max(...data.map((d) => d.v));
  const min = Math.min(...data.map((d) => d.v));
  const range = max - min || 1;
  const pad = ((1 - spread) / 2) * 100;
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const y = (v: number) => 100 - pad - ((v - min) / range) * spread * 100;
  const points = data.map((d, i) => `${x(i)},${y(d.v)}`).join(" ");
  return (
    <div ref={ref} data-seen={seen} className="wipe-in relative h-32">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
        {[25, 50, 75].map((p) => (
          <line key={p} x1="0" x2="100" y1={p} y2={p} style={{ stroke: "rgb(var(--line-soft))" }} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <polyline
          points={points}
          fill="none"
          style={{ stroke: "rgb(var(--ink))" }}
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {data.map((d, i) => (
        <span
          key={i}
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-violet ring-2 ring-surface"
          style={{ left: `${x(i)}%`, top: `${y(d.v)}%` }}
          aria-hidden
        />
      ))}
    </div>
  );
}

/** Per-exercise 1RM progression over time. */
function ProgressionChart({ data }: { data: { date: Date; v: number }[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center border border-dashed border-line-soft text-xs text-ink-3">
        Need at least 2 sessions to draw a trend.
      </div>
    );
  }
  return <TrendChart data={data} />;
}

export default function StatsPage() {
  const { workouts, loading } = useWorkouts();
  const { units } = useUnits();
  const bodyweightKg = useLatestBodyweight();

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

  // Training emphasis: every completed set bucketed by rep range. This uses the
  // whole history (no time window), so it stays useful no matter when you trained.
  const repRanges = useMemo(() => {
    let strength = 0; // 1–5 reps
    let hypertrophy = 0; // 6–12 reps
    let endurance = 0; // 13+ reps
    for (const w of workouts) {
      for (const ex of w.exercises ?? []) {
        for (const s of ex.sets ?? []) {
          if (!s.completed) continue;
          const reps = Number.isFinite(s.reps) ? s.reps : 0;
          if (reps <= 0) continue;
          if (reps <= 5) strength++;
          else if (reps <= 12) hypertrophy++;
          else endurance++;
        }
      }
    }
    return { strength, hypertrophy, endurance, total: strength + hypertrophy + endurance };
  }, [workouts]);

  const totals = useMemo(() => {
    const sessions = workouts.length;
    const sets = workouts.reduce((a, w) => a + workoutSetCount(w), 0);
    const volume = workouts.reduce((a, w) => a + workoutVolume(w, bodyweightKg), 0);
    return { sessions, sets, volume };
  }, [workouts, bodyweightKg]);

  const prs = useMemo(() => computePRs(workouts), [workouts]);

  // Last 10 sessions for the volume chart, oldest first.
  const volumeData = useMemo(
    () =>
      [...workouts]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(-10)
        .map((w) => ({
          kg: workoutVolume(w, bodyweightKg),
          label: w.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          date: w.date,
          name: w.name,
        })),
    [workouts, bodyweightKg],
  );

  if (loading) return <StatsSkeleton />;

  if (workouts.length === 0) {
    return (
      <div className="stagger mx-auto max-w-[640px] space-y-6">
        <header>
          <p className="label">Stats</p>
          <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">How you&apos;re stacking up</h1>
        </header>
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="No stats yet"
          description="Log a workout and your muscle balance, volume, records and calendar show up here."
          action={
            <Link href="/log" className="pop-btn lime">
              Start a workout
            </Link>
          }
        />
        <BodyweightSection />
      </div>
    );
  }

  const first = progression[0]?.v ?? 0;
  const latest = progression[progression.length - 1]?.v ?? 0;
  const delta = latest - first;

  return (
    <div className="stagger space-y-6">
      <header style={{ ["--i" as string]: 0 }}>
        <p className="label">Stats</p>
        <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">How you&apos;re stacking up</h1>
      </header>

      {/* Lifetime totals */}
      <section className="grid grid-cols-[1.1fr_1fr] gap-3 lg:grid-cols-3 lg:gap-4" style={{ ["--i" as string]: 1 }}>
        <div className="plunk face-lime p-4" style={{ ["--d" as string]: "5px" }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">Sessions</p>
          <p className="hero-num num mt-2 text-[64px]">
            <CountUp value={totals.sessions} />
          </p>
          <p className="mt-1 text-xs font-semibold opacity-80">logged, all time</p>
        </div>
        {/* Stacked beside the lime tile on phones; its own columns on desktop. */}
        <div className="grid grid-rows-2 gap-2 lg:contents">
          <div className="card p-3 lg:p-4">
            <p className="label">Sets</p>
            <p className="num mt-1 text-2xl font-extrabold lg:text-4xl">
              <CountUp value={totals.sets} />
            </p>
          </div>
          <div className="card p-3 lg:p-4">
            <p className="label">Volume · {units}</p>
            <p className="num mt-1 text-2xl font-extrabold lg:text-4xl">
              <CountUp value={Math.round(fromKg(totals.volume, units) / 1000)} format={(n) => `${Math.round(n).toLocaleString()}k`} />
            </p>
          </div>
        </div>
      </section>

      <div
        className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0"
        style={{ ["--i" as string]: 2 }}
      >
        <div className="space-y-6">
          {/* This week */}
          <MuscleBalance workouts={workouts} />
          <VolumeChart data={volumeData} />

          {/* Per-exercise 1RM progression */}
          <section className="plunk face-card p-4" style={{ ["--d" as string]: "4px" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="label">Estimated 1RM</p>
                <p className="text-xs text-ink-2">Top set per session, Epley + Brzycki</p>
              </div>
              {exercises.length > 0 && (
                <label className="field compact w-[168px] shrink-0">
                  <span>Exercise</span>
                  <select value={selected ?? ""} onChange={(e) => setPicked(e.target.value)}>
                    {exercises.map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {progression.length > 0 && (
              <p className="num mb-3 mt-2 flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-extrabold tracking-tight">{latest.toFixed(0)}</span>
                <span className="text-sm font-semibold text-ink-3">{units}</span>
                {progression.length > 1 && Math.abs(delta) >= 0.5 && (
                  <span className={`text-xs font-bold ${delta > 0 ? "text-ok" : "text-over"}`}>
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(0)} {units} all-time
                  </span>
                )}
              </p>
            )}
            <ProgressionChart data={progression} />
          </section>

          {/* Training emphasis — rep-range distribution */}
          <RepRangeSection ranges={repRanges} />
        </div>

        <div className="space-y-6">
          <PRCards records={prs} />

          {/* Frequency calendar */}
          <MonthCalendar workouts={workouts} />

          {/* Bodyweight */}
          <BodyweightSection />
        </div>
      </div>
    </div>
  );
}

function BodyweightSection() {
  const { user } = useAuth();
  const { units } = useUnits();
  const toast = useToast();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToBodyMetrics(user.uid, (m) => {
      setMetrics(m);
      setLoaded(true);
    });
  }, [user]);

  const log = async () => {
    if (!user) return;
    const num = parseFloat(input.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0 || num > 500) {
      toast.error("Enter a valid weight.");
      return;
    }
    setSaving(true);
    try {
      await addBodyMetric(user.uid, { date: new Date(), weightKg: toKg(num, units) });
      setInput("");
      toast.success("Logged");
    } catch {
      toast.error("Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const series = useMemo(
    () =>
      metrics
        .filter((m) => typeof m.weightKg === "number")
        .slice(0, 60)
        .reverse()
        .map((m) => ({ date: m.date, v: fromKg(m.weightKg!, units) })),
    [metrics, units],
  );

  const latest = series[series.length - 1];
  const oldest = series[0];
  const delta = latest && oldest ? latest.v - oldest.v : 0;

  return (
    <section className="plunk face-card space-y-4 p-4" style={{ ["--d" as string]: "4px" }} aria-label="Bodyweight">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" /> Bodyweight
          </p>
          <p className="text-xs text-ink-2">Daily or weekly check-in</p>
        </div>
        {latest && (
          <div className="text-right">
            <p className="num text-3xl font-extrabold leading-none">
              {latest.v.toFixed(1)}
              <span className="ml-1 text-sm font-semibold text-ink-3">{units}</span>
            </p>
            {Math.abs(delta) >= 0.1 && (
              <p className={`num mt-1 text-xs font-semibold ${delta > 0 ? "text-warn" : "text-ok"}`}>
                {delta > 0 ? "+" : ""}
                {delta.toFixed(1)} {units} all-time
              </p>
            )}
          </div>
        )}
      </div>

      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void log();
        }}
      >
        <label className="field compact min-w-0 flex-1">
          <span>Today&apos;s weight ({units})</span>
          <input type="text" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} className="num font-bold" />
        </label>
        <Button type="submit" loading={saving} size="sm" className="h-11 shrink-0">
          <Plus className="h-4 w-4" /> Log
        </Button>
      </form>

      {!loaded ? (
        <Skeleton className="h-[164px]" />
      ) : series.length >= 2 ? (
        <BodyweightChart data={series} />
      ) : series.length === 1 ? (
        <p className="py-4 text-center text-xs text-ink-3">One more entry and the trend appears.</p>
      ) : (
        <p className="py-4 text-center text-xs text-ink-3">No bodyweight logged yet.</p>
      )}
    </section>
  );
}

function BodyweightChart({ data }: { data: { date: Date; v: number }[] }) {
  const max = Math.max(...data.map((d) => d.v));
  const min = Math.min(...data.map((d) => d.v));
  const fmt = (d: Date | undefined) => d?.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div>
      <div className="num mb-1 flex justify-between text-[10px] text-ink-3">
        <span>High {max.toFixed(1)}</span>
        <span>Low {min.toFixed(1)}</span>
      </div>
      <TrendChart data={data} spread={0.8} />
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-3">
        <span>{fmt(data[0]?.date)}</span>
        <span>{fmt(data[data.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

function RepRangeSection({
  ranges,
}: {
  ranges: { strength: number; hypertrophy: number; endurance: number; total: number };
}) {
  const rows = [
    { key: "strength", label: "Strength", hint: "1–5 reps", color: "rgb(var(--over))", count: ranges.strength },
    { key: "hypertrophy", label: "Hypertrophy", hint: "6–12 reps", color: "rgb(var(--blue))", count: ranges.hypertrophy },
    { key: "endurance", label: "Endurance", hint: "13+ reps", color: "rgb(var(--ok))", count: ranges.endurance },
  ];
  const top = rows.reduce((a, b) => (b.count > a.count ? b : a), rows[0]!);
  const [ref, seen] = useSeen<HTMLElement>();

  return (
    <section ref={ref} data-seen={seen} className="plunk face-card p-4" style={{ ["--d" as string]: "4px" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Training emphasis</p>
          <p className="text-xs text-ink-2">Completed sets by rep range</p>
        </div>
        {ranges.total > 0 && (
          <div className="text-right">
            <p className="num text-2xl font-extrabold leading-none">{ranges.total}</p>
            <p className="label mt-1">Sets</p>
          </div>
        )}
      </div>

      {ranges.total === 0 ? (
        <p className="py-8 text-center text-xs text-ink-3">Complete some sets to see your rep-range split.</p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {rows.map((r, i) => {
              const pct = Math.round((r.count / ranges.total) * 100);
              return (
                <li key={r.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-semibold">
                      <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: r.color }} aria-hidden />
                      {r.label} <span className="text-xs font-normal text-ink-3">{r.hint}</span>
                    </span>
                    <span className="num shrink-0 text-xs">
                      <span className="font-bold">{pct}%</span>
                      <span className="text-ink-3"> · {r.count}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 bg-elevated">
                    <div
                      className="bar-anim grow-x h-full"
                      style={{ width: `${pct}%`, backgroundColor: r.color, ["--delay" as string]: `${i * 80}ms` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm text-ink-2">
            Most of your work is in the <span className="font-bold text-ink">{top.label.toLowerCase()}</span> range.
          </p>
        </>
      )}
    </section>
  );
}

interface DayCell {
  key: string;
  date: Date;
  workouts: number;
  sets: number;
}

function MonthCalendar({ workouts }: { workouts: { date: Date; exercises: { sets: { completed: boolean }[] }[] }[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [picked, setPicked] = useState(thisKey);
  const [hover, setHover] = useState<DayCell | null>(null);

  // Build month options: every month with data + the current month, last 12 max
  const monthOptions = useMemo(() => {
    const set = new Set<string>([thisKey]);
    for (const w of workouts) {
      const d = w.date;
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return [...set]
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 12)
      .map((k) => {
        const [y, m] = k.split("-").map(Number);
        const d = new Date(y!, m! - 1, 1);
        return { key: k, label: d.toLocaleDateString(undefined, { month: "short", year: "numeric" }) };
      });
  }, [workouts, thisKey]);

  // Aggregate workouts + completed sets per day
  const dayMap = useMemo(() => {
    const map = new Map<string, { workouts: number; sets: number }>();
    for (const w of workouts) {
      const d = new Date(w.date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const sets = w.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.completed).length, 0);
      const existing = map.get(k) ?? { workouts: 0, sets: 0 };
      map.set(k, { workouts: existing.workouts + 1, sets: existing.sets + sets });
    }
    return map;
  }, [workouts]);

  // Build the calendar grid for the picked month
  const [py, pm] = picked.split("-").map(Number);
  const firstOfMonth = new Date(py!, pm! - 1, 1);
  const lastOfMonth = new Date(py!, pm!, 0);
  const startWeekday = firstOfMonth.getDay(); // 0 = Sun

  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= lastOfMonth.getDate(); d++) {
    const date = new Date(py!, pm! - 1, d);
    const k = `${py}-${String(pm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const stats = dayMap.get(k) ?? { workouts: 0, sets: 0 };
    cells.push({ key: k, date, workouts: stats.workouts, sets: stats.sets });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  // Color scale based on set count per day
  const color = (sets: number) => {
    if (sets === 0) return "border border-line-soft text-ink-3";
    if (sets <= 5) return "bg-blue/30";
    if (sets <= 12) return "bg-blue/55";
    if (sets <= 20) return "bg-blue/80 text-white";
    return "bg-blue text-white";
  };

  let totalSessions = 0;
  let totalSets = 0;
  for (const c of cells) {
    if (c) {
      totalSessions += c.workouts;
      totalSets += c.sets;
    }
  }

  return (
    <section className="plunk face-card p-4" style={{ ["--d" as string]: "4px" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="label flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Training frequency
          </p>
          <p className="num text-xs text-ink-2">
            {totalSessions} session{totalSessions === 1 ? "" : "s"} · {totalSets} sets
          </p>
        </div>
        <label className="field compact w-[132px] shrink-0">
          <span>Month</span>
          <select value={picked} onChange={(e) => setPicked(e.target.value)}>
            {monthOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Day-of-week header + calendar grid */}
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="label">
            {d}
          </span>
        ))}
        {cells.map((c, i) => {
          if (!c) return <span key={`empty-${i}`} className="aspect-square" />;
          const isToday = c.date.getTime() === today.getTime();
          return (
            <button
              key={c.key}
              type="button"
              onMouseEnter={() => setHover(c)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(c)}
              onClick={() => setHover(c)}
              aria-label={`${c.date.toDateString()}: ${c.workouts} workouts, ${c.sets} sets`}
              className={`num flex aspect-square items-center justify-center text-xs font-bold transition-colors ${color(c.sets)} ${
                isToday ? "ring-2 ring-inset ring-ink" : ""
              }`}
            >
              {c.date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Tooltip strip */}
      <p className="num mt-3 min-h-[20px] text-xs text-ink-2">
        {hover ? (
          <>
            <strong className="text-ink">
              {hover.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </strong>
            {" — "}
            {hover.workouts === 0 ? (
              <span className="text-ink-3">Rest day</span>
            ) : (
              <>
                <strong className="text-ink">{hover.workouts}</strong> workout
                {hover.workouts === 1 ? "" : "s"} · <strong className="text-ink">{hover.sets}</strong> set
                {hover.sets === 1 ? "" : "s"}
              </>
            )}
          </>
        ) : (
          <span className="text-ink-3">Tap a day for details</span>
        )}
      </p>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">
        <span className="mr-1">Less</span>
        <span className="h-3 w-3 border border-line-soft" />
        <span className="h-3 w-3 bg-blue/30" />
        <span className="h-3 w-3 bg-blue/55" />
        <span className="h-3 w-3 bg-blue/80" />
        <span className="h-3 w-3 bg-blue" />
        <span className="ml-1">More</span>
      </div>
    </section>
  );
}
