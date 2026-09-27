"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Dumbbell, TrendingUp, Trophy } from "lucide-react";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useUnits } from "@/providers/UnitsProvider";
import { findExercise } from "@/lib/data/exercises";
import { MUSCLE_LABELS } from "@/lib/analytics/muscle-groups";
import { estimate1RM } from "@/lib/analytics/onerm";
import { isWorkSet } from "@/lib/analytics/sets";
import { beats } from "@/lib/analytics/personal-records";
import { displayWeight, fromKg } from "@/lib/units/converter";
import type { MuscleGroup, WorkoutSet } from "@/types/workout";
import type { Units } from "@/types/user";
import { TrendChart } from "@/components/charts/TrendChart";
import { CountUp } from "@/components/ui/CountUp";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ExercisePage() {
  return (
    <Suspense fallback={null}>
      <ExercisePageInner />
    </Suspense>
  );
}

interface Session {
  workoutId: string;
  workoutName: string;
  date: Date;
  sets: WorkoutSet[];
  /** Best estimated 1RM from the session's working sets (kg). */
  e1rm: number;
  volume: number;
}

/** Rep counts shown in the "best at" table. */
const REP_MAXES = [1, 3, 5, 8, 10, 12];

const fmt = (kg: number, units: Units) => `${displayWeight(kg, units, 1)} ${units}`;

function ExercisePageInner() {
  const params = useSearchParams();
  const name = (params.get("name") ?? "").trim();
  const key = name.toLowerCase();
  const { workouts, loading } = useWorkouts();
  const { units } = useUnits();

  const sessions = useMemo<Session[]>(() => {
    const out: Session[] = [];
    for (const w of workouts) {
      const sets = w.exercises.filter((e) => e.name.trim().toLowerCase() === key).flatMap((e) => e.sets);
      if (sets.length === 0) continue;
      const work = sets.filter(isWorkSet);
      out.push({
        workoutId: w.id,
        workoutName: w.name,
        date: w.date,
        sets,
        e1rm: work.reduce((m, s) => Math.max(m, estimate1RM(s.kg, s.reps)), 0),
        volume: work.reduce((v, s) => v + s.kg * s.reps, 0),
      });
    }
    return out.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [workouts, key]);

  const records = useMemo(() => {
    const work = sessions.flatMap((s) => s.sets.filter(isWorkSet).map((set) => ({ set, date: s.date })));
    const heaviest = work.reduce<(typeof work)[number] | null>((b, x) => (x.set.kg > 0 && beats(x.set, b?.set) ? x : b), null);
    const bestE1rm = sessions.reduce<Session | null>((b, s) => (s.e1rm > (b?.e1rm ?? 0) ? s : b), null);
    const bestVolume = sessions.reduce<Session | null>((b, s) => (s.volume > (b?.volume ?? 0) ? s : b), null);
    const mostReps = work.reduce<(typeof work)[number] | null>((b, x) => (x.set.reps > (b?.set.reps ?? 0) ? x : b), null);
    // Heaviest weight lifted for at least N reps.
    const repMaxes = REP_MAXES.map((r) => {
      const best = work.filter((x) => x.set.reps >= r && x.set.kg > 0).reduce<(typeof work)[number] | null>((b, x) => (x.set.kg > (b?.set.kg ?? 0) ? x : b), null);
      return { reps: r, best };
    });
    return { heaviest, bestE1rm, bestVolume, mostReps, repMaxes };
  }, [sessions]);

  const trend = useMemo(
    () =>
      [...sessions]
        .reverse()
        .filter((s) => s.e1rm > 0)
        .map((s) => ({ date: s.date, v: fromKg(s.e1rm, units) })),
    [sessions, units],
  );

  const def = findExercise(name);
  const muscles: MuscleGroup[] = def ? [...def.primary, ...(def.secondary ?? [])] : [...new Set(workouts.flatMap((w) => w.exercises.filter((e) => e.name.trim().toLowerCase() === key).flatMap((e) => e.muscles ?? [])))];

  if (loading) {
    return (
      <div className="mx-auto max-w-[640px] space-y-5" aria-busy="true" aria-label="Loading">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-60" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!name || sessions.length === 0) {
    return (
      <div className="mx-auto max-w-[640px] space-y-5">
        <header>
          <p className="label">Exercise</p>
          <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">{name || "Exercise"}</h1>
        </header>
        <EmptyState
          icon={<Dumbbell className="h-6 w-6" />}
          title="No sessions yet"
          description={name ? `Log ${name} and its history, records and 1RM trend show up here.` : "Pick an exercise from a workout or the Stats page."}
          action={
            <Link href="/log" className="pop-btn lime">
              Start a workout
            </Link>
          }
        />
      </div>
    );
  }

  const { heaviest, bestE1rm, bestVolume, mostReps, repMaxes } = records;
  const first = trend[0]?.v ?? 0;
  const latest = trend[trend.length - 1]?.v ?? 0;

  return (
    <div className="stagger mx-auto max-w-[640px] space-y-5">
      <header style={{ ["--i" as string]: 0 }}>
        <p className="label">Exercise{def ? ` · ${def.equipment}` : ""}</p>
        <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">{def?.name ?? name}</h1>
        {muscles.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {muscles.map((m, i) => (
              <span key={m} className={`tag ${def && i < def.primary.length ? "solid bg-ink text-bg" : "border border-line text-ink-2"}`}>
                {MUSCLE_LABELS[m]}
              </span>
            ))}
          </p>
        )}
      </header>

      <section className="grid grid-cols-2 gap-2" style={{ ["--i" as string]: 1 }} aria-label="Records">
        <div className="plunk face-lime col-span-2 p-4" style={{ ["--d" as string]: "5px" }}>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">
            <Trophy className="h-3.5 w-3.5" /> Heaviest set
          </p>
          <p className="hero-num num mt-2 text-[56px]">
            {heaviest ? (
              <>
                <CountUp value={displayWeight(heaviest.set.kg, units, 1)} format={(n) => (Math.round(n * 10) / 10).toString()} />
                <span className="ml-1 text-2xl opacity-60">
                  {units} × {heaviest.set.reps}
                </span>
              </>
            ) : (
              "—"
            )}
          </p>
          {heaviest && (
            <p className="mt-1 text-xs font-semibold opacity-80">{heaviest.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
          )}
        </div>
        <Stat label="Best est. 1RM" value={bestE1rm ? fmt(bestE1rm.e1rm, units) : "—"} sub={bestE1rm?.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} />
        <Stat label="Most volume" value={bestVolume ? `${Math.round(fromKg(bestVolume.volume, units)).toLocaleString()} ${units}` : "—"} sub="in one session" />
        <Stat label="Sessions" value={String(sessions.length)} sub={`last ${sessions[0]!.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`} />
        <Stat label="Most reps" value={mostReps ? `${mostReps.set.reps}` : "—"} sub={mostReps ? (mostReps.set.kg > 0 ? `at ${fmt(mostReps.set.kg, units)}` : "bodyweight") : undefined} />
      </section>

      <section className="plunk face-card p-4" style={{ ["--d" as string]: "4px", ["--i" as string]: 2 }} aria-label="Estimated 1RM trend">
        <div className="flex items-baseline justify-between gap-2">
          <p className="label">Estimated 1RM</p>
          {trend.length > 1 && Math.abs(latest - first) >= 0.5 && (
            <p className={`num flex items-center gap-1 text-xs font-bold ${latest >= first ? "text-ok" : "text-over"}`}>
              <TrendingUp className="h-3.5 w-3.5" /> {latest >= first ? "+" : ""}
              {(latest - first).toFixed(0)} {units} since {trend[0]!.date.toLocaleDateString(undefined, { month: "short", year: "2-digit" })}
            </p>
          )}
        </div>
        <p className="num mb-3 mt-1 text-3xl font-extrabold tracking-tight">
          {latest ? Math.round(latest) : "—"}
          <span className="ml-1 text-sm font-semibold text-ink-3">{units} latest</span>
        </p>
        {trend.length >= 2 ? (
          <TrendChart data={trend} />
        ) : (
          <div className="flex h-32 items-center justify-center border border-dashed border-line-soft text-xs text-ink-3">
            Need at least 2 sessions with weight to draw a trend.
          </div>
        )}
      </section>

      <section className="card p-4" style={{ ["--i" as string]: 3 }} aria-label="Best weight by reps">
        <p className="label">Best weight for reps</p>
        <p className="text-xs text-ink-2">Heaviest working set with at least that many reps</p>
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {repMaxes.map(({ reps, best }) => (
            <div key={reps} className="border border-line-soft p-2 text-center">
              <p className="label !text-[10px]">{reps}RM</p>
              <p className="num text-sm font-extrabold">{best ? displayWeight(best.set.kg, units, 1) : "—"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3" style={{ ["--i" as string]: 4 }} aria-label="History">
        <p className="label">History</p>
        {sessions.map((s) => {
          let n = 0;
          return (
            <Link key={s.workoutId} href={`/workout?id=${s.workoutId}`} className="card block p-4 transition-colors hover:bg-elevated">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate font-bold">{s.workoutName}</p>
                <p className="num shrink-0 text-xs text-ink-3">{s.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.sets.map((set) => (
                  <span
                    key={set.id}
                    className={`num border px-2 py-1 text-xs ${set.warmup ? "border-warn/50 text-warn" : "border-line-soft"}`}
                  >
                    <span className="mr-1 text-[10px] font-bold text-ink-3">{set.warmup ? "W" : ++n}</span>
                    {set.kg > 0 ? displayWeight(set.kg, units, 1) : "BW"} × {set.reps}
                    {typeof set.rpe === "number" && <span className="ml-1 font-bold text-violet">@{set.rpe}</span>}
                  </span>
                ))}
              </div>
              {s.e1rm > 0 && <p className="num mt-2 text-[11px] text-ink-2">est. 1RM {fmt(s.e1rm, units)}</p>}
            </Link>
          );
        })}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3">
      <p className="label">{label}</p>
      <p className="num mt-1 text-xl font-extrabold tracking-tight">{value}</p>
      {sub && <p className="num text-xs text-ink-3">{sub}</p>}
    </div>
  );
}
