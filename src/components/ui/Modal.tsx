"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

const SNAP_BACK = "220ms cubic-bezier(0.2, 0.8, 0.2, 1)";
const SLIDE_OUT = "180ms ease-in";

/**
 * Bottom sheet on phones, centered block with a hard shadow on desktop.
 * On phones the sheet can be dragged down by its top edge (handle and title) to close.
 */
export function Modal({ open, onClose, title, children, className }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; y: number; t: number; v: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  /** Moves the sheet down by `dy` px and fades the backdrop to match; no timing = follow the finger. */
  const setOffset = (dy: number, timing?: string) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = timing ? `transform ${timing}` : "none";
    sheet.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.style.transition = timing ? `opacity ${timing}` : "none";
      backdrop.style.opacity = dy > 0 ? String(Math.max(0, 1 - dy / sheet.offsetHeight)) : "";
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Phones only (the desktop dialog stays put), primary button, and not from the close button.
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    drag.current = { y0: e.clientY, y: e.clientY, t: e.timeStamp, v: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dt = e.timeStamp - d.t;
    if (dt > 0) d.v = (e.clientY - d.y) / dt;
    d.y = e.clientY;
    d.t = e.timeStamp;
    setOffset(Math.max(0, e.clientY - d.y0));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    const sheet = sheetRef.current;
    if (!d || !sheet) return;
    drag.current = null;
    const dy = Math.max(0, e.clientY - d.y0);
    // A flick counts only if the finger was still moving when it lifted.
    const flick = e.timeStamp - d.t < 100 && d.v > 0.5 && dy > 20;
    if (!cancelled && (dy > Math.min(140, sheet.offsetHeight / 3) || flick)) {
      setOffset(sheet.offsetHeight, SLIDE_OUT);
      window.setTimeout(() => {
        onClose();
        // If the parent keeps it open after all, bring the sheet back.
        requestAnimationFrame(() => setOffset(0, SNAP_BACK));
      }, 170);
    } else {
      setOffset(0, SNAP_BACK);
    }
  };

  // Portaled to <body>: page sections animate in with a transform (.stagger),
  // which would otherwise trap this fixed overlay inside that section.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div ref={backdropRef} className="backdrop absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={cn(
          "sheet relative max-h-[88dvh] w-full max-w-[430px] overflow-y-auto border-t-4 border-lime bg-surface lg:max-w-[520px] lg:border-4 lg:shadow-[8px_8px_0_#000]",
          className,
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          className="sticky top-0 z-10 touch-none select-none bg-surface lg:touch-auto lg:select-auto"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, false)}
          onPointerCancel={(e) => endDrag(e, true)}
        >
          <div className="flex justify-center pt-2.5 lg:hidden" aria-hidden="true">
            <span className="h-1 w-10 bg-line" />
          </div>
          {title !== undefined && (
            <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-2 lg:pt-5">
              <h2 className="text-xl font-bold leading-tight">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center text-ink-2 transition-colors hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
