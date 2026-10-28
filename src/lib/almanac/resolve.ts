/**
 * Almanac resolver (ATO-BUILD PHASE-11b, red team H4). Pure: no storage, no network.
 *
 * For one local day it answers three things:
 *  1. WHAT is on (`winner`): the event whose cards the engine may use. Priority:
 *     personal > regional peak > global peak > lead/fade > ambient > micro (then month,
 *     season, week, base, which are always on). Ties go to the higher target, then the id.
 *  2. WHAT THE SCREEN SHOWS (`display`): one "lane" with one owner and one intensity.
 *     The intensity follows the owner's target through a slew limit (`MAX_DAILY_STEP`),
 *     and the owner changes only once the lane has dropped to that same step or lower,
 *     so a losing event slews down and never snaps, and at most one event is ever above 0.4.
 *  3. The ARCS (season, month, week axis), so every day has a theme.
 *
 * State is derived, never stored: the lane for a day is rebuilt by walking back
 * `WALK_BACK_DAYS` days from a steady start. States converge within ~4 days, so
 * any start gives the same answer for today (the check pins this).
 *
 * Content follows the calendar (`winner`), visuals follow the lane. They differ only
 * for the few days an event hands over to a higher-priority one.
 */
import { addDaysYmd, daysBetweenYmd } from '@/lib/local-date';
import type { TraitAxis } from '@/lib/traits';

import {
  equinoxDays,
  eventEnabled,
  fullMoonDays,
  nameFor,
  peakStartsFor,
  type EventPrefs,
  type RuleEnv,
} from './calendar';
import {
  AMBIENT_CAP,
  EVENTS,
  MICRO_INTENSITY,
  MICRO_NAMES,
  SMALL_MOMENT_EVERY,
  type EventDef,
  type MicroId,
} from './events';
import {
  dayIndexFor,
  isLineDay,
  microIdsFor,
  monthArc,
  monthTheme,
  seasonArc,
  seasonFor,
  weekArc,
  weekAxisFor,
  type MicroFacts,
  type MonthTheme,
  type SeasonInfo,
} from './arcs';
import { MAX_DAILY_STEP, rampAt, slewToward } from './ramp';
import type { ActiveEvent, AlmanacCalendar, AlmanacCard, AlmanacContext, AlmanacPhase } from './types';

export const WALK_BACK_DAYS = 30;
/** The lane may hand over once it is at or below this. */
export const HANDOVER_MAX = MAX_DAILY_STEP;

export const RANK = {
  micro: 3,
  ambient: 4,
  approach: 5, // teaser, lead, build, fade of a real event
  globalPeak: 6,
  regionalPeak: 7,
  personal: 8,
} as const;

export interface DayEvent {
  id: string;
  name: string;
  kind: 'event' | 'micro';
  phase: AlmanacPhase;
  /** Target intensity (before the slew limit), 0..1. Ambient events stop at 0.4. */
  target: number;
  /** Days since the peak's first day (negative before it); 0 for a micro-event. */
  dt: number;
  dayInPhase: number;
  /** 1 on the first day of the fade, else 0. */
  fadeDay: number;
  rank: number;
  gentle: boolean;
}

export interface Lane {
  owner: string | null;
  intensity: number;
}

export interface DayTheme {
  ymd: string;
  season: SeasonInfo;
  month: MonthTheme;
  weekAxis: TraitAxis;
  /** The month theme sets the line today (1 day in 3). */
  lineDay: boolean;
  /** Whose cards may show today (content). */
  winner: DayEvent | null;
  /** Every event that is on today, best first. */
  active: DayEvent[];
  /** What the screen shows: one owner, one slewed intensity. */
  display: { event: string | null; intensity: number; phase?: AlmanacPhase };
  /** Every day has a theme: the lane's event, else the season. */
  hero: { kind: 'event' | 'season'; id: string };
}

export interface CalendarConfig extends RuleEnv {
  prefs?: EventPrefs;
}

export interface Calendar {
  readonly config: CalendarConfig;
  /** The day's theme. `facts` (picks, glow) apply to this day only. */
  theme(ymd: string, facts?: MicroFacts): DayTheme;
  /** `count` consecutive themes from `startYmd` (one walk, same answers as `theme`). */
  series(startYmd: string, count: number): DayTheme[];
}

const floorMod = (n: number, m: number) => ((n % m) + m) % m;

function compareEvents(a: DayEvent, b: DayEvent): number {
  return b.rank - a.rank || b.target - a.target || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function rankFor(def: EventDef, phase: AlmanacPhase): number {
  // Only the personal DAY outranks everything; its lead and fade rank like any approach,
  // so a birthday on Dec 22 does not take Christmas Day away.
  if (def.personal) return phase === 'peak' ? RANK.personal : RANK.approach;
  if (def.ambient) return RANK.ambient;
  if (phase === 'peak') return def.regional ? RANK.regionalPeak : RANK.globalPeak;
  return RANK.approach;
}

/** One day of lane. Pure. */
export function stepLane(prev: Lane, winnerId: string | null, winnerTarget: number): Lane {
  if (prev.owner === winnerId) {
    return { owner: winnerId, intensity: winnerId ? slewToward(prev.intensity, winnerTarget) : 0 };
  }
  if (prev.intensity <= HANDOVER_MAX + 1e-9) {
    return winnerId
      ? { owner: winnerId, intensity: Math.min(winnerTarget, HANDOVER_MAX) }
      : { owner: null, intensity: 0 };
  }
  return { owner: prev.owner, intensity: prev.intensity - MAX_DAILY_STEP };
}

export function createCalendar(config: CalendarConfig): Calendar {
  const env: RuleEnv = {
    tz: config.tz,
    region: config.region,
    hemisphere: config.hemisphere,
    bornOn: config.bornOn ?? null,
    joinedYmd: config.joinedYmd ?? null,
  };
  const seasonal = config.prefs?.seasonal !== false;
  const defs = EVENTS.filter((def) => eventEnabled(def, env, config.prefs));
  const peaks = new Map<string, string[]>();
  const microEnv = {
    tz: env.tz,
    hemisphere: env.hemisphere,
    fullMoons: seasonal ? fullMoonDays(env.tz) : new Set<string>(),
    equinoxes: seasonal ? equinoxDays(env.tz) : new Set<string>(),
  };

  const peaksOf = (def: EventDef, year: number): string[] => {
    const key = `${def.id}|${year}`;
    let hit = peaks.get(key);
    if (!hit) {
      hit = peakStartsFor(def.rule, year, env);
      peaks.set(key, hit);
    }
    return hit;
  };

  const compute = (ymd: string, facts?: MicroFacts): DayEvent[] => {
    const year = Number(ymd.slice(0, 4));
    const out: DayEvent[] = [];
    for (const def of defs) {
      let best: DayEvent | null = null;
      for (let y = year - 1; y <= year + 1; y += 1) {
        for (const start of peaksOf(def, y)) {
          const dt = daysBetweenYmd(start, ymd);
          const point = rampAt(def.ramp, dt);
          if (!point) continue;
          const target = def.ambient ? Math.min(point.intensity, AMBIENT_CAP) : point.intensity;
          if (best && best.target >= target) continue;
          best = {
            id: def.id,
            name: nameFor(def, env),
            kind: 'event',
            phase: point.phase,
            target,
            dt,
            dayInPhase: point.dayInPhase,
            fadeDay: point.phase === 'fade' && point.dayInPhase === 1 ? 1 : 0,
            rank: rankFor(def, point.phase),
            gentle: def.gentle === true,
          };
        }
      }
      if (best) out.push(best);
    }
    if (seasonal) {
      const micro = (id: MicroId): DayEvent => ({
        id,
        name: MICRO_NAMES[id],
        kind: 'micro',
        phase: 'peak',
        target: MICRO_INTENSITY,
        dt: 0,
        dayInPhase: 1,
        fadeDay: 0,
        rank: RANK.micro,
        gentle: false,
      });
      for (const id of microIdsFor(ymd, microEnv, facts)) out.push(micro(id));
      if (out.length === 0 && floorMod(dayIndexFor(ymd), SMALL_MOMENT_EVERY) === 0) out.push(micro('small_moment'));
    }
    return out.sort(compareEvents);
  };

  const cache = new Map<string, DayEvent[]>();
  const activeOn = (ymd: string, facts?: MicroFacts): DayEvent[] => {
    if (facts) return compute(ymd, facts);
    let hit = cache.get(ymd);
    if (!hit) {
      hit = compute(ymd);
      cache.set(ymd, hit);
    }
    return hit;
  };

  const startLane = (ymd: string): Lane => {
    const w = activeOn(ymd)[0];
    return w ? { owner: w.id, intensity: w.target } : { owner: null, intensity: 0 };
  };

  const build = (ymd: string, active: DayEvent[], lane: Lane): DayTheme => {
    const month = Number(ymd.slice(5, 7));
    const season = seasonFor(month, env.hemisphere);
    const owned = lane.owner ? active.find((e) => e.id === lane.owner) : undefined;
    return {
      ymd,
      season,
      month: monthTheme(month),
      weekAxis: weekAxisFor(ymd),
      lineDay: isLineDay(ymd),
      winner: active[0] ?? null,
      active,
      display: {
        event: lane.intensity > 0 ? lane.owner : null,
        intensity: lane.intensity,
        phase: lane.owner ? (owned?.phase ?? 'fade') : undefined,
      },
      hero: lane.owner && lane.intensity > 0 ? { kind: 'event', id: lane.owner } : { kind: 'season', id: season.id },
    };
  };

  const walk = (from: string, to: string, facts?: MicroFacts, keep?: (theme: DayTheme) => void): DayTheme => {
    let lane = startLane(from);
    let theme = build(from, activeOn(from), lane);
    for (let day = addDaysYmd(from, 1); daysBetweenYmd(day, to) >= 0; day = addDaysYmd(day, 1)) {
      const last = day === to;
      const active = activeOn(day, last ? facts : undefined);
      const w = active[0];
      lane = stepLane(lane, w?.id ?? null, w?.target ?? 0);
      theme = build(day, active, lane);
      keep?.(theme);
    }
    return theme;
  };

  return {
    config,
    theme(ymd, facts) {
      return walk(addDaysYmd(ymd, -WALK_BACK_DAYS), ymd, facts);
    },
    series(startYmd, count) {
      const out: DayTheme[] = [];
      const end = addDaysYmd(startYmd, count - 1);
      walk(addDaysYmd(startYmd, -WALK_BACK_DAYS), end, undefined, (theme) => {
        if (daysBetweenYmd(startYmd, theme.ymd) >= 0) out.push(theme);
      });
      return out;
    },
  };
}

// ---------------------------------------------------------------- hand-off to the engine

/** `eventId + year`: the key a callback is stored and found under. */
export const callbackKey = (eventId: string, year: number) => `${eventId}:${year}`;

/** The calendar the 11a engine reads (`ctx.calendar`). Only the winner's cards can show. */
export function toAlmanacCalendar(theme: DayTheme): AlmanacCalendar {
  const w = theme.winner;
  const events: ActiveEvent[] = w
    ? [{ event: w.id, phase: w.phase, name: w.name, daysInto: w.kind === 'micro' ? 1 : w.dt >= 0 ? w.dt + 1 : undefined }]
    : [];
  return { events, arcs: [seasonArc(theme.season.id), monthArc(theme.month.id), weekArc(theme.weekAxis)] };
}

// ---------------------------------------------------------------- layer blend

export const LAYER_BOOST = 6;
export const LAYER_DAMP = 0.25;
export const MONTH_BOOST = 4;
export const WEEK_BOOST = 4;
export const SEASON_BOOST = 1.5;

type Slot = 'line' | 'deck' | 'try' | 'other';

function slotOf(kind: AlmanacCard['kind']): Slot {
  switch (kind) {
    case 'line':
    case 'callback':
    case 'afterglow':
    case 'teaser':
      return 'line';
    case 'fact':
    case 'contrast':
      return 'deck';
    case 'try':
    case 'reflect':
      return 'try';
    default:
      return 'other';
  }
}

/**
 * The layer blend for 11a's `ctx.layerWeight`:
 *  - winner target ≥ 0.9: the line and the deck go seasonal (the shared Pick is 11d's);
 *  - ≥ 0.4: the try slot goes seasonal;
 *  - teaser phase: one teaser card only;
 *  - otherwise the week theme sets the try slot, and the month theme sets the line 1 day in 3;
 *  - an afterglow card on the first fade day; callbacks are keyed `eventId+year`;
 *  - a micro-event's cards take the day (its target is 0.4 at most).
 * A weight of 0 hides a card; base cards are damped, never hidden.
 */
export function layerWeightFor(theme: DayTheme): (card: AlmanacCard) => number {
  const w = theme.winner;
  const x = w?.target ?? 0;
  const micro = w?.kind === 'micro';
  return (card) => {
    const slot = slotOf(card.kind);
    if (card.event) {
      if (!w || card.event !== w.id) return 0;
      if (card.kind === 'teaser') return w.phase === 'teaser' ? 1 : 0;
      if (card.kind === 'afterglow') return w.fadeDay === 1 ? LAYER_BOOST : 0;
      if (card.kind === 'callback') return x >= 0.4 ? LAYER_BOOST : 0;
      if (slot === 'other') return 1;
      if (micro) return LAYER_BOOST;
      if (slot === 'try') return x >= 0.4 ? LAYER_BOOST : 0;
      return x >= 0.9 ? LAYER_BOOST : 0;
    }
    if (card.arc?.startsWith('month_')) {
      if (card.kind === 'line') return theme.lineDay && x < 0.9 ? MONTH_BOOST : 0;
      return 1;
    }
    let weight = 1;
    if (!micro) {
      if ((slot === 'line' || slot === 'deck') && x >= 0.9) weight = LAYER_DAMP;
      if (slot === 'try' && x >= 0.4) weight = LAYER_DAMP;
    }
    if (card.arc?.startsWith('week_') && slot === 'try') return x < 0.4 ? WEEK_BOOST : weight;
    if (card.arc?.startsWith('season_') && (slot === 'line' || slot === 'try')) return weight * SEASON_BOOST;
    return weight;
  };
}

/** Everything the engine needs from the calendar for today. */
export function almanacTodayFromTheme(
  theme: DayTheme,
): Pick<AlmanacContext, 'calendar' | 'layerWeight'> {
  return { calendar: toAlmanacCalendar(theme), layerWeight: layerWeightFor(theme) };
}
