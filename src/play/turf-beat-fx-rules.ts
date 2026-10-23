/**
 * Turf War polish beats (step T7, 2026-10-17) — the pure rules, so `check:turf-war-layout` can import them.
 * Display only: nothing here feeds the engine, prices, waves, rewards or the one-leak loss. A beat may hold the won /
 * lost card back for a moment (like the T6 boss blast); the win and the loss are decided and paid on the same tick as before.
 *
 * emci's picks at stop 1 (all recommended): wave start = a new cyan street portal at the path start (`gate/burst`) + a
 * lane line; wave clear = the same portal closes at the exit (frames 7..13, no new art); win = new gold + cyan sparks over
 * every tower (`cheer/burst`, staggered); lose = a red ghost of the leaker re-walks its last 3 cells, then the exit ring.
 */
import type { FxQuality } from '@/play/fx-quality';
import { LEAK_PULSE_MS, type CombatMotion } from '@/play/turf-combat-fx-rules';

/** The fx sheets the beats play from (`meta.fx` keys, one-shots — only "shot" loops). */
export const BEAT_FX = {
  portal: 'gate/burst',
  sparks: 'cheer/burst',
} as const;

/** Timing table (ms). The check keeps every constant inside its [min, max] and matches the packed sheets. */
/** The portal: 14 frames @ 12 fps (opens f0–3, swirls f4–10, closes f11–13). */
export const PORTAL_MS = 1_170;
/** The wave-clear beat plays the portal's closing half at the exit: frames 7..13. */
export const PORTAL_CLOSE_FROM = 7;
export const WAVE_CLEAR_MS = 580;
/** The Reduce Motion portal: one open frame, fading in and out. */
export const PORTAL_STILL_FRAME = 6;
/** Win sparks: 10 frames @ 12 fps per tower, the towers one after another. */
export const WIN_SPARK_MS = 830;
export const WIN_SPARK_STAGGER_MS = 170;
/** At most this many spark bursts (6 towers + 2 Bound Bosses). */
export const WIN_SPARK_MAX = 8;
export const SPARK_STILL_FRAME = 3;
/** The leak replay: the leaker's last cells, walked again at about half speed, then the exit ring. */
export const LEAK_REPLAY_CELLS = 3;
export const LEAK_REPLAY_MS = 1_200;
/** One board cell in board units (16 × 16 grid on 0..100). */
export const CELL_UNITS = 100 / 16;

/** How long the win card waits for the clear + sparks beat (display only). */
export function winBeatMs(sparkCount: number): number {
  const n = Math.min(Math.max(0, sparkCount), WIN_SPARK_MAX);
  return Math.max(WAVE_CLEAR_MS, n > 0 ? (n - 1) * WIN_SPARK_STAGGER_MS + WIN_SPARK_MS : 0);
}
/** How long the lost card waits for the replay + exit ring (display only). */
export const LOSE_BEAT_MS = LEAK_REPLAY_MS + LEAK_PULSE_MS;

export const BEAT_DURATIONS: Record<string, { ms: number; min: number; max: number }> = {
  portal: { ms: PORTAL_MS, min: 800, max: 1_400 },
  waveClear: { ms: WAVE_CLEAR_MS, min: 400, max: 900 },
  winSpark: { ms: WIN_SPARK_MS, min: 600, max: 1_000 },
  winBeat: { ms: winBeatMs(WIN_SPARK_MAX), min: 600, max: 2_200 },
  leakReplay: { ms: LEAK_REPLAY_MS, min: 800, max: 1_600 },
  loseBeat: { ms: LOSE_BEAT_MS, min: 1_000, max: 2_200 },
};

export type BeatMode = 'anim' | 'still';
export type BeatFxFlags = {
  /** Wave start: the portal at the path start. */
  portal: BeatMode | null;
  /** Wave clear: the portal closes at the exit. */
  clear: BeatMode | null;
  /** Win: sparks over the towers. */
  sparks: BeatMode | null;
  /** Spark every Nth tower (Minimal = every other one). */
  sparkEvery: number;
  /** Lose: the leak replay ('still' = the trail, the ghost at the exit and the ring, no motion). */
  replay: BeatMode | null;
};

/**
 * What plays, per Effects Quality and Motion (same shape as T5 / T6). No beat ever flashes, shakes or stops the sim.
 *   Off      — no beat (the lane line and the cards stay; numbers still readable).
 *   Minimal  — every beat, sparks on every other tower.
 *   Full     — every beat.
 * Reduce Motion (OS or in-game Reduced) and Motion Off: every beat as a still frame fading in and out.
 */
export function beatFxFlags(quality: FxQuality, motion: CombatMotion): BeatFxFlags {
  if (quality === 'off') return { portal: null, clear: null, sparks: null, sparkEvery: 1, replay: null };
  const mode: BeatMode = motion.vestibularSafe || motion.cosmeticsStill ? 'still' : 'anim';
  return { portal: mode, clear: mode, sparks: mode, sparkEvery: quality === 'minimal' ? 2 : 1, replay: mode };
}

/** The portal's ground point (board units) for a path end, kept inside the board so the 80 px ring is never clipped. */
export function portalPoint(p: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.min(92, Math.max(8, p.x * 100)), y: Math.min(95.5, Math.max(4.5, p.y * 100)) };
}

/** Win sparks sit this far (board units) above the pad, over the tower. */
export const SPARK_LIFT = 4;
/** Where a tower's win sparks pop (board units), kept inside the board so the 68 px burst is never clipped (corner pads). */
export function sparkPoint(pad: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.min(93.5, Math.max(6.5, pad.x)), y: Math.min(93.5, Math.max(7, pad.y - SPARK_LIFT)) };
}

/** The last `cells` of the path (0..1 waypoints) as board-unit points about one unit apart, ending at the exit. */
export function leakReplayPath(path: readonly { x: number; y: number }[], cells = LEAK_REPLAY_CELLS): { x: number; y: number }[] {
  const pts = path.map((p) => ({ x: p.x * 100, y: p.y * 100 }));
  if (pts.length < 2) return pts;
  let want = cells * CELL_UNITS;
  const back: { x: number; y: number }[] = [pts[pts.length - 1]!];
  for (let i = pts.length - 1; i > 0 && want > 0; i -= 1) {
    const a = pts[i]!;
    const b = pts[i - 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const take = Math.min(len, want);
    const steps = Math.max(1, Math.round(take));
    for (let k = 1; k <= steps; k += 1) {
      const t = (take * k) / steps / Math.max(len, 1e-6);
      back.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    want -= take;
  }
  return back.reverse();
}

/** The lane line at wave start (a NOTIFY: title ≤ 3 words, body ≤ 10). */
export function waveStartNotice(wave: number, phaseLabel: string, puffs: number): { title: string; body: string } {
  return { title: `WAVE ${wave}`, body: `${phaseLabel} · ${puffs} ${puffs === 1 ? 'puff' : 'puffs'} on the road` };
}
