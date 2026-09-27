"use client";

import { Pause, Play, X, Minus, Plus, RotateCcw } from "lucide-react";
import { useTimer } from "@/providers/TimerProvider";

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
  const { status, secondsLeft, totalDuration, pause, resume, cancel, addTime, start } = useTimer();

  if (status === "idle") return null;

  const pct = totalDuration > 0 ? secondsLeft / totalDuration : 0;
  const isDone = status === "done";
  const isPaused = status === "paused";
  const isRunning = status === "running";
  const color = isDone ? "rgb(var(--ok))" : isPaused ? "rgb(var(--warn))" : "rgb(var(--lime))";

  return (
    <div
      role="timer"
      aria-live="polite"
      className="fixed inset-x-0 z-40 px-5 lg:left-60"
      style={{ bottom: "calc(var(--dock-h) + 12px)" }}
    >
      <div className="mx-auto max-w-[390px] border border-line bg-elevated shadow-[4px_4px_0_#000]">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <p className="num shrink-0 text-[28px] font-extrabold leading-none tracking-tight">{fmt(secondsLeft)}</p>
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
              <button aria-label="Pause" onClick={pause} className="flex h-9 w-9 items-center justify-center bg-lime text-on-accent">
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
          <div className="h-full transition-[width] duration-300" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}
