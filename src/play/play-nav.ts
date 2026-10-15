/**
 * Play navigation, pure (Phase 3, 2026-10-14).
 *
 * Hideout is home — the Block is gone. One entry per place:
 *   Hideout · Turf War · Locker (Fits / Blades) · Store are the tabs; Underground (Dive) opens only
 *   from the Hideout hatch (no tab, no tile); Exit Play lives in ⚙ (first row).
 * Back: every sub-screen goes to the Hideout; Dive goes back to the screen that opened it.
 * `src/app/play.tsx` wires these; `check:divecore-nav` pins them.
 */

export type PlayMode = 'dive' | 'pet' | 'dress' | 'defend' | 'shop' | 'about' | 'sheetlab' | 'swords' | 'swordlab';
export type PlayTab = 'hideout' | 'turf' | 'locker' | 'store';

/** Tab bar order. Store only shows while the shop is unlocked. */
export const PLAY_TABS: readonly PlayTab[] = ['hideout', 'turf', 'locker', 'store'];

/** The mode a tab opens (Locker always lands on Fits). */
export function modeForTab(tab: PlayTab): PlayMode {
  switch (tab) {
    case 'hideout':
      return 'pet';
    case 'turf':
      return 'defend';
    case 'locker':
      return 'dress';
    case 'store':
      return 'shop';
  }
}

/** The tab to light for a mode (null where no tab applies: Dive, About, the dev labs). */
export function tabForMode(mode: PlayMode): PlayTab | null {
  switch (mode) {
    case 'pet':
      return 'hideout';
    case 'defend':
      return 'turf';
    case 'dress':
    case 'swords':
      return 'locker';
    case 'shop':
      return 'store';
    default:
      return null;
  }
}

/** One level back: Dive returns to where it was opened, everything else to the Hideout. */
export function backTarget(mode: PlayMode, diveFrom: PlayMode): PlayMode {
  return mode === 'dive' ? diveFrom : 'pet';
}
