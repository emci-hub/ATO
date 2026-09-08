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
