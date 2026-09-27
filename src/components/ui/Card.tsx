import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** "plunk" (default) is the raised NeoPop block; "flat" is a plain bordered card. */
  variant?: "plunk" | "flat";
}

/** Don't add overflow-hidden to a plunk card: its 3D edge is drawn outside the box. */
export function Card({ variant = "plunk", className, style, ...rest }: Props) {
  return (
    <div
      className={cn(variant === "plunk" ? "plunk face-card" : "card", className)}
      style={variant === "plunk" ? { ["--d" as string]: "4px", ...style } : style}
      {...rest}
    />
  );
}
