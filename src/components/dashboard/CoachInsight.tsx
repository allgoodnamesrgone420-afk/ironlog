"use client";

import { useState } from "react";
import { Sparkles, Zap, Loader2 } from "lucide-react";
import type { Workout } from "@/types/workout";
import { callGemini } from "@/lib/ai/gemini-client";
import { INSIGHT_SYSTEM_PROMPT } from "@/lib/ai/system-prompts";
import { useToast } from "@/providers/ToastProvider";

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
    } catch (e) {
      toast.error("Coach is offline — try again in a moment.");
      setTip("Consistency beats intensity. Show up.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10" aria-hidden>
        <Sparkles size={100} />
      </div>
      <h2 className="font-bold flex items-center gap-2 relative z-10">
        <Sparkles className="w-4 h-4 text-yellow-300" /> Coach&rsquo;s Insight
      </h2>
      <div className="mt-3 min-h-[60px] relative z-10">
        {loading ? (
          <div className="flex items-center gap-2 text-purple-200 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" /> Analyzing your last sessions…
          </div>
        ) : tip ? (
          <p className="text-base font-medium leading-relaxed animate-fade-in">&ldquo;{tip}&rdquo;</p>
        ) : (
          <p className="text-purple-100 text-sm">Get personalized advice based on your recent training.</p>
        )}
      </div>
      {!tip && !loading && (
        <button
          onClick={fetchTip}
          className="mt-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors min-h-[44px]"
        >
          <Zap className="w-4 h-4" /> Get insight
        </button>
      )}
    </div>
  );
}
