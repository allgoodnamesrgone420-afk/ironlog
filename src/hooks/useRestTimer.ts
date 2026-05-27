"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "running" | "paused" | "done";

/**
 * Countdown timer with real pause + resume.
 * - `start(seconds)` begins a fresh countdown
 * - `pause()` freezes the remaining time
 * - `resume()` continues from where it paused
 * - `cancel()` clears the timer entirely
 * - `addTime(±s)` adjusts remaining time on the fly
 */
export function useRestTimer() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const intervalRef = useRef<number | null>(null);
  const endAtRef = useRef<number>(0);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
    setSecondsLeft(left);
    if (left <= 0) {
      clear();
      setStatus("done");
      if ("vibrate" in navigator) navigator.vibrate([200, 80, 200]);
    }
  }, [clear]);

  const start = useCallback(
    (seconds: number) => {
      clear();
      setTotalDuration(seconds);
      endAtRef.current = Date.now() + seconds * 1000;
      setSecondsLeft(seconds);
      setStatus("running");
      intervalRef.current = window.setInterval(tick, 250);
    },
    [clear, tick],
  );

  const pause = useCallback(() => {
    clear();
    setStatus("paused");
  }, [clear]);

  const resume = useCallback(() => {
    setStatus((s) => {
      if (s !== "paused") return s;
      endAtRef.current = Date.now() + secondsLeft * 1000;
      intervalRef.current = window.setInterval(tick, 250);
      return "running";
    });
  }, [secondsLeft, tick]);

  const cancel = useCallback(() => {
    clear();
    setSecondsLeft(0);
    setTotalDuration(0);
    setStatus("idle");
  }, [clear]);

  const addTime = useCallback(
    (delta: number) => {
      setSecondsLeft((s) => Math.max(0, s + delta));
      setTotalDuration((d) => Math.max(0, d + delta));
      if (status === "running") endAtRef.current += delta * 1000;
    },
    [status],
  );

  useEffect(() => () => clear(), [clear]);

  return { secondsLeft, totalDuration, status, start, pause, resume, cancel, addTime };
}
