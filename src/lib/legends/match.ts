import { TRAIT_AXES, traitBand, type TraitAxis } from '@/lib/traits';

import type { ArchetypeDef, LegendVariant, LegendCatalog } from '@/lib/legends/store';

/**
 * Archetype matching for Legends.
 *
 * Each variant links to one or more archetypes via legend_archetypes; each
 * archetype carries a 3-axis combo validated against the app's 16-axis
 * vocabulary (e.g. 'openness:high, autonomy:high'). The user's live trait
 * values on `me` are scored against those poles with the same band cutoffs
 * used everywhere else in the app: high ≥ 0.67, low ≤ 0.33. Unset and
 * mid-band axes are misses.
 *
 * A variant is served only when one of its linked archetypes "matches": at
 * least two of the archetype's three poles land in the required band. That
 * says the profile genuinely leans the archetype's way while tolerating one
 * unsettled or mid axis. Ties and one-hit profiles stay hidden.
 *
 * Never-repeat is per VARIANT (user_legend_history keys legend_id = variant
 * id), not per figure: once a figure's v1 has been shown, a later v2 — a
 * different angle on the same archetype or a different archetype the figure
 * also fits — can still resurface. At most one variant of a figure is served
 * per batch (best match wins), so a figure never fills the whole tab at once.
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
  variant: LegendVariant;
  archetype: ArchetypeDef;
  hits: number;
}

export interface LegendView {
  /** Variants to show now: matched archetype + not previously shown. */
  cards: LegendMatch[];
  /** True when any archetype behind a variant matched, even if all shown. */
  anyMatchedArchetype: boolean;
  /** False when no fact-checked variants exist in the catalog at all. */
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
 * Picks the variants this user gets served today: best unseen variant per
 * figure (each whose linked archetype matches ≥2/3 poles), ranked best-match
 * first. A figure whose only matching variant has already been shown stays
 * hidden — until a different variant of it matches later.
 */
export function buildLegendView(
  catalog: LegendCatalog,
  values: LegendValues,
  seenVariantIds: ReadonlySet<string>,
): LegendView {
  const bestPerFigure = new Map<string, LegendMatch>();
  let anyMatchedArchetype = false;

  for (const variant of catalog.variants) {
    if (!variant.factChecked) continue;
    let best: LegendMatch | null = null;
    for (const archetypeId of variant.archetypeIds) {
      const archetype = catalog.archetypes.get(archetypeId);
      if (!archetype) continue;
      const poles = parseAxisCombo(archetype.traitAxis);
      const hits = countPoleHits(poles, values);
      if (!isMatch(poles, hits)) continue;
      anyMatchedArchetype = true;
      if (!best || hits > best.hits) best = { variant, archetype, hits };
    }
    if (!best || seenVariantIds.has(variant.id)) continue;
    const current = bestPerFigure.get(variant.figureId);
    if (!current || best.hits > current.hits) bestPerFigure.set(variant.figureId, best);
  }

  const cards = [...bestPerFigure.values()];
  cards.sort((a, b) => b.hits - a.hits || a.variant.name.localeCompare(b.variant.name));
  return { cards, anyMatchedArchetype, hasCatalog: catalog.variants.length > 0 };
}
