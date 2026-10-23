import { type TraitAxis } from '@/lib/traits';

/** Values of the form read off `me` (TraitValues shape). Local to legends64 — no dependency on the old legend-candidates system. */
export type LegendValues = Readonly<Partial<Record<TraitAxis, number | null>>>;

/**
 * 64-archetype classification (core loop redesign §4,
 * docs/CORE_LOOP_REDESIGN_PLAN.md).
 *
 * A trait is high, low, middle, or unknown. The middle is about 45–55%.
 * Hysteresis: a trait that has already landed high stays high until it
 * falls below 45%, and a low stays low until it rises above 55%. An
 * unanswered trait is unknown, not low.
 *
 * The 64 names are unchanged. A middle trait does not invent a 65th
 * archetype. `closestArchetypes` picks the existing names that differ
 * only on the middle traits, nearest first. The identity card turns that
 * into a "Balanced {role}" title when the role itself is settled, or asks
 * the person to pick between the two nearest names when the role is the
 * thing in the middle.
 *
 * Stored profile-card letters (`storedProfilePole`) stay the server's
 * binary cut (`_profile_code`: >= 0.5 high, unset low) so saved cards do
 * not change shape. Legends no longer use that cut.
 *
 * Story (src/lib/story-v3, not edited here — another branch owns it) still
 * has only high/low lean phrases. A follow-up should skip the lean line, or
 * add a balanced line, when the pole is middle or the trait has fewer than
 * 3 answers. The dev-lab story admin on that branch has the same gap.
 */

/** Core axes, in the fixed order the code string is built from. */
export const CORE_AXES: readonly TraitAxis[] = ['conscientiousness', 'extraversion', 'openness'];

/** Modifier axes, in the fixed order the code string is built from. */
export const MODIFIER_AXES: readonly TraitAxis[] = [
  'agreeableness',
  'conflict_assertiveness',
  'relatedness',
];

/**
 * Third-word axes (name styles v2, emci 2026-10-05): Growth x Composure x
 * Playfulness, the order the third code is built from. Only the three-word
 * styles (Primal Genius, Corporate Realist, Oxymoron) use it.
 */
export const THIRD_AXES: readonly TraitAxis[] = ['growth_mindset', 'steadiness', 'playfulness'];

/** A letter in one of the 64 archetype codes. */
export type Pole = 'H' | 'L';

/** High, low, the middle zone, or unanswered. */
export type LegendPole = Pole | 'M' | 'U';

/** Half-width of the middle zone. 0.5 ± this is about 45–55%. */
export const LEGEND_FLIP_MARGIN = 0.05;
export const LEGEND_LOW_EDGE = 0.5 - LEGEND_FLIP_MARGIN;
export const LEGEND_HIGH_EDGE = 0.5 + LEGEND_FLIP_MARGIN;

/**
 * High / low / middle / unknown.
 *
 * With no previous letter, below 45% is low, above 55% is high, and the
 * band between them is middle. A previous high stays high until the score
 * falls below 45%. A previous low stays low until it rises above 55%.
 * Null, undefined, and NaN are unknown — never low.
 */
export function midpointHighLow(
  value: number | null | undefined,
  previous?: LegendPole | null,
): LegendPole {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'U';
  if (previous === 'H') return value >= LEGEND_LOW_EDGE ? 'H' : 'L';
  if (previous === 'L') return value <= LEGEND_HIGH_EDGE ? 'L' : 'H';
  if (value < LEGEND_LOW_EDGE) return 'L';
  if (value > LEGEND_HIGH_EDGE) return 'H';
  return 'M';
}

/**
 * The letter stored on a profile card. Matches server `_profile_code`
 * (>= 0.5 high, anything else including unset low). Not used for Legends.
 */
export function storedProfilePole(value: number | null | undefined): Pole {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.5 ? 'H' : 'L';
}

function poleString(values: LegendValues, axes: readonly TraitAxis[]): string {
  return axes.map((axis) => midpointHighLow(values[axis])).join('');
}

const LEGEND_NAME_AXES: readonly TraitAxis[] = [...CORE_AXES, ...MODIFIER_AXES];

export interface ArchetypeChoice {
  code: string;
  /** Lower is closer. Middle axes only; a settled letter adds nothing. */
  distance: number;
}

/**
 * The existing 64-codes closest to this reading. Middle traits are tried
 * both ways. Unknown traits return no choices — the name is still forming,
 * and an unknown trait is not treated as low. At most two, nearest first.
 * Ties break by code so the order does not depend on object key order.
 */
export function closestArchetypes(
  values: LegendValues,
  poles: Partial<Record<TraitAxis, LegendPole>>,
): ArchetypeChoice[] {
  if (LEGEND_NAME_AXES.some((axis) => poles[axis] == null || poles[axis] === 'U')) return [];
  const middle = LEGEND_NAME_AXES.filter((axis) => poles[axis] === 'M');
  const letters: Partial<Record<TraitAxis, Pole>> = {};
  for (const axis of LEGEND_NAME_AXES) {
    const pole = poles[axis];
    if (pole === 'H' || pole === 'L') letters[axis] = pole;
  }
  const out: ArchetypeChoice[] = [];
  const combinations = 1 << middle.length;
  for (let mask = 0; mask < combinations; mask += 1) {
    let distance = 0;
    const assigned: Partial<Record<TraitAxis, Pole>> = { ...letters };
    for (let bit = 0; bit < middle.length; bit += 1) {
      const axis = middle[bit]!;
      const pole: Pole = (mask & (1 << bit)) !== 0 ? 'H' : 'L';
      assigned[axis] = pole;
      const raw = values[axis];
      const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0.5;
      distance += pole === 'H' ? LEGEND_HIGH_EDGE - value : value - LEGEND_LOW_EDGE;
    }
    const core = CORE_AXES.map((axis) => assigned[axis]).join('');
    const modifier = MODIFIER_AXES.map((axis) => assigned[axis]).join('');
    out.push({ code: `${core}-${modifier}`, distance });
  }
  out.sort((a, b) => {
    const gap = a.distance - b.distance;
    // 50% is equidistant. A raw subtract prefers low by a rounding hair.
    if (Math.abs(gap) > 1e-9) return gap;
    return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
  const seen = new Set<string>();
  const unique: ArchetypeChoice[] = [];
  for (const row of out) {
    if (seen.has(row.code)) continue;
    seen.add(row.code);
    unique.push(row);
  }
  return unique.slice(0, 2);
}

/** 3-letter H/L code from conscientiousness x extraversion x openness. */
export function coreCode(values: LegendValues): string {
  return poleString(values, CORE_AXES);
}

/** 3-letter H/L code from agreeableness x conflict_assertiveness x relatedness. */
export function modifierCode(values: LegendValues): string {
  return poleString(values, MODIFIER_AXES);
}

/** 3-letter H/L code from growth_mindset x steadiness x playfulness. */
export function thirdCode(values: LegendValues): string {
  return poleString(values, THIRD_AXES);
}

/**
 * Full archetype code, e.g. 'HHH-LHL' — 8 core codes x 8 modifier codes =
 * 64 total. This is the key `archetypes.ts`'s content and `legend_generations`
 * rows are stored/looked up by.
 */
export function archetypeCode(values: LegendValues): string {
  return `${coreCode(values)}-${modifierCode(values)}`;
}

/** Every valid 3-letter H/L combination, in a fixed canonical order. */
export const POLE_COMBOS: readonly string[] = [
  'HHH',
  'HHL',
  'HLH',
  'HLL',
  'LHH',
  'LHL',
  'LLH',
  'LLL',
];

/** All 64 valid full codes, core-major then modifier, canonical order. */
export const ALL_ARCHETYPE_CODES: readonly string[] = POLE_COMBOS.flatMap((core) =>
  POLE_COMBOS.map((modifier) => `${core}-${modifier}`),
);
