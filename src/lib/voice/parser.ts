/**
 * Parses voice transcripts like:
 *   "eighty kilos eight reps"
 *   "100 by 5"
 *   "log 80 8"
 *   "225 pounds for 5"
 * into { kg, reps }.
 */

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
};

const KG_PER_LB = 0.45359237;

function wordsToNumbers(input: string): string {
  // Replace simple word numbers with digits; not perfect but handles "eighty", "one hundred", etc.
  return input
    .toLowerCase()
    .replace(/\bone hundred\b/g, "100")
    .replace(/\btwo hundred\b/g, "200")
    .replace(/\b(\w+)\b/g, (m, w) => (w in WORD_NUMBERS ? String(WORD_NUMBERS[w]) : m));
}

export interface ParsedSet {
  kg: number;
  reps: number;
  /** Whether the transcript explicitly said "lb" or "pounds" */
  wasLb: boolean;
}

export function parseSetTranscript(raw: string): ParsedSet | null {
  if (!raw) return null;
  const text = wordsToNumbers(raw);
  const lbMatch = /\b(lb|lbs|pound|pounds)\b/.test(text);
  const numbers = (text.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => n > 0 && n <= 1000);
  if (numbers.length < 2) return null;
  // First num = weight, second num = reps
  const [weight, reps] = numbers as [number, number];
  if (reps > 100) return null;
  const kg = lbMatch ? weight * KG_PER_LB : weight;
  return { kg, reps, wasLb: lbMatch };
}
