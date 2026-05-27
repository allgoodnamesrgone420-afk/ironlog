"use client";

import { useEffect } from "react";
import { Pause, Play, X, Minus, Plus, RotateCcw } from "lucide-react";
import { useRestTimer } from "@/hooks/useRestTimer";

interface Props {
  defaultSec: number;
  trigger: number;
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RestTimer({ defaultSec, trigger }: Props) {
  const { secondsLeft, totalDuration, status, start, pause, resume, cancel, addTime } = useRestTimer();

  useEffect(() => {
    if (trigger > 0) start(defaultSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (status === "idle") return null;

  const pct = totalDuration > 0 ? secondsLeft / totalDuration : 0;
  const isDone = status === "done";
  const isPaused = status === "paused";
  const isRunning = status === "running";

  return (
    <div
      role="timer"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-32px)] text-white rounded-2xl px-4 py-3 flex items-center gap-3 bg-zinc-900/60 backdrop-blur-2xl backdrop-saturate-150 border border-white/10 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.08)]"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 90px)" }}
    >
      <div className="relative w-12 h-12 shrink-0">
        <svg viewBox="0 0 36 36" className="-rotate-90 w-full h-full">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke={isDone ? "#22c55e" : isPaused ? "#f59e0b" : "#3b82f6"}
            strokeWidth="3"
            strokeDasharray={`${pct * 97.4} 97.4`}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
          {fmt(secondsLeft)}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-400">
          {isDone ? "Done" : isPaused ? "Paused" : "Rest"}
        </div>
        <div className="text-sm font-semibold truncate">
          {isDone ? "Next set, let's go" : isPaused ? "Tap play to resume" : `${totalDuration}s default`}
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          aria-label="Subtract 15 seconds"
          onClick={() => addTime(-15)}
          className="p-2 rounded-full hover:bg-zinc-800 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          aria-label="Add 15 seconds"
          onClick={() => addTime(15)}
          className="p-2 rounded-full hover:bg-zinc-800 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
        >
          <Plus className="w-4 h-4" />
        </button>
        {isDone ? (
          <button
            aria-label="Restart timer"
            onClick={() => start(totalDuration || defaultSec)}
            className="p-2 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        ) : isRunning ? (
          <button
            aria-label="Pause"
            onClick={pause}
            className="p-2 rounded-full bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            aria-label="Resume"
            onClick={resume}
            className="p-2 rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        <button
          aria-label="Dismiss"
          onClick={cancel}
          className="p-2 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
