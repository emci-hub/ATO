/**
 * Pet status (room overhaul, 2026-09-29) — the ONE state the bubble over the
 * pet shows, as a phone emoji + a word, most urgent first:
 *
 *   Away › Pick an egg › Chilly (egg warmth ≤ 1) › (Egg) › Starving › Very sad › Hungry › Sad › Sleepy ›
 *   Evolving soon › Happy › Okay
 *
 * Empty meter = 0 hearts, low = 1 heart. Sleepy = 22:00-07:00 on the phone's
 * clock (looks only — hunger still drops overnight, as before). Evolving soon
 * = the smaller of 12h or 25% of the current stage is left. Pure — no React.
 */
import { PET_METER_MAX, PET_STAGES, PET_STAGE_MS, type PetStage } from './pet';

export const PET_STATUSES = [
  'away',
  'choose_egg',
  'chilly',
  'egg',
  'starving',
  'very_sad',
  'hungry',
  'sad',
  'sleepy',
  'evolving',
  'happy',
  'okay',
] as const;
export type PetStatus = (typeof PET_STATUSES)[number];

export const PET_STATUS_EMOJI: Record<PetStatus, string> = {
  away: '🧭',
  choose_egg: '🥚',
  chilly: '🥶',
  egg: '🥚',
  starving: '😫',
  very_sad: '😭',
  hungry: '😋',
  sad: '😢',
  sleepy: '😴',
  evolving: '✨',
  happy: '😊',
  okay: '🙂',
};

export const PET_STATUS_WORD: Record<PetStatus, string> = {
  away: 'Away',
  choose_egg: 'Pick an egg',
  chilly: 'Chilly',
  egg: 'Egg',
  starving: 'Starving',
  very_sad: 'Very sad',
  hungry: 'Hungry',
  sad: 'Sad',
  sleepy: 'Sleepy',
  evolving: 'Evolving soon',
  happy: 'Happy',
  okay: 'Okay',
};

/** A meter at or below this many hearts is "low". */
export const PET_LOW_HEARTS = 1;
/** Night on the phone's clock: from 22:00, until 07:00. */
export const PET_NIGHT_FROM_HOUR = 22;
export const PET_NIGHT_UNTIL_HOUR = 7;
const HOUR = 60 * 60 * 1000;
export const PET_EVOLVE_SOON_MAX_MS = 12 * HOUR;
export const PET_EVOLVE_SOON_SHARE = 0.25;

export function isNightHour(hour: number): boolean {
  return hour >= PET_NIGHT_FROM_HOUR || hour < PET_NIGHT_UNTIL_HOUR;
}

/** "Evolving soon" window for a stage (null at God — it never evolves). */
export function evolvingSoonWindowMs(stage: PetStage): number | null {
  if (stage === 'god') return null;
  return Math.min(PET_EVOLVE_SOON_MAX_MS, PET_STAGE_MS[stage] * PET_EVOLVE_SOON_SHARE);
}

export function isEvolvingSoon(stage: PetStage, stageLeftMs: number | null): boolean {
  const window = evolvingSoonWindowMs(stage);
  return window != null && stageLeftMs != null && stageLeftMs <= window;
}

export type PetStatusInput = {
  stage: PetStage;
  hunger: number;
  mood: number;
  away: boolean;
  night: boolean;
  stageLeftMs: number | null;
  /** v23 — an egg has been chosen (false = the egg picker). */
  eggChosen?: boolean;
  /** v23 — egg warmth pips (0-4). */
  warmth?: number;
};

/** Egg warmth at or below this reads Chilly. */
export const PET_CHILLY_WARMTH = 1;

/** The one status to show — the most urgent first (see the header). */
export function petStatus(input: PetStatusInput): PetStatus {
  if (input.away) return 'away';
  if (input.stage === 'egg' && input.eggChosen === false) return 'choose_egg';
  if (input.stage === 'egg' && (input.warmth ?? 4) <= PET_CHILLY_WARMTH) return 'chilly';
  // An egg stays "Egg" (so "Choose what hatches" is offered until it hatches);
  // its label reads "Hatching soon" in its last minutes (petStatusLabel).
  if (input.stage === 'egg') return 'egg';
  if (input.hunger <= 0) return 'starving';
  if (input.mood <= 0) return 'very_sad';
  if (input.hunger <= PET_LOW_HEARTS) return 'hungry';
  if (input.mood <= PET_LOW_HEARTS) return 'sad';
  if (input.night) return 'sleepy';
  if (isEvolvingSoon(input.stage, input.stageLeftMs)) return 'evolving';
  if (input.hunger >= 3 && input.mood >= 3) return 'happy';
  return 'okay';
}

/** "😋 Hungry" — an Egg in its evolving-soon window reads "✨ Hatching soon". */
export function petStatusLabel(status: PetStatus, stage: PetStage, stageLeftMs: number | null = null): string {
  if (status === 'egg' && stage === 'egg' && isEvolvingSoon('egg', stageLeftMs)) {
    return `${PET_STATUS_EMOJI.evolving} Hatching soon`;
  }
  return `${PET_STATUS_EMOJI[status]} ${PET_STATUS_WORD[status]}`;
}

/** True when `now` is a later stage than `seen` (a rebirth back to Egg is
 * not) — the room says "I grew!" once. */
export function justEvolved(seen: PetStage | null, now: PetStage): boolean {
  if (seen == null) return false;
  return PET_STAGES.indexOf(now) > PET_STAGES.indexOf(seen);
}

/** "❤❤❤♡" — filled then empty hearts, system characters only. */
export function heartsText(value: number, max: number = PET_METER_MAX): string {
  const filled = Math.max(0, Math.min(max, Math.round(value)));
  return '❤'.repeat(filled) + '♡'.repeat(max - filled);
}
