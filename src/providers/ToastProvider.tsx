"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { uid } from "@/lib/utils";

type Variant = "success" | "error" | "info";
interface Toast {
  id: string;
  message: string;
  variant: Variant;
}

interface ToastCtx {
  show: (message: string, variant?: Variant) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
}

const Ctx = createContext<ToastCtx>({
  show: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: Variant = "info") => {
      const id = uid();
      setToasts((cur) => [...cur, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const api: ToastCtx = {
    show,
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
    info: (m) => show(m, "info"),
  };

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
