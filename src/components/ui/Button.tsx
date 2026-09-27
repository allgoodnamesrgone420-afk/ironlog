"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "lime" | "violet" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Full width, leaving room for the 3D edge. */
  block?: boolean;
  loading?: boolean;
}

/** Pop-button face per variant (see .pop-btn in globals.css). */
const faces: Record<Exclude<Variant, "ghost">, string> = {
  primary: "",
  lime: "lime",
  violet: "violet",
  secondary: "ghost",
  danger: "danger",
};

/**
 * NeoPop "pop" button: a solid face with a 3D edge that presses in on tap.
 * `ghost` is the flat, text-only variant for tertiary actions.
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", block, loading, className, children, disabled, onClick, ...rest },
  ref,
) {
  const cls =
    variant === "ghost"
      ? cn(
          "inline-flex min-h-[44px] items-center justify-center gap-2 px-3 text-xs font-bold uppercase tracking-[0.1em] text-ink-2 transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-45",
          block && "w-full",
          className,
        )
      : cn("pop-btn", faces[variant], size !== "md" && size, block && "wide", className);

  return (
    <button
      ref={ref}
      className={cls}
      disabled={disabled || loading}
      onClick={(e) => {
        navigator.vibrate?.(10);
        onClick?.(e);
      }}
      {...rest}
    >
      {loading && (
        <span className="inline-block h-4 w-4 animate-spin border-2 border-current border-r-transparent" aria-hidden />
      )}
      {children}
    </button>
  );
});
