import "server-only";
import type { NextResponse } from "next/server";

/**
 * Origin allow-list shared by the AI routes. With ALLOWED_ORIGINS unset, only
 * same-origin requests pass in production; in development any origin is
 * reflected so the app can be opened from another device on the network.
 */
const isDev = process.env.NODE_ENV !== "production";

/** True when the Origin header names the host this request was sent to. */
function isSameOrigin(origin: string, req: Request): boolean {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function configuredOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin requests omit Origin
  if (isSameOrigin(origin, req)) return true;
  const allowed = configuredOrigins();
  if (allowed.length === 0) return isDev;
  return allowed.includes(origin);
}

/** Value to echo in Access-Control-Allow-Origin, or null when none applies. */
function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null; // same-origin needs no CORS header
  const allowed = configuredOrigins();
  if (allowed.length === 0) return isDev ? origin : null;
  return allowed.includes(origin) ? origin : null;
}

export function withCors<T extends Response | NextResponse>(res: T, origin: string | null): T {
  const allow = allowedOrigin(origin);
  if (allow) {
    res.headers.set("Access-Control-Allow-Origin", allow);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.headers.set("Access-Control-Max-Age", "86400");
  }
  return res;
}
