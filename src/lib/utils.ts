import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Relative day label by calendar day, so last night's session is "Yesterday", not "Today". */
export function daysAgo(date: Date) {
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  // Round rather than floor: DST days are 23 or 25 hours long.
  const days = Math.round((midnight(new Date()) - midnight(date)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function formatDate(date: Date, fmt: "short" | "long" | "weekday" = "short") {
  if (fmt === "long")
    return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  if (fmt === "weekday")
    return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function startOfWeek(d = new Date()): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Name for greetings: the display name, else the email's local part, capitalised. */
export function friendlyName(user: { displayName?: string | null; email?: string | null } | null | undefined) {
  return (user?.displayName || user?.email?.split("@")[0] || "Athlete").replace(/^./, (c) => c.toUpperCase());
}
