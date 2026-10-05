/**
 * Defend coach — pure, light tips (Play step 5d, GAME_SPEC §9 / §9b / §9d).
 *
 * No new combat systems, no state, no RNG: `tipForWave` reads the wave band,
 * current scrap, and what towers the player has placed, and returns 1–2 plain
 * sentences (plus an optional one-line "Why?" that names the tower job:
 * chip / stall / chunk). The screen decides where to show it — a dismissible
 * Coach card on Defend setup and a one-line hint during a live wave.
 *
 * Bands follow the spec's difficulty shape: early 1–3 (newbie setup guide),
 * mid 4–8 (vines + archer levels), late 9+ (crystals for fat HP, Avatar near
 * the exit, skill on clusters).
 */
import { WARMTH_START } from '@/play/pet-eggs';

import type { PetStatus } from './pet-status';

export type CoachTowerCounts = {
  archer: number;
  vine: number;
  crystal: number;
};

export type CoachTip = {
  tip: string;
  /** One-line "why" (tower job / mechanic), or null when nothing to expand. */
  why: string | null;
};

const EARLY_MAX = 3;
const MID_MAX = 8;

const EMPTY_COUNTS: CoachTowerCounts = { archer: 0, vine: 0, crystal: 0 };

function totalPlaced(counts: CoachTowerCounts): number {
  return counts.archer + counts.vine + counts.crystal;
}

/**
 * 1–2 plain sentences for the upcoming wave, tuned to the tower mix already
 * placed and the scrap on hand. Never blocks Start — callers treat it as an
 * optional hint.
 */
export function tipForWave(
  wave: number,
  scrap: number,
  towersPlaced: CoachTowerCounts = EMPTY_COUNTS,
): CoachTip {
  const w = Math.max(1, Math.floor(wave));
  const counts = towersPlaced ?? EMPTY_COUNTS;
  const placed = totalPlaced(counts);

  if (w <= EARLY_MAX) {
    if (placed === 0) {
      return {
        tip:
          'Place 2 archers near the spawn and the first bend, then drag your Avatar to the leak and cast Root Veil when the path is thick.',
        why: 'Archers chip the line with fast shots; your Avatar covers the exit while the slow lets everyone land more hits.',
      };
    }
    if (counts.archer < 2) {
      return {
        tip: 'Add one more archer to the early line — then save scrap to level it up.',
        why: 'Two archers on the first run catch every puff before the bend; levels make each shot hit harder.',
      };
    }
    return {
      tip: 'Good chip line. Spend scrap on archer levels before adding more towers — don\u2019t overbuild crystals yet.',
      why: 'Archer = chip (fast, first); crystal = chunk (slow, heavy). Heavy hits are overkill while puffs are thin.',
    };
  }

  if (w <= MID_MAX) {
    if (scrap < 40) {
      return {
        tip: `Wave ${w}: save 40 scrap — a vine on a bend is the next big swing.`,
        why: 'Vine = stall — it slows every enemy it hits, so the rest of your line lands more shots.',
      };
    }
    if (counts.vine === 0) {
      return {
        tip: `Wave ${w}: add a vine at a bend to stall the line, then put scrap into archer levels.`,
        why: 'Vine = stall — the slow buys your chips extra volleys on the same puffs.',
      };
    }
    return {
      tip: `Wave ${w}: vines are stalling — pour scrap into archer upgrades and watch the bends.`,
      why: 'More archer shots per stalled second is the cheapest DPS here.',
    };
  }

  // Late: fat HP + speed band.
  if (counts.crystal === 0) {
    return {
      tip: `Wave ${w}: add a crystal on the exit stretch — the puffs are fat now.`,
      why: 'Crystal = chunk — it hits the highest-HP enemy for heavy damage.',
    };
  }
  return {
    tip: `Wave ${w}: keep your Avatar near the exit and cast Root Veil when the path is thick.`,
    why: 'Your Avatar auto-attacks the nearest enemy; the slow lets every tower land more hits.',
  };
}

/* ------------------------------------------------------------ pet coach --- */
/*
 * Pet coach (room overhaul, 2026-09-29) — one line under the pet's status
 * saying what it needs, plus the button that does it. The matching icon in
 * the room's row pulses while the tip applies. Static copy (no AI), and the
 * pet says the same line out loud when tapped.
 */

/** What the coach button does. */
export type PetCoachAction = 'feed' | 'catch' | 'play' | 'dive' | 'expedition' | 'hatch' | 'warm';

/** The room icon (and sheet) each action opens — that icon pulses. */
export type PetCoachIcon = 'feed' | 'play' | 'dive' | 'expedition' | 'info';

/** Null = the action happens in the room itself (the egg picker's eggs,
 * tapping the egg to warm it) — no icon pulses. */
export const PET_COACH_ICON: Record<PetCoachAction, PetCoachIcon | null> = {
  feed: 'feed',
  catch: 'play', // the Play icon pulses; the button opens Catch full screen
  play: 'play',
  dive: 'dive',
  expedition: 'expedition',
  hatch: null, // the egg picker
  warm: null, // tap the egg
};

export type PetCoachAlt = { action: 'dive' | 'defend' | 'dress'; button: string };

export type PetCoachInput = {
  status: PetStatus;
  hunger: number;
  pantryTotal: number;
  expeditionReady: boolean;
  /** v25 — the next trip's length ("15m"), when one is ready. */
  nextTrip?: string | null;
  diveCharges: number;
  tokensLeftToday: number;
  /** "3h 10m" while away, else null. */
  backIn: string | null;
  /** After the first Tend, before they pick Dive or Defend. */
  offerFork?: boolean;
  /** After that outing pays off: a Dress chip beside the usual tip. */
  offerDress?: boolean;
};

export type PetCoachTip = {
  tip: string;
  action: PetCoachAction | null;
  /** Button label (null when there is nothing to press). */
  button: string | null;
  /** Second chip: the other outing, or Dress. Never replaces an urgent Tend. */
  alt: PetCoachAlt | null;
};

/** Egg: one warm tap past the start pip. Hatched: the egg already finished. */
export function hasTended(pet: { stage: string; warmth: number }): boolean {
  if (pet.stage !== 'egg') return true;
  return pet.warmth > WARMTH_START;
}

/** Hungry, chilly, sad, and the egg picker still win over the outing fork. */
function coachIsUrgent(input: PetCoachInput): boolean {
  switch (input.status) {
    case 'away':
    case 'choose_egg':
    case 'chilly':
    case 'starving':
    case 'hungry':
    case 'very_sad':
    case 'sad':
    case 'evolving':
      return true;
    case 'sleepy':
      return input.hunger <= PET_BEDTIME_HUNGER;
    default:
      return false;
  }
}

/** Hunger at or below this makes a sleepy pet ask for a bedtime snack. */
export const PET_BEDTIME_HUNGER = 2;

function foodTip(pantryTotal: number, fed: string, empty: string): Omit<PetCoachTip, 'alt'> {
  return pantryTotal > 0
    ? { tip: fed, action: 'feed', button: 'Feed' }
    : { tip: empty, action: 'catch', button: 'Catch the food' };
}

/** The one coaching line for the pet's current status. Pure. */
function coachLine(input: PetCoachInput): Omit<PetCoachTip, 'alt'> {
  const pantry = `${input.pantryTotal} in the pantry`;
  switch (input.status) {
    case 'away':
      return {
        tip: input.backIn ? `Out exploring — back in ${input.backIn}.` : 'Out exploring — back soon.',
        action: null,
        button: null,
      };
    case 'choose_egg':
      return { tip: 'Pick an egg — Knight, Wizard or Village.', action: 'hatch', button: 'Choose' };
    case 'chilly':
      return { tip: 'Brr… tap me to keep me warm!', action: 'warm', button: 'Warm' };
    case 'egg':
      return { tip: 'Toasty! Tap me now and then to keep it that way.', action: null, button: null };
    case 'starving':
    case 'hungry':
      return foodTip(
        input.pantryTotal,
        `I need food! ${pantry}.`,
        'Pantry’s empty — catch food, or dive for snacks.',
      );
    case 'very_sad':
    case 'sad':
      return { tip: 'I’m feeling low. Play with me?', action: 'play', button: 'Play' };
    case 'sleepy':
      return input.hunger <= PET_BEDTIME_HUNGER
        ? foodTip(input.pantryTotal, `Feed me before bed? ${pantry}.`, 'Tummy’s rumbling — catch me a bedtime snack?')
        : { tip: 'Zzz… see you in the morning.', action: null, button: null };
    case 'evolving':
      return { tip: 'I’m about to grow — keep my hearts up!', action: null, button: null };
    case 'happy':
    case 'okay':
      if (input.expeditionReady) {
        return {
          tip: input.nextTrip ? `All good! I could go exploring (${input.nextTrip}).` : 'All good! I could go exploring.',
          action: 'expedition',
          button: 'Send me',
        };
      }
      if (input.diveCharges >= 1) return { tip: 'All good! Up for a dive?', action: 'dive', button: 'Dive' };
      if (input.tokensLeftToday > 0) return { tip: 'All good! Fancy a game?', action: 'play', button: 'Play' };
      return { tip: 'All good!', action: null, button: null };
  }
}

/** Care first. After one Tend, offer Dive or Defend. Dress is a later chip. */
export function petCoachTip(input: PetCoachInput): PetCoachTip {
  if (input.offerFork && !coachIsUrgent(input)) {
    return {
      tip: 'Dive from here, or Defend on the Hub.',
      action: 'dive',
      button: 'Dive',
      alt: { action: 'defend', button: 'Defend' },
    };
  }
  const tip = coachLine(input);
  if (input.offerDress && !coachIsUrgent(input)) {
    return { ...tip, alt: { action: 'dress', button: 'Dress' } };
  }
  return { ...tip, alt: null };
}
