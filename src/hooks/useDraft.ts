"use client";

import { useEffect, useState } from "react";

/**
 * Persists a value to localStorage under a user-scoped key. Auto-loads on mount.
 */
export function useDraft<T>(uid: string | undefined, key: string, initial: T): [T, (v: T) => void, () => void] {
  const fullKey = uid ? `ironlog:${uid}:${key}` : null;
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  // Load once on mount
  useEffect(() => {
    if (!fullKey) return;
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      // ignore corrupt draft
    }
    setHydrated(true);
  }, [fullKey]);

  // Save on change (skip the first hydration write)
  useEffect(() => {
    if (!fullKey || !hydrated) return;
    try {
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch {
      // quota errors etc.
    }
  }, [fullKey, value, hydrated]);

  const clear = () => {
    if (!fullKey) return;
    localStorage.removeItem(fullKey);
  };

  return [value, setValue, clear];
}
