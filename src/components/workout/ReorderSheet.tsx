"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronDown, ChevronUp, GripVertical, Link as LinkIcon } from "lucide-react";
import type { Exercise } from "@/types/workout";
import { groupBySupersets, moveGroup } from "@/lib/workout/editing";
import { Modal } from "@/components/ui/Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onChange: (next: Exercise[]) => void;
}

const GAP = 8; // px between rows (space-y-2)

/**
 * Compact list of the session's exercises: drag a row by its handle to move
 * it (touch or mouse), or use the arrows / arrow keys. Supersets move as one.
 */
export function ReorderSheet({ open, onClose, exercises, onChange }: Props) {
  const groups = groupBySupersets(exercises);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number } | null>(null);
  const start = useRef<{ y: number; centers: number[]; height: number } | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= groups.length) return;
    onChange(moveGroup(exercises, from, to));
    navigator.vibrate?.(8);
  };

  const onPointerDown = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const rows = rowRefs.current.slice(0, groups.length);
    start.current = {
      y: e.clientY,
      centers: rows.map((r) => (r ? r.offsetTop + r.offsetHeight / 2 : 0)),
      height: (rows[i]?.offsetHeight ?? 56) + GAP,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: i, to: i, dy: 0 });
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (!drag || !s) return;
    const dy = e.clientY - s.y;
    const center = s.centers[drag.from]! + dy;
    // New index = how many of the other rows sit above the dragged row's centre.
    const to = s.centers.filter((c, j) => j !== drag.from && c < center).length;
    if (to !== drag.to) navigator.vibrate?.(5);
    setDrag({ ...drag, to, dy });
  };

  const onPointerUp = () => {
    if (drag && drag.to !== drag.from) onChange(moveGroup(exercises, drag.from, drag.to));
    setDrag(null);
    start.current = null;
  };

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const to = i + (e.key === "ArrowUp" ? -1 : 1);
      move(i, to);
      // Keep focus on the handle as it moves.
      requestAnimationFrame(() => rowRefs.current[to]?.querySelector<HTMLButtonElement>("[data-handle]")?.focus());
    }
  };

  /** Where each row sits while another is dragged past it. */
  const shift = (i: number) => {
    if (!drag || !start.current || i === drag.from) return 0;
    const h = start.current.height;
    if (drag.from < i && i <= drag.to) return -h;
    if (drag.to <= i && i < drag.from) return h;
    return 0;
  };

  return (
    <Modal open={open} onClose={onClose} title="Reorder exercises">
      <div className="px-5 pb-5 pt-1">
        <p className="mb-3 text-xs text-ink-2">Drag the handle, or use the arrows. Supersets move together.</p>
        <ol className="relative space-y-2" aria-label="Exercise order">
          {groups.map((g, i) => {
            const dragging = drag?.from === i;
            const names = g.map((ex) => ex.name.trim() || "Untitled exercise");
            const sets = g.reduce((n, ex) => n + ex.sets.length, 0);
            return (
              <li
                key={g[0]!.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                className={`flex items-center gap-2 border bg-surface pr-1 ${
                  dragging ? "relative z-10 border-ink shadow-[4px_4px_0_rgb(var(--lime))]" : "border-line"
                } ${drag && !dragging ? "transition-transform duration-150" : ""}`}
                style={{ transform: `translateY(${dragging ? drag!.dy : shift(i)}px)` }}
              >
                <button
                  type="button"
                  data-handle
                  onPointerDown={onPointerDown(i)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={onKeyDown(i)}
                  aria-label={`Move ${names.join(" and ")}. Use arrow keys.`}
                  className={`flex h-14 w-11 shrink-0 touch-none items-center justify-center text-ink-3 hover:text-ink ${
                    dragging ? "cursor-grabbing" : "cursor-grab"
                  }`}
                >
                  <GripVertical className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1 py-2">
                  {g.length > 1 && (
                    <span className="mb-0.5 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-warn">
                      <LinkIcon className="h-3 w-3" /> Superset
                    </span>
                  )}
                  <p className="truncate font-bold">{names.join(" + ")}</p>
                  <p className="num text-xs text-ink-3">
                    {sets} set{sets === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move ${names[0]} up`}
                  className="flex h-10 w-9 items-center justify-center text-ink-2 transition-colors hover:text-ink disabled:opacity-25"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === groups.length - 1}
                  aria-label={`Move ${names[0]} down`}
                  className="flex h-10 w-9 items-center justify-center text-ink-2 transition-colors hover:text-ink disabled:opacity-25"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </Modal>
  );
}
