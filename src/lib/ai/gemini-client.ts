"use client";

import { auth } from "@/lib/firebase/client";

/**
 * POSTs to an AI route with the caller's ID token. A token minted before the
 * email was verified still says "unverified" for up to an hour, so on that
 * answer the account is re-read, the token refreshed and the call retried once.
 */
async function authedPost(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const send = async (forceRefresh: boolean) =>
    fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken(forceRefresh)}` },
      body: JSON.stringify(body),
      signal,
    });
  const res = await send(false);
  if (res.status !== 403) return res;
  const code = await res
    .clone()
    .json()
    .then((d: { code?: string }) => d.code)
    .catch(() => undefined);
  if (code !== "unverified") return res;
  await user.reload().catch(() => {});
  return user.emailVerified ? send(true) : res;
}

/**
 * Client-side wrapper for /api/gemini. Always attaches a fresh Firebase ID token
 * so the server can verify the caller before spending money on a model call.
 */
export async function callGemini<T = unknown>(
  prompt: string,
  systemInstruction?: string,
  opts: { jsonMode?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await authedPost(
    "/api/gemini",
    { prompt, systemInstruction: systemInstruction ?? "You are a helpful assistant.", jsonMode: !!opts.jsonMode },
    opts.signal,
  );

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Bad response from server (status ${res.status})`);
  }

  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  // Server returns the extracted text directly (or parsed JSON when jsonMode)
  return data as T;
}

/**
 * Streams a coach reply from /api/coach. `onText` gets the whole reply so far
 * after every chunk; resolves with the full text.
 */
export async function streamCoach(opts: {
  messages: { role: "user" | "model"; text: string }[];
  context: string;
  signal?: AbortSignal;
  onText: (full: string) => void;
}): Promise<string> {
  const res = await authedPost("/api/coach", { messages: opts.messages, context: opts.context }, opts.signal);
  if (!res.ok || !res.body) {
    let msg = `HTTP ${res.status}`;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* not JSON */
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    opts.onText(full);
  }
  full += decoder.decode();
  opts.onText(full);
  return full;
}
