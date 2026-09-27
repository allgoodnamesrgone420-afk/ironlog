"use client";

import { useMemo } from "react";
import { Flame } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkouts } from "@/hooks/useWorkouts";
import { currentStreakWeeks, trainingWeek } from "@/lib/analytics/streak";
import { friendlyName } from "@/lib/utils";

import { Hero } from "@/components/dashboard/Hero";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { TemplatesFromHistory } from "@/components/dashboard/TemplatesFromHistory";
import { TodayProgram } from "@/components/dashboard/TodayProgram";
import { CoachInsight } from "@/components/dashboard/CoachInsight";
import { DashboardSkeleton } from "@/components/ui/PageSkeletons";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
}

/** Today: this week at a glance plus what to do next. Trends live on Stats. */
export default function DashboardPage() {
  const { user } = useAuth();
  const { workouts, loading } = useWorkouts();

  const streak = useMemo(() => currentStreakWeeks(workouts), [workouts]);
  const week = useMemo(() => trainingWeek(workouts), [workouts]);
  const last = useMemo(
    () => workouts.reduce<(typeof workouts)[number] | undefined>((a, w) => (!a || w.date > a.date ? w : a), undefined),
    [workouts],
  );

  if (loading) return <DashboardSkeleton />;

  const now = new Date();
  const dayStreak = week.currentDayStreak;

  return (
    <div className="stagger space-y-5 lg:space-y-6">
      <header className="flex items-center justify-between gap-3" style={{ ["--i" as string]: 0 }}>
        <div className="min-w-0">
          <p className="label truncate">
            {greeting()}, {friendlyName(user)}
          </p>
          <h1 className="text-lg font-bold leading-tight lg:text-3xl lg:font-extrabold lg:tracking-tight">
            <span className="lg:hidden">{now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
            <span className="hidden lg:inline">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
          </h1>
        </div>
        {dayStreak > 0 && (
          <span
            className="plunk face-yellow flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em]"
            style={{ ["--d" as string]: "3px" }}
          >
            <Flame className="h-3.5 w-3.5" /> {dayStreak} day streak
          </span>
        )}
      </header>

      {/* Phones: one column in this order. Desktop: the week on the left, what's next on the right. */}
      <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0" style={{ ["--i" as string]: 1 }}>
        <div className="space-y-5">
          <Hero week={week} last={last} />
          <StatStrip workouts={workouts} streak={streak} />
        </div>
        <div className="space-y-5">
          <TodayProgram />
          <TemplatesFromHistory workouts={workouts} />
          <CoachInsight workouts={workouts} />
        </div>
      </div>
    </div>
  );
}
