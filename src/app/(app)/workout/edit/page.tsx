"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Dumbbell, Link as LinkIcon, Plus } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useToast } from "@/providers/ToastProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { useBarbellKg } from "@/hooks/useBarbellKg";
import { useCustomExercises } from "@/hooks/useCustomExercises";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { putWorkout } from "@/lib/firebase/repository";
import { workoutVolume } from "@/lib/analytics/volume";
import { findExercise } from "@/lib/data/exercises";
import {
  addToSuperset, appendSet, blankExercise, groupBySupersets, patchExercise, patchSet, removeExercise, removeSet,
} from "@/lib/workout/editing";
import { uid } from "@/lib/utils";
import type { Exercise, Workout } from "@/types/workout";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { ReorderSheet } from "@/components/workout/ReorderSheet";

export default function EditWorkoutPage() {
  return (
    <Suspense fallback={null}>
      <EditWorkoutInner />
    </Suspense>
  );
}

function EditWorkoutInner() {
  const params = useSearchParams();
  const { workouts, loading } = useWorkouts();
  const source = workouts.find((w) => w.id === params.get("id"));

  if (loading) {
    return (
      <div className="mx-auto max-w-[640px] space-y-5" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-16" />
        <Skeleton className="h-24" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (!source) {
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
  // Keyed so another workout (or a fresh load) starts a fresh edit.
  return <Editor key={source.id} source={source} />;
}

const dateInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Editor({ source }: { source: Workout }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { units } = useUnits();
  const { barbellKg } = useBarbellKg();
  const { exercises: customExercises } = useCustomExercises();
  const bodyweightKg = useLatestBodyweight();

  const initial = useMemo(
    () => ({
      name: source.name,
      date: dateInput(source.date),
      minutes: source.durationSec ? String(Math.round(source.durationSec / 60)) : "",
      notes: source.notes ?? "",
      exercises: source.exercises.map((e) => ({ ...e, id: e.id || uid(), sets: e.sets.map((s) => ({ ...s, id: s.id || uid(), completed: true })) })),
    }),
    [source],
  );
  const [form, setForm] = useState(initial);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const groups = groupBySupersets(form.exercises);
  const back = `/workout?id=${source.id}`;

  const editExercises = (fn: (list: Exercise[]) => Exercise[]) => setForm((f) => ({ ...f, exercises: fn(f.exercises) }));

  const save = async () => {
    if (!user) return;
    const exercises = form.exercises
      .filter((e) => e.name.trim() && e.sets.length > 0)
      .map((e) => ({ ...e, name: e.name.trim(), sets: e.sets.map((s) => ({ ...s, completed: true })) }));
    if (!form.name.trim()) return toast.error("Give the workout a name.");
    if (exercises.length === 0) return toast.error("Keep at least one named exercise with a set.");
    const [y, m, d] = form.date.split("-").map(Number);
    const date = new Date(source.date);
    if (y && m && d) date.setFullYear(y, m - 1, d); // keeps the original time of day
    const minutes = Number(form.minutes);
    setSaving(true);
    try {
      const status = await putWorkout(user.uid, {
        id: source.id,
        name: form.name.trim().slice(0, 80),
        date,
        exercises,
        totalVolume: workoutVolume({ exercises }, bodyweightKg),
        durationSec: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : undefined,
        notes: form.notes.trim() || undefined,
        programRef: source.programRef,
      });
      toast.success(status === "queued" ? "Saved on this device. It will sync when you're back online." : "Changes saved");
      router.push(back);
    } catch {
      toast.error("Couldn't save the changes. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[640px] space-y-5 pb-10">
      <header>
        <p className="label">Edit workout</p>
        <input
          value={form.name}
          onChange={(e) => {
            const name = e.target.value;
            setForm((f) => ({ ...f, name }));
          }}
          maxLength={80}
          aria-label="Workout name"
          className="mt-0.5 w-full border-b-2 border-transparent bg-transparent text-2xl font-extrabold tracking-tight placeholder:text-ink-3 focus:border-lime focus:outline-none lg:text-3xl"
          placeholder="Workout name"
        />
      </header>

      <div className="sticky top-[calc(3.5rem_+_1px_+_env(safe-area-inset-top))] z-10 -mx-5 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-5 py-2.5 backdrop-blur-sm lg:top-0 lg:mx-0 lg:px-0">
        <p className="text-xs font-semibold text-ink-2">{dirty ? "Unsaved changes" : "No changes yet"}</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => (dirty ? setLeaving(true) : router.push(back))}>
            Cancel
          </Button>
          <Button variant={dirty ? "lime" : "secondary"} size="sm" onClick={save} loading={saving} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2">
        <label className="field compact min-w-0">
          <span>Date</span>
          <input
            type="date"
            value={form.date}
            max={dateInput(new Date())}
            onChange={(e) => {
              const date = e.target.value;
              setForm((f) => ({ ...f, date }));
            }}
          />
        </label>
        <label className="field compact min-w-0">
          <span>Duration (min)</span>
          <input
            inputMode="numeric"
            value={form.minutes}
            onChange={(e) => {
              const minutes = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
              setForm((f) => ({ ...f, minutes }));
            }}
            placeholder="e.g. 60"
          />
        </label>
        <label className="field compact col-span-2 min-w-0">
          <span>Notes</span>
          <input
            value={form.notes}
            maxLength={2000}
            onChange={(e) => {
              const notes = e.target.value;
              setForm((f) => ({ ...f, notes }));
            }}
            placeholder="How it went"
          />
        </label>
      </section>

      <div className="space-y-4">
        {groups.map((group) => {
          const isSuper = group.length > 1;
          return (
            <div key={group[0]!.id} className={isSuper ? "space-y-3 border-l-[6px] border-l-[#ffb800] pl-3" : ""}>
              {isSuper && (
                <span
                  className="plunk face-yellow inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em]"
                  style={{ ["--d" as string]: "2px" }}
                >
                  <LinkIcon className="h-3 w-3" /> Superset
                </span>
              )}
              <div className="space-y-4">
                {group.map((exercise, ix) => (
                  <ExerciseCard
                    key={exercise.id}
                    mode="edit"
                    exercise={exercise}
                    units={units}
                    barbellKg={barbellKg}
                    customExercises={customExercises}
                    last={null}
                    prevBest={null}
                    leadsGroup={ix === 0}
                    inSuperset={isSuper}
                    onNameChange={(name) => editExercises((list) => patchExercise(list, exercise.id, { name }))}
                    onPick={(s) => {
                      if (s.muscles && s.muscles.length > 0 && !findExercise(s.name)) {
                        editExercises((list) => patchExercise(list, exercise.id, { muscles: s.muscles }));
                      }
                    }}
                    onUpdate={(patch) => editExercises((list) => patchExercise(list, exercise.id, patch))}
                    onAddSet={() => editExercises((list) => appendSet(list, exercise.id, true))}
                    onUpdateSet={(setId, patch) => editExercises((list) => patchSet(list, exercise.id, setId, patch))}
                    onRemoveSet={(setId) => editExercises((list) => removeSet(list, exercise.id, setId))}
                    onSetComplete={() => {}}
                    onReorder={groups.length > 1 ? () => setReorderOpen(true) : undefined}
                    onSuperset={() => editExercises((list) => addToSuperset(list, exercise.id, exercise.supersetId, true))}
                    onRemove={() => editExercises((list) => removeExercise(list, exercise.id))}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button onClick={() => editExercises((list) => [...list, blankExercise("", true)])} variant="secondary" size="lg" block>
          <Plus className="h-5 w-5" /> Add exercise
        </Button>
        {groups.length > 1 && (
          <button
            onClick={() => setReorderOpen(true)}
            className="flex min-h-[44px] items-center gap-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2 transition-colors hover:text-ink"
          >
            <ArrowUpDown className="h-3.5 w-3.5" /> Reorder
          </button>
        )}
      </div>

      <ReorderSheet open={reorderOpen} onClose={() => setReorderOpen(false)} exercises={form.exercises} onChange={(next) => editExercises(() => next)} />

      <Modal open={leaving} onClose={() => setLeaving(false)} title="Discard changes?">
        <div className="space-y-5 px-5 pb-5 pt-2">
          <p className="text-sm text-ink-2">Your edits to &ldquo;{source.name}&rdquo; won&apos;t be saved.</p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setLeaving(false)}>
              Keep editing
            </Button>
            <Button variant="danger" onClick={() => router.push(back)}>
              Discard
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
