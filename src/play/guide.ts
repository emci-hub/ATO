/**
 * The newbie guide (Divecore finish step 5, emci 2026-10-19) — pure.
 *
 * ONE small bubble with ONE next step, picked from real game state, in this order:
 *   egg → feed (Catch) → first dive → claim research → Trial 1 → put a Power on → build the Loft → first trip.
 * It teaches a first-time player where to tap and then goes quiet for good. Rules:
 *   - A step shows only when the player can act on it right now (a claim is ready, the Loft can be built, a Power is
 *     in the bag, a trip can start), so it never asks for the impossible.
 *   - A veteran is never nagged: the furthest step already proven counts, and every earlier step counts as done.
 *   - "Got it" hides a step for good; "Guide bubble" in Settings turns the whole thing off.
 *   - Clear voice, no pressure: no "!", no streaks, no countdowns, nothing urgent.
 * It does not repeat the Today list (that is "what is ready"); this is "what to try first".
 * Nothing is saved in the Divecore save: the on/off and dismissed steps live on the phone (guide-store.ts).
 */

export const GUIDE_STEPS = ['egg', 'feed', 'dive', 'research', 'turf', 'power', 'loft', 'trip'] as const;
export type GuideStepId = (typeof GUIDE_STEPS)[number];

/** The screens that can show the bubble. The Hideout shows every step; the others only their own. */
export type GuideScreen = 'hideout' | 'locker' | 'turf';

/** Everything the picker reads — plain values, so it is testable without the store. */
export type GuideInput = {
  /** An egg has been picked. */
  eggPicked: boolean;
  /** The pet has hatched (or a later hatch / hall entry proves it). */
  hatched: boolean;
  /** The pet on the stage is out of its egg right now (Feed and Dive need it). */
  petOut: boolean;
  /** At least one Catch round passed. */
  fed: boolean;
  /** At least one dive. */
  dived: boolean;
  /** At least one research claim. */
  claimed: boolean;
  /** A research claim is ready right now. */
  researchReady: boolean;
  /** Turf War Trial 1 won. */
  wonTrial: boolean;
  /** A Power (not a Look) is worn. */
  powerWorn: boolean;
  /** A Power is in the bag. */
  hasPower: boolean;
  /** The Loft is built. */
  loftBuilt: boolean;
  /** The Loft can be built right now (its gate is met and the tokens are there). */
  loftBuildable: boolean;
  /** At least one expedition sent. */
  tripped: boolean;
  /** An expedition can start now. */
  tripReady: boolean;
};

export type GuideStore = { off: boolean; dismissed: readonly string[] };

export type GuideStep = { id: GuideStepId; text: string };

const SCREENS: Record<GuideStepId, readonly GuideScreen[]> = {
  egg: ['hideout'],
  feed: ['hideout'],
  dive: ['hideout'],
  research: ['hideout'],
  turf: ['hideout', 'turf'],
  power: ['hideout', 'locker'],
  loft: ['hideout'],
  trip: ['hideout'],
};

/** The words, per screen where it differs. Short, plain, one instruction each. */
function textOf(id: GuideStepId, screen: GuideScreen, input: GuideInput): string {
  switch (id) {
    case 'egg':
      return input.eggPicked ? 'Tap your egg to keep it warm until it hatches.' : 'Pick an egg. It hatches into your first pet.';
    case 'feed':
      return 'Open Feed and catch the food. That keeps your pet happy.';
    case 'dive':
      return 'Try a dive: tap Underground on the left rail.';
    case 'research':
      return 'Your research bag fills while you’re away. Tap CLAIM at the top.';
    case 'turf':
      return screen === 'turf' ? 'Clear Trial 1: place towers on the pads, then call the wave.' : 'Defend your street: open Turf War and clear Trial 1.';
    case 'power':
      return screen === 'locker' ? 'Put a Power on: pick one in the bag and tap Equip.' : 'Put a Power on: open Locker, pick one, tap Equip.';
    case 'loft':
      return 'You can build the Loft now. Open Rooms on the right.';
    case 'trip':
      return 'Send your pet exploring. Tap Explore on the left rail.';
  }
}

/** Has the player already done this step? (Drives the veteran rule.) */
function doneOf(id: GuideStepId, i: GuideInput): boolean {
  switch (id) {
    case 'egg':
      return i.hatched;
    case 'feed':
      return i.fed;
    case 'dive':
      return i.dived;
    case 'research':
      return i.claimed;
    case 'turf':
      return i.wonTrial;
    case 'power':
      return i.powerWorn;
    case 'loft':
      return i.loftBuilt;
    case 'trip':
      return i.tripped;
  }
}

/** Can the player act on this step right now? */
function actionableOf(id: GuideStepId, i: GuideInput): boolean {
  switch (id) {
    case 'egg':
      return true;
    case 'feed':
    case 'dive':
      return i.petOut;
    case 'turf':
      return i.hatched;
    case 'research':
      return i.researchReady;
    case 'power':
      return i.hasPower;
    case 'loft':
      return i.loftBuildable;
    case 'trip':
      return i.tripReady;
  }
}

/**
 * The one step to show on `screen`, or null (quiet). Veteran rule: the furthest step already done counts, and
 * every earlier step with it, so a save with progress goes straight past what it has outgrown.
 */
export function guideStep(screen: GuideScreen, input: GuideInput, store: GuideStore): GuideStep | null {
  if (store.off) return null;
  let furthest = -1;
  GUIDE_STEPS.forEach((id, index) => {
    if (doneOf(id, input)) furthest = index;
  });
  for (let index = furthest + 1; index < GUIDE_STEPS.length; index += 1) {
    const id = GUIDE_STEPS[index];
    if (store.dismissed.includes(id)) continue;
    if (!actionableOf(id, input)) continue;
    // The first step the player can act on is THE step; it only shows on the screens that belong to it.
    return SCREENS[id].includes(screen) ? { id, text: textOf(id, screen, input) } : null;
  }
  return null;
}

/** Every line the guide can say (for the copy check). */
export function allGuideLines(): string[] {
  const blank: GuideInput = {
    eggPicked: false, hatched: true, petOut: true, fed: false, dived: false, claimed: false, researchReady: true, wonTrial: false,
    powerWorn: false, hasPower: true, loftBuilt: false, loftBuildable: true, tripped: false, tripReady: true,
  };
  const lines: string[] = [];
  for (const id of GUIDE_STEPS) {
    for (const screen of ['hideout', 'locker', 'turf'] as const) {
      lines.push(textOf(id, screen, blank), textOf(id, screen, { ...blank, eggPicked: true }));
    }
  }
  return [...new Set(lines)];
}

/** The stored shape: `{ v: 1, off, dismissed }`. A bad or missing value reads as "on, nothing dismissed". */
export function parseGuideStore(raw: string | null): GuideStore {
  if (!raw) return { off: false, dismissed: [] };
  try {
    const data = JSON.parse(raw) as { off?: unknown; dismissed?: unknown };
    const dismissed = Array.isArray(data.dismissed)
      ? data.dismissed.filter((x): x is GuideStepId => typeof x === 'string' && (GUIDE_STEPS as readonly string[]).includes(x))
      : [];
    return { off: data.off === true, dismissed: [...new Set(dismissed)] };
  } catch {
    return { off: false, dismissed: [] };
  }
}

export function serializeGuideStore(store: GuideStore): string {
  return JSON.stringify({ v: 1, off: store.off, dismissed: store.dismissed });
}
