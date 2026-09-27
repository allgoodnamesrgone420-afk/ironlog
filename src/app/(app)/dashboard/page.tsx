"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Flame, Snowflake, X } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkouts } from "@/hooks/useWorkouts";
import { trainingWeek } from "@/lib/analytics/streak";
import { goalStreak, trainedDaysByWeek } from "@/lib/analytics/goal";
import { REPORT_SEEN_KEY, defaultReportWeek } from "@/lib/analytics/report";
import { WEEKLY_GOAL_SETTING, useSetting } from "@/lib/settings";
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
  const [goal] = useSetting(WEEKLY_GOAL_SETTING);

  const streak = useMemo(() => goalStreak(workouts, goal), [workouts, goal]);
  const week = useMemo(() => trainingWeek(workouts), [workouts]);
  const last = useMemo(
    () => workouts.reduce<(typeof workouts)[number] | undefined>((a, w) => (!a || w.date > a.date ? w : a), undefined),
    [workouts],
  );

  if (loading) return <DashboardSkeleton />;

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const frozenThisMonth = streak.frozen.some((wk) => wk.startsWith(month));

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
        {streak.weeks > 0 && (
          <Link
            href="/week"
            className="plunk face-yellow flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em]"
            style={{ ["--d" as string]: "3px" }}
            title={
              frozenThisMonth
                ? "Streak freeze used this month: one missed week a month is forgiven"
                : `Weeks in a row you trained ${goal}+ days. One missed week a month won't break it.`
            }
          >
            <Flame className="h-3.5 w-3.5" /> {streak.weeks} wk streak
            {frozenThisMonth && <Snowflake className="ml-0.5 h-3.5 w-3.5" aria-label="streak freeze used this month" />}
          </Link>
        )}
      </header>

      <WeekBanner workouts={workouts} />

      {/* Phones: one column in this order. Desktop: the week on the left, what's next on the right. */}
      <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0" style={{ ["--i" as string]: 1 }}>
        <div className="space-y-5">
          <Hero week={week} goal={goal} last={last} />
          <StatStrip workouts={workouts} />
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

const readSeen = () => {
  try {
    return localStorage.getItem(REPORT_SEEN_KEY) ?? "";
  } catch {
    return "";
  }
};
const noopSubscribe = () => () => {};

/** Sunday to Tuesday: the week's report card is ready (as in Bite). */
function WeekBanner({ workouts }: { workouts: { date: Date }[] }) {
  const seen = useSyncExternalStore(noopSubscribe, readSeen, () => "server");
  const [hidden, setHidden] = useState(false);
  const today = new Date();
  const week = defaultReportWeek(today);
  const dow = today.getDay(); // 0 = Sunday
  const trained = trainedDaysByWeek(workouts).get(week)?.size ?? 0;
  if (hidden || seen === week || seen === "server" || ![0, 1, 2].includes(dow) || trained === 0) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(REPORT_SEEN_KEY, week);
    } catch {
      /* private mode */
    }
    setHidden(true);
  };
  return (
    <div className="plunk face-violet flex items-center gap-3 p-3" style={{ ["--d" as string]: "4px" }}>
      <Link href="/week" onClick={dismiss} className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">{dow === 0 ? "This week" : "Last week"}</span>
        <span className="block font-extrabold">Your weekly report card is ready →</span>
      </Link>
      <button onClick={dismiss} className="flex h-9 w-9 shrink-0 items-center justify-center" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
