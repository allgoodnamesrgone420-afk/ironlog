"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarRange, ChevronRight, Play, Settings2 } from "lucide-react";
import { usePrograms } from "@/hooks/usePrograms";
import { dayAt, clampCursor, missingTrainingMaxes } from "@/lib/programs/resolve";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Dashboard "today's workout" pointer. Shows the active program's current day
 * and a one-tap start that deep-links into the logger pre-filled.
 */
export function TodayProgram() {
  const { active, loading } = usePrograms();
  const router = useRouter();

  if (loading) return null;

  // No active program → gentle prompt to start one.
  if (!active) {
    return (
      <Link
        href="/programs"
        className="card flex items-center gap-3 border-l-[6px] border-l-violet p-3 transition-colors hover:bg-elevated"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-violet text-on-accent" aria-hidden>
          <CalendarRange className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Follow a program</span>
          <span className="block truncate text-xs text-ink-2">PPL, 5/3/1, nSuns or build your own</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
      </Link>
    );
  }

  const cursor = clampCursor(active, active.cursor);
  const day = dayAt(active, cursor);
  const weekLabel = active.weeks[cursor.week]?.label ?? `Week ${cursor.week + 1}`;
  const needsTM = missingTrainingMaxes(active);

  if (!day) {
    return (
      <Card className="p-4">
        <p className="text-sm text-ink-2">
          {active.name} has no training days yet.{" "}
          <Link href="/programs" className="font-bold text-ink underline decoration-lime decoration-2 underline-offset-4">
            Edit it →
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="label flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" /> Today · {weekLabel}
          </p>
          <h3 className="mt-1 truncate text-xl font-extrabold tracking-tight">{day.label}</h3>
          <p className="truncate text-xs text-ink-2">{active.name}</p>
        </div>
        <Link
          href="/programs"
          aria-label="Manage programs"
          className="flex h-9 w-9 shrink-0 items-center justify-center border border-line text-ink-2 transition-colors hover:text-ink"
        >
          <Settings2 className="h-4 w-4" />
        </Link>
      </div>

      <ul className="border-t border-line-soft">
        {day.exercises.slice(0, 5).map((ex, i) => (
          <li key={i} className="flex items-center gap-3 border-b border-line-soft px-4 py-2 text-sm last:border-b-0">
            <span className="min-w-0 truncate font-semibold">{ex.name}</span>
            <span className="num ml-auto shrink-0 text-xs text-ink-3">{ex.prescribed.length} sets</span>
          </li>
        ))}
      </ul>
      {day.exercises.length > 5 && <p className="px-4 pt-1 text-xs text-ink-3">+{day.exercises.length - 5} more</p>}

      {needsTM.length > 0 && (
        <p className="mx-4 mt-3 flex gap-2 border border-warn/60 bg-warn/10 p-2.5 text-xs">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warn" />
          <span>
            Set a training max for {needsTM.join(", ")} on the{" "}
            <Link href="/programs" className="font-bold underline underline-offset-2">
              programs page
            </Link>{" "}
            for accurate weights.
          </span>
        </p>
      )}

      <div className="px-4 pb-4 pt-3">
        <Button variant="lime" block onClick={() => router.push(`/log?program=${active.id}`)}>
          <Play className="h-4 w-4" fill="currentColor" /> Start today&apos;s workout
        </Button>
      </div>
    </Card>
  );
}
