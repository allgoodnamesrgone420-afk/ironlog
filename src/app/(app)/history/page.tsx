"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Trash2, ChevronRight, Dumbbell, Repeat, Download, Sparkles, Zap, Pencil } from "lucide-react";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useToast } from "@/providers/ToastProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { useDeleteWorkout } from "@/hooks/useDeleteWorkout";
import { workoutVolume } from "@/lib/analytics/volume";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { callGemini } from "@/lib/ai/gemini-client";
import { HISTORY_ANALYZER_SYSTEM_PROMPT } from "@/lib/ai/system-prompts";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { HistorySkeleton } from "@/components/ui/PageSkeletons";
import { fromKg } from "@/lib/units/converter";
import { formatDuration } from "@/lib/utils";

export default function HistoryPage() {
  const { workouts, loading } = useWorkouts();
  const { units } = useUnits();
  const toast = useToast();
  const bodyweightKg = useLatestBodyweight();
  const deleteWithUndo = useDeleteWorkout();
  const [summary, setSummary] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const stats = useMemo(() => {
    const totalSessions = workouts.length;
    const totalVolume = workouts.reduce((a, w) => a + workoutVolume(w, bodyweightKg), 0);
    return { totalSessions, totalVolume };
  }, [workouts, bodyweightKg]);

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(workouts, null, 2)], { type: "application/json" });
    download(blob, `ironlog_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleExportCSV = () => {
    const rows: string[] = ["date,workout,exercise,set,kg,reps,rpe,warmup"];
    for (const w of workouts) {
      const date = w.date.toISOString().slice(0, 10);
      for (const ex of w.exercises) {
        ex.sets.forEach((s, i) =>
          rows.push([date, csv(w.name), csv(ex.name), i + 1, s.kg, s.reps, s.rpe ?? "", s.warmup ? 1 : 0].join(",")),
        );
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    download(blob, `ironlog_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const analyze = async () => {
    if (workouts.length === 0) return;
    setAnalyzing(true);
    try {
      const ctx = workouts.slice(0, 20).map((w) => ({
        date: w.date.toLocaleDateString(),
        title: w.name,
        volume: Math.round(w.totalVolume),
        exercises: w.exercises.map((e) => e.name).join(", "),
      }));
      const prompt = `Analyze user's last 20 workouts: ${JSON.stringify(ctx)}. Return JSON: {"analysis": "string"}.`;
      const result = await callGemini<{ analysis: string }>(prompt, HISTORY_ANALYZER_SYSTEM_PROMPT, { jsonMode: true });
      setSummary(result?.analysis ?? "Couldn't generate a summary.");
    } catch {
      toast.error("Couldn't analyze right now.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <HistorySkeleton />;

  return (
    <div className="stagger mx-auto max-w-[640px] space-y-5">
      <header style={{ ["--i" as string]: 0 }}>
        <p className="label">History</p>
        <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">
          {stats.totalSessions} session{stats.totalSessions === 1 ? "" : "s"}
        </h1>
        <p className="num text-sm text-ink-2">
          {Math.round(fromKg(stats.totalVolume, units)).toLocaleString()} {units} lifted in total
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" onClick={handleExportJSON} block>
          <Download className="h-4 w-4" /> Export JSON
        </Button>
        <Button variant="secondary" size="sm" onClick={handleExportCSV} block>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {workouts.length > 0 && (
        <section className="plunk face-violet p-5" style={{ ["--d" as string]: "5px", ["--i" as string]: 1 }} aria-live="polite">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">
            <Sparkles className="h-3.5 w-3.5" /> Progress report
          </p>
          {analyzing ? (
            <>
              <p className="pulse mt-3 text-sm font-bold uppercase tracking-[0.1em]">
                Analyzing {Math.min(20, workouts.length)} session{Math.min(20, workouts.length) === 1 ? "" : "s"}…
              </p>
              <div className="pulse mt-4 h-3 w-3/4 bg-black/20" />
              <div className="pulse mt-2 h-3 w-1/2 bg-black/20" />
            </>
          ) : summary ? (
            <>
              <p className="revealing mt-2 text-[15px] font-semibold leading-relaxed">{summary}</p>
              <button
                onClick={() => setSummary(null)}
                className="mt-3 text-[11px] font-bold uppercase tracking-[0.1em] underline decoration-2 underline-offset-4"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 text-xl font-extrabold leading-tight">
                A coach&rsquo;s read on your last {Math.min(20, workouts.length)} session{Math.min(20, workouts.length) === 1 ? "" : "s"}.
              </p>
              <Button className="mt-4" onClick={analyze}>
                <Zap className="h-4 w-4" /> Analyze history
              </Button>
            </>
          )}
        </section>
      )}

      {workouts.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-6 w-6" />}
          title="No workouts logged yet"
          description="Your sessions will land here as soon as you finish your first."
          action={
            <Link href="/log" className="pop-btn lime">
              Start your first
            </Link>
          }
        />
      ) : (
        <div className="space-y-4" style={{ ["--i" as string]: 2 }}>
          {workouts.map((w) => {
            const volume = fromKg(workoutVolume(w, bodyweightKg), units);
            return (
              <div key={w.id} className="plunk face-card" style={{ ["--d" as string]: "4px" }}>
                <Link href={`/workout?id=${w.id}`} className="flex w-full items-center gap-3 p-4 text-left">
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center bg-elevated leading-none" aria-hidden>
                    <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-ink-3">
                      {w.date.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span className="num mt-0.5 text-lg font-extrabold">{w.date.getDate()}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{w.name}</span>
                    <span className="num mt-0.5 flex items-center gap-1 truncate text-xs text-ink-2">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {w.date.toLocaleDateString(undefined, { weekday: "long" })} · {w.exercises.length} ex
                      {w.durationSec ? ` · ${formatDuration(w.durationSec)}` : ""}
                    </span>
                  </span>
                  <span className="num shrink-0 text-right leading-none">
                    <span className="block text-xl font-extrabold tracking-tight">{Math.round(volume).toLocaleString()}</span>
                    <span className="label">{units}</span>
                  </span>
                  <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-3" />
                </Link>
                <div className="flex divide-x divide-line-soft border-t border-line-soft text-[11px] font-bold tracking-[0.08em]">
                  <Link
                    href={`/log?repeat=${w.id}`}
                    aria-label={`Repeat ${w.name}`}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 uppercase transition-colors hover:bg-elevated"
                  >
                    <Repeat className="h-3.5 w-3.5" /> Repeat
                  </Link>
                  <Link
                    href={`/workout/edit?id=${w.id}`}
                    aria-label={`Edit ${w.name}`}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 uppercase transition-colors hover:bg-elevated"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                  <button
                    onClick={() => void deleteWithUndo(w)}
                    aria-label={`Delete ${w.name}`}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 uppercase text-over transition-colors hover:bg-elevated"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function csv(s: string) {
  const needsQuote = /[",\n]/.test(s);
  return needsQuote ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
