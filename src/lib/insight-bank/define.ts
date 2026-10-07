/**
 * The Focus · try · watch bank — types and the one helper every trait file
 * uses. Written by hand in the clear voice (src/lib/voice/clear-voice.ts),
 * never by a model.
 *
 * IDS ARE FOREVER. `ftw_<axis>_<h|l>_<nn>` for a trait idea, `ftw_starter_<nn>`
 * for a starter. History rows are matched back to an idea by its focus text
 * (the daily_insights title), and the no-repeat window is kept by id, so an id
 * is never renumbered or reused. Retire an idea by deleting it; write a new one
 * with the next free number.
 *
 * An idea's focus has three wordings of the same thought. The picker turns
 * through them each time the idea comes back, so a returning idea does not
 * read word for word the same.
 */
import type { LineKey } from '@/lib/daily-line/bank';

export type { LineKey };

export interface InsightIdea {
  id: string;
  /** Empty for a starter, one key for a trait idea, two for a pair idea. */
  keys: readonly LineKey[];
  focus: readonly [string, string, string];
  why: string;
  try: readonly [string, string];
  watch: readonly [string, string];
}

export interface IdeaCopy {
  focus: readonly [string, string, string];
  why: string;
  try: readonly [string, string];
  watch: readonly [string, string];
}

export function idea(id: string, keys: readonly LineKey[], copy: IdeaCopy): InsightIdea {
  return { id, keys, ...copy };
}
