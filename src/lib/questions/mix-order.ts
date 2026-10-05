import { fnv1a } from '@/lib/daily-line/bank';
import type { TraitAxis } from '@/lib/traits';

/**
 * Mix and match (emci 2026-10-05): a returning person should never feel the
 * same question sits at the same number, or the same answer sits in the same
 * spot. Pure and deterministic — no Math.random, no storage:
 *
 * - Question order inside one intake set or one round is a stable shuffle
 *   seeded by user id + set/round. The same person sees the same order on
 *   Back, on a page turn and after a restart; two people see different orders.
 * - Where the list allows it, no trait shows twice on one page (and never
 *   twice in a row).
 * - Option order is shown either as authored or reversed, per person per
 *   question. Reversed, not shuffled: a middle option stays in the middle,
 *   so a scale never reads "agree / somewhat / disagree" scrambled (research
 *   notes in docs/proposals/question-rewrite.md).
 *
 * Only DISPLAY order changes. Picks, stored stamps and saves stay in the
 * ORIGINAL option index — the server reads options->index (answer_intake_question,
 * answer_round_item), so `displayToOriginal` is applied at the tap.
 */

export const MIX_PAGE_SIZE = 4;

export function mixSeed(userId: string, scope: string): string {
  return `${userId}|${scope}`;
}

function rank(seed: string, key: string): number {
  return fnv1a(`${seed}|q|${key}`);
}

/**
 * Stable per-seed order. Rows are first sorted by a hash of seed + row key
 * (so a row's place never depends on the order the caller passed), then laid
 * out page by page, preferring a trait that is not already on the page, then
 * one that is not the row just placed.
 */
export function mixRows<T extends { key: string; axis: TraitAxis }>(
  rows: readonly T[],
  seed: string,
  pageSize: number = MIX_PAGE_SIZE,
): T[] {
  const pool = [...rows].sort((a, b) => rank(seed, a.key) - rank(seed, b.key) || (a.key < b.key ? -1 : 1));
  const left = new Map<TraitAxis, number>();
  for (const r of pool) left.set(r.axis, (left.get(r.axis) ?? 0) + 1);
  // Among the allowed rows, take the trait with the most rows still to place
  // (seed order breaks ties) so repeats never pile up on the last page.
  const pick = (allowed: (r: T) => boolean): number => {
    let best = -1;
    for (let i = 0; i < pool.length; i += 1) {
      if (!allowed(pool[i]!)) continue;
      if (best < 0 || left.get(pool[i]!.axis)! > left.get(pool[best]!.axis)!) best = i;
    }
    return best;
  };
  const out: T[] = [];
  while (pool.length > 0) {
    const pageStart = out.length - (out.length % pageSize);
    const onPage = new Set(out.slice(pageStart).map((r) => r.axis));
    const prev = out[out.length - 1]?.axis;
    let at = pick((r) => !onPage.has(r.axis));
    if (at < 0) at = pick((r) => r.axis !== prev);
    if (at < 0) at = 0;
    const [row] = pool.splice(at, 1);
    left.set(row!.axis, left.get(row!.axis)! - 1);
    out.push(row!);
  }
  return out;
}

/** Display position -> original option index, for one person and one question. */
export function optionDisplayOrder(seed: string, rowKey: string, optionCount: number): number[] {
  const order = Array.from({ length: optionCount }, (_, i) => i);
  return fnv1a(`${seed}|o|${rowKey}`) % 2 === 1 ? order.reverse() : order;
}

export function displayToOriginal(order: readonly number[], displayIndex: number): number {
  return order[displayIndex] ?? displayIndex;
}

export function originalToDisplay(order: readonly number[], originalIndex: number): number {
  const at = order.indexOf(originalIndex);
  return at < 0 ? originalIndex : at;
}
