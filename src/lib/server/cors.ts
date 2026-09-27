import "server-only";
import type { NextResponse } from "next/server";

/**
 * Origin allow-list shared by the AI routes. With ALLOWED_ORIGINS unset,
 * same-origin requests pass and cross-origin ones are reflected (dev).
 */
function configuredOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin requests omit Origin
  const allowed = configuredOrigins();
  if (allowed.length === 0) return true; // dev: rely on CORS/preflight
  return allowed.includes(origin);
}

/** Value to echo in Access-Control-Allow-Origin, or null when none applies. */
function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null; // same-origin needs no CORS header
  const allowed = configuredOrigins();
  if (allowed.length === 0) return origin; // dev: reflect
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
