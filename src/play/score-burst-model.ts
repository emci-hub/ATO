/**
 * Mini-game result celebration — the rules, with no React in them so a check
 * script can pin them (scripts/score-burst-check.ts).
 *
 *   strong  = a new record, or a Silver / Gold medal. Bronze and a plain pass
 *             still count the score up, but get no confetti.
 *   count   = the score eases up from 0 to the final number (ease-out cubic).
 */
import type { Medal } from '@/play/game-records';

export const COUNT_UP_MS = 900;
export const CONFETTI_COUNT = 18;

export function isStrongResult(r: { medal: Medal | null; newRecord: boolean }): boolean {
  return r.newRecord || r.medal === 'silver' || r.medal === 'gold';
}

/** The number to show `elapsedMs` into the count. Always lands on `target`. */
export function countUpValue(target: number, elapsedMs: number, durationMs: number = COUNT_UP_MS): number {
  const end = Math.max(0, Math.round(target));
  if (end === 0 || elapsedMs >= durationMs) return end;
  if (elapsedMs <= 0) return 0;
  const t = elapsedMs / durationMs;
  const eased = 1 - Math.pow(1 - t, 3);
  return Math.min(end, Math.round(end * eased));
}

export type ConfettiPiece = {
  /** Radians, fanned upward (-π..0) so the burst reads as a pop, not a fall. */
  angle: number;
  /** How far it flies, in px. */
  dist: number;
  /** Total rotation, in degrees. */
  spin: number;
  delay: number;
  duration: number;
  /** Index into the palette. */
  color: number;
  size: number;
};

export function confettiPieces(count: number, rng: () => number): ConfettiPiece[] {
  const out: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      angle: -Math.PI * (0.08 + 0.84 * ((i + rng() * 0.8) / count)),
      dist: 70 + rng() * 80,
      spin: (rng() - 0.5) * 720,
      delay: Math.round(rng() * 120),
      duration: 650 + Math.round(rng() * 450),
      color: Math.floor(rng() * 5),
      size: 6 + Math.round(rng() * 4),
    });
  }
  return out;
}
