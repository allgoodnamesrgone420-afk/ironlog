"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Pause, Play, X, Minus, Plus, RotateCcw } from "lucide-react";
import { useTimer } from "@/providers/TimerProvider";
import { prefersReducedMotion } from "@/lib/motion";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const btn = "flex h-9 w-9 items-center justify-center border border-line text-ink-2 transition-colors hover:text-ink";

/**
 * Floating rest timer. Reads state from the global TimerProvider so it stays
 * alive when the user navigates between Log / Coach / Stats etc.
 * Rendered by the Log page; sits just above the phone dock.
 */
export function RestTimer() {
  const { status, secondsLeft, totalDuration, endsAt, pause, resume, cancel, addTime, start } = useTimer();
  const barRef = useRef<HTMLDivElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  // While running, the bar follows the clock every frame instead of stepping once a second.
  const smooth = status === "running" && endsAt !== null && totalDuration > 0 && !reduced;

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!smooth || !el || endsAt === null) return;
    let raf = 0;
    const frame = () => {
      const left = (endsAt - Date.now()) / (totalDuration * 1000);
      el.style.transform = `scaleX(${Math.min(1, Math.max(0, left))})`;
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [smooth, endsAt, totalDuration]);

  if (status === "idle") return null;

  const isDone = status === "done";
  const isPaused = status === "paused";
  const isRunning = status === "running";
  const pct = isDone ? 1 : totalDuration > 0 ? secondsLeft / totalDuration : 0;
  // The last three seconds beat once a second (keyed so each second restarts it).
  const finalCount = isRunning && secondsLeft > 0 && secondsLeft <= 3;
  const color = isDone ? "rgb(var(--ok))" : isPaused ? "rgb(var(--warn))" : "rgb(var(--lime))";

  return (
    <div
      role="timer"
      aria-label="Rest timer"
      aria-live="polite"
      className="fixed inset-x-0 z-40 px-5 lg:left-60"
      style={{ bottom: "calc(var(--dock-h) + 12px)" }}
    >
      <div className="mx-auto max-w-[390px] border border-line bg-elevated shadow-[4px_4px_0_#000]">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <p className="num shrink-0 text-[28px] font-extrabold leading-none tracking-tight">
            <span key={finalCount ? secondsLeft : "clock"} className={finalCount ? "tick-pulse" : "inline-block"}>
              {fmt(secondsLeft)}
            </span>
          </p>
          <div className="min-w-0 flex-1">
            <p className="label flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0" style={{ backgroundColor: color }} aria-hidden />
              {isDone ? "Done" : isPaused ? "Paused" : "Rest"}
            </p>
            <p className="truncate text-xs font-semibold">
              {isDone ? "Next set, let's go" : isPaused ? "Tap play to resume" : `${totalDuration}s default`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button aria-label="Subtract 15 seconds" onClick={() => addTime(-15)} className={btn}>
              <Minus className="h-4 w-4" />
            </button>
            <button aria-label="Add 15 seconds" onClick={() => addTime(15)} className={btn}>
              <Plus className="h-4 w-4" />
            </button>
            {isDone ? (
              <button
                aria-label="Restart timer"
                onClick={() => start(totalDuration || 60)}
                className="flex h-9 w-9 items-center justify-center bg-ok text-on-accent"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : isRunning ? (
              // Neutral like −/+: on the log screen the lime action is Finish.
              <button aria-label="Pause" onClick={pause} className={btn}>
                <Pause className="h-4 w-4" />
              </button>
            ) : (
              <button aria-label="Resume" onClick={resume} className="flex h-9 w-9 items-center justify-center bg-warn text-on-accent">
                <Play className="h-4 w-4" />
              </button>
            )}
            <button
              aria-label="Dismiss"
              onClick={cancel}
              className="flex h-9 w-7 items-center justify-center text-ink-3 transition-colors hover:text-over"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-1 bg-line-soft">
          <div
            ref={barRef}
            className={`h-full origin-left ${isDone ? "pulse" : ""}`}
            // When smooth, the frame loop owns the transform; React only sets the colour.
            style={smooth ? { backgroundColor: color } : { transform: `scaleX(${pct})`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}
