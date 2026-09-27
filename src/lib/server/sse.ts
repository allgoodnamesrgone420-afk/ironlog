/**
 * Turns Gemini's server-sent events (streamGenerateContent?alt=sse) into a
 * plain-text stream of the reply, chunk by chunk.
 */
export function geminiSseToText(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  /** Enqueues the text of one SSE line; says whether it produced any. */
  const emit = (line: string, controller: ReadableStreamDefaultController<Uint8Array>): boolean => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return false;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return false;
    try {
      const json = JSON.parse(payload) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      if (!text) return false;
      controller.enqueue(encoder.encode(text));
      return true;
    } catch {
      return false; // keep-alive or a partial line
    }
  };

  return new ReadableStream<Uint8Array>({
    // Keep reading until something is enqueued: a pull that returns empty-handed
    // isn't called again, which would leave the reader waiting forever when a
    // network chunk ends mid-event.
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          if (buffer) emit(buffer, controller);
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        let sent = false;
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          if (emit(buffer.slice(0, nl), controller)) sent = true;
          buffer = buffer.slice(nl + 1);
        }
        if (sent) return;
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}
