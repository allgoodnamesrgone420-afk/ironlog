"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link as LinkIcon, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useDraft } from "@/hooks/useDraft";
import { useToast } from "@/providers/ToastProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { saveWorkout, advanceProgramCursor } from "@/lib/firebase/repository";
import { useCustomExercises } from "@/hooks/useCustomExercises";
import { usePrograms } from "@/hooks/usePrograms";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { resolveDay, nextCursor, clampCursor } from "@/lib/programs/resolve";
import { workoutVolume } from "@/lib/analytics/volume";
import { bestSetFor, lastSessionFor } from "@/lib/analytics/personal-records";
import { findExercise } from "@/lib/data/exercises";
import { uid } from "@/lib/utils";
import type { Exercise, WorkoutSet } from "@/types/workout";
import type { ProgramRef } from "@/types/program";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { SessionBar } from "@/components/workout/SessionBar";
import { useTimer } from "@/providers/TimerProvider";
import { useRestTimerEnabled } from "@/hooks/useRestTimerEnabled";
import { useBarbellKg } from "@/hooks/useBarbellKg";
import { RestTimer } from "@/components/workout/RestTimer";
import { AIGenerateModal } from "@/components/workout/AIGenerateModal";

interface Draft {
  name: string;
  exercises: Exercise[];
  startedAt: number;
  /** Set when this session was started from a program day. */
  programRef?: ProgramRef;
}

function blankExercise(name = ""): Exercise {
  return {
    id: uid(),
    name,
    notes: "",
    restSec: 90,
    sets: [{ id: uid(), kg: 0, reps: 0, completed: false }],
  };
}

/** A draft opened this long ago with no set done yet restarts its clock. */
const STALE_DRAFT_MS = 3 * 60 * 60 * 1000;

const hasCompletedSet = (exercises: Exercise[]) => exercises.some((e) => e.sets.some((s) => s.completed));

// useSearchParams() must sit under a Suspense boundary for the static export
// (and for streaming SSR on web). Keep the page logic in an inner component.
export default function LogPage() {
  return (
    <Suspense fallback={null}>
      <LogPageInner />
    </Suspense>
  );
}

function LogPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { units } = useUnits();
  const { barbellKg } = useBarbellKg();
  const { workouts } = useWorkouts();
  const { exercises: customExercises, upsert: upsertCustomExercise } = useCustomExercises();
  const { programs } = usePrograms();
  const bodyweightKg = useLatestBodyweight();

  const [draft, setDraft, clearDraft] = useDraft<Draft>(user?.uid, "draft", {
    name: "Evening Lift",
    exercises: [blankExercise("Barbell Bench Press")],
    startedAt: Date.now(),
  });

  const [aiOpen, setAiOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useTimer();
  const { enabled: timerEnabled } = useRestTimerEnabled();

  // Handle ?repeat=workoutId pre-fill
  useEffect(() => {
    const repeatId = params.get("repeat");
    if (!repeatId) return;
    const source = workouts.find((w) => w.id === repeatId);
    if (!source) return;
    setDraft({
      name: source.name,
      startedAt: Date.now(),
      exercises: source.exercises.map((ex) => ({
        ...ex,
        id: uid(),
        sets: ex.sets.map((s) => ({ ...s, id: uid(), completed: false })),
      })),
    });
    router.replace("/log");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, workouts.length]);

  // Handle ?program=programId pre-fill — resolves the program's current cursor day.
  useEffect(() => {
    const programId = params.get("program");
    if (!programId) return;
    const program = programs.find((p) => p.id === programId);
    if (!program) return;
    const resolved = resolveDay(program);
    if (!resolved) return;
    const c = clampCursor(program, program.cursor);
    setDraft({
      name: resolved.name,
      startedAt: Date.now(),
      exercises: resolved.exercises,
      programRef: {
        id: program.id,
        programName: program.name,
        week: c.week,
        day: c.day,
        dayLabel: program.weeks[c.week]?.days[c.day]?.label ?? "Day",
      },
    });
    router.replace("/log");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, programs.length]);

  const groups = useMemo(() => groupBySupersets(draft.exercises), [draft.exercises]);

  // A draft opened long ago and never started (no set done) gets a fresh clock,
  // so the header doesn't count the hours it sat unused.
  const started = hasCompletedSet(draft.exercises);
  useEffect(() => {
    if (!started && Date.now() - draft.startedAt > STALE_DRAFT_MS) setDraft((d) => ({ ...d, startedAt: Date.now() }));
  }, [started, draft.startedAt, setDraft]);

  const setsTotal = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
  const setsDone = draft.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
  const volumeDone = useMemo(
    () =>
      workoutVolume(
        { exercises: draft.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.completed) })) },
        bodyweightKg,
      ),
    [draft.exercises, bodyweightKg],
  );

  // ─── Mutators ──────────────────────────────────────────────────────
  // Functional updates: one gesture can make two edits (picking a suggestion
  // sets the name, then its muscles), and each must see the other's result.
  const editExercises = (fn: (list: Exercise[]) => Exercise[]) =>
    setDraft((d) => ({ ...d, exercises: fn(d.exercises) }));

  const addExercise = () => editExercises((list) => [...list, blankExercise()]);

  const addSuperset = (afterId: string, supersetId?: string | null) => {
    const sid = supersetId ?? uid();
    editExercises((list) =>
      list.flatMap((ex) => (ex.id === afterId ? [{ ...ex, supersetId: sid }, { ...blankExercise(), supersetId: sid }] : [ex])),
    );
  };

  const removeExercise = (id: string) => editExercises((list) => list.filter((e) => e.id !== id));

  /** Move an entire group (single exercise OR full superset) up or down. */
  const moveGroup = (groupIndex: number, direction: -1 | 1) =>
    editExercises((list) => {
      const grouped = groupBySupersets(list);
      const target = groupIndex + direction;
      if (target < 0 || target >= grouped.length) return list;
      [grouped[groupIndex], grouped[target]] = [grouped[target]!, grouped[groupIndex]!];
      return grouped.flat();
    });

  const updateExercise = (id: string, patch: Partial<Exercise>) =>
    editExercises((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const addSet = (exId: string) =>
    editExercises((list) =>
      list.map((e) => {
        if (e.id !== exId) return e;
        const prev = e.sets[e.sets.length - 1];
        return { ...e, sets: [...e.sets, { id: uid(), kg: prev?.kg ?? 0, reps: prev?.reps ?? 0, completed: false }] };
      }),
    );

  const updateSet = (exId: string, setId: string, patch: Partial<WorkoutSet>) =>
    setDraft((d) => {
      const exercises = d.exercises.map((e) =>
        e.id !== exId ? e : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) },
      );
      // First set of a draft that sat open for hours: the session starts now.
      const restart = patch.completed && !hasCompletedSet(d.exercises) && Date.now() - d.startedAt > STALE_DRAFT_MS;
      return { ...d, exercises, startedAt: restart ? Date.now() : d.startedAt };
    });

  const removeSet = (exId: string, setId: string) =>
    editExercises((list) => list.map((e) => (e.id !== exId ? e : { ...e, sets: e.sets.filter((s) => s.id !== setId) })));

  // ─── Finish workout ────────────────────────────────────────────────
  const finish = async () => {
    if (!user) return;
    const valid = draft.exercises
      .filter((e) => e.name.trim() && e.sets.some((s) => s.completed))
      .map((e) => ({
        ...e,
        sets: e.sets.filter((s) => s.completed && s.kg >= 0 && s.reps >= 0),
      }));
    if (valid.length === 0) {
      toast.error("Nothing to save — mark at least one set as completed.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveWorkout(user.uid, {
        name: draft.name.trim() || "Workout",
        exercises: valid,
        totalVolume: workoutVolume({ exercises: valid }, bodyweightKg),
        durationSec: Math.round((Date.now() - draft.startedAt) / 1000),
        programRef: draft.programRef,
      });

      // If this session came from a program, advance its cursor to the next day.
      if (draft.programRef) {
        const program = programs.find((p) => p.id === draft.programRef!.id);
        if (program) {
          try {
            await advanceProgramCursor(
              user.uid,
              program.id,
              nextCursor(program, { week: draft.programRef.week, day: draft.programRef.day }),
            );
          } catch {
            // Non-fatal: the workout is already saved.
          }
        }
      }

      // Save any custom exercises (with muscle tags) to the user's local library
      // so they appear in autocomplete next time. Local-only — no network, no rules.
      const seen = new Set<string>();
      for (const e of valid) {
        if (findExercise(e.name)) continue; // library hit, skip
        if (!e.muscles || e.muscles.length === 0) continue;
        const k = e.name.trim().toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        upsertCustomExercise(e.name, e.muscles);
      }

      clearDraft();
      timer.cancel();
      toast.success(saved === "queued" ? "Workout saved. It will sync when you're back online." : "Workout saved");
      router.push("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const resetDraft = () => {
    clearDraft();
    timer.cancel();
    setDraft({ name: "Evening Lift", exercises: [blankExercise()], startedAt: Date.now() });
  };

  return (
    <div className="mx-auto max-w-[640px] space-y-5 pb-28">
      <header className="flex items-end gap-3">
        <label className="min-w-0 flex-1">
          <span className="label block">
            Session · {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <input
            value={draft.name}
            onChange={(e) => {
              const name = e.target.value;
              setDraft((d) => ({ ...d, name }));
            }}
            maxLength={80}
            aria-label="Session name"
            className="mt-0.5 w-full border-b-2 border-transparent bg-transparent text-2xl font-extrabold tracking-tight placeholder:text-ink-3 focus:border-lime focus:outline-none lg:text-3xl"
            placeholder="e.g. Leg Day"
          />
        </label>
        <button
          onClick={() => setAiOpen(true)}
          aria-label="Generate workout with AI"
          className="pop-btn violet mb-1 h-11 min-h-0 w-11 shrink-0 px-0"
          style={{ ["--d" as string]: "3px" }}
        >
          <Sparkles className="h-5 w-5" />
        </button>
      </header>

      <SessionBar
        startedAt={draft.startedAt}
        setsDone={setsDone}
        setsTotal={setsTotal}
        volumeKg={volumeDone}
        units={units}
        saving={saving}
        onFinish={finish}
      />

      {/* Exercise list */}
      <div className="space-y-4">
        {groups.map((group, gi) => {
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
                    exercise={exercise}
                    units={units}
                    barbellKg={barbellKg}
                    customExercises={customExercises}
                    last={lastSessionFor(workouts, exercise.name)}
                    prevBest={bestSetFor(workouts, exercise.name)}
                    leadsGroup={ix === 0}
                    inSuperset={isSuper}
                    canMoveUp={gi > 0}
                    canMoveDown={gi < groups.length - 1}
                    onNameChange={(name) => {
                      const patch: Partial<Exercise> = { name };
                      if (!exercise.notes?.trim() && name.trim()) {
                        const pastNote = findPastNote(workouts, name);
                        if (pastNote) patch.notes = pastNote;
                      }
                      updateExercise(exercise.id, patch);
                    }}
                    onPick={(s) => {
                      // When picking a custom exercise, auto-fill its saved muscle tags.
                      if (s.muscles && s.muscles.length > 0 && !findExercise(s.name)) {
                        updateExercise(exercise.id, { muscles: s.muscles });
                      }
                    }}
                    onUpdate={(patch) => updateExercise(exercise.id, patch)}
                    onAddSet={() => addSet(exercise.id)}
                    onUpdateSet={(setId, patch) => updateSet(exercise.id, setId, patch)}
                    onRemoveSet={(setId) => removeSet(exercise.id, setId)}
                    onSetComplete={() => {
                      if (timerEnabled) timer.start(exercise.restSec ?? 90);
                    }}
                    onMove={(direction) => moveGroup(gi, direction)}
                    onSuperset={() => addSuperset(exercise.id, exercise.supersetId ?? null)}
                    onRemove={() => removeExercise(exercise.id)}
                  />
                ))}
                {isSuper && (
                  <button
                    onClick={() => {
                      const tail = group[group.length - 1]!;
                      addSuperset(tail.id, tail.supersetId);
                    }}
                    className="flex h-11 w-full items-center justify-center gap-2 border border-dashed border-warn/70 text-xs font-bold uppercase tracking-[0.1em] text-warn transition-colors hover:bg-warn/10"
                  >
                    <Plus className="h-4 w-4" /> Add to superset
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 pt-1">
        <Button onClick={addExercise} variant="secondary" size="lg" block>
          <Plus className="h-5 w-5" /> Add exercise
        </Button>
        <Confirm
          title="Discard draft?"
          message="This clears all unsaved sets for this session."
          confirmLabel="Discard"
          destructive
          onConfirm={resetDraft}
          trigger={(open) => (
            <button
              onClick={open}
              className="mx-auto min-h-[44px] px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3 transition-colors hover:text-over"
            >
              Discard draft
            </button>
          )}
        />
      </div>

      <AIGenerateModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        recent={workouts}
        onApply={({ name, exercises }) => setDraft((d) => ({ ...d, name, exercises, startedAt: Date.now() }))}
      />

      {/* Timer UI is page-scoped (only visible here). State lives globally in
          TimerProvider so it keeps ticking when you navigate away. */}
      <RestTimer />
    </div>
  );
}

function groupBySupersets(exercises: Exercise[]): Exercise[][] {
  const groups: Exercise[][] = [];
  let current: Exercise[] = [];
  exercises.forEach((ex, i) => {
    const prev = exercises[i - 1];
    if (i === 0) current.push(ex);
    else if (ex.supersetId && prev && prev.supersetId === ex.supersetId) current.push(ex);
    else {
      groups.push(current);
      current = [ex];
    }
  });
  if (current.length) groups.push(current);
  return groups;
}

/** Finds the most recent non-empty notes for an exercise name across past workouts. */
function findPastNote(workouts: { date: Date; exercises: Exercise[] }[], name: string): string | undefined {
  const target = name.trim().toLowerCase();
  if (!target) return undefined;
  const sorted = [...workouts].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const w of sorted) {
    for (const ex of w.exercises) {
      if (ex.name.trim().toLowerCase() === target && ex.notes?.trim()) {
        return ex.notes;
      }
    }
  }
  return undefined;
}
