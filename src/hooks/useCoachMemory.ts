"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { subscribeToProfile, upsertProfile } from "@/lib/firebase/repository";
import type { MemoryFact } from "@/types/user";

export const MEMORY_MAX = 30;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

function normalizeMemory(value: unknown): MemoryFact[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((f): f is MemoryFact => !!f && typeof f.text === "string" && f.text.trim() !== "")
    .map((f) => ({ text: f.text.slice(0, 160), at: typeof f.at === "number" ? f.at : 0 }))
    .slice(-MEMORY_MAX);
}

/** Applies the coach's memory edits: drops removed facts, skips duplicates, keeps the newest MEMORY_MAX. Ported from Bite. */
export function applyMemory(facts: MemoryFact[], add: string[], remove: string[], now = Date.now()): MemoryFact[] {
  const gone = new Set(remove.map(norm));
  let next = facts.filter((f) => !gone.has(norm(f.text)));
  for (const a of add) {
    const t = a.trim().slice(0, 160);
    if (!t || next.some((f) => norm(f.text) === norm(t))) continue;
    next.push({ text: t, at: now });
  }
  if (next.length > MEMORY_MAX) next = next.slice(next.length - MEMORY_MAX);
  return next;
}

/** What the coach remembers about you, stored on your profile so it follows the account. */
export function useCoachMemory() {
  const { user } = useAuth();
  const [facts, setFacts] = useState<MemoryFact[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, (p) => setFacts(normalizeMemory(p?.coachMemory)));
  }, [user]);

  const save = async (next: MemoryFact[]) => {
    if (!user) return;
    setFacts(next);
    await upsertProfile(user.uid, { coachMemory: next });
  };

  return {
    facts,
    texts: facts.map((f) => f.text),
    /** Returns the facts that were actually added. */
    update: async (add: string[], remove: string[] = []) => {
      const next = applyMemory(facts, add, remove);
      const added = next.filter((f) => !facts.some((o) => o.text === f.text)).map((f) => f.text);
      if (added.length || next.length !== facts.length) await save(next);
      return added;
    },
    forget: (text: string) => save(facts.filter((f) => f.text !== text)),
    clear: () => save([]),
  };
}
