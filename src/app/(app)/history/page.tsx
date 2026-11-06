"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Trash2, ChevronRight, Dumbbell, Repeat, Download, Sparkles, Zap, Pencil, Search, X, FileJson, FileSpreadsheet } from "lucide-react";
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
import { Modal } from "@/components/ui/Modal";
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
  const [query, setQuery] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  // Search matches the session name or any exercise in it.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workouts;
    return workouts.filter((w) => w.name.toLowerCase().includes(q) || w.exercises.some((e) => e.name.toLowerCase().includes(q)));
  }, [workouts, query]);

  // Newest first, one group per calendar month, with that month's totals.
  const months = useMemo(() => {
    const groups: { key: string; label: string; items: typeof shown; volume: number }[] = [];
    const thisYear = new Date().getFullYear();
    for (const w of shown) {
      const key = `${w.date.getFullYear()}-${w.date.getMonth()}`;
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        const label = w.date.toLocaleDateString(undefined, w.date.getFullYear() === thisYear ? { month: "long" } : { month: "long", year: "numeric" });
        g = { key, label, items: [], volume: 0 };
        groups.push(g);
      }
      g.items.push(w);
      g.volume += workoutVolume(w, bodyweightKg);
    }
    return groups;
  }, [shown, bodyweightKg]);

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

      {workouts.length > 0 && (
        <div className="flex items-stretch gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 border border-line bg-field px-3 focus-within:border-ink focus-within:shadow-[3px_3px_0_rgb(var(--lime))]">
            <Search className="h-4 w-4 shrink-0 text-ink-3" />
            <span className="sr-only">Search sessions</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sessions or exercises"
              enterKeyHint="search"
              className="h-11 w-full min-w-0 bg-transparent text-base placeholder:text-ink-3 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center text-ink-3 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            aria-label="Export history"
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center border border-line text-ink-2 transition-colors hover:bg-elevated hover:text-ink"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      )}

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export history">
        <div className="space-y-3 px-5 pb-5 pt-2">
          <p className="text-sm text-ink-2">
            Every session and set, {workouts.length} workout{workouts.length === 1 ? "" : "s"}. Files save to this device.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              block
              onClick={() => {
                handleExportCSV();
                setExportOpen(false);
              }}
            >
              <FileSpreadsheet className="h-4 w-4" /> CSV
            </Button>
            <Button
              variant="secondary"
              block
              onClick={() => {
                handleExportJSON();
                setExportOpen(false);
              }}
            >
              <FileJson className="h-4 w-4" /> JSON
            </Button>
          </div>
          <p className="text-xs text-ink-3">CSV opens in Sheets or Excel. JSON keeps everything, for backups.</p>
        </div>
      </Modal>

      {workouts.length > 0 && !query && (
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
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title={`Nothing matches \u201c${query.trim()}\u201d`}
          description="Try a session name like Push Day, or an exercise like Squat."
          action={
            <Button variant="secondary" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="space-y-6" style={{ ["--i" as string]: 2 }}>
          {query && (
            <p className="label -mb-3" role="status">
              {shown.length} matching session{shown.length === 1 ? "" : "s"}
            </p>
          )}
          {months.map((m, mi) => (
            <section key={m.key} aria-label={m.label}>
              {/* Sticks under the phone top bar while you scroll that month. */}
              <h2 className="sticky top-[calc(3.5rem_+_1px_+_env(safe-area-inset-top))] z-10 -mx-5 mb-3 flex items-baseline justify-between gap-3 border-b border-line-soft bg-bg/95 px-5 py-2 backdrop-blur-sm lg:top-0 lg:mx-0 lg:px-0">
                <span className="text-sm font-extrabold uppercase tracking-[0.1em]">{m.label}</span>
                <span className="num text-xs font-semibold text-ink-3">
                  {m.items.length} session{m.items.length === 1 ? "" : "s"} · {Math.round(fromKg(m.volume, units)).toLocaleString()} {units}
                </span>
              </h2>
              <div className="space-y-3">
                {m.items.map((w, i) => {
                  const volume = fromKg(workoutVolume(w, bodyweightKg), units);
                  // Only the first screenful animates in; a long list shouldn't keep you waiting.
                  const order = mi === 0 ? i : 99;
                  return (
                    <div
                      key={w.id}
                      className={`plunk face-card ${order < 8 ? "history-in" : ""}`}
                      style={{ ["--d" as string]: "4px", ["--i" as string]: order }}
                    >
                      <Link href={`/workout?id=${w.id}`} className="flex w-full items-center gap-3 p-3.5 text-left">
                        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center bg-elevated leading-none" aria-hidden>
                          <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-ink-3">
                            {w.date.toLocaleDateString(undefined, { weekday: "short" })}
                          </span>
                          <span className="num mt-0.5 text-lg font-extrabold">{w.date.getDate()}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{w.name}</span>
                          <span className="num mt-0.5 flex items-center gap-1 truncate text-xs text-ink-2">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {w.exercises.length} ex
                            {w.durationSec ? ` · ${formatDuration(w.durationSec)}` : ""}
                          </span>
                        </span>
                        <span className="num shrink-0 text-right leading-none">
                          <span className="block text-lg font-extrabold tracking-tight">{Math.round(volume).toLocaleString()}</span>
                          <span className="label">{units}</span>
                        </span>
                        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-ink-3" />
                      </Link>
                      <div className="flex divide-x divide-line-soft border-t border-line-soft text-[11px] font-bold tracking-[0.08em]">
                        <Link
                          href={`/log?repeat=${w.id}`}
                          aria-label={`Repeat ${w.name}`}
                          className="flex h-10 flex-1 items-center justify-center gap-1.5 uppercase transition-colors hover:bg-elevated active:bg-elevated"
                        >
                          <Repeat className="h-3.5 w-3.5" /> Repeat
                        </Link>
                        <Link
                          href={`/workout/edit?id=${w.id}`}
                          aria-label={`Edit ${w.name}`}
                          className="flex h-10 flex-1 items-center justify-center gap-1.5 uppercase transition-colors hover:bg-elevated active:bg-elevated"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Link>
                        <button
                          onClick={() => void deleteWithUndo(w)}
                          aria-label={`Delete ${w.name}`}
                          className="flex h-10 flex-1 items-center justify-center gap-1.5 uppercase text-over transition-colors hover:bg-elevated active:bg-elevated"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
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
