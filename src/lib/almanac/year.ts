/**
 * "Your year in you" (PHASE-11e): up to eight swipe cards drawn from the
 * Almanac's `you.year` cards. Pure and seeded by the day, so the same day always
 * gives the same deck. Date-gated from December 1.
 */
import { addDaysYmd } from '@/lib/local-date';

import { ALMANAC_BANK, today } from './index';
import type { AlmanacCard, AlmanacContext, SeenEntry } from './types';

export const YEAR_RECAP_CARDS = 8;
export const YEAR_RECAP_FIRST_MONTH = 12;

/** Open from Dec 1 through the end of the year. */
export function yearRecapOpen(ymd: string): boolean {
  return Number(ymd.slice(5, 7)) === YEAR_RECAP_FIRST_MONTH;
}

export interface YearCard {
  card: AlmanacCard;
  text: string;
}

export function yearDeck(
  ctx: AlmanacContext,
  bank: readonly AlmanacCard[] = ALMANAC_BANK,
  count: number = YEAR_RECAP_CARDS,
): YearCard[] {
  const seen: SeenEntry[] = [];
  const out: YearCard[] = [];
  for (let i = 0; i < count; i += 1) {
    const result = today('you.year', ctx, { bank, seen });
    if (!result || result.source !== 'card') break;
    if (out.some((c) => c.card.id === result.card.id)) break;
    out.push({ card: result.card, text: result.text });
    // Dated yesterday: a card seen "today" stays eligible by design (select.ts), so this
    // is what keeps the eight cards apart. Nothing is stored.
    seen.push({ id: result.card.id, ymd: addDaysYmd(ctx.ymd, -1) });
  }
  return out;
}
