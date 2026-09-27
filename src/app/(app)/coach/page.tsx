"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Brain, Dumbbell, Send, Sparkles, Square, X } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useToast } from "@/providers/ToastProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { useMuscleTargets } from "@/hooks/useMuscleTargets";
import { useCoachMemory } from "@/hooks/useCoachMemory";
import { useBodyMetrics } from "@/hooks/useBodyMetrics";
import { WEEKLY_GOAL_SETTING, useSetting } from "@/lib/settings";
import { appendCoachMessage, newCoachMessageId, subscribeToCoachMessages } from "@/lib/firebase/repository";
import { streamCoach } from "@/lib/ai/gemini-client";
import { coachContext, memoryEdits, visibleReply } from "@/lib/ai/coach";
import { autoFocus, generateWorkout, muscleStatus } from "@/lib/ai/workout-builder";
import { stashWorkout } from "@/lib/workout/handoff";
import { dayKey } from "@/lib/analytics/goal";
import { trendSeries, weeklyRate, weightsFromMetrics } from "@/lib/analytics/weight";
import { MUSCLE_LABELS } from "@/lib/analytics/muscle-groups";
import { displayWeight } from "@/lib/units/converter";
import { uid as newId } from "@/lib/utils";
import { Markdown } from "@/components/coach/Markdown";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { CoachMessage } from "@/types/ai";
import type { Units } from "@/types/user";

/** Map server / network errors to actionable copy. */
function formatCoachError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("unauthorized") || m.includes("401")) return "You got signed out — refresh and sign in again.";
  if (m.includes("rate limit") || m.includes("429")) return msg;
  if (m.includes("server misconfigured")) return "Server is missing the Gemini key. Add GEMINI_API_KEY to Vercel env vars.";
  if (m.includes("model error") || m.includes("502")) return "The model is having trouble. Try again in a moment.";
  if (m.includes("invalid request")) return "That message had an unexpected shape — try rephrasing.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Network issue — check your connection.";
  return msg;
}

const SUGGESTIONS = ["What's my strongest lift?", "How's my push volume?", "Why might I be plateauing?", "Remember: I train at home"];

export default function CoachPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { workouts, loading: workoutsLoading } = useWorkouts();
  const toast = useToast();
  const { units } = useUnits();
  const { targets } = useMuscleTargets();
  const memory = useCoachMemory();
  const { metrics } = useBodyMetrics();
  const [goal] = useSetting(WEEKLY_GOAL_SETTING);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  /** The reply being written right now (streamed text, or empty while waiting). */
  const [live, setLive] = useState<{ id: string; text: string; label: string } | null>(null);
  const [streaming, setStreaming] = useState(false);
  /** Notes the coach saved, shown under the reply that saved them. */
  const [remembered, setRemembered] = useState<Record<string, string[]>>({});
  const [memoryOpen, setMemoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latest = useRef("");
  const busy = live !== null;

  // Subscribe to persisted chat history
  useEffect(() => {
    if (!user) return;
    return subscribeToCoachMessages(user.uid, (m) => {
      setMessages(m);
      setLoaded(true);
    });
  }, [user]);

  // The live bubble steps aside once its saved copy shows up in the history.
  useEffect(() => {
    if (live && messages.some((m) => m.id === live.id)) setLive(null);
  }, [messages, live]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: live?.text ? "auto" : "smooth" });
  }, [messages, live]);

  const stats = useMemo(() => muscleStatus(workouts, targets), [workouts, targets]);
  const bodyweight = useMemo(() => {
    const weights = weightsFromMetrics(metrics);
    const series = trendSeries(weights, dayKey(new Date()));
    const last = series[series.length - 1];
    return last ? { trend: last.trend, ratePerWeek: weeklyRate(weights, dayKey(new Date())) } : null;
  }, [metrics]);

  const send = async (text?: string) => {
    if (!user || busy) return;
    const message = (text ?? input).trim();
    if (!message) return;
    setInput("");
    // A built workout's card isn't in its text, so spell the plan out for the model.
    const history = [
      ...messages.slice(-10).map((m) => ({
        role: m.role,
        text: m.workout ? `${m.text}\n(Built "${m.workout.name}": ${m.workout.exercises.map((e) => e.name).join(", ")})` : m.text,
      })),
      { role: "user" as const, text: message },
    ];
    void appendCoachMessage(user.uid, "user", message).catch(() => toast.error("Couldn't save your message."));

    const id = newCoachMessageId(user.uid);
    const controller = new AbortController();
    abortRef.current = controller;
    latest.current = "";
    setStreaming(true);
    setLive({ id, text: "", label: "Coach is typing" });
    try {
      const full = await streamCoach({
        messages: history,
        context: coachContext({ workouts, stats, goal, units, memory: memory.texts, bodyweight }),
        signal: controller.signal,
        onText: (t) => {
          latest.current = t;
          setLive({ id, text: t, label: "Coach is typing" });
        },
      });
      const reply = visibleReply(full) || "Hmm, no response — try again?";
      void appendCoachMessage(user.uid, "model", reply, { id }).catch(() => setLive(null));
      const edits = memoryEdits(full);
      if (edits.add.length || edits.remove.length) {
        const added = await memory.update(edits.add, edits.remove);
        if (added.length) setRemembered((r) => ({ ...r, [id]: added }));
      }
    } catch (e) {
      if (controller.signal.aborted) {
        const partial = visibleReply(latest.current);
        if (partial) void appendCoachMessage(user.uid, "model", `${partial} …`, { id }).catch(() => setLive(null));
        else setLive(null);
      } else {
        const friendly = formatCoachError(e instanceof Error ? e.message : "Unknown error");
        toast.error(friendly);
        void appendCoachMessage(user.uid, "model", `_Couldn't reach the coach:_ **${friendly}**`, { id }).catch(() => setLive(null));
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  };

  /** Builds today's session from this week's balance and opens it as a card in the chat. */
  const build = async () => {
    if (!user || busy) return;
    void appendCoachMessage(user.uid, "user", "Build today's workout").catch(() => {});
    const id = newCoachMessageId(user.uid);
    setLive({ id, text: "", label: "Building your session" });
    try {
      const plan = await generateWorkout({ request: "", focus: autoFocus(stats), auto: true, workouts, stats, memory: memory.texts, units });
      // The card shows the name, targets and exercises; the text says why.
      const text = plan.why || `Here's ${plan.name} for today.`;
      void appendCoachMessage(user.uid, "model", text, {
        id,
        workout: { name: plan.name, why: plan.why, targetMuscles: plan.targetMuscles, exercises: plan.exercises },
      }).catch(() => setLive(null));
    } catch (e) {
      const friendly = formatCoachError(e instanceof Error ? e.message : "Unknown error");
      toast.error(friendly);
      void appendCoachMessage(user.uid, "model", `_Couldn't build a workout:_ **${friendly}**`, { id }).catch(() => setLive(null));
    }
  };

  const start = (w: NonNullable<CoachMessage["workout"]>) => {
    stashWorkout({
      name: w.name,
      targetMuscles: w.targetMuscles,
      // Fresh ids: the same plan can be started more than once.
      exercises: w.exercises.map((ex) => ({ ...ex, id: newId(), sets: ex.sets.map((s) => ({ ...s, id: newId(), completed: false })) })),
    });
    router.push("/log?handoff=1");
  };

  // The intro quotes the workout count, so it waits for workouts too; history alone can show at once.
  const chatReady = loaded && (messages.length > 0 || !workoutsLoading);

  return (
    // Phones: the chat fills the space between the top bar and the dock, input pinned above the dock.
    <div className="-mx-5 -mb-[calc(var(--dock-h)_+_32px)] -mt-5 flex h-[calc(100dvh_-_3.5rem_-_1px_-_var(--dock-h)_-_env(safe-area-inset-top))] flex-col lg:mx-auto lg:my-0 lg:h-[calc(100dvh_-_80px)] lg:max-w-[640px] lg:gap-4">
      <header className="hidden shrink-0 lg:block">
        <p className="label">Coach</p>
        <h1 className="text-3xl font-extrabold tracking-tight">AI Coach</h1>
        <p className="text-sm text-ink-2">Personalized to your data. Chat history is saved.</p>
      </header>

      <section className="flex min-h-0 flex-1 flex-col bg-bg lg:plunk lg:face-card" style={{ ["--d" as string]: "5px" }} aria-label="Chat with your coach">
        <div className="flex shrink-0 items-center gap-2 border-b border-line-soft px-4 py-2">
          <span
            className="plunk face-violet hidden shrink-0 items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] sm:inline-flex"
            style={{ ["--d" as string]: "2px" }}
          >
            <Bot className="h-3 w-3" /> AI coach
          </span>
          <h1 className="sr-only lg:hidden">AI Coach</h1>
          {workoutsLoading ? (
            <Skeleton className="h-3 w-24" />
          ) : (
            <span className="num min-w-0 flex-1 truncate text-[11px] font-semibold text-ink-3">
              {workouts.length} workout{workouts.length === 1 ? "" : "s"}
              <span className="hidden sm:inline"> in context</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setMemoryOpen(true)}
            aria-label={`What the coach remembers (${memory.facts.length})`}
            className="flex h-9 shrink-0 items-center gap-1 border border-line px-2 text-[11px] font-bold text-ink-2 transition-colors hover:text-ink"
          >
            <Brain className="h-4 w-4" />
            <span className="num">{memory.facts.length}</span>
          </button>
          <Button variant="violet" size="sm" onClick={build} disabled={busy} className="shrink-0">
            <Sparkles className="h-4 w-4" /> Build workout
          </Button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {!chatReady && (
            // Chat history on its way: bubbles where the messages will be.
            <div className="space-y-3" aria-busy="true" aria-label="Loading chat">
              <div className="flex justify-end">
                <Skeleton className="h-9 w-2/5" />
              </div>
              <Skeleton className="h-20 w-4/5" />
              <div className="flex justify-end">
                <Skeleton className="h-9 w-1/3" />
              </div>
            </div>
          )}
          {chatReady && messages.length === 0 && !live && (
            <div className="space-y-1 py-2">
              <p className="font-bold">I have access to your {workouts.length} logged workouts.</p>
              <p className="text-sm text-ink-2">
                Ask about progress, programming or technique, or tap <strong className="text-ink">Build workout</strong> for a session aimed at what&apos;s behind this week.
              </p>
            </div>
          )}
          {chatReady &&
            messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap bg-lime px-3 py-2 text-[15px] font-medium text-on-accent">{m.text}</p>
                </div>
              ) : (
                <div key={m.id} className="max-w-[92%] space-y-2">
                  <div className="border-l-4 border-l-violet bg-elevated px-3 py-2 text-[15px] leading-relaxed">
                    <Markdown text={m.text} />
                  </div>
                  {m.workout && <WorkoutCard workout={m.workout} units={units} onStart={() => start(m.workout!)} />}
                  {remembered[m.id] && (
                    <p className="flex items-start gap-1.5 text-xs text-ink-2">
                      <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet" /> Remembered: {remembered[m.id]!.join("; ")}
                    </p>
                  )}
                </div>
              ),
            )}
          {live && !messages.some((m) => m.id === live.id) && (
            <div className="max-w-[92%] border-l-4 border-l-violet bg-elevated px-3 py-2 text-[15px] leading-relaxed" aria-label={live.label}>
              {visibleReply(live.text) ? (
                <>
                  <Markdown text={visibleReply(live.text)} />
                  <span className="pulse ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-violet" aria-hidden="true" />
                </>
              ) : (
                <div className="flex items-center gap-2 py-1">
                  <div className="pulse h-2 w-24 bg-ink-3/40" />
                  <span className="text-xs text-ink-3">{live.label}…</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-line-soft bg-bg p-3 lg:bg-transparent">
          {loaded && messages.length < 2 && !busy && (
            <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1" role="group" aria-label="Suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="chip min-h-8 shrink-0 text-xs">
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (streaming) abortRef.current?.abort();
              else void send();
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">Message your coach</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your coach…"
                enterKeyHint="send"
                className="box-input mb-1 h-12 px-3"
              />
            </label>
            {streaming ? (
              <button type="submit" aria-label="Stop" className="pop-btn danger w-12 px-0">
                <Square className="h-4 w-4" fill="currentColor" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send" className="pop-btn lime w-12 px-0">
                <Send className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>
      </section>

      <Modal open={memoryOpen} onClose={() => setMemoryOpen(false)} title="What the coach remembers">
        <div className="space-y-4 px-5 pb-5 pt-2">
          <p className="text-sm text-ink-2">
            Notes the coach keeps from your chats to tailor advice and workouts. Say &ldquo;remember that…&rdquo; to add one. Stored in your account.
          </p>
          {memory.facts.length === 0 ? (
            <p className="border border-dashed border-line-soft p-4 text-center text-sm text-ink-3">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-line-soft border-y border-line-soft">
              {memory.facts.map((f) => (
                <li key={f.text} className="flex items-start gap-2 py-2">
                  <p className="min-w-0 flex-1 text-sm">{f.text}</p>
                  <button
                    type="button"
                    onClick={() => void memory.forget(f.text)}
                    aria-label={`Forget "${f.text}"`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center text-ink-3 transition-colors hover:text-over"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {memory.facts.length > 0 && (
            <Button variant="ghost" onClick={() => void memory.clear()} className="text-over hover:text-over">
              Forget everything
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}

function WorkoutCard({ workout, units, onStart }: { workout: NonNullable<CoachMessage["workout"]>; units: Units; onStart: () => void }) {
  return (
    <div className="card p-3">
      <p className="flex items-center gap-1.5 font-bold">
        <Dumbbell className="h-4 w-4 text-violet" /> {workout.name}
      </p>
      {workout.targetMuscles && workout.targetMuscles.length > 0 && (
        <p className="mt-1.5 flex flex-wrap gap-1">
          {workout.targetMuscles.map((m) => (
            <span key={m} className="tag border border-violet/70 text-violet">
              {MUSCLE_LABELS[m]}
            </span>
          ))}
        </p>
      )}
      <ol className="mt-2 space-y-1 text-sm">
        {workout.exercises.map((ex, i) => {
          const work = ex.sets.filter((s) => !s.warmup);
          const top = work.reduce((m, s) => Math.max(m, s.kg), 0);
          return (
            <li key={`${ex.name}-${i}`} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">
                <span className="num mr-1.5 text-xs font-bold text-ink-3">{i + 1}</span>
                {ex.name}
              </span>
              <span className="num shrink-0 text-xs text-ink-2">
                {work.length} × {[...new Set(work.map((s) => s.reps))].join("/")}
                {top > 0 ? ` · ${displayWeight(top, units, 1)} ${units}` : ""}
              </span>
            </li>
          );
        })}
      </ol>
      <Button variant="violet" size="sm" className="mt-3" onClick={onStart}>
        <Dumbbell className="h-4 w-4" /> Start this workout
      </Button>
    </div>
  );
}
