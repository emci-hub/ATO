import { TRAIT_AXES, traitBand, type TraitAxis } from '@/lib/traits';

import type { ArchetypeDef, LegendDef, LegendCatalog } from '@/lib/legends/store';

/**
 * Archetype matching for Legends.
 *
 * Each archetype carries a 3-axis combo validated against the app's 16-axis
 * vocabulary (e.g. 'openness:high, autonomy:high'). The user's live trait
 * values on `me` are scored against those poles with the same band cutoffs
 * used everywhere else in the app: high ≥ 0.67, low ≤ 0.33. Unset and
 * mid-band axes are misses.
 *
 * A legend is served only when its linked archetype is "matched": at least
 * two of the archetype's three poles land in the required band. That says the
 * profile genuinely leans the archetype's way while tolerating one unsettled
 * or mid axis. Ties and one-hit profiles stay hidden.
 */

export interface AxisPole {
  axis: TraitAxis;
  /** Pole the user's band must land in for a hit ('high' band ↔ ≥0.67). */
  band: 'high' | 'low';
}

/** Values of the form read off `me` (TraitValues shape). */
export type LegendValues = Readonly<Partial<Record<TraitAxis, number | null>>>;

/** Poles required for a match out of a combo (combos are 3-axis today). */
const MATCH_REQUIRED_HITS = 2;

export interface LegendMatch {
  legend: LegendDef;
  archetype: ArchetypeDef;
  hits: number;
}

export interface LegendView {
  /** Legends to show now: matched archetype + not previously seen. */
  cards: LegendMatch[];
  /** True when any archetype behind a legend matched, even if all seen. */
  anyMatchedArchetype: boolean;
  /** False when no fact-checked legends exist in the catalog at all. */
  hasCatalog: boolean;
}

/** Parses 'axis:high, axis:low' into poles, dropping anything invalid. */
export function parseAxisCombo(traitAxis: string | null | undefined): AxisPole[] {
  if (!traitAxis) return [];
  const poles: AxisPole[] = [];
  for (const token of traitAxis.split(',')) {
    const [rawAxis, rawPole] = token.trim().split(':');
    if (!rawAxis || !rawPole) continue;
    const axis = rawAxis.trim() as TraitAxis;
    if (!(TRAIT_AXES as readonly string[]).includes(axis)) continue;
    const band = rawPole.trim();
    if (band !== 'high' && band !== 'low') continue;
    poles.push({ axis, band });
  }
  return poles;
}

/** Number of combo poles whose required band the user actually lands in. */
export function countPoleHits(poles: AxisPole[], values: LegendValues): number {
  let hits = 0;
  for (const pole of poles) {
    const value = values[pole.axis];
    const band = value == null ? null : traitBand(value);
    if (band === pole.band) hits += 1;
  }
  return hits;
}

function isMatch(poles: AxisPole[], hits: number): boolean {
  return poles.length > 0 && hits >= Math.min(MATCH_REQUIRED_HITS, poles.length);
}

/**
 * Picks the legends this user gets served today: each legend whose best
 * linked archetype matches (≥2/3 poles hit), ranked best-match first, with
 * previously-seen legends removed.
 */
export function buildLegendView(
  catalog: LegendCatalog,
  values: LegendValues,
  seenLegendIds: ReadonlySet<string>,
): LegendView {
  const cards: LegendMatch[] = [];
  let anyMatchedArchetype = false;

  for (const legend of catalog.legends) {
    if (!legend.factChecked) continue;
    let best: LegendMatch | null = null;
    for (const archetypeId of legend.archetypeIds) {
      const archetype = catalog.archetypes.get(archetypeId);
      if (!archetype) continue;
      const poles = parseAxisCombo(archetype.traitAxis);
      const hits = countPoleHits(poles, values);
      if (!isMatch(poles, hits)) continue;
      anyMatchedArchetype = true;
      if (!best || hits > best.hits) best = { legend, archetype, hits };
    }
    if (!best || seenLegendIds.has(legend.id)) continue;
    cards.push(best);
  }

  cards.sort((a, b) => b.hits - a.hits || a.legend.name.localeCompare(b.legend.name));
  return { cards, anyMatchedArchetype, hasCatalog: catalog.legends.length > 0 };
}
