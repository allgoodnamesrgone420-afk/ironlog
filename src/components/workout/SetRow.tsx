"use client";

import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import type { WorkoutSet } from "@/types/workout";
import { useUnits } from "@/providers/UnitsProvider";
import { fromKg, toKg } from "@/lib/units/converter";

interface Props {
  index: number;
  set: WorkoutSet;
  /** Suggested pre-fill from last session, if any */
  suggestion?: { kg: number; reps: number };
  canDelete: boolean;
  onChange: (patch: Partial<WorkoutSet>) => void;
  onDelete: () => void;
  onComplete: () => void;
}

export function SetRow({ index, set, suggestion, canDelete, onChange, onDelete, onComplete }: Props) {
  const { units } = useUnits();
  const showSuggestion = !set.completed && !set.kg && !set.reps && suggestion;

  return (
    <div
      className={`grid grid-cols-[28px_1fr_1fr_auto] gap-2 items-center transition-opacity ${
        set.completed ? "opacity-60" : "opacity-100"
      }`}
    >
      <div className="text-center font-medium text-zinc-400 dark:text-zinc-600 text-sm">{index + 1}</div>

      <input
        type="text"
        inputMode="decimal"
        placeholder={showSuggestion ? `${fromKg(suggestion!.kg, units).toFixed(1)}` : units}
        value={set.kg ? fromKg(set.kg, units).toString() : ""}
        /* completed sets stay editable — typos happen */
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          const num = parseFloat(raw);
          onChange({ kg: Number.isFinite(num) && num >= 0 ? toKg(num, units) : 0 });
        }}
        className="w-full text-center bg-zinc-50 dark:bg-zinc-800 rounded-lg py-2.5 font-bold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-50 placeholder-zinc-300 dark:placeholder-zinc-600"
      />

      <input
        type="text"
        inputMode="numeric"
        placeholder={showSuggestion ? `${suggestion!.reps}` : "reps"}
        value={set.reps || ""}
        /* completed sets stay editable — typos happen */
        onChange={(e) => {
          const num = parseInt(e.target.value, 10);
          onChange({ reps: Number.isFinite(num) && num >= 0 ? num : 0 });
        }}
        className="w-full text-center bg-zinc-50 dark:bg-zinc-800 rounded-lg py-2.5 font-bold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-50 placeholder-zinc-300 dark:placeholder-zinc-600"
      />

      <div className="flex items-center gap-1 justify-end">
        <button
          type="button"
          onClick={() => {
            onChange({ completed: !set.completed });
            if (!set.completed && set.kg > 0 && set.reps > 0) onComplete();
          }}
          aria-label={set.completed ? "Mark set incomplete" : "Mark set complete"}
          className={`p-2 min-w-[44px] min-h-[44px] rounded-full transition-colors flex items-center justify-center ${
            set.completed
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          {set.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete set"
            className="p-2 min-w-[44px] min-h-[44px] rounded-full text-zinc-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
