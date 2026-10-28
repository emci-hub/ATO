/**
 * Almanac engine types (ATO-BUILD PHASE-11a). Pure: no storage, no network, no model call.
 *
 * A card is one short piece of hand-written copy. Ids are stable slugs
 * `alm_<kind>_<event|axis|arc>_<nn>`: never reused or renamed, and a retired
 * card keeps its id (seen-sets and callbacks point at it).
 */
import type { ClearLean } from '@/lib/daily-line/pick';
import type { TraitAxis, TraitLean } from '@/lib/traits';

export const ALMANAC_KINDS = [
  'pick',
  'line',
  'try',
  'reflect',
  'fact',
  'contrast',
  'week',
  'month',
  'year',
  'callback',
  'afterglow',
  'teaser',
] as const;
export type AlmanacKind = (typeof ALMANAC_KINDS)[number];

export const ALMANAC_PHASES = ['teaser', 'lead', 'build', 'peak', 'fade'] as const;
export type AlmanacPhase = (typeof ALMANAC_PHASES)[number];

/** Same key shape as the daily line: `openness:high`. */
export type AlmanacLeanKey = `${TraitAxis}:${TraitLean}`;

export interface AlmanacCard {
  id: string;
  kind: AlmanacKind;
  /** Every key must match one of the reader's clear leans. None = a card for anyone. */
  axes?: readonly AlmanacLeanKey[];
  /** Days of data (check-ins) needed before the card may show. */
  minDataDays?: number;
  /** Calendar event id (PHASE-11b). The card shows only while that event is active. */
  event?: string;
  /** With `event`: only in this phase of the event. */
  phase?: AlmanacPhase;
  /** Off-season arc id (PHASE-11b). */
  arc?: string;
  /** Local weekdays the card may show on, 0 = Sunday … 6 = Saturday. */
  weekday?: readonly number[];
  text: string;
  /** Used when a slot in `text` has no value. A card without one is dropped instead. */
  alt?: string;
  weight?: number;
  reviewed: boolean;
  variant?: string;
}

export const ALMANAC_SURFACES = [
  'home.pick',
  'home.line',
  'insights.deck',
  'insights.try',
  'push',
  'you.week',
  'you.month',
  'you.year',
] as const;
export type AlmanacSurface = (typeof ALMANAC_SURFACES)[number];

/** Which card kinds each surface draws from. */
export const SURFACE_KINDS: Readonly<Record<AlmanacSurface, readonly AlmanacKind[]>> = {
  'home.pick': ['pick'],
  'home.line': ['line', 'callback', 'afterglow', 'teaser'],
  'insights.deck': ['fact', 'contrast'],
  'insights.try': ['try', 'reflect'],
  push: ['line', 'teaser'],
  'you.week': ['week'],
  'you.month': ['month'],
  'you.year': ['year'],
};

/** An event that is live today, as PHASE-11b's calendar reports it. */
export interface ActiveEvent {
  event: string;
  phase?: AlmanacPhase;
  /** Shown in `{eventName}`. */
  name?: string;
  /** Shown in `{daysInto}`. */
  daysInto?: number;
}

export interface AlmanacCalendar {
  events?: readonly ActiveEvent[];
  arcs?: readonly string[];
}

/** Slot values that later phases supply (server split, last Pick). Already formatted. */
export type AlmanacExtraSlot = 'peerFrac' | 'pickShare' | 'lastPick';

export interface AlmanacContext {
  userId: string;
  /** Local day key: `almanacYmd(now, me.timezone)`. */
  ymd: string;
  /** From `clearLeans(tracks)` (daily-line/pick). */
  leans: readonly ClearLean[];
  /** Days of data the reader has (check-ins). */
  dataDays: number;
  /** Days Home was opened, for `{streak}` (`streakWithRest`). */
  openedYmds?: readonly string[];
  name?: string | null;
  calendar?: AlmanacCalendar;
  /** PHASE-11b's layer weight (season / event / arc blend). Defaults to 1. */
  layerWeight?: (card: AlmanacCard) => number;
  extras?: Partial<Record<AlmanacExtraSlot, string>>;
}

export interface SeenEntry {
  id: string;
  ymd: string;
}

export type AlmanacResult =
  | { surface: AlmanacSurface; source: 'card'; card: AlmanacCard; text: string; usedAlt: boolean }
  | { surface: 'home.pick'; source: 'rotation'; pickIndex: number };

/** Minimal key-value store (AsyncStorage fits). Injected so the engine stays testable offline. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
