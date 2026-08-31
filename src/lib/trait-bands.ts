/**
 * You-tab spectrum bands. Plain-language endpoints only — never a trait
 * name, never a number. Reads the same 0–1 ME columns mergeTraitWrite
 * already updates. Null axes are omitted (no gap-copy).
 */

import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import {
  TRAIT_AXES,
  traitStateFromRow,
  type TraitAxis,
} from '@/lib/traits';

export const TRAIT_BANDS_LABEL = 'How you tend to move';

export interface TraitBandPhrases {
  low: string;
  high: string;
}

/**
 * Endpoints for every TRAIT_AXES item. OCEAN uses the locked You-tab wording.
 * The other axes follow the existing Settings left/right pairs, shortened
 * to the same whole-phrase shape.
 */
export const TRAIT_BAND_PHRASES: Record<TraitAxis, TraitBandPhrases> = {
  openness: {
    low: 'sticks with what works',
    high: 'goes for the untried option',
  },
  conscientiousness: {
    low: 'keeps plans loose',
    high: 'sees a plan through',
  },
  extraversion: {
    low: 'leans toward quiet time',
    high: 'leans toward people around',
  },
  agreeableness: {
    low: 'holds their ground',
    high: 'goes along to keep it easy',
  },
  steadiness: {
    low: 'feels a bad day longer',
    high: 'shakes it off quickly',
  },
  attachment_anxiety: {
    low: "doesn't dwell on people leaving",
    high: 'worries people will pull away',
  },
  attachment_avoidance: {
    low: "stays close once they're in",
    high: 'keeps some distance',
  },
  conflict_assertiveness: {
    low: 'steps back in a disagreement',
    high: 'puts their own point on the table',
  },
  conflict_cooperativeness: {
    low: 'protects their outcome first',
    high: 'looks for something the other person can live with',
  },
  autonomy: {
    low: 'a path already set is fine',
    high: 'wants to do it their way',
  },
  competence: {
    low: 'doubts they can pull a hard thing off',
    high: 'feels they can handle a hard thing',
  },
  relatedness: {
    low: 'a day can land without much connection',
    high: 'needs a real connection for a day to land',
  },
  growth_mindset: {
    low: 'a miss can feel like the end of that path',
    high: 'looks for what to change after a miss',
  },
  locus_of_control: {
    low: 'figures it was bound to happen',
    high: 'looks at what they might have done differently',
  },
  self_efficacy: {
    low: 'not sure they can pull a big task off',
    high: 'feels they can pull a big task off',
  },
  playfulness: {
    low: 'treats the day as a job to get through',
    high: 'looks for a lighter take',
  },
};

export interface FilledTraitBand {
  axis: TraitAxis;
  value: number;
  low: string;
  high: string;
}

/** Axes with a real stored number, in TRAIT_AXES order. Same ME columns as mergeTraitWrite. */
export function filledTraitBands(
  row: Parameters<typeof traitStateFromRow>[0],
): FilledTraitBand[] {
  const values = traitStateFromRow(row).values;
  const out: FilledTraitBand[] = [];
  for (const axis of TRAIT_AXES) {
    const value = values[axis];
    if (value == null || !Number.isFinite(value)) continue;
    const phrases = TRAIT_BAND_PHRASES[axis];
    out.push({ axis, value, low: phrases.low, high: phrases.high });
  }
  return out;
}

export function bandPhrasesClean(): boolean {
  for (const axis of TRAIT_AXES) {
    const { low, high } = TRAIT_BAND_PHRASES[axis];
    if (containsFrameworkTerm(low) || containsFrameworkTerm(high)) return false;
  }
  return true;
}
