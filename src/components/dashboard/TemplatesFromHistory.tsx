"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Workout } from "@/types/workout";
import { useUnits } from "@/providers/UnitsProvider";
import { formatWeight } from "@/lib/units/converter";
import { workoutVolume } from "@/lib/analytics/volume";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { daysAgo } from "@/lib/utils";

/** Accent per routine card, in frequency order. */
const ACCENTS = ["rgb(var(--lime))", "rgb(var(--violet))", "rgb(var(--blue))"];

/**
 * Templates surfaced from past workouts. We group by workout name (case-insensitive)
 * and surface the top 3 most-frequent — those are the routines you actually do.
 * Each card uses the most-recent occurrence as the "current best version" of that template.
 */
export function TemplatesFromHistory({ workouts }: { workouts: Workout[] }) {
  const { units } = useUnits();
  const bodyweightKg = useLatestBodyweight();

  const templates = useMemo(() => {
    const groups = new Map<string, { count: number; latest: Workout }>();
    for (const w of workouts) {
      const key = w.name.trim().toLowerCase();
      if (!key) continue;
      const existing = groups.get(key);
      if (!existing) groups.set(key, { count: 1, latest: w });
      else {
        existing.count += 1;
        if (w.date.getTime() > existing.latest.date.getTime()) existing.latest = w;
      }
    }
    return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [workouts]);

  if (templates.length === 0) {
    return (
      <div className="card p-5 text-center">
        <p className="font-semibold">Nothing logged yet.</p>
        <p className="mt-1 text-sm text-ink-2">Your routines will appear here as templates.</p>
        <Link href="/log" className="pop-btn sm lime mt-4">
          Start your first workout
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-3" aria-label="Your routines">
      <div className="flex items-baseline justify-between">
        <p className="label">Your routines</p>
        <p className="text-[11px] font-semibold text-ink-3">Tap to repeat</p>
      </div>
      {templates.map((t, i) => (
        <Link
          key={t.latest.id}
          href={`/log?repeat=${t.latest.id}`}
          className="card flex items-center gap-3 border-l-[6px] p-3 transition-colors hover:bg-elevated"
          style={{ borderLeftColor: ACCENTS[i % ACCENTS.length] }}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-bold">{t.latest.name}</span>
              <span className="tag num shrink-0 text-ink-2">{t.count}×</span>
            </span>
            <span className="num mt-0.5 block truncate text-xs text-ink-2">
              {daysAgo(t.latest.date)} · {t.latest.exercises.length} ex · {formatWeight(workoutVolume(t.latest, bodyweightKg), units, 0)}
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-3">
              {t.latest.exercises.map((ex) => ex.name).join(", ")}
            </span>
          </span>
          <span className="pop-btn sm lime shrink-0" aria-hidden="true">
            Repeat
          </span>
        </Link>
      ))}
    </section>
  );
}
