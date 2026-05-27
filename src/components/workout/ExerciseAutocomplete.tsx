"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchExercises } from "@/lib/data/exercises";
import type { ExerciseDefinition, MuscleGroup } from "@/types/workout";

/** Minimal shape — any source (localStorage hook or Firestore) can supply this. */
export interface CustomExerciseLike {
  name: string;
  muscles: MuscleGroup[];
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Fires when user picks a known suggestion (library OR custom). Used to auto-fill muscles. */
  onPick?: (s: { name: string; muscles?: MuscleGroup[] }) => void;
  placeholder?: string;
  /** User's saved custom exercises, merged into suggestions. */
  customExercises?: CustomExerciseLike[];
}

interface Suggestion {
  name: string;
  display: string;
  equipment?: string;
  muscles: MuscleGroup[];
  source: "library" | "custom";
}

export function ExerciseAutocomplete({ value, onChange, onPick, placeholder = "Exercise name", customExercises = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!open || value.length === 0) return [];
    const q = value.trim().toLowerCase();

    const fromLibrary: Suggestion[] = searchExercises(value).map((def: ExerciseDefinition) => ({
      name: def.name,
      display: def.primary.join(" · "),
      equipment: def.equipment,
      muscles: def.primary,
      source: "library",
    }));

    const fromCustom: Suggestion[] = customExercises
      .filter((e) => e.name.toLowerCase().includes(q))
      .filter((e) => !fromLibrary.some((s) => s.name.toLowerCase() === e.name.toLowerCase()))
      .map((e) => ({
        name: e.name,
        display: e.muscles.join(" · ") || "Custom",
        muscles: e.muscles,
        source: "custom" as const,
      }));

    return [...fromCustom, ...fromLibrary].slice(0, 10);
  }, [open, value, customExercises]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const pick = (s: Suggestion) => {
    onChange(s.name);
    onPick?.({ name: s.name, muscles: s.muscles });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((i) => Math.min(suggestions.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && suggestions[highlighted]) {
            e.preventDefault();
            pick(suggestions[highlighted]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="text-lg font-bold text-zinc-900 dark:text-white bg-transparent w-full pr-20 focus:outline-none border-b border-transparent focus:border-brand-300 placeholder-zinc-300 dark:placeholder-zinc-600 transition-colors"
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg max-h-64 overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.source}-${s.name}`}>
              <button
                type="button"
                onClick={() => pick(s)}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${
                  i === highlighted ? "bg-brand-50 dark:bg-zinc-800" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-900 dark:text-white text-sm flex items-center gap-2">
                    {s.name}
                    {s.source === "custom" && (
                      <span className="text-[9px] uppercase tracking-wider font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/15 px-1 py-0.5 rounded">
                        Yours
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">{s.display}</div>
                </div>
                {s.equipment && (
                  <span className="text-[10px] text-zinc-400 uppercase font-bold shrink-0 ml-2">{s.equipment}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
