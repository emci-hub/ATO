/**
 * Almanac ramps (ATO-BUILD PHASE-11b, red team H4). Pure.
 *
 * ONE meaning for the numbers: each event has `{teaser, lead, build, peak, fade}`
 * in DAYS, and the phases are laid out backward from the peak's first day:
 *
 *   ... teaser | lead | build | PEAK | fade ...
 *
 * Christmas 14/7/5/2/5 = a 14-day teaser, then a 7-day lead, then a 5-day build,
 * then a 2-day peak (Dec 25-26), then a 5-day fade. The addendum's "offsets" and
 * `windows {leadDays...}` are not used.
 *
 * Target intensity (smoothstep inside each band):
 *   teaser 0.10-0.20 · lead 0.20-0.40 · build 0.40-0.80 · peak 1.0 · fade 1 → 0
 * What the screen SHOWS is this target passed through a slew limit
 * (`MAX_DAILY_STEP`) by `resolve.ts`, so nothing pops in or snaps out.
 */
import type { AlmanacPhase } from './types';

export interface RampDays {
  teaser: number;
  lead: number;
  build: number;
  peak: number;
  fade: number;
}

export const MIN_BUILD_DAYS = 2;
export const MIN_FADE_DAYS = 4;
/** The displayed intensity never moves more than this in one day. */
export const MAX_DAILY_STEP = 0.3;

export const PHASE_BANDS: Readonly<Record<'teaser' | 'lead' | 'build', readonly [number, number]>> = {
  teaser: [0.1, 0.2],
  lead: [0.2, 0.4],
  build: [0.4, 0.8],
};

/** Clamp a ramp to whole days with the minimum build and fade. */
export function normalizeRamp(ramp: RampDays): RampDays {
  const whole = (n: number) => Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  return {
    teaser: whole(ramp.teaser),
    lead: whole(ramp.lead),
    build: Math.max(MIN_BUILD_DAYS, whole(ramp.build)),
    peak: Math.max(1, whole(ramp.peak)),
    fade: Math.max(MIN_FADE_DAYS, whole(ramp.fade)),
  };
}

export function smoothstep(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

export interface RampPoint {
  phase: AlmanacPhase;
  /** Target intensity before the slew limit, 0..1. */
  intensity: number;
  /** 1-based day inside this phase. */
  dayInPhase: number;
  phaseDays: number;
}

/** Days from the first teaser day to the last fade day, inclusive. */
export function rampSpanDays(ramp: RampDays): number {
  const r = normalizeRamp(ramp);
  return r.teaser + r.lead + r.build + r.peak + r.fade;
}

/**
 * The ramp on the day that is `dt` days after the peak's first day
 * (negative = before the peak). Null outside the event's window.
 */
export function rampAt(ramp: RampDays, dt: number): RampPoint | null {
  const r = normalizeRamp(ramp);
  const pre = r.teaser + r.lead + r.build;
  if (dt < -pre || dt >= r.peak + r.fade) return null;
  if (dt >= r.peak) {
    const j = dt - r.peak + 1;
    return { phase: 'fade', intensity: 1 - smoothstep(j / (r.fade + 1)), dayInPhase: j, phaseDays: r.fade };
  }
  if (dt >= 0) return { phase: 'peak', intensity: 1, dayInPhase: dt + 1, phaseDays: r.peak };
  const ahead = -dt; // 1 = the day before the peak
  const bands: ['build' | 'lead' | 'teaser', number][] = [
    ['build', r.build],
    ['lead', r.lead],
    ['teaser', r.teaser],
  ];
  let offset = 0;
  for (const [phase, days] of bands) {
    if (ahead <= offset + days) {
      const i = days - (ahead - offset); // 0-based from the phase's first day
      const [lo, hi] = PHASE_BANDS[phase];
      return {
        phase,
        intensity: lo + (hi - lo) * smoothstep((i + 1) / days),
        dayInPhase: i + 1,
        phaseDays: days,
      };
    }
    offset += days;
  }
  return null;
}

/** Move `prev` toward `target` by at most `max`. */
export function slewToward(prev: number, target: number, max: number = MAX_DAILY_STEP): number {
  const delta = target - prev;
  if (Math.abs(delta) <= max) return target;
  return prev + Math.sign(delta) * max;
}
