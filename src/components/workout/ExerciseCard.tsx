"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Link as LinkIcon, MessageSquareQuote, MoreHorizontal, Plus, Trash2, TrendingUp } from "lucide-react";
import type { Exercise, MuscleGroup, WorkoutSet } from "@/types/workout";
import type { Units } from "@/types/user";
import { findExercise } from "@/lib/data/exercises";
import { MUSCLE_LABELS } from "@/lib/analytics/muscle-groups";
import { beats } from "@/lib/analytics/personal-records";
import { displayWeight, roundToPlate } from "@/lib/units/converter";
import { Card } from "@/components/ui/Card";
import { ExerciseAutocomplete, type CustomExerciseLike } from "./ExerciseAutocomplete";
import { PlateCalculator } from "./PlateCalculator";
import { SetRow } from "./SetRow";

const MUSCLES: MuscleGroup[] = ["chest", "back", "shoulders", "biceps", "triceps", "forearms", "core", "quads", "hamstrings", "glutes", "calves", "cardio"];

interface Props {
  exercise: Exercise;
  units: Units;
  barbellKg: number;
  customExercises: CustomExerciseLike[];
  /** Top set from the last session of this exercise (progressive-overload hint). */
  last: { kg: number; reps: number } | null;
  /** Best set from earlier sessions, for PR detection. */
  prevBest: { kg: number; reps: number } | null;
  /** First exercise of its group: owns the reorder / superset controls. */
  leadsGroup: boolean;
  inSuperset: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onNameChange: (name: string) => void;
  onPick: (s: { name: string; muscles?: MuscleGroup[] }) => void;
  onUpdate: (patch: Partial<Exercise>) => void;
  onAddSet: () => void;
  onUpdateSet: (setId: string, patch: Partial<WorkoutSet>) => void;
  onRemoveSet: (setId: string) => void;
  onSetComplete: () => void;
  onMove: (direction: -1 | 1) => void;
  onSuperset: () => void;
  onRemove: () => void;
}

/** "82.5 kg × 5", or "12 reps" for bodyweight sets. */
export function formatSet(set: { kg: number; reps: number }, units: Units): string {
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

/**
 * One exercise in the logger. The set table is the focus; notes, machine
 * settings, plates and reorder/superset/remove sit behind "⋯". Once every set
 * is done the card folds to a single line (tap to reopen).
 */
export function ExerciseCard(props: Props) {
  const { exercise, units, last, prevBest } = props;
  const [toolsOpen, setToolsOpen] = useState(false);

  const done = exercise.sets.length > 0 && exercise.sets.every((s) => s.completed);
  // Fold a moment after the last set, so its check (and any PR burst) is seen first.
  const [foldReady, setFoldReady] = useState(done);
  const [reopened, setReopened] = useState(false);
  useEffect(() => {
    if (!done) {
      setFoldReady(false);
      setReopened(false);
      return;
    }
    const t = setTimeout(() => setFoldReady(true), 1300);
    return () => clearTimeout(t);
  }, [done]);
  const folded = done && foldReady && !reopened;

  // Plate calc target: next incomplete set, else the last set.
  const topSet = exercise.sets.find((s) => !s.completed) ?? exercise.sets[exercise.sets.length - 1];
  const custom = exercise.name.trim() !== "" && !findExercise(exercise.name);

  // PRs only count against earlier sessions; a first attempt isn't a record.
  const sessionBestExcept = (i: number) =>
    exercise.sets.reduce<{ kg: number; reps: number } | null>(
      (best, s, j) => (j !== i && s.completed && s.kg > 0 && beats(s, best) ? s : best),
      null,
    );
  const isNewBest = (s: { kg: number; reps: number }, i: number) => {
    if (!prevBest || s.kg <= 0 || s.reps <= 0) return false;
    const sessionBest = sessionBestExcept(i);
    return beats(s, sessionBest && beats(sessionBest, prevBest) ? sessionBest : prevBest);
  };

  if (folded) {
    const best = exercise.sets.reduce<WorkoutSet | null>((b, s) => (beats(s, b) ? s : b), null);
    return (
      <button
        type="button"
        onClick={() => setReopened(true)}
        className="card fade-in flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-elevated"
        aria-label={`${exercise.name}: done. Show sets`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-lime text-on-accent" aria-hidden="true">
          <Check className="h-5 w-5" strokeWidth={3} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{exercise.name || "Exercise"}</span>
          <span className="num block truncate text-xs text-ink-2">
            {exercise.sets.length} set{exercise.sets.length === 1 ? "" : "s"}
            {best && ` · top ${formatSet(best, units)}`}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" />
      </button>
    );
  }

  const smallBtn =
    "flex h-9 items-center gap-1.5 border border-line px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors hover:bg-elevated disabled:opacity-30";

  return (
    <Card>
      <div className="p-3 pb-2 sm:p-4 sm:pb-2">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1 pt-1">
            <ExerciseAutocomplete
              value={exercise.name}
              customExercises={props.customExercises}
              onChange={props.onNameChange}
              onPick={props.onPick}
            />
          </div>
          {done && (
            <button
              type="button"
              onClick={() => setReopened(false)}
              aria-label="Fold exercise"
              className="flex h-9 w-9 shrink-0 items-center justify-center text-ink-3 transition-colors hover:text-ink"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setToolsOpen((o) => !o)}
            aria-label="Exercise options"
            aria-expanded={toolsOpen}
            className={`flex h-9 w-9 shrink-0 items-center justify-center border transition-colors ${
              toolsOpen ? "border-ink bg-elevated text-ink" : "border-line text-ink-2 hover:text-ink"
            }`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Muscle picker — only when the name isn't recognised by the library */}
        {custom && (
          <div className="mt-3">
            <p className="label">Custom exercise — tag muscles</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MUSCLES.map((m) => {
                const selected = (exercise.muscles ?? []).includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      const cur = exercise.muscles ?? [];
                      props.onUpdate({ muscles: selected ? cur.filter((x) => x !== m) : [...cur, m] });
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

        {/* Form cues stay visible; they're edited under ⋯ */}
        {exercise.notes?.trim() && !toolsOpen && (
          <p className="mt-1 truncate text-xs italic text-ink-2">&ldquo;{exercise.notes}&rdquo;</p>
        )}

        {/* Last-session hint (progressive overload) */}
        {last && exercise.name && (
          <p className="num mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-ink-2">
            <TrendingUp className="h-3 w-3" />
            Last time: <strong className="text-ink">{formatSet(last, units)}</strong>
            <span className="font-semibold text-ok">· try {nextTarget(last, units)}</span>
          </p>
        )}

        {toolsOpen && (
          <div className="mt-3 space-y-3 border border-line-soft bg-elevated/40 p-3">
            <label className="flex items-center gap-2 border border-line-soft bg-field px-3 focus-within:border-ink focus-within:shadow-[3px_3px_0_rgb(var(--lime))]">
              <MessageSquareQuote className="h-4 w-4 shrink-0 text-ink-3" />
              <span className="sr-only">Notes</span>
              <input
                placeholder="Notes (form cues, tempo)"
                value={exercise.notes ?? ""}
                onChange={(e) => props.onUpdate({ notes: e.target.value })}
                maxLength={500}
                className="h-10 w-full bg-transparent text-base placeholder:text-ink-3 focus:outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="field compact min-w-0">
                <span>Seat / pad</span>
                <input
                  value={exercise.settings?.seat ?? ""}
                  onChange={(e) => props.onUpdate({ settings: { ...exercise.settings, seat: e.target.value } })}
                  placeholder="e.g. 5"
                  maxLength={20}
                />
              </label>
              <label className="field compact min-w-0">
                <span>Incline / angle</span>
                <input
                  value={exercise.settings?.incline ?? ""}
                  onChange={(e) => props.onUpdate({ settings: { ...exercise.settings, incline: e.target.value } })}
                  placeholder="e.g. 30°"
                  maxLength={20}
                />
              </label>
            </div>
            {topSet && topSet.kg > 0 && <PlateCalculator targetKg={topSet.kg} barbellKg={props.barbellKg} />}
            <div className="flex flex-wrap gap-2">
              {props.leadsGroup && (
                <>
                  <button type="button" onClick={() => props.onMove(-1)} disabled={!props.canMoveUp} className={smallBtn}>
                    <ChevronUp className="h-4 w-4" /> Up
                  </button>
                  <button type="button" onClick={() => props.onMove(1)} disabled={!props.canMoveDown} className={smallBtn}>
                    <ChevronDown className="h-4 w-4" /> Down
                  </button>
                </>
              )}
              {props.leadsGroup && !props.inSuperset && (
                <button type="button" onClick={props.onSuperset} className={`${smallBtn} text-warn`}>
                  <LinkIcon className="h-4 w-4" /> Superset
                </button>
              )}
              <button type="button" onClick={props.onRemove} className={`${smallBtn} text-over`}>
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[48px_1fr_1fr_24px] gap-1 border-y border-line-soft bg-elevated/60 px-3 py-1.5 text-center sm:px-4">
        <div className="label">Set</div>
        <div className="label">{units}</div>
        <div className="label">Reps</div>
        <div />
      </div>

      <div className="space-y-2 px-3 py-3 sm:px-4">
        {exercise.sets.map((set, idx) => (
          <SetRow
            key={set.id}
            index={idx}
            set={set}
            suggestion={last ?? undefined}
            canDelete={exercise.sets.length > 1}
            beatsBest={(values) => isNewBest(values, idx)}
            isPR={set.completed && !!prevBest && set.kg > 0 && beats(set, prevBest)}
            onChange={(patch) => props.onUpdateSet(set.id, patch)}
            onDelete={() => props.onRemoveSet(set.id)}
            onComplete={props.onSetComplete}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={props.onAddSet}
        className="flex h-11 w-full items-center justify-center gap-2 border-t border-dashed border-line-soft text-xs font-bold uppercase tracking-[0.1em] text-ink-2 transition-colors hover:bg-elevated hover:text-ink"
      >
        <Plus className="h-4 w-4" /> Add set
      </button>
    </Card>
  );
}
