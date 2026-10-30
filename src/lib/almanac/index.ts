/**
 * Almanac engine (ATO-BUILD PHASE-11a): one daily card per surface, chosen on
 * the phone from hand-written copy. No network, no model call.
 *
 *   almanac.today(surface, ctx, { bank, seen })   pure: same input → same card
 *   almanac.loadToday(surface, ctx, store)        today's cached card, else today() + save
 *
 * Surfaces: home.pick, home.line, insights.deck, insights.try, push, you.week,
 * you.month, you.year. Nothing calls this yet: PHASE-11e wires the surfaces. The bank
 * is `bank.generated.ts` (PHASE-11c): only the cards emci ticked ship.
 */
import {
  cacheKey,
  loadTodayCache,
  readCached,
  saveTodayCache,
  writeCached,
  type CachedResult,
} from './cache';
import { GENERATED_BANK_VERSION, GENERATED_CARDS } from './bank.generated';
import { addSeen, loadSeen, saveSeen, seenFor } from './seen-store';
import { eventPickForYmd } from '@/lib/daily-pick/bank';

import { basePickIndex } from './seed';
import { selectCard } from './select';
import type {
  AlmanacCard,
  AlmanacContext,
  AlmanacResult,
  AlmanacSurface,
  KeyValueStore,
  SeenEntry,
} from './types';

export * from './types';
export { almanacYmd, basePickIndex, personalSeed } from './seed';
export { ALMANAC_MAX_CHARS, ALMANAC_SLOTS, fillCard } from './slots';
export { ALMANAC_SEEN_CAP, ALMANAC_SEEN_KEY } from './seen-store';
export { ALMANAC_TODAY_KEY, cacheKey } from './cache';

/**
 * True since 2026-10-30: emci approved the ticked cards in docs/almanac-review.md (⚑ almanac copy).
 * Only ticked rows reach the generated bank.
 */
export const ALMANAC_COPY_REVIEWED = true;
/** Changes whenever a shipped card changes (`npm run load:almanac` writes it). 0 = nothing shipped. */
export const ALMANAC_BANK_VERSION = GENERATED_BANK_VERSION;
/** The ticked cards, from `bank.generated.ts`. */
export const ALMANAC_BANK: readonly AlmanacCard[] = GENERATED_CARDS;

export interface TodayOptions {
  bank?: readonly AlmanacCard[];
  /** Seen entries for this surface. */
  seen?: readonly SeenEntry[];
}

/**
 * Today's card for a surface, or null when nothing fits.
 * `home.pick` is the existing global rotation unless a reviewed event Pick is
 * live today; event Picks use a shared seed so everyone gets the same one.
 * PLACEHOLDER for event Picks: PHASE-11d replaces this draw with the server's
 * event-override lookup (ymd → pick_id, red team H3/M5), because the server's
 * `answer_daily_pick` checks that row. Event Pick cards must not carry axes or
 * minDataDays (that would split readers), and the card type gains Pick options there.
 */
export function today(surface: AlmanacSurface, ctx: AlmanacContext, opts: TodayOptions = {}): AlmanacResult | null {
  const bank = opts.bank ?? ALMANAC_BANK;
  if (surface === 'home.pick') {
    // PHASE-11e: a peak day names its Pick in the override table (daily-pick/bank,
    // the same rows as wave117), so the phone and the server agree on which one.
    // The card only shows it once the server confirms (today-pick-card).
    const event = eventPickForYmd(ctx.ymd);
    const card = event ? bank.find((c) => c.id === event.cardId && c.kind === 'pick') : undefined;
    if (event && card) return { surface, source: 'card', card, text: event.prompt, usedAlt: false };
    return { surface, source: 'rotation', pickIndex: basePickIndex(ctx.ymd) };
  }
  const chosen = selectCard(surface, ctx, bank, opts.seen ?? []);
  if (!chosen) return null;
  return { surface, source: 'card', card: chosen.card, text: chosen.filled.text, usedAlt: chosen.filled.usedAlt };
}

function toCached(result: AlmanacResult): CachedResult {
  return result.source === 'card'
    ? { source: 'card', cardId: result.card.id, text: result.text, usedAlt: result.usedAlt }
    : { source: 'rotation', pickIndex: result.pickIndex };
}

function fromCached(
  surface: AlmanacSurface,
  cached: CachedResult,
  bank: readonly AlmanacCard[],
): AlmanacResult | null {
  if (cached.source === 'rotation') {
    return surface === 'home.pick' ? { surface, source: 'rotation', pickIndex: cached.pickIndex } : null;
  }
  const card = bank.find((c) => c.id === cached.cardId);
  return card ? { surface, source: 'card', card, text: cached.text, usedAlt: cached.usedAlt } : null;
}

// Reads and writes run one at a time, so two surfaces loading together never
// drop each other's seen entry.
let queue: Promise<unknown> = Promise.resolve();
function inQueue<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

export interface LoadTodayOptions {
  bank?: readonly AlmanacCard[];
  bankVersion?: number;
}

/**
 * Today's card, from the cache when present; otherwise chosen now and saved.
 * A card counts as seen when chosen (11e/11f decide if "shown" should count instead).
 * An OTA that bumps bankVersion mid-day misses the cache by design, so that
 * day's card may change once; the same bankVersion never swaps it.
 */
export function loadToday(
  surface: AlmanacSurface,
  ctx: AlmanacContext,
  store: KeyValueStore,
  opts: LoadTodayOptions = {},
): Promise<AlmanacResult | null> {
  const bank = opts.bank ?? ALMANAC_BANK;
  const bankVersion = opts.bankVersion ?? ALMANAC_BANK_VERSION;
  return inQueue(async () => {
    const cache = await loadTodayCache(store, ctx.userId);
    const hit = readCached(cache, ctx.ymd, surface, bankVersion);
    if (hit) {
      const result = fromCached(surface, hit, bank);
      if (result) return result;
    }
    const seenState = await loadSeen(store, ctx.userId);
    const result = today(surface, ctx, { bank, seen: seenFor(seenState, surface) });
    if (!result) return null;
    await saveTodayCache(store, writeCached(cache, { ymd: ctx.ymd, surface, bankVersion, result: toCached(result) }));
    if (result.source === 'card' && surface !== 'home.pick') {
      await saveSeen(store, addSeen(seenState, surface, { id: result.card.id, ymd: ctx.ymd }));
    }
    return result;
  });
}

export const almanac = { today, loadToday, cacheKey } as const;
