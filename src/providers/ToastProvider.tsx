"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { uid } from "@/lib/utils";

type Variant = "success" | "error" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  message: string;
  variant: Variant;
  action?: ToastAction;
}

interface ToastCtx {
  show: (message: string, variant?: Variant, opts?: { action?: ToastAction; durationMs?: number }) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
  /** A success toast with an Undo button, kept up a little longer. */
  undo: (message: string, onUndo: () => void) => void;
}

const Ctx = createContext<ToastCtx>({
  show: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
  undo: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastCtx["show"]>(
    (message, variant = "info", opts) => {
      const id = uid();
      setToasts((cur) => [...cur, { id, message, variant, action: opts?.action }]);
      window.setTimeout(() => dismiss(id), opts?.durationMs ?? (opts?.action ? 6000 : 4000));
    },
    [dismiss],
  );

  const api = useMemo<ToastCtx>(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
      info: (m) => show(m, "info"),
      undo: (m, onUndo) => show(m, "success", { action: { label: "Undo", onClick: onUndo } }),
    }),
    [show],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-5"
        style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`backdrop flex w-full max-w-[390px] items-start gap-3 border border-line border-l-[6px] bg-elevated px-4 py-3 text-sm font-semibold shadow-[4px_4px_0_#000] ${
              t.variant === "success" ? "border-l-ok" : t.variant === "error" ? "border-l-over" : "border-l-violet"
            }`}
          >
            {t.variant === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
            ) : t.variant === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-over" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
            )}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  dismiss(t.id);
                  t.action!.onClick();
                }}
                className="-my-1 shrink-0 border border-ink px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] transition-colors hover:bg-lime hover:text-on-accent"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-m-1 p-1 text-ink-3 transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
