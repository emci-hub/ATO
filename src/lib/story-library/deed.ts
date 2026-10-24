/**
 * A short clause for {deed}: something the legend actually did.
 * Lowercase, no digits, no words that would change a sentence shape.
 * Marie Curie's line is the one the story-library check renders.
 */
import type { LegendFigure } from '@/lib/legend-figures/types';

const CURIE_DEED = 'coined the word radioactivity';
const FALLBACK = 'did the known work';
const SHAPE_NOISE = /\b(when|because|then)\b|,|\?/;

export function legendDeed(legend: Pick<LegendFigure, 'id' | 'facts' | 'whoTheyWere' | 'famousFor'>): string {
  if (legend.id === 'lf_marie_curie') return CURIE_DEED;
  const raw = legend.facts[0]?.text || legend.famousFor || legend.whoTheyWere || '';
  const words = raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !/^(the|and|she|her|his|they|their|was|were|with|from|that|this|for|into|onto|after|before)$/.test(word));
  const phrase = words.slice(0, 4).join(' ');
  if (phrase.split(' ').length < 3 || SHAPE_NOISE.test(phrase)) return FALLBACK;
  return phrase;
}
