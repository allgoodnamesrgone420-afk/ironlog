"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import type { WorkoutSet } from "@/types/workout";
import { useUnits } from "@/providers/UnitsProvider";
import { fromKg, toKg } from "@/lib/units/converter";

interface Props {
  index: number;
  set: WorkoutSet;
  suggestion?: { kg: number; reps: number };
  canDelete: boolean;
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
}: {
  externalValue: number;
  onValue: (n: number) => void;
  decimal: boolean;
  placeholder?: string;
  className?: string;
}) {
  const formatExternal = (v: number) => (v > 0 ? (Number.isInteger(v) ? v.toString() : v.toString()) : "");
  const [text, setText] = useState<string>(formatExternal(externalValue));
  const lastEmittedRef = useRef<number>(externalValue);

  // Sync from external changes (suggestion fill, voice, undo).
  // Skip when the external value matches what the user's text would parse to —
  // that means we're seeing our own emit echo back.
  useEffect(() => {
    if (externalValue === lastEmittedRef.current) return;
    setText(formatExternal(externalValue));
    lastEmittedRef.current = externalValue;
  }, [externalValue]);

  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={text}
      placeholder={placeholder}
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

export function SetRow({ index, set, suggestion, canDelete, onChange, onDelete, onComplete }: Props) {
  const { units } = useUnits();
  const showSuggestion = !set.completed && !set.kg && !set.reps && suggestion;

  // Display value for kg is in the user's chosen unit
  const displayKg = fromKg(set.kg, units);

  // Completed rows dim their numbers; the lime check stays bright.
  const done = set.completed ? "opacity-50" : "";
  const input = `box-input num h-11 text-center font-bold disabled:opacity-50 ${done}`;

  return (
    <div className="grid grid-cols-[28px_1fr_1fr_88px] items-center gap-2">
      <div className={`num text-center text-sm font-bold text-ink-3 ${done}`}>{index + 1}</div>

      <NumberField
        externalValue={displayKg}
        onValue={(v) => onChange({ kg: toKg(v, units) })}
        decimal
        placeholder={showSuggestion ? `${fromKg(suggestion!.kg, units).toFixed(1)}` : units}
        className={input}
      />

      <NumberField
        externalValue={set.reps}
        onValue={(v) => onChange({ reps: Math.round(v) })}
        decimal={false}
        placeholder={showSuggestion ? `${suggestion!.reps}` : "reps"}
        className={input}
      />

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => {
            onChange({ completed: !set.completed });
            // Fire the rest timer on completion. Only reps are required — bodyweight
            // moves (push-ups, pull-ups, dips) legitimately have kg === 0.
            if (!set.completed && set.reps > 0) onComplete();
          }}
          aria-label={set.completed ? "Mark set incomplete" : "Mark set complete"}
          aria-pressed={set.completed}
          className={`flex h-11 w-11 items-center justify-center border transition-colors ${
            set.completed ? "border-lime bg-lime text-on-accent" : "border-line text-ink-3 hover:text-ink"
          }`}
        >
          <Check className="h-5 w-5" strokeWidth={set.completed ? 3.5 : 2} />
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete set"
            className="flex h-11 w-10 items-center justify-center text-ink-3 transition-colors hover:text-over"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
