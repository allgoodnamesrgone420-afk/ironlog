"use client";

import { auth } from "@/lib/firebase/client";

/**
 * Client-side wrapper for /api/gemini. Always attaches a fresh Firebase ID token
 * so the server can verify the caller before spending money on a model call.
 */
export async function callGemini<T = unknown>(
  prompt: string,
  systemInstruction?: string,
  opts: { jsonMode?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const idToken = await user.getIdToken();

  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      prompt,
      systemInstruction: systemInstruction ?? "You are a helpful assistant.",
      jsonMode: !!opts.jsonMode,
    }),
    signal: opts.signal,
  });

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
