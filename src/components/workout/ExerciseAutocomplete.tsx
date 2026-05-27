"use client";

import { useEffect, useRef, useState } from "react";
import { searchExercises } from "@/lib/data/exercises";
import type { ExerciseDefinition } from "@/types/workout";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onPick?: (def: ExerciseDefinition) => void;
  placeholder?: string;
}

export function ExerciseAutocomplete({ value, onChange, onPick, placeholder = "Exercise name" }: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const suggestions = open && value.length > 0 ? searchExercises(value) : [];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const pick = (def: ExerciseDefinition) => {
    onChange(def.name);
    onPick?.(def);
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
            <li key={s.name}>
              <button
                type="button"
                onClick={() => pick(s)}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${
                  i === highlighted ? "bg-brand-50 dark:bg-zinc-800" : ""
                }`}
              >
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white text-sm">{s.name}</div>
                  <div className="text-xs text-zinc-500">{s.primary.join(" · ")}</div>
                </div>
                <span className="text-[10px] text-zinc-400 uppercase font-bold">{s.equipment}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
