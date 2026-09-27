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
        className="w-full border-b-2 border-transparent bg-transparent pr-2 text-lg font-extrabold tracking-tight transition-colors placeholder:text-ink-3 focus:border-lime focus:outline-none"
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto border border-line bg-surface shadow-[4px_4px_0_#000]"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.source}-${s.name}`}>
              <button
                type="button"
                onClick={() => pick(s)}
                onMouseEnter={() => setHighlighted(i)}
                className={`flex w-full items-center justify-between border-b border-line-soft px-4 py-2.5 text-left transition-colors ${
                  i === highlighted ? "bg-elevated" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    {s.name}
                    {s.source === "custom" && <span className="tag text-violet">Yours</span>}
                  </div>
                  <div className="truncate text-xs text-ink-2">{s.display}</div>
                </div>
                {s.equipment && (
                  <span className="label ml-2 shrink-0">{s.equipment}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
