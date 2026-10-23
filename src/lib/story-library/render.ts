/**
 * Assemble a CategoryDive or a LegendStory from approved library copy.
 * Percents, museum facts, and "where you match" stay hand-worked. This file
 * only fills the words.
 */
import type { CategoryDive, DiveLean } from '@/lib/category-deep-dive/dive';
import { DIVE_TOP_LEANS } from '@/lib/category-deep-dive/dive';
import type { LegendDiffer, LegendPair, LegendStory } from '@/lib/legend-figures/story';
import { STORY_MAX_PAIRS } from '@/lib/legend-figures/story';
import type { LegendAngle, LegendFigure } from '@/lib/legend-figures/types';
import { fill, PRONOUNS } from '@/lib/story-v3/tracery';
import type { TraitAxis, TraitLean } from '@/lib/traits';
import { TRAIT_BAND_HIGH_CUT, TRAIT_BAND_LOW_CUT } from '@/lib/traits';

import { templateById } from './library';
import { getStoryLibrary } from './persist';
import type { Reader, StoryLibrary, Tier } from './types';

const YOU = PRONOUNS.you;

export function tierForDiveLean(lean: Pick<DiveLean, 'lean' | 'pct' | 'middle'>): Tier {
  if (lean.middle) return 'mid';
  if (lean.lean === 'high') return lean.pct >= Math.round(TRAIT_BAND_HIGH_CUT * 100) ? 'high' : 'mid';
  return lean.pct >= Math.round((1 - TRAIT_BAND_LOW_CUT) * 100) + 1 ? 'low' : 'mid';
}

/** `strength` is `abs(value - 0.5)` from the story ranker. */
export function tierForStrength(lean: TraitLean, strength: number): Tier {
  if (lean === 'high') return strength >= TRAIT_BAND_HIGH_CUT - 0.5 ? 'high' : 'mid';
  return strength > 0.5 - TRAIT_BAND_LOW_CUT ? 'low' : 'mid';
}

function reader(trait: string, tier: Tier, secondary?: Reader['secondary']): Reader {
  return { name: 'You', pronoun: YOU, dominant: { trait, tier }, ...(secondary ? { secondary } : {}) };
}

function must(id: string, library: StoryLibrary) {
  const found = templateById(id, library);
  if (!found) throw new Error(`story library missing ${id}`);
  return found;
}

function normSentence(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
}

/** One card shares an avoid list, so a later line does not reprint an earlier sentence. */
function cardSay(library: StoryLibrary) {
  const avoid = new Set<string>();
  const avoidText = new Set<string>();
  return (id: string, who: Reader, seed: string, tokens?: Record<string, string>) => {
    const result = fill(must(id, library), who, library.entries, seed, {
      requireApproved: true,
      tokens,
      avoid: [...avoid],
      avoidText: [...avoidText],
    });
    for (const picked of Object.values(result.picks)) avoid.add(picked);
    for (const sentence of result.text.split(/(?<=[.!?])\s+/)) {
      const norm = normSentence(sentence);
      if (norm) avoidText.add(norm);
    }
    return result.text;
  };
}

export function renderLibraryDive(
  input: { categoryId: string; leans: readonly DiveLean[]; seed: string },
  library: StoryLibrary = getStoryLibrary(),
): CategoryDive {
  const top = [...input.leans].sort((a, b) => b.pct - a.pct).slice(0, DIVE_TOP_LEANS);
  const lead = top[0];
  const second = top[1];
  const dominant = lead ? { trait: lead.axis, tier: tierForDiveLean(lead) } : { trait: 'openness', tier: 'mid' as const };
  const secondary = second ? { trait: second.axis, tier: tierForDiveLean(second) } : undefined;
  const who = reader(dominant.trait, dominant.tier, secondary);
  const seed = input.seed;
  const say = cardSay(library);

  const showsUp = top.map((lean) => ({
    axis: lean.axis,
    line: say('dive-shows', reader(lean.axis, tierForDiveLean(lean)), `${seed}|shows|${lean.axis}`),
  }));

  const mix = top.length >= 2 ? say('dive-mix', who, `${seed}|mix`) : null;
  const notice = say('dive-notice', who, `${seed}|notice`);
  const means = say('dive-means', who, `${seed}|means`);
  const title = say('dive-title', who, `${seed}|title`);
  const joke = say('dive-joke', who, `${seed}|joke`);

  return {
    categoryId: input.categoryId,
    leansKey: `storylib|${input.categoryId}`,
    title,
    showsUp,
    mix,
    othersNotice: notice,
    whatItMeansForYou: means,
    joke,
    source: 'library',
  };
}

export function renderLibraryLegend(
  input: {
    legend: Pick<LegendFigure, 'id' | 'name'>;
    angle: Pick<LegendAngle, 'id'>;
    momentId: string;
    pairs: readonly LegendPair[];
    differ: LegendDiffer | null;
    seed?: string;
  },
  library: StoryLibrary = getStoryLibrary(),
): LegendStory {
  const pairs = input.pairs.slice(0, STORY_MAX_PAIRS);
  const lead = pairs[0];
  const second = pairs[1];
  const dominant = lead
    ? { trait: lead.axis, tier: tierForStrength(lead.lean, lead.strength) }
    : { trait: 'openness', tier: 'mid' as const };
  const secondary = second ? { trait: second.axis, tier: tierForStrength(second.lean, second.strength) } : undefined;
  const who = reader(dominant.trait, dominant.tier, secondary);
  const seed = input.seed ?? `${input.legend.id}|${input.angle.id}|${input.momentId}`;
  const tokens = { legend: input.legend.name };
  const say = cardSay(library);

  const lineFor = (trait: TraitAxis, tier: Tier, slot: string) =>
    say('legend-won', reader(trait, tier), `${seed}|won|${slot}`, tokens);

  return {
    legendId: input.legend.id,
    angleId: input.angle.id,
    momentId: input.momentId,
    whereYouMatch: pairs.map((pair) => ({ axis: pair.axis, lean: pair.lean, them: pair.tag.them })),
    howTheTraitWon: pairs.map((pair, index) => ({
      axis: pair.axis,
      momentId: input.momentId,
      line: lineFor(pair.axis, tierForStrength(pair.lean, pair.strength), String(index)),
    })),
    whatItMeansForYou: say('legend-means', who, `${seed}|means`, tokens),
    title: say('legend-title', who, `${seed}|title`, tokens),
    metScene: say('legend-scene', who, `${seed}|scene`, tokens),
    ...(input.differ
      ? {
          differ: {
            axis: input.differ.axis,
            lean: input.differ.lean,
            line: say(
              'legend-differ',
              reader(input.differ.axis, input.differ.lean === 'high' ? 'high' : 'low'),
              `${seed}|differ`,
              tokens,
            ),
          },
        }
      : {}),
    joke: say('legend-joke', who, `${seed}|joke`, tokens),
    source: 'library',
  };
}
