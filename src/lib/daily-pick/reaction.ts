/**
 * Today's Pick: the mini guy's line after you answer. Pure (no storage, no
 * network) so the check can run it.
 */
import { allLines, lineKey, type DailyLine } from '@/lib/daily-line/bank';

import type { DailyPick } from './bank';

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The mini guy's line after you pick: one of the approved daily lines about
 * the trait end your answer leans to. The same pick and answer on the same
 * day always gets the same line.
 */
export function reactionLine(pick: DailyPick, optionIndex: number, ymd: string): DailyLine | null {
  const option = pick.options[optionIndex];
  if (!option) return null;
  const key = lineKey(pick.axis, option.value >= 0.5 ? 'high' : 'low');
  const lines = allLines().filter((line) => line.source === 'authored' && line.keys.length === 1 && line.keys[0] === key);
  const pool = lines.length > 0 ? lines : allLines().filter((line) => line.source === 'authored' && line.keys.length === 0);
  if (pool.length === 0) return null;
  return pool[hash(`${ymd}:${pick.id}:${optionIndex}`) % pool.length]!;
}

