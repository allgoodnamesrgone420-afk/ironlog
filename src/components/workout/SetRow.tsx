"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import type { WorkoutSet } from "@/types/workout";
import { useUnits } from "@/providers/UnitsProvider";
import { displayWeight, fromKg, toKg } from "@/lib/units/converter";

interface Props {
  index: number;
  set: WorkoutSet;
  suggestion?: { kg: number; reps: number };
  canDelete: boolean;
  /** Whether these numbers would beat the lifter's best (completing them shows the NEW PR burst). */
  beatsBest: (values: { kg: number; reps: number }) => boolean;
  /** This completed set beats the best from earlier sessions (keeps a PR badge). */
  isPR: boolean;
  onChange: (patch: Partial<WorkoutSet>) => void;
  onDelete: () => void;
  onComplete: () => void;
}

/**
 * Input that keeps its own text state so the user can type intermediate values
 * like "20." or "0.5" without the canonical numeric state stomping them.
 */
function NumberField({
  externalValue,
  onValue,
  decimal,
  placeholder,
  className,
  label,
}: {
  externalValue: number;
  onValue: (n: number) => void;
  decimal: boolean;
  placeholder?: string;
  className?: string;
  label: string;
}) {
  // Round for display: pounds are stored as kg, so 31 lb comes back as 30.999999999999996.
  const formatExternal = (v: number) => (v > 0 ? String(Math.round(v * 100) / 100) : "");
  const [text, setText] = useState<string>(formatExternal(externalValue));
  const lastEmittedRef = useRef<number>(externalValue);

  // Sync from external changes (steppers, suggestion fill, unit switch).
  // Skip when the external value matches what the user's text would parse to —
  // that means we're seeing our own emit echo back (allowing for kg↔lb float noise).
  useEffect(() => {
    if (Math.abs(externalValue - lastEmittedRef.current) < 1e-6) return;
    setText(formatExternal(externalValue));
    lastEmittedRef.current = externalValue;
  }, [externalValue]);

  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={text}
      placeholder={placeholder}
      aria-label={label}
      className={className}
      onChange={(e) => {
        let next = e.target.value;
        // Accept "," as decimal separator
        if (decimal) next = next.replace(",", ".");
        // Strip obvious junk; allow digits, single dot, leading nothing
        if (decimal) next = next.replace(/[^0-9.]/g, "");
        else next = next.replace(/[^0-9]/g, "");
        // Collapse multiple dots — keep only the first
        if (decimal) {
          const parts = next.split(".");
          if (parts.length > 2) next = parts[0] + "." + parts.slice(1).join("");
        }
        setText(next);
        const parsed = parseFloat(next);
        const out = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        lastEmittedRef.current = out;
        onValue(out);
      }}
    />
  );
}

/** Boxed number input with −/+ buttons either side. */
function Stepper({
  label,
  onStep,
  children,
}: {
  label: string;
  onStep: (direction: -1 | 1) => void;
  children: React.ReactNode;
}) {
  const btn = "flex w-8 shrink-0 items-center justify-center text-ink-2 transition-colors hover:text-ink active:bg-elevated";
  return (
    <div className="flex h-12 min-w-0 items-stretch border border-line bg-field focus-within:border-ink focus-within:shadow-[3px_3px_0_rgb(var(--lime))]">
      <button type="button" className={btn} onClick={() => onStep(-1)} aria-label={`Less ${label}`}>
        <Minus className="h-4 w-4" />
      </button>
      {children}
      <button type="button" className={btn} onClick={() => onStep(1)} aria-label={`More ${label}`}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

// Fixed directions (deg) and colours for the burst's sparks.
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => ({
  x: Math.round(Math.cos((deg * Math.PI) / 180) * 46),
  y: Math.round(Math.sin((deg * Math.PI) / 180) * 30) - 14,
  color: ["rgb(var(--lime))", "#ffb800", "rgb(var(--violet))", "rgb(var(--pink))"][i % 4],
}));

export function SetRow({ index, set, suggestion, canDelete, beatsBest, isPR, onChange, onDelete, onComplete }: Props) {
  const { units } = useUnits();
  // Grey hints: last time's top set, per empty box.
  const hint = set.completed ? undefined : suggestion;
  const [burst, setBurst] = useState(0);
  const [popped, setPopped] = useState(0);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(0), 1400);
    return () => clearTimeout(t);
  }, [burst]);

  // Display value for kg is in the user's chosen unit
  const displayKg = fromKg(set.kg, units);
  const weightStep = units === "kg" ? 2.5 : 5;

  const stepWeight = (dir: -1 | 1) => {
    // An empty box starts from last session's weight (shown as the placeholder).
    const base = set.kg > 0 ? displayWeight(set.kg, units) : suggestion ? displayWeight(suggestion.kg, units) : 0;
    // Land on the plate grid: 53.75 goes to 55 or 52.5, not 56.25.
    const steps = base / weightStep;
    const next = (dir > 0 ? Math.floor(steps + 1e-6) + 1 : Math.ceil(steps - 1e-6) - 1) * weightStep;
    onChange({ kg: toKg(Math.max(0, next), units) });
  };
  const stepReps = (dir: -1 | 1) => {
    const base = set.reps > 0 ? set.reps : (suggestion?.reps ?? 0);
    onChange({ reps: Math.max(0, base + dir) });
  };

  const toggle = () => {
    if (set.completed) {
      onChange({ completed: false });
      return;
    }
    // Ticking a row with empty boxes logs what the grey hints show (last time's
    // top set). Typed reps without a weight stay bodyweight.
    const patch: Partial<WorkoutSet> = { completed: true };
    if (suggestion && !set.reps) {
      patch.reps = suggestion.reps;
      if (!set.kg) patch.kg = suggestion.kg;
    }
    onChange(patch);
    const pr = beatsBest({ kg: patch.kg ?? set.kg, reps: patch.reps ?? set.reps });
    setPopped((n) => n + 1);
    if (pr) setBurst((n) => n + 1);
    navigator.vibrate?.(pr ? [20, 40, 30] : 12);
    // Fire the rest timer on completion. Only reps are required — bodyweight
    // moves (push-ups, pull-ups, dips) legitimately have kg === 0.
    if ((patch.reps ?? set.reps) > 0) onComplete();
  };

  const input = "num min-w-0 flex-1 bg-transparent text-center text-base font-bold placeholder:text-ink-3 focus:outline-none";

  return (
    <div className="relative grid grid-cols-[48px_1fr_1fr_24px] items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-label={set.completed ? `Set ${index + 1} done. Mark incomplete` : `Complete set ${index + 1}`}
        aria-pressed={set.completed}
        className={`relative flex h-12 w-12 items-center justify-center border transition-colors ${
          set.completed ? "border-lime bg-lime text-on-accent" : "border-line text-ink-2 hover:border-ink hover:text-ink"
        }`}
      >
        {set.completed ? (
          <Check key={popped} className="check-pop h-6 w-6" strokeWidth={3.5} />
        ) : (
          <span className="num text-base font-extrabold">{index + 1}</span>
        )}
        {isPR && (
          <span className="absolute -right-1.5 -top-1.5 bg-[#ffb800] px-1 text-[9px] font-extrabold leading-4 text-on-accent">PR</span>
        )}
      </button>

      {set.completed ? (
        <>
          <p className="num text-center text-base font-bold text-ink-2">
            {set.kg > 0 ? displayWeight(set.kg, units) : "—"}
            <span className="ml-1 text-xs font-semibold text-ink-3">{set.kg > 0 ? units : "bw"}</span>
          </p>
          <p className="num text-center text-base font-bold text-ink-2">
            × {set.reps}
          </p>
        </>
      ) : (
        <>
          <Stepper label="weight" onStep={stepWeight}>
            <NumberField
              externalValue={displayKg}
              onValue={(v) => onChange({ kg: toKg(v, units) })}
              decimal
              label={`Set ${index + 1} weight (${units})`}
              placeholder={hint && hint.kg > 0 ? String(displayWeight(hint.kg, units, 1)) : units}
              className={input}
            />
          </Stepper>
          <Stepper label="reps" onStep={stepReps}>
            <NumberField
              externalValue={set.reps}
              onValue={(v) => onChange({ reps: Math.round(v) })}
              decimal={false}
              label={`Set ${index + 1} reps`}
              placeholder={hint ? String(hint.reps) : "reps"}
              className={input}
            />
          </Stepper>
        </>
      )}

      {canDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete set ${index + 1}`}
          className="flex h-12 w-6 items-center justify-center text-ink-3 transition-colors hover:text-over"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <span />
      )}

      {burst > 0 && (
        <span key={burst} className="pointer-events-none absolute left-1/2 top-1 z-20" aria-hidden="true">
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="spark absolute h-1.5 w-1.5"
              style={{ backgroundColor: s.color, ["--sx" as string]: `${s.x}px`, ["--sy" as string]: `${s.y}px` }}
            />
          ))}
          <span
            className="pr-tag plunk face-yellow absolute left-0 top-0 whitespace-nowrap px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em]"
            style={{ ["--d" as string]: "3px" }}
          >
            New PR
          </span>
        </span>
      )}
      {burst > 0 && (
        <span className="sr-only" role="status">
          New personal record
        </span>
      )}
    </div>
  );
}
