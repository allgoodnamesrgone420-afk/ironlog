import "server-only";
import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/firebase/admin";
import { checkAndIncrement } from "@/lib/rate-limit";
import { CoachStreamSchema } from "@/lib/validation/schemas";
import { COACH_SYSTEM_PROMPT } from "@/lib/ai/system-prompts";
import { checkOrigin, withCors } from "@/lib/server/cors";
import { geminiSseToText } from "@/lib/server/sse";

/**
 * Coach chat with streamed replies. Same guards as /api/gemini (origin, Firebase
 * ID token, per-user rate limit, validated body), then Gemini's SSE stream is
 * relayed to the browser as plain text, chunk by chunk.
 */

const STREAM_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse";

export const runtime = "nodejs"; // firebase-admin requires Node, not Edge
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req.headers.get("origin"));
}

const fail = (error: string, status: number, headers?: Record<string, string>) => NextResponse.json({ error }, { status, headers });

async function handlePost(req: Request): Promise<Response> {
  if (!checkOrigin(req)) return fail("Origin not allowed", 403);

  let uid: string;
  try {
    ({ uid } = await verifyBearerToken(req.headers.get("authorization")));
  } catch {
    return fail("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }
  const parsed = CoachStreamSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid request", 400);
  const { messages, context } = parsed.data;

  const rl = await checkAndIncrement(uid, "gemini");
  if (!rl.ok) {
    return fail(`Rate limit hit (${rl.reason}). Try again in ${rl.retryAfterSec ?? 60}s.`, 429, { "Retry-After": String(rl.retryAfterSec ?? 60) });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[/api/coach] GEMINI_API_KEY is not configured");
    return fail("Server misconfigured", 500);
  }

  // The model expects the conversation to open with the user.
  const turns = [...messages];
  while (turns.length > 1 && turns[0]!.role !== "user") turns.shift();

  let upstream: Response;
  try {
    // Key in a header rather than the URL, so it can't end up in request logs.
    upstream = await fetch(STREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        systemInstruction: { parts: [{ text: context ? `${COACH_SYSTEM_PROMPT}\n\n${context}` : COACH_SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.6, maxOutputTokens: 1200 },
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Upstream call failed", 502);
  }
  if (!upstream.ok || !upstream.body) {
    // Don't leak Google's verbose error messages to the client
    return fail("Model error", 502);
  }

  // Server-sent events → plain text, relayed as each chunk arrives.
  const stream = geminiSseToText(upstream.body);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: Request) {
  return withCors(await handlePost(req), req.headers.get("origin"));
}
