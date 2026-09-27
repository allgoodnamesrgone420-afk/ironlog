/**
 * The coach saves what it learns by ending a reply with one line:
 *   @@MEMORY {"add": [...], "remove": [...]}
 * These helpers hide that line from the chat (even while it is still
 * streaming in) and read the edits out of it.
 */

export const MEMORY_MARKER = "@@MEMORY";

/** The reply without the memory line, also hiding a marker that's still arriving mid-stream. */
export function visibleReply(full: string): string {
  const at = full.indexOf(MEMORY_MARKER);
  let text = at >= 0 ? full.slice(0, at) : full;
  for (let k = MEMORY_MARKER.length - 1; k > 0; k--) {
    if (text.endsWith(MEMORY_MARKER.slice(0, k))) {
      text = text.slice(0, -k);
      break;
    }
  }
  return text.trimEnd();
}

/** The coach's memory edits from the end of a reply, if any. */
export function memoryEdits(full: string): { add: string[]; remove: string[] } {
  const at = full.indexOf(MEMORY_MARKER);
  if (at < 0) return { add: [], remove: [] };
  const raw = full.slice(at + MEMORY_MARKER.length).trim();
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try {
    const parsed = JSON.parse(json) as { add?: unknown; remove?: unknown };
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim().slice(0, 160)) : []);
    return { add: list(parsed.add).slice(0, 3), remove: list(parsed.remove).slice(0, 5) };
  } catch {
    return { add: [], remove: [] };
  }
}
