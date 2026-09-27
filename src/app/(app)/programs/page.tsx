"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange, Check, ChevronDown, Plus, Trash2, Dumbbell, Play, Star, Pencil, X,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { useToast } from "@/providers/ToastProvider";
import { usePrograms } from "@/hooks/usePrograms";
import {
  saveProgram, updateProgram, deleteProgram, setActiveProgram, advanceProgramCursor,
} from "@/lib/firebase/repository";
import { PRESET_PROGRAMS } from "@/lib/programs/presets";
import { clampCursor, missingTrainingMaxes } from "@/lib/programs/resolve";
import { fromKg, toKg } from "@/lib/units/converter";
import { uid } from "@/lib/utils";
import type { Program } from "@/types/program";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgramsSkeleton } from "@/components/ui/PageSkeletons";

export default function ProgramsPage() {
  const { user } = useAuth();
  const { units } = useUnits();
  const { programs, active, loading } = usePrograms();
  const toast = useToast();
  const router = useRouter();
  const [installing, setInstalling] = useState<string | null>(null);

  const allIds = useMemo(() => programs.map((p) => p.id), [programs]);

  const install = async (key: string) => {
    if (!user) return;
    const preset = PRESET_PROGRAMS.find((p) => p.key === key);
    if (!preset) return;
    setInstalling(key);
    try {
      const trainingMaxes: Record<string, number> = {};
      preset.trainingMaxLifts.forEach((l) => (trainingMaxes[l] = 0));
      await saveProgram(user.uid, {
        name: preset.name,
        description: preset.description,
        weeks: preset.build(),
        trainingMaxes,
        active: programs.length === 0, // first program installed becomes active
        cursor: { week: 0, day: 0 },
      });
      toast.success(`${preset.name} added`);
    } catch {
      toast.error("Couldn't add program.");
    } finally {
      setInstalling(null);
    }
  };

  const makeActive = async (p: Program) => {
    if (!user) return;
    try {
      await setActiveProgram(user.uid, p.id, allIds);
      toast.success(`${p.name} is now active`);
    } catch {
      toast.error("Couldn't activate.");
    }
  };

  const remove = async (p: Program) => {
    if (!user) return;
    try {
      await deleteProgram(user.uid, p.id);
      toast.success("Program deleted");
    } catch {
      toast.error("Couldn't delete.");
    }
  };

  const createBlank = async () => {
    if (!user) return;
    try {
      await saveProgram(user.uid, {
        name: "My Program",
        description: "",
        weeks: [{ label: "Week 1", days: [{ id: uid(), label: "Day 1", exercises: [] }] }],
        trainingMaxes: {},
        active: programs.length === 0,
        cursor: { week: 0, day: 0 },
      });
      toast.success("Blank program created — edit it below");
    } catch {
      toast.error("Couldn't create program.");
    }
  };

  return (
    <div className="stagger mx-auto max-w-[640px] space-y-6">
      <header className="flex items-end justify-between gap-3" style={{ ["--i" as string]: 0 }}>
        <div>
          <p className="label">Programs</p>
          <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">Train with a plan</h1>
        </div>
        <Button size="sm" variant="secondary" onClick={createBlank} className="shrink-0">
          <Plus className="h-4 w-4" /> Blank
        </Button>
      </header>

      {/* Installed programs */}
      {loading ? (
        <ProgramsSkeleton />
      ) : programs.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="h-6 w-6" />}
          title="No program yet"
          description="Add one of the templates below, or start a blank program and build your own."
        />
      ) : (
        <div className="space-y-4" style={{ ["--i" as string]: 1 }}>
          {programs.map((p) => (
            <ProgramRow
              key={p.id}
              program={p}
              units={units}
              isActive={active?.id === p.id}
              onActivate={() => makeActive(p)}
              onDelete={() => remove(p)}
              onStart={() => router.push(`/log?program=${p.id}`)}
              onSaveTM={async (name, kg) => {
                if (!user) return;
                await updateProgram(user.uid, p.id, {
                  trainingMaxes: { ...(p.trainingMaxes ?? {}), [name]: kg },
                });
              }}
              onJump={async (week, day) => {
                if (!user) return;
                await advanceProgramCursor(user.uid, p.id, { week, day });
                toast.success("Marked as next up");
              }}
              onRename={async (name) => {
                if (!user || !name.trim()) return;
                await updateProgram(user.uid, p.id, { name: name.trim() });
              }}
            />
          ))}
        </div>
      )}

      {/* Preset library */}
      <section className="space-y-3" style={{ ["--i" as string]: 2 }}>
        <p className="label">Templates</p>
        {PRESET_PROGRAMS.map((preset) => (
          <div key={preset.key} className="card flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <h3 className="font-bold">{preset.name}</h3>
              <p className="mt-1 text-xs text-ink-2">{preset.description}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => install(preset.key)}
              loading={installing === preset.key}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}

// ── Single program card ──────────────────────────────────────────────
function ProgramRow({
  program, units, isActive, onActivate, onDelete, onStart, onSaveTM, onJump, onRename,
}: {
  program: Program;
  units: "kg" | "lb";
  isActive: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onStart: () => void;
  onSaveTM: (name: string, kg: number) => Promise<void>;
  onJump: (week: number, day: number) => Promise<void>;
  onRename: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(isActive);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(program.name);
  const cursor = clampCursor(program, program.cursor);
  const needsTM = missingTrainingMaxes(program);
  const tmLifts = Object.keys(program.trainingMaxes ?? {});
  const cancelRename = () => {
    setNameDraft(program.name);
    setEditingName(false);
  };

  return (
    <Card>
      <div className="p-4">
        {editingName ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={async (e) => {
              e.preventDefault();
              await onRename(nameDraft);
              setEditingName(false);
            }}
          >
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && cancelRename()}
              maxLength={60}
              autoFocus
              aria-label="Program name"
              className="box-input min-w-0 flex-1 px-3 text-lg font-extrabold tracking-tight"
            />
            <button type="submit" aria-label="Save name" className="flex h-11 w-11 shrink-0 items-center justify-center bg-lime text-on-accent">
              <Check className="h-4 w-4" />
            </button>
            <button type="button" onClick={cancelRename} aria-label="Cancel rename" className="flex h-11 w-9 shrink-0 items-center justify-center text-ink-3 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </form>
        ) : (
          // The name block and the pencil are sibling buttons: a button can't contain other controls.
          <div className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="flex min-w-0 flex-1 items-start justify-between gap-2 text-left"
            >
              <span className="min-w-0">
                {isActive && (
                  <span className="tag solid mb-1.5 bg-lime text-on-accent">
                    <Star className="h-3 w-3" fill="currentColor" /> Active
                  </span>
                )}
                <span className="block truncate text-lg font-extrabold tracking-tight">{program.name}</span>
                <span className="num block text-xs text-ink-2">
                  {program.weeks.length} week{program.weeks.length !== 1 && "s"} ·{" "}
                  {program.weeks.reduce((n, w) => n + w.days.length, 0)} days · up to{" "}
                  {program.weeks[cursor.week]?.label ?? `Week ${cursor.week + 1}`} /{" "}
                  {program.weeks[cursor.week]?.days[cursor.day]?.label ?? "—"}
                </span>
              </span>
              <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setEditingName(true)}
              aria-label="Rename program"
              className="flex h-8 w-8 shrink-0 items-center justify-center text-ink-3 transition-colors hover:text-ink"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isActive && (
            <Button size="sm" variant="secondary" onClick={onActivate}>
              <Star className="h-4 w-4" /> Set active
            </Button>
          )}
          {isActive && (
            <Button size="sm" variant="lime" onClick={onStart}>
              <Play className="h-4 w-4" fill="currentColor" /> Start today
            </Button>
          )}
          <Confirm
            title="Delete program?"
            message={`"${program.name}" will be removed. Your logged workouts stay.`}
            confirmLabel="Delete"
            destructive
            onConfirm={onDelete}
            trigger={(openConfirm) => (
              <Button size="sm" variant="ghost" onClick={openConfirm} className="text-over hover:text-over" aria-label="Delete program">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          />
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-line-soft p-4">
          {/* Training maxes */}
          {tmLifts.length > 0 && (
            <div>
              <p className="label mb-2">Training maxes ({units})</p>
              {needsTM.length > 0 && (
                <p className="mb-2 text-[11px] font-semibold text-warn">
                  Set a value for every lift so percentages compute correctly.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {tmLifts.map((lift) => (
                  <TMInput
                    key={lift}
                    lift={lift}
                    units={units}
                    kg={program.trainingMaxes?.[lift] ?? 0}
                    onSave={(kg) => onSaveTM(lift, kg)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Week / day breakdown */}
          {program.weeks.map((week, wi) => (
            <div key={wi}>
              <p className="label mb-1.5">{week.label ?? `Week ${wi + 1}`}</p>
              <div className="space-y-1.5">
                {week.days.map((d, di) => {
                  const upNext = cursor.week === wi && cursor.day === di;
                  return (
                    <div
                      key={d.id}
                      className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
                        upNext ? "border-l-[6px] border-l-lime bg-elevated" : "bg-elevated/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-bold">{d.label}</span>
                        <span className="flex items-center gap-1 truncate text-xs text-ink-2">
                          <Dumbbell className="h-3 w-3 shrink-0" />
                          {d.exercises.map((e) => e.name).join(", ") || "No exercises"}
                        </span>
                      </div>
                      {upNext ? (
                        <span className="tag solid shrink-0 bg-lime text-on-accent">Up next</span>
                      ) : (
                        <button
                          onClick={() => onJump(wi, di)}
                          className="shrink-0 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3 hover:text-ink"
                        >
                          Set next
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Training-max input (debounced save on blur) ──────────────────────
function TMInput({
  lift, units, kg, onSave,
}: {
  lift: string;
  units: "kg" | "lb";
  kg: number;
  onSave: (kg: number) => void;
}) {
  const display = kg > 0 ? String(Math.round(fromKg(kg, units))) : "";
  const [val, setVal] = useState(display);

  return (
    <label className="field compact min-w-0">
      <span className="right-2 truncate">{lift}</span>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={() => {
          const n = parseFloat(val);
          onSave(Number.isFinite(n) && n > 0 ? toKg(n, units) : 0);
        }}
        inputMode="decimal"
        placeholder="0"
        className="num font-bold"
      />
    </label>
  );
}
