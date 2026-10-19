/**
 * Today (Divecore finish step 4, emci 2026-10-18) — what can be done in the Hideout right now.
 *
 * A pure list over the live state, read by the Hideout's dock button ("Today" + a count) and its sheet.
 * Calm by design: it lists things that are READY, in a fixed order, in plain sentences. It never counts down,
 * never shows a streak, never pushes, and says nothing urgent. Left out on purpose:
 *   - the Store (a "you can buy something" row would nudge spending),
 *   - the daily check-in (that is the ATO app, not Divecore),
 *   - the Tide calendar (it claims itself when the game opens),
 *   - room builds (they finish on their own).
 * Dive counts only when the charges are FULL: they refill all day, so "1 or more" would keep the badge on forever.
 * No save field: it is derived from state the game already keeps.
 */
import type { PetStatus } from '@/play/pet-status';

export type TodayAction = 'claim' | 'feed' | 'play' | 'eggs' | 'expedition' | 'visitor' | 'dive';

export type TodayItemId = 'research' | 'care_feed' | 'care_play' | 'eggs' | 'trip_back' | 'trip_ready' | 'visitor' | 'dive_full';

export type TodayItem = {
  id: TodayItemId;
  /** One plain sentence. */
  text: string;
  /** The one button on the row. */
  button: string;
  action: TodayAction;
};

/** Everything the list reads — plain values, so it is testable without the store. */
export type TodayInput = {
  /** The pet's shown name. */
  name: string;
  /** Research finds banked and ready to claim (0 = none). */
  researchFinds: number;
  /** The pet's status (most urgent first); only hungry / sad ones add a care row. */
  status: PetStatus;
  /** Free eggs waiting at the egg picker (0 = none). */
  freeEggs: number;
  /** The trip state: can go now, out, done for today, or too young. */
  expedition: 'ready' | 'away' | 'done_today' | 'locked';
  /** A trip came back with something not yet looked at. */
  tripBack: boolean;
  /** Today's visitor is in the Hideout and has not been greeted. */
  visitorHere: boolean;
  /** Dive charges are at the cap. */
  diveFull: boolean;
  /** A dive is in progress (no Dive row then). */
  diveActive: boolean;
};

/** The list, in a fixed order. */
export function todayItems(input: TodayInput): TodayItem[] {
  const items: TodayItem[] = [];
  const n = Math.max(0, Math.floor(input.researchFinds));
  if (n > 0) {
    items.push({ id: 'research', text: `Research: ${n} ${n === 1 ? 'find' : 'finds'} ready`, button: 'Claim', action: 'claim' });
  }
  if (input.status === 'hungry' || input.status === 'starving') {
    items.push({ id: 'care_feed', text: `${input.name} would like a snack`, button: 'Feed', action: 'feed' });
  } else if (input.status === 'sad' || input.status === 'very_sad') {
    items.push({ id: 'care_play', text: `${input.name} would like some play time`, button: 'Play', action: 'play' });
  }
  const eggs = Math.max(0, Math.floor(input.freeEggs));
  if (eggs > 0) {
    items.push({ id: 'eggs', text: eggs === 1 ? 'A free egg is waiting' : `Free eggs: ${eggs} waiting`, button: 'Eggs', action: 'eggs' });
  }
  if (input.tripBack) {
    items.push({ id: 'trip_back', text: `${input.name} is back with something`, button: 'Look', action: 'expedition' });
  } else if (input.expedition === 'ready') {
    items.push({ id: 'trip_ready', text: `Send ${input.name} exploring`, button: 'Go', action: 'expedition' });
  }
  if (input.visitorHere) {
    items.push({ id: 'visitor', text: 'Today’s visitor is here', button: 'Say hi', action: 'visitor' });
  }
  if (input.diveFull && !input.diveActive) {
    items.push({ id: 'dive_full', text: 'Dive charges are full', button: 'Dive', action: 'dive' });
  }
  return items;
}

/** The sheet's empty line and its quiet footer. */
export const TODAY_CAUGHT_UP = 'All caught up';
export const TODAY_FOOT = 'Nothing here is urgent. Come back any time.';
export const TODAY_TITLE = 'Today';

/**
 * The Hideout's free-egg count: the egg picker is open and the next egg costs nothing (the same rule the
 * "free eggs ready" reminder uses, `pet-screen.tsx`).
 */
export function freeEggsWaiting(stage: string, egg: unknown, nextPrice: number | null, free: number, used: number): number {
  if (stage !== 'egg' || egg != null || nextPrice !== 0) return 0;
  return Math.max(1, free - used);
}
