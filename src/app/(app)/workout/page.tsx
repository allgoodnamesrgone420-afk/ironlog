"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Dumbbell, Home, Pencil, Repeat, Share2, Trash2, Trophy } from "lucide-react";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useUnits } from "@/providers/UnitsProvider";
import { useToast } from "@/providers/ToastProvider";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { useDeleteWorkout } from "@/hooks/useDeleteWorkout";
import { workoutSetCount, workoutVolume } from "@/lib/analytics/volume";
import { prsInWorkout } from "@/lib/analytics/personal-records";
import { MUSCLE_LABELS, muscleSetsThisWeek } from "@/lib/analytics/muscle-groups";
import { displayWeight, fromKg } from "@/lib/units/converter";
import { renderWorkoutCard, shareImage } from "@/lib/share-card";
import { formatDuration } from "@/lib/utils";
import type { MuscleGroup, Workout } from "@/types/workout";
import type { Units } from "@/types/user";
import { Button } from "@/components/ui/Button";
import { CountUp } from "@/components/ui/CountUp";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";

export default function WorkoutPage() {
  return (
    <Suspense fallback={null}>
      <WorkoutPageInner />
    </Suspense>
  );
}

const fmtSet = (s: { kg: number; reps: number }, units: Units) =>
  s.kg > 0 ? `${displayWeight(s.kg, units, 1)} ${units} × ${s.reps}` : `${s.reps} reps`;

function WorkoutSkeleton() {
  return (
    <div className="mx-auto max-w-[640px] space-y-5" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-[170px]" />
      <Skeleton className="h-11" />
      <Skeleton className="h-40" />
      <Skeleton className="h-64" />
    </div>
  );
}

function WorkoutPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const done = params.get("done") === "1";
  const { workouts, loading } = useWorkouts();
  const workout = workouts.find((w) => w.id === id);

  if (loading) return <WorkoutSkeleton />;
  if (!workout) {
    return (
      <div className="mx-auto max-w-[640px]">
        <EmptyState
          icon={<Dumbbell className="h-6 w-6" />}
          title="Workout not found"
          description="It may have been deleted."
          action={
            <Link href="/history" className="pop-btn">
              Back to history
            </Link>
          }
        />
      </div>
    );
  }
  return <Summary workout={workout} workouts={workouts} done={done} onDeleted={() => router.replace("/history")} />;
}

function Summary({ workout, workouts, done, onDeleted }: { workout: Workout; workouts: Workout[]; done: boolean; onDeleted: () => void }) {
  const { units } = useUnits();
  const toast = useToast();
  const bodyweightKg = useLatestBodyweight();
  const del = useDeleteWorkout();
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [rendering, setRendering] = useState(false);

  const volume = fromKg(workoutVolume(workout, bodyweightKg), units);
  const sets = workoutSetCount(workout);
  const prs = useMemo(() => prsInWorkout(workouts, workout), [workouts, workout]);
  const muscles = useMemo(() => {
    const totals = muscleSetsThisWeek([workout]);
    return (Object.entries(totals) as [MuscleGroup, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  }, [workout]);
  // Same session last time, for a volume comparison.
  const previous = useMemo(
    () =>
      workouts
        .filter((w) => w.id !== workout.id && w.date < workout.date && w.name.trim().toLowerCase() === workout.name.trim().toLowerCase())
        .sort((a, b) => b.date.getTime() - a.date.getTime())[0],
    [workouts, workout],
  );
  const prevVolume = previous ? fromKg(workoutVolume(previous, bodyweightKg), units) : 0;
  const change = prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null;
  const maxMuscle = muscles[0]?.[1] ?? 1;

  const openCard = async () => {
    setRendering(true);
    try {
      const blob = await renderWorkoutCard({
        title: workout.name,
        date: workout.date,
        stats: [
          { label: "Time", value: formatDuration(workout.durationSec) },
          { label: `Volume · ${units}`, value: Math.round(volume).toLocaleString() },
          { label: "Sets", value: String(sets) },
        ],
        muscles: muscles.slice(0, 6).map(([m]) => MUSCLE_LABELS[m]),
        prs: prs.map((p) => `${p.name} · ${fmtSet(p, units)}`),
        exercises: workout.exercises.map((ex) => {
          const work = ex.sets.filter((s) => !s.warmup);
          const top = work.reduce<{ kg: number; reps: number } | null>((b, s) => (!b || s.kg > b.kg ? s : b), null);
          return { name: ex.name, detail: `${work.length} × ${top ? fmtSet(top, units) : "—"}` };
        }),
      });
      setCard({ blob, url: URL.createObjectURL(blob) });
    } catch {
      toast.error("Couldn't make the card on this device.");
    } finally {
      setRendering(false);
    }
  };

  const closeCard = () => {
    if (card) URL.revokeObjectURL(card.url);
    setCard(null);
  };

  const share = async () => {
    if (!card) return;
    const result = await shareImage(card.blob, `ironlog-${workout.date.toISOString().slice(0, 10)}.png`, workout.name);
    if (result === "downloaded") toast.success("Image saved");
    if (result !== "cancelled") closeCard();
  };

  return (
    <div className="stagger mx-auto max-w-[640px] space-y-5">
      <header style={{ ["--i" as string]: 0 }}>
        <p className={`label ${done ? "text-ok" : ""}`}>
          {done ? "Workout complete" : workout.date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">{workout.name}</h1>
        {done && (
          <p className="text-sm text-ink-2">
            {workout.date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>
        )}
      </header>

      <section className="plunk face-lime p-5" style={{ ["--d" as string]: "6px", ["--i" as string]: 1 }}>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">Time</p>
            <p className="num mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{formatDuration(workout.durationSec)}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">Volume · {units}</p>
            <p className="num mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              <CountUp value={Math.round(volume)} />
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">Sets</p>
            <p className="num mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              <CountUp value={sets} />
            </p>
          </div>
        </div>
        <p className="num mt-4 text-sm font-semibold opacity-80">
          {workout.exercises.length} exercise{workout.exercises.length === 1 ? "" : "s"}
          {change !== null && ` · volume ${change >= 0 ? "+" : ""}${change}% vs last ${previous!.name}`}
        </p>
      </section>

      <div className="flex flex-wrap gap-2" style={{ ["--i" as string]: 2 }}>
        <Button variant="lime" onClick={openCard} loading={rendering}>
          <Share2 className="h-4 w-4" /> Share card
        </Button>
        {done ? (
          <Link href="/dashboard" className="pop-btn ghost">
            <Home className="h-4 w-4" /> Done
          </Link>
        ) : (
          <>
            <Link href={`/workout/edit?id=${workout.id}`} className="pop-btn ghost">
              <Pencil className="h-4 w-4" /> Edit
            </Link>
            <Link href={`/log?repeat=${workout.id}`} className="pop-btn ghost">
              <Repeat className="h-4 w-4" /> Repeat
            </Link>
          </>
        )}
      </div>

      {prs.length > 0 && (
        <section className="card border-l-[6px] border-l-[#ffb800] p-4" style={{ ["--i" as string]: 3 }} aria-label="New records">
          <p className="label flex items-center gap-1.5 text-warn">
            <Trophy className="h-3.5 w-3.5" /> {prs.length === 1 ? "New record" : `${prs.length} new records`}
          </p>
          <ul className="mt-2 space-y-2">
            {prs.map((p) => (
              <li key={p.name} className="flex items-baseline justify-between gap-3">
                <Link href={`/exercise?name=${encodeURIComponent(p.name)}`} className="min-w-0 truncate font-bold hover:underline">
                  {p.name}
                </Link>
                <span className="num shrink-0 text-right text-sm">
                  <strong>{fmtSet(p, units)}</strong>
                  <span className="block text-xs text-ink-3">was {fmtSet(p.prev, units)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {muscles.length > 0 && (
        <section className="plunk face-card p-4" style={{ ["--d" as string]: "4px", ["--i" as string]: 4 }} aria-label="Muscles hit">
          <p className="label">Muscles hit</p>
          <p className="text-xs text-ink-2">Working sets (a secondary muscle counts half)</p>
          <ul className="mt-3 space-y-2.5">
            {muscles.map(([m, n], i) => (
              <li key={m}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{MUSCLE_LABELS[m]}</span>
                  <span className="num text-xs font-bold">{Math.round(n * 10) / 10}</span>
                </div>
                <div className="mt-1 h-2 bg-elevated">
                  <div className="grow-x h-full bg-ink" style={{ width: `${(n / maxMuscle) * 100}%`, ["--delay" as string]: `${i * 50}ms` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3" style={{ ["--i" as string]: 5 }} aria-label="Exercises">
        <p className="label">Exercises</p>
        {workout.exercises.map((ex) => {
          let n = 0;
          return (
            <div key={ex.id} className="card p-4">
              <Link href={`/exercise?name=${encodeURIComponent(ex.name)}`} className="font-bold hover:underline">
                {ex.name}
              </Link>
              {ex.notes && <p className="mt-0.5 text-xs italic text-ink-2">&ldquo;{ex.notes}&rdquo;</p>}
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {ex.sets.map((s) => (
                  <div key={s.id} className={`border p-2 text-center ${s.warmup ? "border-warn/50 bg-warn/5" : "border-line-soft bg-surface"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${s.warmup ? "text-warn" : "text-ink-3"}`}>
                      {s.warmup ? "Warm-up" : `Set ${++n}`}
                    </p>
                    <p className="num text-sm">
                      <span className="font-bold">{s.kg > 0 ? displayWeight(s.kg, units, 1) : "BW"}</span> × {s.reps}
                    </p>
                    {typeof s.rpe === "number" && <p className="num text-[10px] font-bold text-violet">RPE {s.rpe}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {!done && (
        <div className="flex justify-center pb-4">
          <button
            onClick={async () => {
              if (await del(workout)) onDeleted();
            }}
            className="flex min-h-[44px] items-center gap-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3 transition-colors hover:text-over"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete workout
          </button>
        </div>
      )}

      <Modal open={card !== null} onClose={closeCard} title="Share your workout">
        <div className="space-y-4 px-5 pb-5 pt-2">
          {card && (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a remote image
            <img src={card.url} alt={`Summary card for ${workout.name}`} className="mx-auto max-h-[56dvh] w-auto border border-line" />
          )}
          <Button variant="lime" block onClick={share}>
            <Share2 className="h-4 w-4" /> Share or save
          </Button>
        </div>
      </Modal>
    </div>
  );
}
