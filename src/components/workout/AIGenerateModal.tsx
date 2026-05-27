"use client";

import { useState } from "react";
import { Sparkles, Loader2, Activity } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { callGemini } from "@/lib/ai/gemini-client";
import { WORKOUT_BUILDER_SYSTEM_PROMPT } from "@/lib/ai/system-prompts";
import { useToast } from "@/providers/ToastProvider";
import type { Exercise, Workout } from "@/types/workout";
import { uid } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  recent: Workout[];
  onApply: (workout: { name: string; exercises: Exercise[] }) => void;
}

interface AIResponse {
  workoutName: string;
  exercises: {
    name: string;
    notes?: string;
    restSec?: number;
    sets: { kg: number; reps: number; rpe?: number }[];
  }[];
}

export function AIGenerateModal({ open, onClose, recent, onApply }: Props) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const generate = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const history = recent.slice(0, 10).map((w) => ({
        date: w.date.toLocaleDateString(),
        name: w.name,
        exercises: w.exercises.map((e) => e.name).join(", "),
      }));
      const user = `USER HISTORY: ${JSON.stringify(history)}\n\nREQUEST: ${prompt}`;
      const result = await callGemini<AIResponse>(user, WORKOUT_BUILDER_SYSTEM_PROMPT, { jsonMode: true });
      if (!result?.exercises?.length) throw new Error("Empty response");

      const exercises: Exercise[] = result.exercises.map((ex) => ({
        id: uid(),
        name: ex.name,
        notes: ex.notes,
        restSec: ex.restSec ?? 90,
        sets: (ex.sets ?? []).map((s) => ({
          id: uid(),
          kg: Number(s.kg) || 0,
          reps: Number(s.reps) || 0,
          rpe: typeof s.rpe === "number" ? s.rpe : undefined,
          completed: false,
        })),
      }));
      onApply({ name: result.workoutName || "AI Workout", exercises });
      onClose();
      setPrompt("");
    } catch {
      toast.error("Couldn't generate a workout. Try a simpler prompt.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="AI workout builder">
      <div className="p-5 space-y-4">
        <div className="bg-brand-50 dark:bg-zinc-800 text-brand-700 dark:text-brand-400 text-xs p-3 rounded-lg flex gap-2 items-start">
          <Activity className="w-4 h-4 mt-0.5 shrink-0" />
          <p>Coach considers your last 10 sessions and applies progressive overload.</p>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="What's the goal? e.g. Push day, 45 min, focus on incline pressing"
          className="w-full border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-violet-500 outline-none resize-none"
        />
        <Button
          onClick={generate}
          loading={busy}
          disabled={!prompt.trim()}
          className="w-full bg-violet-600 hover:bg-violet-700"
          size="lg"
        >
          {busy ? (
            "Designing…"
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Generate
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
}
