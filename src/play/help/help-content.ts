/**
 * The "?" help sheet copy (Divecore Phase 4, emci 2026-10-14) — pure.
 *
 * One small sheet per game screen: at most 3 bullets, at most 10 words each. Anything longer
 * lives in the Guide (Hideout → Info → Guide); the sheet only points there. Pinned by
 * `check:divecore-ftue` (limits, one entry per screen, plain words).
 */
import type { GameScreenId } from '@/play/stage-frame';

/** One entry per game screen (list screens split into Locker, Blades and Store). */
export const HELP_IDS = [
  'hideout',
  'turf-setup',
  'turf-wave',
  'dive',
  'pet-game',
  'locker',
  'blades',
  'store',
] as const;
export type HelpId = (typeof HELP_IDS)[number];

export const HELP_MAX_BULLETS = 3;
export const HELP_MAX_WORDS = 10;

export type HelpEntry = { title: string; bullets: readonly string[] };

export const HELP: Record<HelpId, HelpEntry> = {
  hideout: {
    title: 'Hideout',
    bullets: [
      'Tap the egg to warm it.',
      'Feed keeps your pet happy.',
      'Room spots open Play, Underground and Explore.',
    ],
  },
  'turf-setup': {
    title: 'Turf War',
    bullets: [
      'Place towers along the path.',
      'Setup holds maps, drops and replays.',
      'Call wave when you are ready.',
    ],
  },
  'turf-wave': {
    title: 'Turf War',
    bullets: [
      'Drag your Avatar to stop leaks.',
      'Your pet pounces once a wave.',
      'Pause, then Leave from the bar.',
    ],
  },
  dive: {
    title: 'Underground',
    bullets: [
      'Surface keeps your haul.',
      'Deeper adds a find and a bust chance.',
      'The % on the button is the real roll.',
    ],
  },
  'pet-game': {
    title: 'Mini-game',
    bullets: [
      'Catch: tap falling food, skip the bombs.',
      'Train: tap while the marker is in the lit zone.',
      'A pass feeds or trains your pet.',
    ],
  },
  locker: {
    title: 'Locker',
    bullets: [
      'Powers change the games. Looks are only style.',
      'Each Power says where it works.',
      'Equip to wear. Sell extras. Merge copies (can miss).',
    ],
  },
  blades: {
    title: 'Blades',
    bullets: [
      'Blades are your tower swords.',
      'Mix and merge copies to level up.',
      'Undo takes back your last move.',
    ],
  },
  store: {
    title: 'Store',
    bullets: [
      'Spend tokens on the shelf.',
      'Daily and weekly limits apply.',
      'Paid rows are not for sale yet.',
    ],
  },
};

/** Where the long version lives, in the words a player sees. */
export const FULL_GUIDE_PATH = 'Hideout → Info → Guide';

/** Screens that sit inside a live run: leaving for the Guide would end it, so the sheet only names the path. */
export const HELP_GUIDE_LINK_BLOCKED: readonly HelpId[] = ['dive', 'turf-wave', 'pet-game'];

export function helpGuideLinkAllowed(id: HelpId): boolean {
  return !HELP_GUIDE_LINK_BLOCKED.includes(id);
}

/** Which frame id each help entry belongs to (the gate checks every frame has at least one). */
export const HELP_FRAME: Record<HelpId, GameScreenId> = {
  hideout: 'hideout',
  'turf-setup': 'turf-setup',
  'turf-wave': 'turf-wave',
  dive: 'dive',
  'pet-game': 'pet-game',
  locker: 'list',
  blades: 'list',
  store: 'list',
};

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
