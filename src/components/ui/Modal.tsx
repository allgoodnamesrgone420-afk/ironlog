"use client";

import { useEffect, type ReactNode } from "react";
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

/** Bottom sheet on phones, centered block with a hard shadow on desktop. */
export function Modal({ open, onClose, title, children, className }: Props) {
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

  // Portaled to <body>: page sections animate in with a transform (.stagger),
  // which would otherwise trap this fixed overlay inside that section.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="backdrop absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          "sheet relative max-h-[88dvh] w-full max-w-[430px] overflow-y-auto border-t-4 border-lime bg-surface lg:max-w-[520px] lg:border-4 lg:shadow-[8px_8px_0_#000]",
          className,
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {title !== undefined && (
          <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-5">
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
        {children}
      </div>
    </div>,
    document.body,
  );
}
