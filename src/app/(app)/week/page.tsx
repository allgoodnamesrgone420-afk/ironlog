"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Check, ChevronLeft, ChevronRight, Flame, Share2, Snowflake } from "lucide-react";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useUnits } from "@/providers/UnitsProvider";
import { useToast } from "@/providers/ToastProvider";
import { useMuscleTargets } from "@/hooks/useMuscleTargets";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { WEEKLY_GOAL_SETTING, useSetting } from "@/lib/settings";
import { addDays, parseKey, weekKey } from "@/lib/analytics/goal";
import { REPORT_SEEN_KEY, buildWeekReport, defaultReportWeek, reportText, type WeekReport } from "@/lib/analytics/report";
import { MUSCLE_LABELS } from "@/lib/analytics/muscle-groups";
import { displayWeight, fromKg } from "@/lib/units/converter";
import type { Units } from "@/types/user";
import { Button } from "@/components/ui/Button";
import { CountUp } from "@/components/ui/CountUp";
import { Skeleton } from "@/components/ui/Skeleton";

const fmt = (key: string, o: Intl.DateTimeFormatOptions) => parseKey(key).toLocaleDateString(undefined, o);

export default function WeekPage() {
  const { workouts, loading } = useWorkouts();
  const { units } = useUnits();
  const [goal] = useSetting(WEEKLY_GOAL_SETTING);
  const { targets } = useMuscleTargets();
  const bodyweightKg = useLatestBodyweight();
  const [today] = useState(() => new Date());
  const [start, setStart] = useState<string | null>(null);
  const week = start ?? defaultReportWeek(today);

  useEffect(() => {
    try {
      localStorage.setItem(REPORT_SEEN_KEY, defaultReportWeek(today));
    } catch {
      /* private mode */
    }
  }, [today]);

  const report = useMemo(
    () => buildWeekReport({ workouts, start: week, goal, targets, bodyweightKg, today }),
    [workouts, week, goal, targets, bodyweightKg, today],
  );

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-52" />
        </div>
        <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
          <div className="space-y-4">
            <Skeleton className="h-[190px]" />
            <Skeleton className="h-16" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </div>
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const latest = weekKey(today);
  return (
    <Report
      r={report}
      units={units}
      onPrev={() => setStart(addDays(week, -7))}
      onNext={week < latest ? () => setStart(addDays(week, 7)) : undefined}
    />
  );
}

function Report({ r, units, onPrev, onNext }: { r: WeekReport; units: Units; onPrev: () => void; onNext?: () => void }) {
  const toast = useToast();
  const title = `${fmt(r.start, { day: "numeric", month: "short" })} – ${fmt(r.end, { day: "numeric", month: "short" })}`;
  const volume = Math.round(fromKg(r.volumeKg, units));

  const share = async () => {
    const text = reportText(r, units);
    try {
      if (navigator.share) await navigator.share({ title: "My week on IronLog", text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Copied your week to the clipboard");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  return (
    <div className="stagger space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3" style={{ ["--i" as string]: 0 }}>
        <div>
          <p className="label">Weekly report card</p>
          <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">{title}</h1>
          {r.partial && <p className="text-xs text-ink-2">This week isn&apos;t over yet. Numbers so far.</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="flex h-10 w-10 items-center justify-center border border-line" aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onNext}
            disabled={!onNext}
            className="flex h-10 w-10 items-center justify-center border border-line disabled:opacity-30"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {r.sessions === 0 ? (
        <section className="card p-5 text-center">
          <p className="font-semibold">Nothing logged this week.</p>
          <p className="mt-1 text-sm text-ink-2">Try an earlier week, or train and check back on Sunday.</p>
        </section>
      ) : (
        <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
          <div className="space-y-4">
            <section className="plunk face-lime p-5" style={{ ["--d" as string]: "6px", ["--i" as string]: 1 }}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">Days trained</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">
                  {r.hit ? "Goal hit ✓" : r.partial ? `${r.goal - r.daysTrained} to go` : `${r.goal - r.daysTrained} short`}
                </p>
              </div>
              <p className="hero-num num mt-2 text-[80px]">
                <CountUp value={r.daysTrained} />
                <span className="text-3xl opacity-60">/{r.goal}</span>
              </p>
              <p className="mt-1 text-sm font-semibold opacity-80">
                {r.sessions} session{r.sessions === 1 ? "" : "s"}
                {r.minutes > 0 && ` · ${r.minutes} min`} · goal {r.goal} day{r.goal === 1 ? "" : "s"} a week
              </p>
            </section>

            <section className="grid grid-cols-7 gap-1.5" aria-label="Each day this week" style={{ ["--i" as string]: 2 }}>
              {r.days.map((d) => (
                <div key={d.key} className="flex flex-col items-center gap-1">
                  <span className="label !text-[10px]">{fmt(d.key, { weekday: "narrow" })}</span>
                  <span
                    className={`flex aspect-square w-full items-center justify-center text-sm font-extrabold ${
                      d.sessions.length ? "bg-lime text-on-accent" : "border border-line-soft text-ink-3"
                    }`}
                    title={`${fmt(d.key, { weekday: "long", day: "numeric", month: "short" })}: ${d.sessions.length ? d.sessions.join(", ") : "rest"}`}
                  >
                    {d.sessions.length ? <Check className="h-4 w-4" strokeWidth={3} /> : "·"}
                  </span>
                  <span className="num text-[10px] text-ink-2">{d.sessions.length > 1 ? `×${d.sessions.length}` : d.sessions.length ? "1" : "—"}</span>
                </div>
              ))}
            </section>

            <section className="grid grid-cols-2 gap-3" style={{ ["--i" as string]: 3 }}>
              <Stat
                label={`Volume · ${units}`}
                value={volume.toLocaleString()}
                sub={r.vsPrev?.volumePct != null ? `${r.vsPrev.volumePct >= 0 ? "+" : "−"}${Math.abs(r.vsPrev.volumePct)}% vs last wk` : "lifted"}
              />
              <Stat label="Working sets" value={String(r.sets)} sub={r.vsPrev ? `${r.vsPrev.sets >= 0 ? "+" : "−"}${Math.abs(r.vsPrev.sets)} vs last wk` : "warm-ups not counted"} />
              <Stat label="Records" value={String(r.prs.length)} sub={r.prs[0] ? r.prs[0].name : "none this week"} />
              <div className="card p-3">
                <p className="label">Streak</p>
                <p className="num mt-1 flex items-center gap-1.5 text-2xl font-extrabold">
                  <Flame className="h-5 w-5 text-warn" /> {r.streak.weeks}
                  {r.streak.frozenThisWeek && <Snowflake className="h-4 w-4 text-under" aria-label="streak freeze used" />}
                </p>
                <p className="num text-xs text-ink-2">
                  {r.streak.frozenThisWeek ? "freeze used: one missed week a month is forgiven" : `week${r.streak.weeks === 1 ? "" : "s"} hitting your goal`}
                </p>
              </div>
            </section>
          </div>

          <div className="space-y-4">
            {r.focus && (
              <section className="plunk face-violet p-5" style={{ ["--d" as string]: "5px", ["--i" as string]: 4 }}>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">{r.partial ? "One focus for the rest of the week" : "One focus for next week"}</p>
                <p className="mt-2 text-xl font-extrabold leading-tight">{r.focus.title}</p>
                <p className="mt-2 text-sm font-medium opacity-90">{r.focus.detail}</p>
              </section>
            )}

            {r.wins.length > 0 && (
              <section className="card space-y-2.5 p-4">
                {r.wins.map((w) => (
                  <p key={w} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={3} />
                    {w}
                  </p>
                ))}
                {r.prs.length > 0 && (
                  <ul className="space-y-1 border-t border-line-soft pt-2.5">
                    {r.prs.map((p, i) => (
                      <li key={`${p.name}-${i}`} className="num flex justify-between gap-2 text-xs">
                        <Link href={`/exercise?name=${encodeURIComponent(p.name)}`} className="truncate font-semibold hover:underline">
                          {p.name}
                        </Link>
                        <span className="shrink-0 text-ink-2">
                          {p.kg > 0 ? `${displayWeight(p.kg, units, 1)} ${units}` : "BW"} × {p.reps}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {r.muscles.length > 0 && (
              <section className="card p-4" aria-label="Muscles against weekly targets">
                <p className="label">Muscles vs targets</p>
                <ul className="mt-3 space-y-2.5">
                  {r.muscles.map((m) => {
                    const max = Math.max(m.target * 1.5, m.done, 1);
                    const status = m.target > 0 && m.done > m.target * 1.5 ? "over" : m.target > 0 && m.done >= m.target ? "hit" : m.target > 0 && m.done < m.target * 0.5 ? "behind" : "building";
                    return (
                      <li key={m.muscle}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="font-semibold">{MUSCLE_LABELS[m.muscle]}</span>
                          <span className="num text-xs">
                            <strong>{m.done}</strong>
                            <span className="text-ink-3"> / {m.target}</span>
                          </span>
                        </div>
                        <div className="relative mt-1 h-2 bg-elevated">
                          <div
                            className={`h-full ${status === "over" ? "hatch bg-over" : status === "behind" ? "bg-under" : status === "hit" ? "bg-ink" : "bg-ink-3"}`}
                            style={{ width: `${(m.done / max) * 100}%` }}
                          />
                          {m.target > 0 && (
                            <span className="absolute -bottom-1 -top-1 w-0.5 bg-ink" style={{ left: `calc(${(m.target / max) * 100}% - 1px)` }} aria-hidden="true" />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap gap-3">
              <Button variant="lime" onClick={() => void share()}>
                <Share2 className="h-4 w-4" /> Share my week
              </Button>
              <Link href="/coach" className="pop-btn ghost">
                <Bot className="h-4 w-4" /> Ask the coach
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-3">
      <p className="label">{label}</p>
      <p className="num mt-1 text-2xl font-extrabold">{value}</p>
      <p className="num truncate text-xs text-ink-2">{sub}</p>
    </div>
  );
}
