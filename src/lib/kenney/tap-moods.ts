/**
 * Nav-pixel tap moods. Each entry is a complete gesture: one hand state plus
 * a matching short motion. Randomness is only *which* mood plays — never a
 * mix of one mood's hands with another's motion.
 *
 * Hands are Shape-pack states only (open / thumb / peace / closed). Closed is
 * a fist, so hug uses open + a squeeze, not a fist.
 */

export type TapMoodId = 'wave' | 'thumbsUp' | 'happyBounce' | 'hug';

export type TapHandState = 'open' | 'thumb' | 'peace';

export interface TapMood {
  id: TapMoodId;
  /** The only hand state this mood ever shows. */
  hand: TapHandState;
  /** Hand hold + motion; keep under ~1s so re-taps can interrupt cleanly. */
  durationMs: number;
}

export const TAP_MOODS: Record<TapMoodId, TapMood> = {
  wave: { id: 'wave', hand: 'open', durationMs: 720 },
  thumbsUp: { id: 'thumbsUp', hand: 'thumb', durationMs: 640 },
  happyBounce: { id: 'happyBounce', hand: 'peace', durationMs: 760 },
  hug: { id: 'hug', hand: 'open', durationMs: 780 },
};

const CURRENT_YOU_POOL: readonly TapMoodId[] = ['wave', 'thumbsUp', 'hug', 'happyBounce'];
/** Sage (aspirational glow): same four, weighted toward bounce + wave. */
const SAGE_POOL: readonly TapMoodId[] = [
  'happyBounce',
  'happyBounce',
  'wave',
  'wave',
  'thumbsUp',
  'hug',
];

export function pickTapMood(onSage: boolean, lastId: TapMoodId | null): TapMood {
  const pool = onSage ? SAGE_POOL : CURRENT_YOU_POOL;
  const candidates = lastId ? pool.filter((id) => id !== lastId) : pool;
  const pickFrom = candidates.length > 0 ? candidates : pool;
  const id = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  return TAP_MOODS[id];
}
