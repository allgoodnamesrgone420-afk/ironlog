"use client";

import { useEffect, useState } from "react";
import type { Units } from "@/types/user";
import { fromKg } from "@/lib/units/converter";
import { Button } from "@/components/ui/Button";

interface Props {
  startedAt: number;
  setsDone: number;
  setsTotal: number;
  /** Volume of the completed sets, in kg. */
  volumeKg: number;
  units: Units;
  saving: boolean;
  onFinish: () => void;
}

function fmtElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Pinned session header for the logger: elapsed time, sets done, volume and
 * Finish. Sticks under the phone top bar (to the top on desktop); the line
 * along its bottom edge fills as sets are completed.
 */
export function SessionBar({ startedAt, setsDone, setsTotal, volumeKg, units, saving, onFinish }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const pct = setsTotal > 0 ? (setsDone / setsTotal) * 100 : 0;
  const volume = Math.round(fromKg(volumeKg, units));

  return (
    <div className="sticky top-[calc(3.5rem_+_1px_+_env(safe-area-inset-top))] z-10 -mx-5 border-b border-line bg-bg/95 px-5 py-2.5 backdrop-blur-sm lg:top-0 lg:mx-0 lg:px-0">
      <div className="flex items-center gap-4 sm:gap-6">
        <div>
          <p role="timer" aria-label="Elapsed time" className="num text-xl font-extrabold leading-none tracking-tight">
            {fmtElapsed(now - startedAt)}
          </p>
          <p className="label mt-1">Time</p>
        </div>
        <div>
          <p className="num text-xl font-extrabold leading-none tracking-tight">
            <span key={setsDone} className="check-pop inline-block">
              {setsDone}
            </span>
            <span className="text-ink-3">/{setsTotal}</span>
          </p>
          <p className="label mt-1">Sets</p>
        </div>
        <div className="hidden min-w-0 min-[360px]:block">
          <p className="num truncate text-xl font-extrabold leading-none tracking-tight">
            {volume.toLocaleString()}
            <span className="ml-1 text-xs font-semibold text-ink-3">{units}</span>
          </p>
          <p className="label mt-1">Volume</p>
        </div>
        {/* The lime action once there is something to save. */}
        <Button
          variant={setsDone > 0 ? "lime" : "secondary"}
          size="sm"
          onClick={onFinish}
          loading={saving}
          className="ml-auto shrink-0"
        >
          Finish
        </Button>
      </div>
      <div
        className="absolute -bottom-px left-0 h-[3px] bg-lime transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-label="Sets done"
        aria-valuemin={0}
        aria-valuemax={setsTotal}
        aria-valuenow={setsDone}
      />
    </div>
  );
}
