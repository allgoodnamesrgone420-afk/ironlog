"use client";

import type { MuscleVolume } from "@/lib/analytics/muscle-groups";
import { MUSCLE_LABELS } from "@/lib/analytics/muscle-groups";

interface Props {
  intensity: MuscleVolume;
}

/**
 * Simple front-view body silhouette. Each region's fill alpha = relative weekly volume.
 * Tooltip on tap/hover shows the muscle name and the raw set count.
 */
export function BodyHeatmap({ intensity }: Props) {
  // Color from neutral (low) to brand-red (high)
  const color = (v: number) => {
    const a = Math.max(0.08, v);
    return `rgba(220, 38, 38, ${a.toFixed(2)})`;
  };

  return (
    <div className="flex gap-4 items-start">
      <svg viewBox="0 0 100 200" className="w-32 h-64 shrink-0">
        {/* Head */}
        <circle cx="50" cy="14" r="10" fill="rgba(161,161,170,0.2)" stroke="rgba(161,161,170,0.4)" strokeWidth="0.5" />
        {/* Torso */}
        <rect x="32" y="25" width="36" height="50" rx="6" fill="rgba(161,161,170,0.15)" stroke="rgba(161,161,170,0.4)" strokeWidth="0.5" />
        {/* Chest */}
        <path d="M34 30 Q50 28 66 30 L66 45 Q50 48 34 45 Z" fill={color(intensity.chest)} />
        {/* Shoulders */}
        <ellipse cx="26" cy="32" rx="8" ry="6" fill={color(intensity.shoulders)} />
        <ellipse cx="74" cy="32" rx="8" ry="6" fill={color(intensity.shoulders)} />
        {/* Arms */}
        <rect x="18" y="38" width="10" height="22" rx="4" fill={color(intensity.biceps)} />
        <rect x="72" y="38" width="10" height="22" rx="4" fill={color(intensity.biceps)} />
        <rect x="18" y="60" width="10" height="18" rx="4" fill={color(intensity.triceps)} />
        <rect x="72" y="60" width="10" height="18" rx="4" fill={color(intensity.triceps)} />
        {/* Forearms */}
        <rect x="19" y="78" width="8" height="20" rx="3" fill={color(intensity.forearms)} />
        <rect x="73" y="78" width="8" height="20" rx="3" fill={color(intensity.forearms)} />
        {/* Core */}
        <rect x="38" y="48" width="24" height="26" rx="3" fill={color(intensity.core)} />
        {/* Hips */}
        <rect x="32" y="76" width="36" height="8" rx="3" fill="rgba(161,161,170,0.15)" />
        {/* Quads */}
        <rect x="34" y="86" width="14" height="40" rx="4" fill={color(intensity.quads)} />
        <rect x="52" y="86" width="14" height="40" rx="4" fill={color(intensity.quads)} />
        {/* Hamstrings (rendered behind for visual — we just overlay on the quads region top half) */}
        {/* Calves */}
        <rect x="35" y="130" width="12" height="32" rx="4" fill={color(intensity.calves)} />
        <rect x="53" y="130" width="12" height="32" rx="4" fill={color(intensity.calves)} />
      </svg>

      <div className="flex-1 grid grid-cols-2 gap-1 text-xs">
        {(Object.keys(intensity) as (keyof typeof intensity)[])
          .filter((k) => k !== "cardio")
          .sort((a, b) => intensity[b] - intensity[a])
          .slice(0, 8)
          .map((k) => (
            <div key={k} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800/60">
              <span className="text-zinc-600 dark:text-zinc-400 truncate">{MUSCLE_LABELS[k]}</span>
              <span
                className="w-8 h-2 rounded-full"
                style={{ backgroundColor: color(intensity[k]) }}
                aria-label={`${Math.round(intensity[k] * 100)}%`}
              />
            </div>
          ))}
      </div>
    </div>
  );
}
