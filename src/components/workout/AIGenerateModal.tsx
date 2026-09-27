"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Sparkles, Target } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/providers/ToastProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { useMuscleTargets } from "@/hooks/useMuscleTargets";
import { useCoachMemory } from "@/hooks/useCoachMemory";
import { MUSCLE_LABELS } from "@/lib/analytics/muscle-groups";
import { displayWeight } from "@/lib/units/converter";
import {
  FOCUS_MUSCLES, autoFocus, exerciseMuscles, generateWorkout, muscleStatus, type BuiltWorkout,
} from "@/lib/ai/workout-builder";
import type { Exercise, MuscleGroup, Workout } from "@/types/workout";

interface Props {
  open: boolean;
  onClose: () => void;
  recent: Workout[];
  onApply: (workout: { name: string; exercises: Exercise[]; targetMuscles: MuscleGroup[] }) => void;
}

const label = (m: MuscleGroup) => MUSCLE_LABELS[m];

/**
 * Builds a session with the coach. You pick the muscles, or Auto picks the
 * ones furthest behind this week that have rested; the plan shows what each
 * exercise targets before it replaces anything.
 */
export function AIGenerateModal({ open, onClose, recent, onApply }: Props) {
  const toast = useToast();
  const { units } = useUnits();
  const { targets } = useMuscleTargets();
  const memory = useCoachMemory();
  const [picked, setPicked] = useState<MuscleGroup[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<BuiltWorkout | null>(null);

  const stats = useMemo(() => muscleStatus(recent, targets), [recent, targets]);
  const auto = useMemo(() => autoFocus(stats), [stats]);
  const focus = picked.length ? picked : auto;

  const toggle = (m: MuscleGroup) => setPicked((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  const generate = async () => {
    setBusy(true);
    try {
      setPlan(await generateWorkout({ request: prompt, focus, auto: picked.length === 0, workouts: recent, stats, memory: memory.texts, units }));
    } catch {
      toast.error("Couldn't build a workout. Try again, or simplify the request.");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setPlan(null);
    onClose();
  };

  const summary = (ex: Exercise) => {
    const work = ex.sets.filter((s) => !s.warmup);
    const warm = ex.sets.length - work.length;
    const top = work.reduce((m, s) => Math.max(m, s.kg), 0);
    const reps = [...new Set(work.map((s) => s.reps))].join("/");
    return `${work.length} × ${reps}${top > 0 ? ` · ${displayWeight(top, units, 1)} ${units}` : ""}${warm ? ` · ${warm} warm-up` : ""}`;
  };

  return (
    <Modal open={open} onClose={close} title="AI workout builder">
      {plan ? (
        <div className="space-y-4 px-5 pb-5 pt-2">
          <div>
            <p className="text-xl font-extrabold leading-tight">{plan.name}</p>
            <p className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="label">Targets</span>
              {plan.targetMuscles.map((m) => (
                <span key={m} className="tag solid bg-violet text-on-accent">
                  {label(m)}
                </span>
              ))}
            </p>
            {plan.why && <p className="mt-2 text-sm text-ink-2">{plan.why}</p>}
          </div>
          <ol className="divide-y divide-line-soft border-y border-line-soft">
            {plan.exercises.map((ex, i) => (
              <li key={ex.id} className="flex items-start gap-3 py-2.5">
                <span className="num mt-0.5 w-5 shrink-0 text-sm font-extrabold text-ink-3">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight">{ex.name}</p>
                  <p className="num mt-0.5 text-xs text-ink-2">{summary(ex)}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {exerciseMuscles(ex).map((m) => (
                      <span key={m} className={`tag ${plan.targetMuscles.includes(m) ? "border border-violet/70 text-violet" : "text-ink-3"}`}>
                        {label(m)}
                      </span>
                    ))}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPlan(null)} disabled={busy} className="shrink-0">
              <RotateCcw className="h-4 w-4" /> Change
            </Button>
            <Button
              variant="violet"
              block
              onClick={() => {
                onApply({ name: plan.name, exercises: plan.exercises, targetMuscles: plan.targetMuscles });
                setPrompt("");
                setPicked([]);
                close();
              }}
            >
              Use this workout
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 px-5 pb-5 pt-2">
          <div>
            <p className="label mb-2 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" /> Muscles to hit
            </p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Muscles to hit">
              <button type="button" aria-pressed={picked.length === 0} onClick={() => setPicked([])} className="chip min-h-8 px-2.5 text-xs">
                Auto
              </button>
              {FOCUS_MUSCLES.map((m) => (
                <button key={m} type="button" aria-pressed={picked.includes(m)} onClick={() => toggle(m)} className="chip min-h-8 px-2.5 text-xs">
                  {label(m)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-2" aria-live="polite">
              {picked.length === 0 ? (
                <>
                  Auto picks <strong className="text-ink">{auto.map(label).join(", ")}</strong>: furthest behind this week and rested.
                </>
              ) : (
                <>
                  Building around <strong className="text-ink">{picked.map(label).join(", ")}</strong>.
                </>
              )}
            </p>
          </div>
          <label className="field">
            <span>Anything else? (optional)</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              maxLength={400}
              placeholder="e.g. 45 min, dumbbells only, go easy on the shoulder"
              className="resize-none"
            />
          </label>
          <Button onClick={generate} loading={busy} variant="violet" size="lg" block>
            {busy ? (
              "Designing…"
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Build workout
              </>
            )}
          </Button>
          <p className="text-center text-[11px] text-ink-3">Uses your last sessions, this week&apos;s muscle balance and what the coach knows about you.</p>
        </div>
      )}
    </Modal>
  );
}
