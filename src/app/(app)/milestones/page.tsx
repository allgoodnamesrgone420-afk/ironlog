"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { useUnits } from "@/providers/UnitsProvider";
import { useMilestones } from "@/hooks/useMilestones";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useSeen } from "@/hooks/useSeen";
import { milestoneProgress, nextMilestones, type Milestone, type MilestoneFamily } from "@/lib/analytics/milestones";
import { FAMILY, MilestoneTile, milestoneCopy } from "@/components/milestones/MilestoneBadge";
import { CountUp } from "@/components/ui/CountUp";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";

const ORDER: MilestoneFamily[] = ["sessions", "volume", "records", "streak", "strength"];

/** The trophy case: what you've earned, what's next, and how far along you are. */
export default function MilestonesPage() {
  const { units } = useUnits();
  const { workouts, loading } = useWorkouts();
  const { milestones, bodyweightKg } = useMilestones(workouts);
  const [open, setOpen] = useState<Milestone | null>(null);

  const earned = milestones.filter((m) => m.earned).length;
  const next = useMemo(() => nextMilestones(milestones), [milestones]);
  const latest = useMemo(
    () => milestones.filter((m) => m.earned).sort((a, b) => b.earned!.at.getTime() - a.earned!.at.getTime())[0],
    [milestones],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[640px] space-y-5" aria-busy="true">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stagger mx-auto max-w-[640px] space-y-7">
      <header style={{ ["--i" as string]: 0 }}>
        <p className="label">Milestones</p>
        <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">
          <CountUp value={earned} /> of {milestones.length} earned
        </h1>
        <div className="mt-3 h-2 bg-line-soft" role="progressbar" aria-label="Milestones earned" aria-valuemin={0} aria-valuemax={milestones.length} aria-valuenow={earned}>
          <div className="grow-x h-full bg-lime" style={{ width: `${(earned / milestones.length) * 100}%`, ["--delay" as string]: "150ms" }} />
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {latest
            ? `Latest: ${milestoneCopy(latest, units, bodyweightKg).title}, ${latest.earned!.at.toLocaleDateString(undefined, { day: "numeric", month: "short" })}.`
            : "Worked out from your log. Your first session earns the first one."}
        </p>
      </header>

      {next.length > 0 && (
        <section style={{ ["--i" as string]: 1 }} aria-label="Up next">
          <p className="label mb-2">Up next</p>
          <ul className="space-y-2">
            {next.map((m, i) => {
              const copy = milestoneCopy(m, units, bodyweightKg);
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => setOpen(m)} className="card flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-elevated">
                    <span className="w-11 shrink-0">
                      <MilestoneTile m={m} size="sm" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-bold">{copy.title}</span>
                        <span className="num shrink-0 text-xs font-bold">{Math.floor(milestoneProgress(m) * 100)}%</span>
                      </span>
                      <span className="mt-1.5 block h-1.5 bg-line-soft">
                        <span
                          className="grow-x block h-full"
                          style={{ width: `${milestoneProgress(m) * 100}%`, backgroundColor: FAMILY[m.family].color, ["--delay" as string]: `${250 + i * 80}ms` }}
                        />
                      </span>
                      <span className="num mt-1 block truncate text-xs text-ink-2">{copy.progress}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ORDER.map((family, fi) => (
        <FamilySection
          key={family}
          family={family}
          list={milestones.filter((m) => m.family === family)}
          index={fi + 2}
          units={units}
          bodyweightKg={bodyweightKg}
          onOpen={setOpen}
        />
      ))}

      <MilestoneSheet m={open} onClose={() => setOpen(null)} units={units} bodyweightKg={bodyweightKg} />
    </div>
  );
}

function FamilySection({ family, list, index, units, bodyweightKg, onOpen }: {
  family: MilestoneFamily;
  list: Milestone[];
  index: number;
  units: "kg" | "lb";
  bodyweightKg?: number;
  onOpen: (m: Milestone) => void;
}) {
  // Badges below the fold pop in when you scroll to them, not while off screen.
  const [ref, seen] = useSeen<HTMLElement>();
  const fam = FAMILY[family];
  const Icon = fam.icon;
  const got = list.filter((m) => m.earned).length;
  return (
    <section ref={ref} data-seen={seen} style={{ ["--i" as string]: Math.min(index, 4) }} aria-label={fam.label}>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-line-soft pb-2">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.1em]">
          <Icon className="h-4 w-4" style={{ color: fam.color }} /> {fam.label}
        </h2>
        <span className="num text-xs font-semibold text-ink-3">
          {got}/{list.length}
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
        {list.map((m, i) => {
          const copy = milestoneCopy(m, units, bodyweightKg);
          return (
            <li key={m.id} className={seen ? "badge-in" : "opacity-0"} style={{ ["--i" as string]: i }}>
              <button
                type="button"
                onClick={() => onOpen(m)}
                className="flex w-full flex-col items-stretch text-left transition-transform active:scale-95"
                aria-label={`${copy.title}: ${m.earned ? "earned" : copy.progress}`}
              >
                <MilestoneTile m={m} label={copy.short} shine={seen && !!m.earned} />
                <span className="mt-2 line-clamp-2 text-xs font-bold leading-tight">{copy.title}</span>
                <span className="num mt-0.5 truncate text-[11px] text-ink-3">
                  {m.earned ? m.earned.at.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" }) : copy.tile}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MilestoneSheet({ m, onClose, units, bodyweightKg }: {
  m: Milestone | null;
  onClose: () => void;
  units: "kg" | "lb";
  bodyweightKg?: number;
}) {
  if (!m) return null;
  const copy = milestoneCopy(m, units, bodyweightKg);
  const fam = FAMILY[m.family];
  return (
    <Modal open onClose={onClose} title={copy.title}>
      <div className="space-y-5 px-5 pb-6 pt-2">
        <div className="flex items-center gap-5">
          <span className="w-24 shrink-0">
            <MilestoneTile m={m} label={copy.short} size="lg" shine={!!m.earned} />
          </span>
          <div className="min-w-0">
            <p className={`label flex items-center gap-1 ${m.earned ? "text-ok" : ""}`}>
              {m.earned ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Lock className="h-3.5 w-3.5" />}
              {m.earned ? "Earned" : "Locked"} · {fam.label}
            </p>
            <p className="mt-1 text-sm text-ink-2">{copy.detail}</p>
          </div>
        </div>
        {m.earned ? (
          <Link href={`/workout?id=${m.earned.workoutId}`} className="card flex items-center justify-between gap-3 p-3 transition-colors hover:bg-elevated">
            <span className="min-w-0">
              <span className="label block">Earned in</span>
              <span className="block truncate font-bold">{m.earned.workoutName}</span>
            </span>
            <span className="num shrink-0 text-sm text-ink-2">
              {m.earned.at.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </span>
          </Link>
        ) : (
          <div>
            <div className="h-2 bg-line-soft">
              <div className="grow-x h-full" style={{ width: `${milestoneProgress(m) * 100}%`, backgroundColor: fam.color }} />
            </div>
            <p className="num mt-2 flex justify-between text-sm">
              <span className="text-ink-2">{copy.progress}</span>
              <span className="font-bold">{Math.floor(milestoneProgress(m) * 100)}%</span>
            </p>
            {m.needsBodyweight && (
              <Link href="/body" className="pop-btn sm mt-4">
                Log bodyweight
              </Link>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
