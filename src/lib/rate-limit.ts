import "server-only";
import { adminDb } from "./firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Firestore-backed sliding-window rate limiter. We store per-uid counters in
 * /rateLimits/{uid}/buckets/{minute}. Reads/writes go through the Admin SDK
 * (security rules block client writes).
 *
 * Default: 30 requests/minute, 200/day.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec?: number;
  reason?: "minute" | "day";
}

const MINUTE_LIMIT = 30;
const DAY_LIMIT = 200;

export async function checkAndIncrement(uid: string, scope = "gemini"): Promise<RateLimitResult> {
  const now = new Date();
  const minuteKey = `${scope}-${now.toISOString().slice(0, 16)}`; // YYYY-MM-DDTHH:MM
  const dayKey = `${scope}-${now.toISOString().slice(0, 10)}`;

  const db = adminDb();
  const userRef = db.collection("rateLimits").doc(uid);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const data = (snap.exists ? snap.data() : {}) as Record<string, { count: number; resetAt: Timestamp }>;

    const minute = data[minuteKey];
    const day = data[dayKey];

    const minuteCount = minute?.count ?? 0;
    const dayCount = day?.count ?? 0;

    if (minuteCount >= MINUTE_LIMIT) {
      const secondsToNextMin = 60 - now.getSeconds();
      return { ok: false, remaining: 0, retryAfterSec: secondsToNextMin, reason: "minute" as const };
    }
    if (dayCount >= DAY_LIMIT) {
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(24, 0, 0, 0);
      const retry = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
      return { ok: false, remaining: 0, retryAfterSec: retry, reason: "day" as const };
    }

    const patch: Record<string, { count: number; resetAt: Timestamp }> = {
      [minuteKey]: {
        count: minuteCount + 1,
        resetAt: Timestamp.fromDate(new Date(now.getTime() + 60_000)),
      },
      [dayKey]: {
        count: dayCount + 1,
        resetAt: Timestamp.fromDate(new Date(now.getTime() + 86_400_000)),
      },
    };

    // GC: drop any keys that have expired (so the doc doesn't grow unbounded)
    const fresh: typeof patch = {};
    for (const [k, v] of Object.entries(data)) {
      if (v.resetAt && v.resetAt.toMillis() > now.getTime()) fresh[k] = v;
    }
    Object.assign(fresh, patch);

    tx.set(userRef, fresh);
    return { ok: true, remaining: MINUTE_LIMIT - (minuteCount + 1) };
  });

  return result;
}
