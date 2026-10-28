/**
 * PHASE-11h: the Almanac's look on Home, as pure data and maths (no React, no art
 * imports, so `check:almanac-art` can run it under plain tsx). Components map the
 * string keys here to `ART.*` accessors; this file only decides WHICH art and how
 * much of it, from the day's theme.
 *
 * Intensity is always `theme.display.intensity` (already slew-limited, H4): never
 * the raw target, and no second ramp here.
 */
import type { SeasonId } from './arcs';
import type { DayTheme } from './resolve';

export type LoopKey = 'snow' | 'leaf' | 'petal' | 'candle' | 'firework' | 'lantern-glow';

export type DecorKey =
  | 'crescent'
  | 'diya'
  | 'egg'
  | 'firework'
  | 'lantern'
  | 'petal'
  | 'pumpkin'
  | 'snowflake'
  | 'star'
  | 'wreath';

export type SprigKey =
  | 'christmas'
  | 'diwali'
  | 'easter'
  | 'eidAlFitr'
  | 'halloween'
  | 'lunarNewYear'
  | 'mothersDay'
  | 'newYear'
  | 'summer'
  | 'thanksgiving'
  | 'valentines'
  | 'winterSolstice';

export type MicroStickerKey =
  | 'clockChange'
  | 'equinox'
  | 'firstSnow'
  | 'friday13th'
  | 'fullMoon'
  | 'glow30'
  | 'halfYear'
  | 'oneYearAgo'
  | 'paydayFriday'
  | 'pick100'
  | 'smallMoment';

export type MonthStickerKey =
  | 'month01'
  | 'month02'
  | 'month03'
  | 'month04'
  | 'month05'
  | 'month06'
  | 'month07'
  | 'month08'
  | 'month09'
  | 'month10'
  | 'month11'
  | 'month12';

export type StickerKey = MicroStickerKey | MonthStickerKey;

/** Most decor icons on the ring at full intensity (spec: round(maxDecor × intensity)). */
export const MAX_DECOR = 12;
/** Edge sprigs show only while the event is approaching or fading in this band. */
export const SPRIG_MIN = 0.1;
export const SPRIG_MAX = 0.4;
/** Reduce Motion plays at a quarter of the speed. */
export const REDUCE_MOTION_SPEED = 0.25;
/** Reduce Motion plays every 3rd frame ("frames 1/3"). */
export const REDUCE_MOTION_FRAME_STEP = 3;

/**
 * One sprite sheet per loop: 64 px frames, `cols` across, row-major, `frames` used.
 * `rest` = blank ticks after the last frame (the firework is a one-shot burst).
 */
export const LOOPS: Record<LoopKey, { frames: number; cols: number; rows: number; ms: number; rest?: number }> = {
  snow: { frames: 16, cols: 4, rows: 4, ms: 83 },
  leaf: { frames: 16, cols: 4, rows: 4, ms: 100 },
  petal: { frames: 16, cols: 4, rows: 4, ms: 100 },
  candle: { frames: 8, cols: 3, rows: 3, ms: 100 },
  firework: { frames: 16, cols: 4, rows: 4, ms: 71, rest: 16 },
  'lantern-glow': { frames: 12, cols: 4, rows: 3, ms: 83 },
};

export interface EventLook {
  /** Event accent (lerped from the season colour by intensity). */
  color: string;
  decor: readonly DecorKey[];
  sprig: SprigKey | null;
  loop: LoopKey | null;
}

/** The season's colour on Home (the constellation tint when no event is on). */
export const SEASON_COLOR: Record<SeasonId, string> = {
  sparks: '#F5B83D',
  bloom: '#E86FA3',
  tides: '#3FB6D9',
  embers: '#E8743B',
};

/** Objects only for Diwali, Eid and Lunar New Year (M12): no garments, no outfits. */
export const EVENT_LOOK: Record<string, EventLook> = {
  new_year: { color: '#F5D05A', decor: ['firework', 'star'], sprig: 'newYear', loop: 'firework' },
  lunar_new_year: { color: '#E5483F', decor: ['lantern', 'firework'], sprig: 'lunarNewYear', loop: 'lantern-glow' },
  valentines: { color: '#E8557D', decor: ['petal'], sprig: 'valentines', loop: 'petal' },
  easter: { color: '#9AD6A2', decor: ['egg', 'petal'], sprig: 'easter', loop: 'petal' },
  mothers_day: { color: '#F08FB4', decor: ['petal'], sprig: 'mothersDay', loop: 'petal' },
  fathers_day: { color: '#4C8DD9', decor: ['star'], sprig: null, loop: null },
  summer_solstice: { color: '#FFC83D', decor: ['star'], sprig: 'summer', loop: null },
  summer: { color: '#26C0C7', decor: ['star'], sprig: 'summer', loop: null },
  back_to_school: { color: '#5B7BE0', decor: ['star'], sprig: null, loop: null },
  thanksgiving_ca: { color: '#D9822B', decor: ['wreath'], sprig: 'thanksgiving', loop: 'leaf' },
  thanksgiving_us: { color: '#D9822B', decor: ['wreath'], sprig: 'thanksgiving', loop: 'leaf' },
  halloween: { color: '#F27A1A', decor: ['pumpkin'], sprig: 'halloween', loop: 'candle' },
  diwali: { color: '#F2A81D', decor: ['diya', 'lantern'], sprig: 'diwali', loop: 'candle' },
  eid_al_fitr: { color: '#3FB58A', decor: ['crescent', 'star'], sprig: 'eidAlFitr', loop: 'lantern-glow' },
  winter_solstice: { color: '#7FB6E8', decor: ['snowflake', 'star'], sprig: 'winterSolstice', loop: 'snow' },
  christmas: { color: '#D23B3B', decor: ['wreath', 'snowflake', 'star'], sprig: 'christmas', loop: 'snow' },
  year_end: { color: '#C9B6F2', decor: ['firework', 'star'], sprig: 'newYear', loop: 'firework' },
  birthday: { color: '#FF8AD1', decor: ['star', 'firework'], sprig: null, loop: 'firework' },
  ato_anniversary: { color: '#8FD6FF', decor: ['star', 'firework'], sprig: null, loop: 'firework' },
};

const MICRO_STICKER: Record<string, MicroStickerKey> = {
  pick_100: 'pick100',
  glow_30: 'glow30',
  one_year_ago: 'oneYearAgo',
  equinox: 'equinox',
  full_moon: 'fullMoon',
  friday_13th: 'friday13th',
  clock_change: 'clockChange',
  half_year: 'halfYear',
  first_snow: 'firstSnow',
  payday_friday: 'paydayFriday',
  small_moment: 'smallMoment',
};

export const MICRO_STICKER_KEYS = Object.values(MICRO_STICKER);

export interface Look {
  /** Constellation accent: season colour, lerped toward the event colour by intensity. */
  accent: string;
  /** Displayed intensity, 0..1. */
  intensity: number;
  /** The event's art, or null on a season-only day. */
  event: EventLook | null;
  /** Decor icons on the ring: `round(MAX_DECOR × intensity)`. */
  decorCount: number;
  /** Edge sprigs show at 0.1–0.4 only. */
  sprigOn: boolean;
  /** One sticker: the micro-event's, else the month glyph. */
  sticker: StickerKey;
  /** Sticker is a real micro-event today (not the quiet month glyph). */
  stickerIsMicro: boolean;
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear sRGB-space colour lerp (`#rrggbb` in, `#rrggbb` out); t is clamped to 0..1. */
export function lerpColor(a: string, b: string, t: number): string {
  const k = Math.min(1, Math.max(0, t));
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * k);
  const out = (mix(ar, br) << 16) | (mix(ag, bg) << 8) | mix(ab, bb);
  return `#${out.toString(16).padStart(6, '0')}`;
}

export function lookOf(theme: DayTheme): Look {
  const intensity = Math.min(1, Math.max(0, theme.display.intensity));
  const eventId = theme.display.event;
  const event = (eventId && EVENT_LOOK[eventId]) || null;
  const seasonColor = SEASON_COLOR[theme.season.id];
  const accent = event ? lerpColor(seasonColor, event.color, intensity) : seasonColor;
  const micro = theme.active.find((e) => e.kind === 'micro');
  const microKey = micro ? MICRO_STICKER[micro.id] : undefined;
  const month = Math.min(12, Math.max(1, Number(theme.ymd.slice(5, 7)) || 1));
  return {
    accent,
    intensity,
    event,
    decorCount: event ? Math.round(MAX_DECOR * intensity) : 0,
    sprigOn: !!event?.sprig && intensity >= SPRIG_MIN && intensity <= SPRIG_MAX,
    sticker: microKey ?? (`month${String(month).padStart(2, '0')}` as MonthStickerKey),
    stickerIsMicro: !!microKey,
  };
}

/** Reduce Motion, gentle and never still: half the ring, quarter speed, every 3rd frame. */
export function reducedDecorCount(count: number): number {
  return Math.ceil(count / 2);
}

/** Particle layer opacity for an intensity (a faint haze at 0.1, clear at the peak). */
export function particleOpacity(intensity: number, reduced: boolean): number {
  const base = 0.2 + 0.7 * Math.min(1, Math.max(0, intensity));
  return reduced ? base / 2 : base;
}
