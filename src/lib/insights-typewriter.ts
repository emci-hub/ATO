/**
 * Pure maths for the Insights typewriter (PHASE-09): how many characters show
 * at each of the 28 steps, and which word glows. No React, so a check can pin it.
 */
/** Same as `TYPEWRITER.steps` in motion-tokens (pinned by check:insights-g3; no import so a node check can load this). */
export const TYPEWRITER_STEPS = 28;

/** Characters shown at `step` (0..steps) of a text `length` long: whole numbers, never past the end. */
export function revealCount(step: number, length: number, steps: number = TYPEWRITER_STEPS): number {
  if (!(length > 0) || !(step > 0)) return 0;
  if (step >= steps) return length;
  return Math.min(length, Math.ceil((length * step) / steps));
}

/** The longest word (5+ letters, first on a tie) is the "key word" that glows. Null when none. */
export function keyWordRange(text: string): { start: number; end: number } | null {
  let best: { start: number; end: number } | null = null;
  for (const m of text.matchAll(/[A-Za-z’'-]+/g)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (m[0].length < 5) continue;
    if (!best || end - start > best.end - best.start) best = { start, end };
  }
  return best;
}

/** The text cut into [before, key, after] (empty strings when there is no key word). */
export function splitAtKeyWord(text: string): [string, string, string] {
  const r = keyWordRange(text);
  if (!r) return [text, '', ''];
  return [text.slice(0, r.start), text.slice(r.start, r.end), text.slice(r.end)];
}
