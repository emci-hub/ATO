/**
 * Profile history and the collectible profile card (emci 2026-10-06). Pure:
 * no network, no storage, no AI — testable under Node (check:profile-history).
 *
 * Every saved profile (trait_profile_snapshots, wave85/86) and the live one
 * render as a card: the type name, the date, a Divecore hero, 16 small bars,
 * and a Strength / Weakness line. The server decides when a monthly card is
 * saved (`_profile_changed`); `profileChanged` here is the same rule, pinned.
 */
import { AXIS_POLE_NAME, AXIS_POLES, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { lineKey } from '@/lib/daily-line/bank';
import { TRAIT_IDEAS } from '@/lib/insight-bank';
import { archetypeName, DEFAULT_LEGEND_SKIN } from '@/lib/legends64/archetypes';
import { CORE_AXES, MODIFIER_AXES, POLE_COMBOS, THIRD_AXES, storedProfilePole } from '@/lib/legends64/classify';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

/**
 * The Strength line is the trait end's own words (axis-poles.ts); the Weakness
 * and Step lines come from the insight bank, so they are only as reviewed as
 * INSIGHT_BANK_COPY_REVIEWED (accepted by emci 2026-10-23, roadmap A4).
 * Not AI. Flip this flag once emci has read the card layout (A4: he reads it first).
 */
export const PROFILE_CARD_COPY_REVIEWED = false;

export type SnapshotReason = 'start_fresh' | 'change_answers' | 'monthly' | 'now';

export type ProfileValues = Partial<Record<TraitAxis, number | null>>;

export interface ProfileSnapshot {
  id: string;
  createdAt: string;
  reason: SnapshotReason;
  values: ProfileValues;
  /** 'HHH-LHL-HHL': core, modifier, third (classify.ts letters). */
  code: string;
  answers: number;
}

export const SNAPSHOT_REASON_LABEL: Readonly<Record<SnapshotReason, string>> = {
  now: 'Now',
  monthly: 'Monthly',
  change_answers: 'Before changes',
  start_fresh: 'Before Start Fresh',
};

/** What a trait has to move for a monthly card to be worth keeping. */
export const MEANINGFUL_DELTA = 0.1;
/** What a trait has to move for the compare view to draw an arrow. */
export const COMPARE_ARROW_AT = 0.05;

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * The 9-letter type code — the server's `_profile_code` (wave86), same letters.
 * Still the binary cut (unset reads low). Legends use the middle zone in
 * `classify.ts` and do not read this code.
 */
export function profileCode(values: ProfileValues): string {
  const part = (axes: readonly TraitAxis[]) => axes.map((a) => storedProfilePole(values[a] ?? null)).join('');
  return `${part(CORE_AXES)}-${part(MODIFIER_AXES)}-${part(THIRD_AXES)}`;
}

/**
 * A saved row -> a card. Null for a wiped-history marker ({}), so the binder
 * never shows an empty card. Reads both payload shapes (wave85's track list
 * and wave86's lighter one).
 */
export function parseSnapshot(id: string, createdAt: string, reason: string, raw: unknown): ProfileSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const profile = raw as { values?: Record<string, unknown>; code?: unknown; answers?: unknown };
  if (!profile.values || typeof profile.values !== 'object') return null;
  const values: ProfileValues = {};
  for (const axis of TRAIT_AXES) values[axis] = num(profile.values[axis]);
  const r: SnapshotReason = reason === 'monthly' || reason === 'change_answers' || reason === 'start_fresh' ? reason : 'monthly';
  return {
    id,
    createdAt,
    reason: r,
    values,
    code: typeof profile.code === 'string' && /^[HL]{3}-[HL]{3}-[HL]{3}$/.test(profile.code) ? profile.code : profileCode(values),
    answers: num(profile.answers) ?? 0,
  };
}

/** The live profile as a card. */
export function currentProfileCard(values: ProfileValues, answers: number, nowIso: string): ProfileSnapshot {
  return { id: 'now', createdAt: nowIso, reason: 'now', values: { ...values }, code: profileCode(values), answers };
}

/** Same rule as the server's `_profile_changed` (wave86). */
export function profileChanged(prev: ProfileSnapshot | null, next: ProfileSnapshot): boolean {
  if (!prev) return true;
  if (prev.code !== next.code) return true;
  return TRAIT_AXES.some((axis) => {
    const a = prev.values[axis] ?? null;
    const b = next.values[axis] ?? null;
    if ((a == null) !== (b == null)) return true;
    if (a == null || b == null) return false;
    return a >= 0.5 !== b >= 0.5 || Math.abs(b - a) >= MEANINGFUL_DELTA;
  });
}

/** The card's name, e.g. "Grinning Muralist, Hungry" (default name style). */
export function cardName(code: string): string {
  const [core, modifier, third] = code.split('-');
  if (!core || !modifier) return 'Still forming';
  return archetypeName(`${core}-${modifier}`, DEFAULT_LEGEND_SKIN, third) ?? 'Still forming';
}

/**
 * The Divecore hero on the card, picked by the 3-letter core code (one of the
 * 8 dungeon-legends heroes already in assets/play). Fixed, never random.
 */
export const CARD_HEROES = [
  'arcane_engineer',
  'dragonblood_champion',
  'dungeon_witch',
  'death_knight',
  'ratkin_treasure_hunter',
  'crystal_berserker',
  'dungeon_druid',
  'abyssal_assassin',
] as const;
export type CardHero = (typeof CARD_HEROES)[number];

export function heroForCode(code: string): CardHero {
  const idx = POLE_COMBOS.indexOf(code.slice(0, 3));
  return CARD_HEROES[idx >= 0 ? idx : 0]!;
}

export interface CardBar {
  axis: TraitAxis;
  label: string;
  value: number | null;
}

/** 16 condensed bars, trait order. */
export function cardBars(values: ProfileValues): CardBar[] {
  return TRAIT_AXES.map((axis) => ({ axis, label: AXIS_SHORT_NAME[axis], value: values[axis] ?? null }));
}

/**
 * Strength: the strongest lean, in that end's own words. Weakness (emci
 * 2026-10-19): the real cost of that same lean, plainly, and one practical step.
 * Both come from the insight bank's idea for that axis and side (`why` = what it
 * costs, `try` = the step), so they are supported by the same lean and already
 * in the clear voice. No idea for the side = no weakness line (nothing invented).
 * In-app only (the binder); a share surface must filter with `ideaShareable`.
 */
export function cardStrengthWeakness(
  values: ProfileValues,
): { strength: string; weakness: string | null; step: string | null } | null {
  let best: { axis: TraitAxis; lean: number } | null = null;
  for (const axis of TRAIT_AXES) {
    const v = values[axis];
    if (v == null) continue;
    const lean = v - 0.5;
    if (!best || Math.abs(lean) > Math.abs(best.lean)) best = { axis, lean };
  }
  if (!best || Math.abs(best.lean) < 0.05) return null;
  const end = best.lean >= 0 ? 'high' : 'low';
  const key = lineKey(best.axis, end);
  // The first idea for this side whose `why` actually names a cost ("X helps, but Y"):
  // some `why` lines are upside only and would show a Weakness with no weakness in it.
  const idea = TRAIT_IDEAS.find((i) => i.keys.length === 1 && i.keys[0] === key && /\bbut\b/i.test(i.why));
  // A strong lean alone does not prove its drawback (emci 2026-10-19): the cost is
  // offered as a possibility ("You may…") and only for a clear lean.
  const supported = Math.abs(best.lean) >= WEAKNESS_MIN_LEAN && idea;
  return {
    strength: `${AXIS_POLE_NAME[best.axis][end]}: “${AXIS_POLES[best.axis][end]}”`,
    weakness: supported ? `${WEAKNESS_LEAD} ${idea.why}` : null,
    step: supported ? idea.try[0] : null,
  };
}

/** How far from the middle a lean must be before the card names a possible drawback. */
export const WEAKNESS_MIN_LEAN = 0.15;
/** The weakness line is always a possibility, never a verdict. */
export const WEAKNESS_LEAD = 'You may find it cuts both ways.';

export type CompareArrow = 'up' | 'down' | 'same';

export interface CompareRow {
  axis: TraitAxis;
  label: string;
  before: number | null;
  after: number | null;
  arrow: CompareArrow;
}

/** Older card first, newer second: which traits moved and which way. */
export function compareProfiles(older: ProfileSnapshot, newer: ProfileSnapshot): CompareRow[] {
  return TRAIT_AXES.map((axis) => {
    const before = older.values[axis] ?? null;
    const after = newer.values[axis] ?? null;
    let arrow: CompareArrow = 'same';
    if (before != null && after != null && Math.abs(after - before) >= COMPARE_ARROW_AT) {
      arrow = after > before ? 'up' : 'down';
    }
    return { axis, label: AXIS_SHORT_NAME[axis], before, after, arrow };
  });
}

/** Two picked cards in time order (older first). */
export function orderForCompare(a: ProfileSnapshot, b: ProfileSnapshot): [ProfileSnapshot, ProfileSnapshot] {
  return a.createdAt <= b.createdAt ? [a, b] : [b, a];
}
