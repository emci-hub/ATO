/**
 * Which Almanac cards may leave the phone (share sheet). Kept out of the component
 * files so a check can run it.
 */
import type { AlmanacCard } from '@/lib/almanac';
import type { ClearLean } from '@/lib/daily-line/pick';
import { isShareableLean } from '@/lib/legends64/identity';
import type { TraitAxis, TraitLean } from '@/lib/traits';

const AXIS_SLOT = /\{(axis|axisPct)\}/;
const PAIR_SLOT = /\{(pairAxis|pairPct)\}/;

/**
 * A card may leave the phone only when no private lean can end up in its text
 * (`isShareableLean`, the same rule as titles, pushes and the widget):
 *  - every lean the card was written for must be shareable;
 *  - a card that fills `{axis}` / `{pairAxis}` from the reader's strongest leans
 *    (slots.ts) is shareable only if the lean(s) that would fill them are.
 * A card for anyone with no axis slot is fine.
 */
export function cardIsShareable(
  card: Pick<AlmanacCard, 'axes' | 'text' | 'alt'>,
  leans: readonly ClearLean[] = [],
): boolean {
  const keys = card.axes ?? [];
  const keyOk = keys.every((key) => {
    const [axis, lean] = key.split(':');
    return isShareableLean(axis as TraitAxis, lean as TraitLean);
  });
  if (!keyOk) return false;
  // Same order as slotValues: the card's own leans first, then by strength.
  const own = keys
    .map((key) => {
      const [axis, lean] = key.split(':');
      return leans.find((l) => l.axis === axis && l.lean === lean);
    })
    .filter((l): l is ClearLean => !!l);
  const byStrength = [...leans].sort((a, b) => b.strength - a.strength || a.axis.localeCompare(b.axis));
  const ordered = [...own, ...byStrength.filter((l) => !own.includes(l))];
  const body = `${card.text} ${card.alt ?? ''}`;
  const used: ClearLean[] = [];
  if (AXIS_SLOT.test(body) && ordered[0]) used.push(ordered[0]);
  if (PAIR_SLOT.test(body) && ordered[1]) used.push(ordered[1]);
  return used.every((l) => isShareableLean(l.axis, l.lean));
}
