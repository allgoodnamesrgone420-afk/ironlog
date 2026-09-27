"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Eases to `target`: up from 0 the first time, then from whatever is on screen
 * when it changes (even mid-animation). Holds at 0 until `enabled` (e.g. the
 * number has scrolled into view). Ported from Bite's useCountUp.
 */
export function useCountUp(target: number, duration = 600, enabled = true): number {
  const [value, setValue] = useState(0);
  const shown = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const start = shown.current;
    if (start === target || prefersReducedMotion()) {
      shown.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      shown.current = start + (target - start) * (1 - Math.pow(1 - p, 3));
      setValue(shown.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return value;
}

/** A number that counts up. Screen readers get the final value only. */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  duration,
  start = true,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  /** Hold at 0 until true. */
  start?: boolean;
}) {
  const shown = useCountUp(value, duration, start);
  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
