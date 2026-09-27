"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, Trash2, Save, Calendar, Settings2, TrendingUp, MessageSquareQuote,
  Sparkles, Link as LinkIcon, ChevronUp, ChevronDown,
} from "lucide-react";
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
import { lastSessionFor } from "@/lib/analytics/personal-records";
import { findExercise } from "@/lib/data/exercises";
import { MUSCLE_LABELS } from "@/lib/analytics/muscle-groups";
import { uid } from "@/lib/utils";
import { displayWeight, roundToPlate } from "@/lib/units/converter";
import type { Units } from "@/types/user";
import type { Exercise, MuscleGroup, WorkoutSet } from "@/types/workout";
import type { ProgramRef } from "@/types/program";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Confirm } from "@/components/ui/Confirm";
import { SetRow } from "@/components/workout/SetRow";
import { ExerciseAutocomplete } from "@/components/workout/ExerciseAutocomplete";
import { PlateCalculator } from "@/components/workout/PlateCalculator";
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

  // ─── Mutators ──────────────────────────────────────────────────────
  const setExercises = (next: Exercise[]) => setDraft({ ...draft, exercises: next });

  const addExercise = () => setExercises([...draft.exercises, blankExercise()]);

  const addSuperset = (afterId: string, supersetId?: string | null) => {
    const sid = supersetId ?? uid();
    const next = draft.exercises.flatMap((ex) => {
      if (ex.id === afterId) {
        return [
          { ...ex, supersetId: sid },
          { ...blankExercise(), supersetId: sid },
        ];
      }
      return [ex];
    });
    setExercises(next);
  };

  const removeExercise = (id: string) =>
    setExercises(draft.exercises.filter((e) => e.id !== id));

  /** Move an entire group (single exercise OR full superset) up or down. */
  const moveGroup = (groupIndex: number, direction: -1 | 1) => {
    const grouped = groupBySupersets(draft.exercises);
    const target = groupIndex + direction;
    if (target < 0 || target >= grouped.length) return;
    const next = [...grouped];
    const temp = next[groupIndex]!;
    next[groupIndex] = next[target]!;
    next[target] = temp;
    setExercises(next.flat());
  };

  const updateExercise = (id: string, patch: Partial<Exercise>) =>
    setExercises(draft.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const addSet = (exId: string) =>
    setExercises(
      draft.exercises.map((e) =>
        e.id !== exId
          ? e
          : {
              ...e,
              sets: [
                ...e.sets,
                {
                  id: uid(),
                  kg: e.sets[e.sets.length - 1]?.kg ?? 0,
                  reps: e.sets[e.sets.length - 1]?.reps ?? 0,
                  completed: false,
                },
              ],
            },
      ),
    );

  const updateSet = (exId: string, setId: string, patch: Partial<WorkoutSet>) =>
    setExercises(
      draft.exercises.map((e) =>
        e.id !== exId
          ? e
          : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) },
      ),
    );

  const removeSet = (exId: string, setId: string) =>
    setExercises(
      draft.exercises.map((e) =>
        e.id !== exId ? e : { ...e, sets: e.sets.filter((s) => s.id !== setId) },
      ),
    );

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

  return (
    <div className="mx-auto max-w-[640px] space-y-6 pb-28">
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <label className="min-w-0 flex-1">
            <span className="label block">Session</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              maxLength={80}
              className="mt-0.5 w-full border-b-2 border-transparent bg-transparent text-2xl font-extrabold tracking-tight placeholder:text-ink-3 focus:border-lime focus:outline-none"
              placeholder="e.g. Leg Day"
            />
          </label>
          <button
            onClick={() => setAiOpen(true)}
            aria-label="Generate workout with AI"
            className="pop-btn violet h-11 min-h-0 w-11 shrink-0 px-0"
            style={{ ["--d" as string]: "3px" }}
          >
            <Sparkles className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-2">
          <Calendar className="h-3.5 w-3.5" />
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </p>
      </Card>

      {/* Exercise list */}
      <div className="space-y-5">
        {groups.map((group, gi) => {
          const isSuper = group.length > 1;
          return (
            <div key={gi} className={isSuper ? "space-y-3 border-l-[6px] border-l-[#ffb800] pl-3" : ""}>
              {isSuper && (
                <span
                  className="plunk face-yellow inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em]"
                  style={{ ["--d" as string]: "2px" }}
                >
                  <LinkIcon className="h-3 w-3" /> Superset
                </span>
              )}
              <div className="space-y-5">
                {group.map((exercise, ix) => {
                  const last = lastSessionFor(workouts, exercise.name);
                  // Plate calc target: next incomplete set, else the LAST set (so completing
                  // your final set doesn't snap the plates back to set 1).
                  const topSet =
                    exercise.sets.find((s) => !s.completed) ??
                    exercise.sets[exercise.sets.length - 1];
                  return (
                    <Card key={exercise.id}>
                      <div className="p-4 pb-3">
                        <ExerciseAutocomplete
                          value={exercise.name}
                          customExercises={customExercises}
                          onChange={(name) => {
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
                        />

                        {/* Muscle picker — only when the name isn't recognised by the library */}
                        {exercise.name.trim() && !findExercise(exercise.name) && (
                          <div className="mt-3">
                            <p className="label">Custom exercise — tag muscles</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {(["chest","back","shoulders","biceps","triceps","forearms","core","quads","hamstrings","glutes","calves","cardio"] as MuscleGroup[]).map((m) => {
                                const selected = (exercise.muscles ?? []).includes(m);
                                return (
                                  <button
                                    key={m}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => {
                                      const cur = exercise.muscles ?? [];
                                      const next = selected ? cur.filter((x) => x !== m) : [...cur, m];
                                      updateExercise(exercise.id, { muscles: next });
                                    }}
                                    className="chip min-h-8 px-2 text-[11px]"
                                  >
                                    {MUSCLE_LABELS[m]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Last-session hint (progressive overload) */}
                        {last && exercise.name && (
                          <p className="num mt-2 flex flex-wrap items-center gap-1 text-[11px] text-ink-2">
                            <TrendingUp className="h-3 w-3" />
                            Last time: <strong className="text-ink">{formatSet(last, units)}</strong>
                            <span className="font-semibold text-ok">· try {nextTarget(last, units)}</span>
                          </p>
                        )}

                        <label className="mt-3 flex items-center gap-2 border border-line-soft bg-field px-3 focus-within:border-ink focus-within:shadow-[3px_3px_0_rgb(var(--lime))]">
                          <MessageSquareQuote className="h-4 w-4 shrink-0 text-ink-3" />
                          <span className="sr-only">Notes</span>
                          <input
                            placeholder="Notes (form cues, tempo)"
                            value={exercise.notes ?? ""}
                            onChange={(e) => updateExercise(exercise.id, { notes: e.target.value })}
                            maxLength={500}
                            className="h-10 w-full bg-transparent text-base placeholder:text-ink-3 focus:outline-none"
                          />
                        </label>

                        <details className="group mt-3">
                          <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
                            <Settings2 className="h-3.5 w-3.5" />
                            <span>Machine settings</span>
                            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <label className="field compact min-w-0">
                              <span>Seat / pad</span>
                              <input
                                value={exercise.settings?.seat ?? ""}
                                onChange={(e) =>
                                  updateExercise(exercise.id, {
                                    settings: { ...exercise.settings, seat: e.target.value },
                                  })
                                }
                                placeholder="e.g. 5"
                                maxLength={20}
                              />
                            </label>
                            <label className="field compact min-w-0">
                              <span>Incline / angle</span>
                              <input
                                value={exercise.settings?.incline ?? ""}
                                onChange={(e) =>
                                  updateExercise(exercise.id, {
                                    settings: { ...exercise.settings, incline: e.target.value },
                                  })
                                }
                                placeholder="e.g. 30°"
                                maxLength={20}
                              />
                            </label>
                          </div>
                        </details>

                        {topSet && topSet.kg > 0 && (
                          <div className="mt-3">
                            <PlateCalculator targetKg={topSet.kg} barbellKg={barbellKg} />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-[28px_1fr_1fr_88px] gap-2 border-y border-line-soft bg-elevated/60 px-4 py-2 text-center">
                        <div className="label">#</div>
                        <div className="label">{units}</div>
                        <div className="label">Reps</div>
                        <div />
                      </div>

                      <div className="space-y-2 px-4 py-3">
                        {exercise.sets.map((set, idx) => (
                          <SetRow
                            key={set.id}
                            index={idx}
                            set={set}
                            suggestion={last ?? undefined}
                            canDelete={exercise.sets.length > 1}
                            onChange={(patch) => updateSet(exercise.id, set.id, patch)}
                            onDelete={() => removeSet(exercise.id, set.id)}
                            onComplete={() => {
                              if (timerEnabled) timer.start(exercise.restSec ?? 90);
                            }}
                          />
                        ))}
                      </div>

                      <button
                        onClick={() => addSet(exercise.id)}
                        className="flex h-11 w-full items-center justify-center gap-2 border-t border-dashed border-line-soft text-xs font-bold uppercase tracking-[0.1em] text-ink-2 transition-colors hover:bg-elevated hover:text-ink"
                      >
                        <Plus className="h-4 w-4" /> Add set
                      </button>

                      <div className="flex divide-x divide-line-soft border-t border-line-soft text-[11px] font-bold tracking-[0.08em]">
                        {ix === 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => moveGroup(gi, -1)}
                              disabled={gi === 0}
                              aria-label="Move up"
                              className="flex h-11 flex-1 items-center justify-center gap-1 uppercase text-ink-2 transition-colors hover:bg-elevated hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ChevronUp className="h-4 w-4" /> Up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveGroup(gi, 1)}
                              disabled={gi === groups.length - 1}
                              aria-label="Move down"
                              className="flex h-11 flex-1 items-center justify-center gap-1 uppercase text-ink-2 transition-colors hover:bg-elevated hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ChevronDown className="h-4 w-4" /> Down
                            </button>
                          </>
                        )}
                        {!isSuper && ix === 0 && (
                          <button
                            type="button"
                            onClick={() => addSuperset(exercise.id, exercise.supersetId ?? null)}
                            className="flex h-11 flex-1 items-center justify-center gap-1 uppercase text-warn transition-colors hover:bg-elevated"
                          >
                            <LinkIcon className="h-4 w-4" /> Superset
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeExercise(exercise.id)}
                          className="flex h-11 flex-1 items-center justify-center gap-1 uppercase text-over transition-colors hover:bg-elevated"
                        >
                          <Trash2 className="h-4 w-4" /> Remove
                        </button>
                      </div>
                    </Card>
                  );
                })}
                {isSuper && (
                  <button
                    onClick={() => {
                      const last = group[group.length - 1]!;
                      addSuperset(last.id, last.supersetId);
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

      <div className="flex flex-col gap-3 pt-2">
        <Button onClick={addExercise} variant="secondary" size="lg" block>
          <Plus className="h-5 w-5" /> Add exercise
        </Button>
        <Button onClick={finish} loading={saving} variant="lime" size="lg" block>
          <Save className="h-5 w-5" /> Finish workout
        </Button>
        <Confirm
          title="Discard draft?"
          message="This clears all unsaved sets for this session."
          confirmLabel="Discard"
          destructive
          onConfirm={() => {
            clearDraft();
            timer.cancel();
            setDraft({ name: "Evening Lift", exercises: [blankExercise()], startedAt: Date.now() });
          }}
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
        onApply={({ name, exercises }) => setDraft({ ...draft, name, exercises, startedAt: Date.now() })}
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

/** "82.5 kg × 5", or "12 reps" for bodyweight sets. */
function formatSet(set: { kg: number; reps: number }, units: Units): string {
  return set.kg > 0 ? `${displayWeight(set.kg, units, 1)} ${units} × ${set.reps}` : `${set.reps} reps`;
}

/**
 * Progressive-overload nudge: about 2.5% heavier, rounded to a loadable jump
 * (2.5 kg / 5 lb). When that rounds back to the same weight, add a rep instead.
 */
function nextTarget(last: { kg: number; reps: number }, units: Units): string {
  if (last.kg <= 0) return `${last.reps + 1} reps`;
  const next = roundToPlate(last.kg * 1.025, units);
  if (displayWeight(next, units, 1) > displayWeight(last.kg, units, 1)) return `${displayWeight(next, units, 1)} ${units}`;
  return formatSet({ kg: last.kg, reps: last.reps + 1 }, units);
}
