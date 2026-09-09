import { type TraitAxis } from '@/lib/traits';
import type { LegendValues } from '@/lib/legends/match';

/**
 * 64-archetype classification (core loop redesign §4,
 * docs/CORE_LOOP_REDESIGN_PLAN.md). Deterministic straight-midpoint split —
 * deliberately NOT `traitBand`'s 0.67/0.33 bands (those stay as-is for
 * every other Legends/Explore/Sage Title consumer; this is a new,
 * independent classification used only by the 64-archetype system).
 *
 * Every user gets exactly one code — there is no "no match"/"tied" case
 * like the old 3-axis `buildLegendView` matcher, since a straight high/low
 * split on 6 axes always resolves to exactly one of the 64 combinations.
 */

/** Core axes, in the fixed order the code string is built from. */
export const CORE_AXES: readonly TraitAxis[] = ['conscientiousness', 'extraversion', 'openness'];

/** Modifier axes, in the fixed order the code string is built from. */
export const MODIFIER_AXES: readonly TraitAxis[] = [
  'agreeableness',
  'conflict_assertiveness',
  'relatedness',
];

export type Pole = 'H' | 'L';

/**
 * Straight midpoint split: >= 0.5 is high, everything else (including an
 * unset/non-finite axis) is low. Unlike `traitBand` there is no mid band —
 * a value must land somewhere, since every user gets exactly one archetype
 * code. An axis with no stored value yet (rare by Q50, when Legends
 * unlocks, but not impossible for all 6 of these specific axes) defaults
 * to low; this is a deliberate simplifying choice, not an oversight.
 */
export function midpointHighLow(value: number | null | undefined): Pole {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.5 ? 'H' : 'L';
}

function poleString(values: LegendValues, axes: readonly TraitAxis[]): string {
  return axes.map((axis) => midpointHighLow(values[axis])).join('');
}

/** 3-letter H/L code from conscientiousness x extraversion x openness. */
export function coreCode(values: LegendValues): string {
  return poleString(values, CORE_AXES);
}

/** 3-letter H/L code from agreeableness x conflict_assertiveness x relatedness. */
export function modifierCode(values: LegendValues): string {
  return poleString(values, MODIFIER_AXES);
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
