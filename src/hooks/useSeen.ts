"use client";

import { useEffect, useState } from "react";

/**
 * Flips to true the first time the element scrolls into view, and stays true.
 * Pass the returned ref to the element and put `data-seen={seen}` on it: bars
 * and counters below the fold then animate when the user reaches them instead
 * of while they're off screen.
 */
export function useSeen<T extends Element>() {
  // A callback ref (state, not useRef) so an element that mounts later is still observed.
  const [el, setEl] = useState<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, seen]);
  return [setEl, seen] as const;
}
