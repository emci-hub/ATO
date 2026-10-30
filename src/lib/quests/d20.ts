import type { QuestCheck, Stat } from '@/lib/quests/types';

/**
 * Quests d20 (ATO-BUILD PHASE-14). Pure and seeded: the roll for a pick is
 * mulberry32(fnv1a(runId|sceneId|choiceId)), so a reload, a resume or a Rewind
 * that re-picks the same choice gets the same roll (no re-roll, R16). A NEW run
 * has a new runId and rolls again; that changes the branch, not the evidence.
 *
 * Success = roll + stat ≥ dc, except a natural 1 never passes and a natural 20
 * always does. Those two rules make the odds shown before commit,
 * clamp((21 − (dc − stat)) / 20, 0.05, 0.95), the real odds for every dc 1–30.
 * Party stats only.
 */

/** 32-bit FNV-1a. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a float in [0, 1) per call. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1–20, fixed for this run, scene and choice. */
export function rollD20(runId: string, sceneId: string, choiceId: string): number {
  return 1 + Math.floor(mulberry32(fnv1a(`${runId}|${sceneId}|${choiceId}`))() * 20);
}

/** The odds shown before commit. */
export function checkOdds(dc: number, stat: number): number {
  return Math.max(0.05, Math.min(0.95, (21 - (dc - stat)) / 20));
}

export function rollPasses(roll: number, stat: number, dc: number): boolean {
  if (roll <= 1) return false;
  if (roll >= 20) return true;
  return roll + stat >= dc;
}

export interface D20Result {
  roll: number;
  stat: Stat;
  /** The party stat's value at the roll. */
  value: number;
  dc: number;
  success: boolean;
}

export function resolveCheck(
  check: QuestCheck,
  stats: Record<Stat, number>,
  runId: string,
  sceneId: string,
  choiceId: string,
): D20Result {
  const roll = rollD20(runId, sceneId, choiceId);
  const value = stats[check.stat];
  return { roll, stat: check.stat, value, dc: check.dc, success: rollPasses(roll, value, check.dc) };
}
