/**
 * The community goal card's maths (PHASE-11e). Pure. The card shows one total of
 * everyone's seasonal Picks this year against the next round goal.
 */
import { GLOBAL_PICK_EVENTS, type GlobalPickEvent } from '@/lib/daily-pick/bank';

import type { DayTheme } from './resolve';

/** Round goals; the bar aims at the next one above the total. */
export const COMMUNITY_GOAL_STEPS = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000] as const;

export function nextGoal(total: number): number {
  return COMMUNITY_GOAL_STEPS.find((step) => step > total) ?? (Math.floor(total / 100000) + 1) * 100000;
}

/** The global event whose Picks the card counts, on its build or peak days only. */
export function communityEventFor(theme: DayTheme): GlobalPickEvent | null {
  const phase = theme.display.phase;
  if (phase !== 'build' && phase !== 'peak') return null;
  const id = theme.display.event;
  return GLOBAL_PICK_EVENTS.find((e) => e.event === id)?.event ?? null;
}

export const COMMUNITY_EVENT_NAME: Record<GlobalPickEvent, string> = {
  new_year: 'New Year',
  valentines: 'Valentine’s Day',
  halloween: 'Halloween',
  christmas: 'Christmas',
};

export const communityLine = (event: GlobalPickEvent, total: number, goal: number) =>
  `${COMMUNITY_EVENT_NAME[event]} Picks answered: ${total.toLocaleString('en-US')} of ${goal.toLocaleString('en-US')}.`;

/** Event intensity band for the one-line teaser on Home (spec 11e step 1). */
export const TEASER_MIN = 0.1;
export const TEASER_MAX = 0.4;

export function teaserWindow(theme: DayTheme): boolean {
  const x = theme.display.intensity;
  return theme.display.event != null && x >= TEASER_MIN && x <= TEASER_MAX;
}

/**
 * The year an event's deck, badge and total belong to. New Year's build days in
 * late December are next year's New Year, so they count there (one deck, one badge).
 */
export function eventYear(eventId: string, ymd: string): number {
  const year = Number(ymd.slice(0, 4));
  return eventId === 'new_year' && ymd.slice(5, 7) === '12' ? year + 1 : year;
}
