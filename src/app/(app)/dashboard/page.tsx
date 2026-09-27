"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Flame } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkouts } from "@/hooks/useWorkouts";
import { currentStreakWeeks, trainingWeek } from "@/lib/analytics/streak";
import { computePRs } from "@/lib/analytics/personal-records";
import { workoutVolume } from "@/lib/analytics/volume";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { friendlyName } from "@/lib/utils";

import { Hero } from "@/components/dashboard/Hero";
import { MuscleBalance } from "@/components/dashboard/MuscleBalance";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { TemplatesFromHistory } from "@/components/dashboard/TemplatesFromHistory";
import { TodayProgram } from "@/components/dashboard/TodayProgram";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import { PRCards } from "@/components/dashboard/PRCards";
import { CoachInsight } from "@/components/dashboard/CoachInsight";
import { Skeleton } from "@/components/ui/Skeleton";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { workouts, loading } = useWorkouts();
  const bodyweightKg = useLatestBodyweight();

  const streak = useMemo(() => currentStreakWeeks(workouts), [workouts]);
  const week = useMemo(() => trainingWeek(workouts), [workouts]);
  const prs = useMemo(() => computePRs(workouts), [workouts]);
  const last = useMemo(
    () => workouts.reduce<(typeof workouts)[number] | undefined>((a, w) => (!a || w.date > a.date ? w : a), undefined),
    [workouts],
  );

  const chartData = useMemo(
    () =>
      [...workouts]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(-10)
        .map((w) => ({
          kg: workoutVolume(w, bodyweightKg),
          label: w.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          date: w.date,
          name: w.name,
        })),
    [workouts, bodyweightKg],
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-60" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-52" />
      </div>
    );
  }

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

      {/* Phones: one column in this order. Desktop: today on the left, trends on the right. */}
      <div
        className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0"
        style={{ ["--i" as string]: 1 }}
      >
        <div className="space-y-5">
          <Hero week={week} last={last} />
          <StatStrip workouts={workouts} streak={streak} />
          <TodayProgram />
          <TemplatesFromHistory workouts={workouts} />
        </div>
        <div className="space-y-5">
          <MuscleBalance workouts={workouts} />
          <VolumeChart data={chartData} />
          <PRCards records={prs} />
          <CoachInsight workouts={workouts} />
          <Link
            href="/coach"
            className="card flex items-center gap-3 border-l-[6px] border-l-violet p-3 transition-colors hover:bg-elevated"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-violet text-on-accent" aria-hidden>
              <Bot className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Ask the coach</span>
              <span className="block truncate text-xs text-ink-2">Progress, programming or technique</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
