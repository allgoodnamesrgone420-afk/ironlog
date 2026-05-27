"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import type { MuscleGroup } from "@/types/workout";

export interface CustomExercise {
  id: string;
  name: string;
  muscles: MuscleGroup[];
  createdAt: number;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function storageKey(uid: string | undefined): string | null {
  return uid ? `ironlog:${uid}:customExercises` : null;
}

/**
 * Per-user custom exercise library, stored in localStorage.
 *
 * Why local instead of Firestore: it's instant, works offline, doesn't need
 * security rules deploys, and these exercises are personal to your device.
 * Trade-off: doesn't sync across devices. If you ever want cloud sync, the
 * Firestore plumbing is still in repository.ts ready to swap in.
 */
export function useCustomExercises() {
  const { user } = useAuth();
  const key = storageKey(user?.uid);
  const [exercises, setExercises] = useState<CustomExercise[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!key) {
      setExercises([]);
      setHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw) setExercises(JSON.parse(raw) as CustomExercise[]);
      else setExercises([]);
    } catch {
      setExercises([]);
    }
    setHydrated(true);
  }, [key]);

  const upsert = (name: string, muscles: MuscleGroup[]) => {
    if (!key) return;
    const id = slugify(name);
    if (!id) return;
    setExercises((prev) => {
      const without = prev.filter((e) => e.id !== id);
      const next = [...without, { id, name: name.trim(), muscles, createdAt: Date.now() }];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  };

  const remove = (id: string) => {
    if (!key) return;
    setExercises((prev) => {
      const next = prev.filter((e) => e.id !== id);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  };

  return { exercises, upsert, remove, hydrated };
}
