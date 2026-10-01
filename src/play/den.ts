/**
 * The Den (v27, Part D) — keep many pets, raise one at a time. Pure rules.
 *
 *   - Slots: 6 to start (the active pet counts as one), more for shells —
 *     7th 100, 8th 150, 9th 225, 10th 340, 11th 500, 12th 750; 12 at most.
 *   - One ACTIVE pet (the room, its perks, the pounce, Pumped). The others
 *     REST: they are frozen — no aging, no hunger or mood loss, no care
 *     mistakes, no egg warmth lost — because nothing ever ages a resting pet.
 *     Waking one sets `seen_at = max(now, seen_at)`, so no time passes while it
 *     rested; a clock set back can't add any either.
 *   - Waking a pet before Child re-stamps its pity position to the counter
 *     now (`pity_from`); only the active pet ever reveals, so the counter can
 *     only move through the pet that holds the stamp.
 *   - Swapping is refused mid-dive, while the active pet is away on an
 *     expedition, and while a mini-game is open (the Den lives in the Pet room,
 *     so TD can never run at the same time).
 *   - Buffs, the expedition ladder, the token cap, the Power ceiling, records
 *     and pity are per player — a swap never touches them.
 */
import { PET_STAGES, type PetState } from '@/play/pet';
import { gradeRank } from '@/play/pet-eggs';

export const DEN_START_SLOTS = 6;
export const DEN_SLOT_PRICES: readonly number[] = [100, 150, 225, 340, 500, 750];
export const DEN_MAX_SLOTS = DEN_START_SLOTS + DEN_SLOT_PRICES.length;

/** Shells for the next slot, or null when the Den is at its most. */
export function denSlotPrice(slots: number): number | null {
  const i = Math.floor(slots) - DEN_START_SLOTS;
  return i >= 0 && i < DEN_SLOT_PRICES.length ? DEN_SLOT_PRICES[i] : null;
}

export function clampDenSlots(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : DEN_START_SLOTS;
  return Math.max(DEN_START_SLOTS, Math.min(DEN_MAX_SLOTS, v));
}

/** No egg chosen yet (the egg picker). */
export function isBlankSlot(pet: PetState): boolean {
  return pet.stage === 'egg' && pet.egg == null;
}

/** Slots in use: the active pet + every resting one. */
export function denUsed(resting: readonly PetState[]): number {
  return 1 + resting.length;
}

export function petRevealed(pet: PetState): boolean {
  return pet.hero != null && PET_STAGES.indexOf(pet.stage) >= PET_STAGES.indexOf('child');
}

export type DenSwapBlock = 'diving' | 'away' | 'game' | 'pick_egg';

/** Why the active pet can't change right now, or null. `pick_egg` = a blank
 * slot whose egg is already paid for (from "Change egg") — pick it first. */
export function denSwapBlock(s: { diving: boolean; away: boolean; gameOpen: boolean; active: PetState }): DenSwapBlock | null {
  if (s.diving) return 'diving';
  if (s.away) return 'away';
  if (s.gameOpen) return 'game';
  if (isBlankSlot(s.active) && s.active.prepaid) return 'pick_egg';
  return null;
}

/** A pet waking up in the Den: no time passed while it rested, and before
 * Child it takes the pity position as of now. */
export function wakePet(pet: PetState, now: number, since: number): PetState {
  const preChild = PET_STAGES.indexOf(pet.stage) < PET_STAGES.indexOf('child');
  return {
    ...pet,
    seen_at: Math.max(now, pet.seen_at),
    pity_from: preChild ? Math.max(0, Math.floor(since)) : pet.pity_from,
  };
}

export type DenSort = 'recent' | 'grade' | 'shiny';
export const DEN_SORTS: readonly DenSort[] = ['recent', 'grade', 'shiny'];
export const DEN_SORT_LABEL: Record<DenSort, string> = { recent: 'Newest', grade: 'Grade', shiny: 'Shiny' };

/** Favourites first, then the sort (ties: newest first). */
export function sortDen(pets: readonly PetState[], sort: DenSort): PetState[] {
  const grade = (p: PetState) => (p.grade ? gradeRank(p.grade) : -1);
  return [...pets].sort((a, b) => {
    if (a.fav !== b.fav) return a.fav ? -1 : 1;
    if (sort === 'grade' && grade(a) !== grade(b)) return grade(b) - grade(a);
    if (sort === 'shiny' && a.shiny !== b.shiny) return a.shiny ? -1 : 1;
    return b.uid - a.uid;
  });
}
