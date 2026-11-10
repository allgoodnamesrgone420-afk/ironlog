"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Link as LinkIcon, Minus, Pause, Play, Plus, SkipForward, Sun, Trophy, Undo2, X } from "lucide-react";
import type { Exercise, Workout, WorkoutSet } from "@/types/workout";
import type { Units } from "@/types/user";
import { useTimer } from "@/providers/TimerProvider";
import { groupBySupersets } from "@/lib/workout/editing";
import { bestSetFor, isSessionPR, lastSessionFor } from "@/lib/analytics/personal-records";
import { displayWeight, fromKg, toKg } from "@/lib/units/converter";
import { prefersReducedMotion } from "@/lib/motion";
import { findExercise } from "@/lib/data/exercises";
import { Button } from "@/components/ui/Button";
import { formatSet, nextTarget } from "./ExerciseCard";
import { NumberField, stepWeightKg } from "./SetRow";

interface Props {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  workouts: Workout[];
  units: Units;
  startedAt: number;
  /** Volume of the completed sets, in kg (for the done screen). */
  volumeKg: number;
  timerEnabled: boolean;
  saving: boolean;
  onUpdateSet: (exId: string, setId: string, patch: Partial<WorkoutSet>) => void;
  onAddSet: (exId: string) => void;
  /** A set was just completed: the logger starts the rest timer. */
  onSetComplete: (ex: Exercise) => void;
  onFinish: () => void;
}

/** One set in the order Focus walks through them. */
interface Step {
  ex: Exercise;
  set: WorkoutSet;
  setIndex: number;
  /** "1", "2"… for working sets, "W" for warm-ups (as in the logger). */
  label: string;
  workTotal: number;
  exNumber: number;
  exTotal: number;
  inSuperset: boolean;
}

/**
 * Every set of every named exercise, in the order you'd do them: straight
 * through for a single exercise, alternating A1 B1 A2 B2 for a superset.
 */
function buildSteps(exercises: Exercise[]): Step[] {
  const named = exercises.filter((e) => e.name.trim());
  const steps: Step[] = [];
  const at = (ex: Exercise, i: number, inSuperset: boolean): Step => {
    let n = 0;
    const labels = ex.sets.map((s) => (s.warmup ? "W" : String(++n)));
    return {
      ex,
      set: ex.sets[i]!,
      setIndex: i,
      label: labels[i]!,
      workTotal: n,
      exNumber: named.indexOf(ex) + 1,
      exTotal: named.length,
      inSuperset,
    };
  };
  for (const group of groupBySupersets(named)) {
    if (group.length === 1) {
      group[0]!.sets.forEach((_, i) => steps.push(at(group[0]!, i, false)));
      continue;
    }
    const rounds = Math.max(...group.map((e) => e.sets.length));
    for (let i = 0; i < rounds; i++) for (const ex of group) if (ex.sets[i]) steps.push(at(ex, i, true));
  }
  return steps;
}

const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (x: number) => x.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};
const fmtRest = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

/** Keeps the screen awake while mounted, where the browser supports it. Returns whether it's held. */
function useWakeLock(active: boolean) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request("screen");
        if (gone) return void l.release();
        lock = l;
        setHeld(true);
        l.addEventListener("release", () => setHeld(false));
      } catch {
        setHeld(false); // battery saver, or the tab isn't visible
      }
    };
    // The browser drops the lock whenever the tab is hidden; take it again on return.
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
  return held;
}

// Sparks for the PR burst: 12 directions, alternating near and far.
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  const r = i % 2 ? 120 : 84;
  return {
    x: Math.round(Math.cos(a) * r),
    y: Math.round(Math.sin(a) * r),
    color: ["rgb(var(--lime))", "#ffb800", "rgb(var(--violet))", "rgb(var(--pink))"][i % 4],
  };
});

/**
 * Focus mode: the session one set at a time, full screen, for the gym floor.
 * Big steppers and one big button; swipe (or ← →) between sets. After each
 * set the rest timer takes over as a ring, with what's next underneath. The
 * screen stays awake while it's open.
 */
export function FocusMode(props: Props) {
  const { open, exercises, workouts, units, timerEnabled } = props;
  const timer = useTimer();
  const steps = useMemo(() => buildSteps(exercises), [exercises]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [resting, setResting] = useState(false);
  const [burst, setBurst] = useState(0);
  const [restOver, setRestOver] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [shake, setShake] = useState(0);
  /** "Add set" adds a set we don't know the id of yet: jump to it once it appears. */
  const [jumpToNew, setJumpToNew] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const awake = useWakeLock(open);

  const allDone = steps.length > 0 && steps.every((s) => s.set.completed);
  const doneCount = steps.filter((s) => s.set.completed).length;
  const idx = Math.max(0, steps.findIndex((s) => s.set.id === currentId));
  const step = steps[idx];

  // State that follows other state is adjusted here, during render, rather than
  // in effects (React re-renders straight away, before anything is painted).

  // Opening: start at the first set not done yet. Later edits keep your place.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setClosing(false);
      setReviewing(false);
      setResting(false);
      setCurrentId((steps.find((s) => !s.set.completed) ?? steps[steps.length - 1])?.set.id ?? null);
    }
  }

  if (jumpToNew) {
    const fresh = steps.find((s) => !s.set.completed);
    if (fresh) {
      setJumpToNew(false);
      setDir(1);
      setCurrentId(fresh.set.id);
    }
  }

  // Finishing the last set shows the done screen, even if you'd been reviewing.
  const [wasAllDone, setWasAllDone] = useState(allDone);
  if (allDone !== wasAllDone) {
    setWasAllDone(allDone);
    if (allDone) setReviewing(false);
  }

  // The countdown ending closes the rest screen and flags the next set.
  const [prevStatus, setPrevStatus] = useState(timer.status);
  if (timer.status !== prevStatus) {
    setPrevStatus(timer.status);
    if (timer.status === "done" || timer.status === "idle") setResting(false);
    if (prevStatus === "running" && timer.status === "done" && open) setRestOver(true);
  }
  useEffect(() => {
    if (!restOver) return;
    const t = setTimeout(() => setRestOver(false), 2200);
    return () => clearTimeout(t);
  }, [restOver]);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(0), 1500);
    return () => clearTimeout(t);
  }, [burst]);

  // While open: no page scroll behind, and keys go to Focus (handler below, kept fresh in a ref).
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => onKeyRef.current(e);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const swipe = useRef<{ x0: number; y0: number; dx: number; horizontal: boolean | null } | null>(null);

  if (!open || typeof document === "undefined") return null;

  onKeyRef.current = (e) => {
    // A sheet opened on top of Focus handles its own keys.
    if (document.querySelectorAll('[role="dialog"]').length > 1) return;
    if (e.key === "Escape") close();
    if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  };

  function close() {
    if (closing) return;
    setClosing(true);
    setTimeout(props.onClose, prefersReducedMotion() ? 0 : 160);
  }

  function go(delta: 1 | -1) {
    const next = steps[idx + delta];
    if (!next) return;
    setDir(delta);
    setCurrentId(next.set.id);
    setResting(false);
  }

  /** The first set not done after this one (wrapping round), skipping `skipId`. */
  const nextOpen = (skipId?: string) => {
    for (let k = 1; k <= steps.length; k++) {
      const s = steps[(idx + k) % steps.length]!;
      if (!s.set.completed && s.set.id !== skipId) return s;
    }
    return undefined;
  };

  const lastFor = (ex: Exercise) => lastSessionFor(workouts, ex.name);

  const complete = () => {
    if (!step) return;
    const { ex, set, setIndex } = step;
    const last = set.warmup ? null : lastFor(ex);
    // Empty boxes log what the grey hints show (last time's top set), as in the list.
    const patch: Partial<WorkoutSet> = { completed: true };
    if (last && !set.reps) {
      patch.reps = last.reps;
      if (!set.kg) patch.kg = last.kg;
    }
    const values = { kg: patch.kg ?? set.kg, reps: patch.reps ?? set.reps };
    if (values.reps <= 0) {
      setShake((n) => n + 1);
      navigator.vibrate?.([30, 40, 30]);
      return;
    }
    const pr = isSessionPR(ex.sets, setIndex, values, bestSetFor(workouts, ex.name));
    props.onUpdateSet(ex.id, set.id, patch);
    navigator.vibrate?.(pr ? [20, 40, 30] : 12);
    if (pr) setBurst((n) => n + 1);
    props.onSetComplete(ex);
    const next = nextOpen(set.id);
    if (next) {
      setDir(1);
      setCurrentId(next.set.id);
      if (timerEnabled) setResting(true);
    }
  };

  // ─── Swipe between sets ────────────────────────────────────────────
  const setCardX = (dx: number, animate: boolean) => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms" : "none";
    el.style.transform = dx ? `translateX(${dx}px)` : "";
    el.style.opacity = dx ? String(Math.max(0.4, 1 - Math.abs(dx) / 400)) : "";
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    swipe.current = { x0: e.clientX, y0: e.clientY, dx: 0, horizontal: null };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    if (!s) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (s.horizontal === null && Math.hypot(dx, dy) > 8) {
      s.horizontal = Math.abs(dx) > Math.abs(dy);
      if (s.horizontal) e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!s.horizontal) return;
    // Resist at the ends, where there's nowhere to go.
    const blocked = (dx > 0 && idx === 0) || (dx < 0 && idx === steps.length - 1);
    s.dx = blocked ? dx * 0.25 : dx;
    setCardX(s.dx, false);
  };
  const onPointerUp = (cancelled: boolean) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s?.horizontal) return;
    const delta: 1 | -1 = s.dx < 0 ? 1 : -1;
    if (!cancelled && Math.abs(s.dx) > 70 && steps[idx + delta]) {
      go(delta); // the next card is a new element; it slides in on its own
    } else {
      setCardX(0, true);
    }
  };

  // ─── Pieces ────────────────────────────────────────────────────────
  const restingNow = resting && (timer.status === "running" || timer.status === "paused");
  const upNext = restingNow ? step : nextOpen(step?.set.id);

  const header = (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-3">
      <button
        type="button"
        onClick={close}
        aria-label="Close focus mode"
        className="flex h-10 w-10 shrink-0 items-center justify-center border border-line text-ink-2 transition-colors hover:text-ink"
      >
        <X className="h-5 w-5" />
      </button>
      <ol className="flex min-w-0 flex-1 items-center" aria-label={`${doneCount} of ${steps.length} sets done`}>
        {steps.map((s, i) => {
          const newExercise = i > 0 && steps[i - 1]!.ex.id !== s.ex.id && !s.inSuperset;
          return (
            <li
              key={s.set.id}
              className={`h-1.5 min-w-[3px] flex-1 transition-colors duration-300 ${newExercise ? "ml-1.5" : i > 0 ? "ml-[2px]" : ""} ${
                s.set.completed ? "bg-lime" : i === idx && !allDone ? "bg-ink" : "bg-line-soft"
              }`}
            />
          );
        })}
      </ol>
      <div className="shrink-0 text-right">
        <ElapsedClock startedAt={props.startedAt} />
        <p className="label flex items-center justify-end gap-1 leading-none" title={awake ? "Your screen stays on while Focus is open" : undefined}>
          {awake && <Sun className="h-3 w-3 text-lime" aria-label="Screen stays on" />}
          {doneCount}/{steps.length} sets
        </p>
      </div>
    </header>
  );

  let body: React.ReactNode;
  let footer: React.ReactNode = null;

  if (steps.length === 0) {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-xl font-extrabold">Nothing to focus on yet</p>
        <p className="text-sm text-ink-2">Name an exercise in the list first, then come back.</p>
        <Button onClick={close}>Back to list</Button>
      </div>
    );
  } else if (allDone && !reviewing) {
    const work = steps.filter((s) => !s.set.warmup).length;
    body = (
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-8 text-center">
        <span className="check-pop plunk face-lime flex h-24 w-24 items-center justify-center" style={{ ["--d" as string]: "6px" }}>
          <Check className="h-12 w-12" strokeWidth={3.5} />
        </span>
        <p className="label mt-8">Every set done</p>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight">That&rsquo;s the session.</h2>
        <div className="stagger mt-6 grid w-full max-w-[340px] grid-cols-3 gap-2">
          {[
            { label: "Time", value: fmtClock((Date.now() - props.startedAt) / 1000) },
            { label: "Sets", value: String(work) },
            { label: units, value: Math.round(fromKg(props.volumeKg, units)).toLocaleString() },
          ].map((t, i) => (
            <div key={t.label} className="card p-3" style={{ ["--i" as string]: i + 1 }}>
              <p className="num truncate text-xl font-extrabold tracking-tight">{t.value}</p>
              <p className="label">{t.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 w-full max-w-[340px] space-y-3">
          <Button variant="lime" size="lg" block onClick={props.onFinish} loading={props.saving}>
            <Check className="h-5 w-5" strokeWidth={3} /> Finish workout
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              block
              className="whitespace-nowrap px-3"
              onClick={() => {
                setJumpToNew(true);
                setReviewing(true);
                props.onAddSet(step!.ex.id);
              }}
            >
              <Plus className="h-4 w-4" /> Add set
            </Button>
            <Button variant="secondary" block className="whitespace-nowrap px-3" onClick={() => setReviewing(true)}>
              Review
            </Button>
          </div>
        </div>
      </div>
    );
  } else if (restingNow) {
    body = (
      <div className="fade-in flex min-h-full flex-col items-center justify-center px-6 py-3">
        <p className="label">Rest</p>
        <RestRing />
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => timer.addTime(-15)} className="pop-btn ghost h-14 w-16 px-0 text-base" aria-label="Rest 15 seconds less">
            −15
          </button>
          {timer.status === "running" ? (
            <button type="button" onClick={timer.pause} className="pop-btn ghost h-14 w-16 px-0" aria-label="Pause rest">
              <Pause className="h-5 w-5" />
            </button>
          ) : (
            <button type="button" onClick={timer.resume} className="pop-btn yellow h-14 w-16 px-0" aria-label="Resume rest">
              <Play className="h-5 w-5" />
            </button>
          )}
          <button type="button" onClick={() => timer.addTime(15)} className="pop-btn ghost h-14 w-16 px-0 text-base" aria-label="Rest 15 seconds more">
            +15
          </button>
        </div>
        {upNext && (
          <div className="mt-5 w-full max-w-[360px] border border-line bg-surface p-4">
            <p className="label">Up next</p>
            <p className="mt-1 truncate text-lg font-extrabold">{upNext.ex.name}</p>
            <p className="num text-sm text-ink-2">
              {upNext.set.warmup ? "Warm-up" : `Set ${upNext.label} of ${upNext.workTotal}`}
              {(upNext.set.kg > 0 || upNext.set.reps > 0) && ` · ${formatSet(upNext.set, units)}`}
            </p>
          </div>
        )}
      </div>
    );
    footer = (
      <footer className="mx-auto grid w-full max-w-[520px] shrink-0 grid-cols-2 gap-2 bg-bg px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <Button variant="secondary" size="lg" block className="whitespace-nowrap px-3" onClick={() => setResting(false)}>
          Adjust<span className="hidden min-[360px]:inline"> next</span>
        </Button>
        <Button
          size="lg"
          block
          className="whitespace-nowrap px-3"
          onClick={() => {
            timer.cancel();
            setResting(false);
          }}
        >
          <SkipForward className="h-5 w-5" /> Skip<span className="hidden min-[360px]:inline"> rest</span>
        </Button>
      </footer>
    );
  } else if (step) {
    const { ex, set } = step;
    const last = set.warmup ? null : lastFor(ex);
    const settings = [ex.settings?.seat && `Seat ${ex.settings.seat}`, ex.settings?.incline && `Incline ${ex.settings.incline}`].filter(Boolean);
    const timerLive = timer.status === "running" || timer.status === "paused";
    const bodyweight = findExercise(ex.name)?.equipment === "bodyweight" || last?.kg === 0;
    body = (
      <div
        className="flex min-h-full touch-pan-y flex-col px-5 pb-6 pt-5"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => onPointerUp(false)}
        onPointerCancel={() => onPointerUp(true)}
      >
        {timerLive && (
          <button
            type="button"
            onClick={() => setResting(true)}
            className="fade-in mb-4 flex items-center justify-between border border-line bg-elevated px-3 py-2 text-left"
          >
            <span className="label">{timer.status === "paused" ? "Rest paused" : "Resting"}</span>
            <span className="num flex items-center gap-1 text-lg font-extrabold">
              {fmtRest(timer.secondsLeft)} <ChevronRight className="h-4 w-4 text-ink-3" />
            </span>
          </button>
        )}
        {allDone && (
          <button
            type="button"
            onClick={() => setReviewing(false)}
            className="fade-in mb-4 flex items-center justify-between bg-lime px-3 py-2 text-left text-on-accent"
          >
            <span className="text-xs font-extrabold uppercase tracking-[0.1em]">Every set done</span>
            <span className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-[0.1em]">
              Finish <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        )}
        {restOver && (
          <p className="fade-in mb-4 bg-lime px-3 py-2 text-center text-sm font-extrabold uppercase tracking-[0.1em] text-on-accent" role="status">
            Rest&rsquo;s up. Go!
          </p>
        )}

        {/* Name and hints up top; the steppers sit low, in thumb reach above Done. */}
        <div ref={cardRef} key={set.id} className={`flex flex-1 flex-col ${dir > 0 ? "focus-in-next" : "focus-in-prev"}`}>
          <div className="flex items-center gap-2">
            <p className="label">
              Exercise {step.exNumber}/{step.exTotal}
            </p>
            {step.inSuperset && (
              <span className="tag text-warn">
                <LinkIcon className="h-3 w-3" /> Superset
              </span>
            )}
          </div>
          <h2 className="mt-1 line-clamp-2 text-[28px] font-extrabold leading-[1.1] tracking-tight">{ex.name}</h2>
          <p className="mt-2 flex items-center gap-2">
            <span
              className={`plunk inline-block px-2 py-0.5 text-[12px] font-extrabold uppercase tracking-[0.1em] ${set.warmup ? "face-yellow" : "face-lime"}`}
              style={{ ["--d" as string]: "3px" }}
            >
              {set.warmup ? "Warm-up" : `Set ${step.label} of ${step.workTotal}`}
            </span>
            {set.completed && (
              <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.08em] text-ok">
                <Check className="h-3.5 w-3.5" strokeWidth={3} /> Done
              </span>
            )}
          </p>
          {last && (
            <p className="num mt-3 text-sm text-ink-2">
              Last time <strong className="text-ink">{formatSet(last, units)}</strong>
              <span className="font-semibold text-ok"> · try {nextTarget(last, units)}</span>
            </p>
          )}
          {(ex.notes?.trim() || settings.length > 0) && (
            <p className="mt-1 truncate text-xs text-ink-2">
              {settings.join(" · ")}
              {settings.length > 0 && ex.notes?.trim() ? " · " : ""}
              {ex.notes?.trim() && <em>&ldquo;{ex.notes.trim()}&rdquo;</em>}
            </p>
          )}

          <div className="mt-auto space-y-3 pt-6">
            <BigStepper
              label={units}
              name="weight"
              disabled={set.completed}
              value={fromKg(set.kg, units)}
              placeholder={last && last.kg > 0 ? String(displayWeight(last.kg, units, 1)) : bodyweight ? "BW" : "0"}
              decimal
              onValue={(v) => props.onUpdateSet(ex.id, set.id, { kg: toKg(v, units) })}
              onStep={(d) => props.onUpdateSet(ex.id, set.id, { kg: stepWeightKg(set.kg, last?.kg, units, d) })}
            />
            <BigStepper
              key={`reps-${shake}`}
              label="reps"
              name="reps"
              shake={shake > 0}
              disabled={set.completed}
              value={set.reps}
              placeholder={last ? String(last.reps) : "0"}
              onValue={(v) => props.onUpdateSet(ex.id, set.id, { reps: Math.round(v) })}
              onStep={(d) => props.onUpdateSet(ex.id, set.id, { reps: Math.max(0, (set.reps || last?.reps || 0) + d) })}
            />
            {shake > 0 && !set.reps && <p className="text-center text-xs font-semibold text-over">How many reps? Enter them first.</p>}
          </div>
        </div>

        {upNext && upNext.set.id !== set.id && (
          <p className="num truncate pt-5 text-center text-xs text-ink-3">
            Next: <span className="font-semibold text-ink-2">{upNext.ex.name}</span>
            {upNext.set.warmup ? " · warm-up" : ` · set ${upNext.label}`}
          </p>
        )}
        <p className="pt-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">Swipe for other sets</p>
      </div>
    );
    footer = (
      <footer className="mx-auto flex w-full max-w-[520px] shrink-0 items-center gap-2 bg-bg px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={idx === 0}
          aria-label="Previous set"
          className="flex h-14 w-14 shrink-0 items-center justify-center border border-line text-ink-2 transition-colors hover:text-ink disabled:opacity-30"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        {set.completed ? (
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => props.onUpdateSet(ex.id, set.id, { completed: false })}>
            <Undo2 className="h-5 w-5" /> Not done
          </Button>
        ) : (
          <Button variant="lime" size="lg" className="flex-1" onClick={complete}>
            <Check className="h-6 w-6" strokeWidth={3} /> Done
          </Button>
        )}
        <button
          type="button"
          onClick={() => go(1)}
          disabled={idx >= steps.length - 1}
          aria-label="Next set"
          className="flex h-14 w-14 shrink-0 items-center justify-center border border-line text-ink-2 transition-colors hover:text-ink disabled:opacity-30"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </footer>
    );
  }

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Focus mode"
      className={`fixed inset-0 z-50 flex flex-col bg-bg outline-none ${closing ? "focus-exit" : "focus-enter"}`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {header}
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto h-full w-full max-w-[520px]">{body}</div>
      </div>
      {footer && <div className="border-t border-line">{footer}</div>}

      {burst > 0 && (
        <div key={burst} className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center" aria-hidden="true">
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="spark absolute h-2.5 w-2.5"
              style={{ backgroundColor: s.color, ["--sx" as string]: `${s.x}px`, ["--sy" as string]: `${s.y}px` }}
            />
          ))}
          <span className="pr-pop plunk face-yellow flex items-center gap-2 px-4 py-3 text-xl font-extrabold uppercase tracking-[0.08em]" style={{ ["--d" as string]: "5px" }}>
            <Trophy className="h-6 w-6" strokeWidth={2.5} /> New PR
          </span>
        </div>
      )}
      {burst > 0 && (
        <span className="sr-only" role="status">
          New personal record
        </span>
      )}
    </div>,
    document.body,
  );
}

/** Elapsed session time, ticking once a second. */
function ElapsedClock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <p role="timer" aria-label="Elapsed time" className="num text-base font-extrabold leading-tight">
      {fmtClock((now - startedAt) / 1000)}
    </p>
  );
}

/** A gym-sized number box with −/+ either side. */
function BigStepper({
  label,
  name,
  value,
  placeholder,
  decimal = false,
  disabled,
  shake,
  onValue,
  onStep,
}: {
  label: string;
  name: string;
  value: number;
  placeholder: string;
  decimal?: boolean;
  disabled?: boolean;
  shake?: boolean;
  onValue: (v: number) => void;
  onStep: (d: -1 | 1) => void;
}) {
  const btn =
    "flex w-[72px] shrink-0 items-center justify-center text-ink-2 transition-colors hover:text-ink active:bg-elevated disabled:opacity-30";
  return (
    <div
      className={`flex h-[84px] items-stretch border-2 border-line bg-field focus-within:border-ink focus-within:shadow-[4px_4px_0_rgb(var(--lime))] ${
        shake ? "shake border-over" : ""
      } ${disabled ? "opacity-70" : ""}`}
    >
      <button type="button" className={btn} onClick={() => onStep(-1)} disabled={disabled} aria-label={`Less ${name}`}>
        <Minus className="h-7 w-7" strokeWidth={2.5} />
      </button>
      <label className="flex min-w-0 flex-1 flex-col items-center justify-center border-x border-line-soft">
        {disabled ? (
          <span className="num text-[40px] font-extrabold leading-none tracking-tight">{value > 0 ? Math.round(value * 100) / 100 : "—"}</span>
        ) : (
          <NumberField
            externalValue={value}
            onValue={onValue}
            decimal={decimal}
            label={name === "weight" ? `Weight (${label})` : "Reps"}
            placeholder={placeholder}
            className="num w-full min-w-0 bg-transparent text-center text-[40px] font-extrabold leading-none tracking-tight placeholder:text-ink-3 focus:outline-none"
          />
        )}
        <span className="label mt-1 leading-none">{label}</span>
      </label>
      <button type="button" className={btn} onClick={() => onStep(1)} disabled={disabled} aria-label={`More ${name}`}>
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/** The rest countdown as a ring that empties, following the clock every frame. */
function RestRing() {
  const { status, secondsLeft, totalDuration, endsAt } = useTimer();
  const ringRef = useRef<SVGCircleElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  const R = 45;
  const C = 2 * Math.PI * R;
  const smooth = status === "running" && endsAt !== null && totalDuration > 0 && !reduced;
  const share = totalDuration > 0 ? Math.min(1, secondsLeft / totalDuration) : 0;

  useLayoutEffect(() => {
    const el = ringRef.current;
    if (!smooth || !el || endsAt === null) return;
    let raf = 0;
    const frame = () => {
      const left = Math.min(1, Math.max(0, (endsAt - Date.now()) / (totalDuration * 1000)));
      el.style.strokeDashoffset = String(C * (1 - left));
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [smooth, endsAt, totalDuration, C]);

  const finalCount = status === "running" && secondsLeft > 0 && secondsLeft <= 3;
  const color = status === "paused" ? "rgb(var(--warn))" : "rgb(var(--lime))";

  return (
    <div className="relative mt-3 aspect-square w-[min(72vw,260px,30dvh)]" role="timer" aria-label={`Rest, ${secondsLeft} seconds left`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgb(var(--line-soft))" strokeWidth="6" />
        <circle
          ref={ringRef}
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="butt"
          strokeDasharray={C}
          // When smooth, the frame loop owns the offset.
          style={smooth ? undefined : { strokeDashoffset: C * (1 - share), transition: "stroke-dashoffset 300ms" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          key={finalCount ? secondsLeft : "clock"}
          className={`num text-[clamp(44px,8.5dvh,64px)] font-extrabold leading-none tracking-tight ${finalCount ? "tick-pulse" : ""}`}
        >
          {fmtRest(secondsLeft)}
        </span>
        <span className="label mt-2">{status === "paused" ? "Paused" : `of ${fmtRest(totalDuration)}`}</span>
      </div>
    </div>
  );
}
