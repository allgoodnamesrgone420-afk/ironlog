"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Status = "idle" | "running" | "paused" | "done";

interface TimerState {
  status: Status;
  secondsLeft: number;
  totalDuration: number;
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  addTime: (delta: number) => void;
}

const Ctx = createContext<TimerState | null>(null);

const STORAGE_KEY = "ironlog:restTimer";

interface Persisted {
  status: Status;
  totalDuration: number;
  endsAt?: number; // ms epoch when running
  secondsLeft?: number; // when paused
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const endAtRef = useRef<number>(0);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const persist = useCallback((p: Persisted | null) => {
    try {
      if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* quota */
    }
  }, []);

  const tick = useCallback(() => {
    const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
    setSecondsLeft(left);
    if (left <= 0) {
      clear();
      setStatus("done");
      persist(null);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([200, 80, 200]);
    }
  }, [clear, persist]);

  const start = useCallback(
    (seconds: number) => {
      clear();
      setTotalDuration(seconds);
      endAtRef.current = Date.now() + seconds * 1000;
      setSecondsLeft(seconds);
      setStatus("running");
      persist({ status: "running", totalDuration: seconds, endsAt: endAtRef.current });
      intervalRef.current = window.setInterval(tick, 250);
    },
    [clear, tick, persist],
  );

  const pause = useCallback(() => {
    clear();
    setStatus("paused");
    setSecondsLeft((s) => {
      persist({ status: "paused", totalDuration, secondsLeft: s });
      return s;
    });
  }, [clear, totalDuration, persist]);

  const resume = useCallback(() => {
    setStatus((s) => {
      if (s !== "paused") return s;
      endAtRef.current = Date.now() + secondsLeft * 1000;
      persist({ status: "running", totalDuration, endsAt: endAtRef.current });
      intervalRef.current = window.setInterval(tick, 250);
      return "running";
    });
  }, [secondsLeft, totalDuration, tick, persist]);

  const cancel = useCallback(() => {
    clear();
    setSecondsLeft(0);
    setTotalDuration(0);
    setStatus("idle");
    persist(null);
  }, [clear, persist]);

  const addTime = useCallback(
    (delta: number) => {
      setSecondsLeft((s) => Math.max(0, s + delta));
      setTotalDuration((d) => Math.max(0, d + delta));
      if (status === "running") endAtRef.current += delta * 1000;
    },
    [status],
  );

  // Restore on mount — survives refresh and tab close
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Persisted;
      if (p.status === "running" && p.endsAt) {
        const left = Math.ceil((p.endsAt - Date.now()) / 1000);
        if (left > 0) {
          endAtRef.current = p.endsAt;
          setTotalDuration(p.totalDuration);
          setSecondsLeft(left);
          setStatus("running");
          intervalRef.current = window.setInterval(tick, 250);
        } else {
          setStatus("done");
          setSecondsLeft(0);
          setTotalDuration(p.totalDuration);
        }
      } else if (p.status === "paused" && typeof p.secondsLeft === "number") {
        setStatus("paused");
        setTotalDuration(p.totalDuration);
        setSecondsLeft(p.secondsLeft);
      }
    } catch {
      /* corrupt */
    }
    return () => clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider value={{ status, secondsLeft, totalDuration, start, pause, resume, cancel, addTime }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTimer(): TimerState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTimer must be used inside <TimerProvider>");
  return ctx;
}
