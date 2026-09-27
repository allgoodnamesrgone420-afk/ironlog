"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useToast } from "@/providers/ToastProvider";
import { appendCoachMessage, subscribeToCoachMessages } from "@/lib/firebase/repository";
import { callGemini } from "@/lib/ai/gemini-client";
import { COACH_SYSTEM_PROMPT } from "@/lib/ai/system-prompts";
import { computePRs } from "@/lib/analytics/personal-records";
import { Markdown } from "@/components/coach/Markdown";
import type { CoachMessage } from "@/types/ai";

export default function CoachPage() {
  const { user } = useAuth();
  const { workouts } = useWorkouts();
  const toast = useToast();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to persisted chat history
  useEffect(() => {
    if (!user) return;
    return subscribeToCoachMessages(user.uid, setMessages);
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = async (text?: string) => {
    if (!user) return;
    const message = (text ?? input).trim();
    if (!message) return;
    setInput("");
    await appendCoachMessage(user.uid, "user", message);
    setTyping(true);

    try {
      const recent = workouts.slice(0, 10).map((w) => ({
        date: w.date.toLocaleDateString(),
        name: w.name,
        volume: Math.round(w.totalVolume),
        exercises: w.exercises.map((e) => e.name).join(", "),
      }));
      const prs = computePRs(workouts).slice(0, 10);
      const history = [...messages.slice(-10), { role: "user", text: message }]
        .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.text}`)
        .join("\n");

      const systemInstruction = `${COACH_SYSTEM_PROMPT}

USER DATA CONTEXT:
- Recent workouts: ${JSON.stringify(recent)}
- Personal records: ${JSON.stringify(prs)}

CONVERSATION (oldest → newest):
${history}`;

      const result = await callGemini<string>(message, systemInstruction);
      const text = typeof result === "string" ? result : JSON.stringify(result);
      await appendCoachMessage(user.uid, "model", text || "Hmm, no response — try again?");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Unknown error";
      const friendly = formatCoachError(raw);
      toast.error(friendly);
      await appendCoachMessage(user.uid, "model", `_Couldn't reach the coach:_ **${friendly}**`);
    } finally {
      setTyping(false);
    }
  };

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

  const suggestions = [
    "What's my strongest lift?",
    "Suggest a leg session",
    "How's my push volume?",
    "Why might I be plateauing?",
  ];

  return (
    <div className="mx-auto flex h-[calc(100dvh_-_var(--dock-h)_-_112px_-_env(safe-area-inset-top))] min-h-[440px] max-w-[640px] flex-col gap-4 lg:h-[calc(100dvh_-_80px)]">
      <header className="shrink-0">
        <p className="label">Coach</p>
        <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">AI Coach</h1>
        <p className="text-sm text-ink-2">Personalized to your data. Chat history is saved.</p>
      </header>

      <section className="plunk face-card flex min-h-0 flex-1 flex-col" style={{ ["--d" as string]: "5px" }} aria-label="Chat with your coach">
        <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
          <span
            className="plunk face-violet inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em]"
            style={{ ["--d" as string]: "2px" }}
          >
            <Bot className="h-3 w-3" /> AI coach
          </span>
          <span className="num text-[11px] font-semibold text-ink-3">
            {workouts.length} workout{workouts.length === 1 ? "" : "s"} in context
          </span>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="space-y-1 py-2">
              <p className="font-bold">I have access to your {workouts.length} logged workouts.</p>
              <p className="text-sm text-ink-2">Ask about progress, programming, or technique.</p>
            </div>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap bg-lime px-3 py-2 text-sm font-medium text-on-accent">{m.text}</p>
              </div>
            ) : (
              <div key={m.id} className="max-w-[92%] border-l-4 border-l-violet bg-elevated px-3 py-2 text-[15px] leading-relaxed">
                <Markdown text={m.text} />
              </div>
            ),
          )}
          {typing && (
            <div className="max-w-[60%] border-l-4 border-l-violet bg-elevated px-3 py-3" aria-label="Coach is typing">
              <div className="pulse h-2 w-24 bg-ink-3/40" />
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-line-soft p-3">
          {messages.length < 2 && (
            <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1" role="group" aria-label="Suggestions">
              {suggestions.map((s) => (
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
              send();
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
            <button type="submit" disabled={!input.trim() || typing} aria-label="Send" className="pop-btn lime w-12 px-0">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
