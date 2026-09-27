"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import type { Workout } from "@/types/workout";
import { callGemini } from "@/lib/ai/gemini-client";
import { INSIGHT_SYSTEM_PROMPT } from "@/lib/ai/system-prompts";
import { useToast } from "@/providers/ToastProvider";
import { Button } from "@/components/ui/Button";

export function CoachInsight({ workouts }: { workouts: Workout[] }) {
  const [tip, setTip] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const fetchTip = async () => {
    if (workouts.length === 0) {
      toast.info("Log a workout first so I have something to comment on.");
      return;
    }
    setLoading(true);
    try {
      const context = workouts.slice(0, 3).map((w) => ({
        name: w.name,
        date: w.date.toDateString(),
        volume: w.totalVolume,
        exercises: w.exercises.map((e) => e.name).join(", "),
      }));
      const prompt = `Analyze these recent workouts: ${JSON.stringify(context)}. Return JSON: {"tip": "string"} with one specific motivating insight (max 30 words).`;
      const result = await callGemini<{ tip: string } | string>(prompt, INSIGHT_SYSTEM_PROMPT, { jsonMode: true });
      const text = typeof result === "object" && result && "tip" in result ? result.tip : String(result);
      setTip(text || "Consistency beats intensity. Show up.");
    } catch {
      toast.error("Coach is offline — try again in a moment.");
      setTip("Consistency beats intensity. Show up.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="plunk face-violet p-5" style={{ ["--d" as string]: "5px" }} aria-live="polite">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">
        <Sparkles className="h-3.5 w-3.5" /> Coach&rsquo;s insight
      </p>
      {loading ? (
        <>
          <p className="pulse mt-3 text-sm font-bold uppercase tracking-[0.1em]">Analyzing your last sessions…</p>
          <div className="pulse mt-4 h-3 w-3/4 bg-black/20" />
          <div className="pulse mt-2 h-3 w-1/2 bg-black/20" />
        </>
      ) : tip ? (
        <p className="revealing mt-2 text-xl font-extrabold leading-snug">&ldquo;{tip}&rdquo;</p>
      ) : (
        <p className="mt-2 text-xl font-extrabold leading-tight">Get personalized advice based on your recent training.</p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {!tip && !loading ? (
          <Button onClick={fetchTip}>
            <Zap className="h-4 w-4" /> Get insight
          </Button>
        ) : (
          <span />
        )}
        <Link
          href="/coach"
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] underline decoration-2 underline-offset-4"
        >
          Open chat <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
