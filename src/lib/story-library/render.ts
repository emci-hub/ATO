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

import { STORY_LIBRARY, templateById } from './library';
import type { Reader, StoryLibrary, Template, Tier } from './types';

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

function must(id: string, library: StoryLibrary): Template {
  const found = templateById(id, library);
  if (!found) throw new Error(`story library missing ${id}`);
  return found;
}

function say(template: Template, who: Reader, seed: string, library: StoryLibrary, tokens?: Record<string, string>): string {
  return fill(template, who, library.entries, seed, { requireApproved: true, tokens }).text;
}

export function renderLibraryDive(
  input: { categoryId: string; leans: readonly DiveLean[]; seed: string },
  library: StoryLibrary = STORY_LIBRARY,
): CategoryDive {
  const top = [...input.leans].sort((a, b) => b.pct - a.pct).slice(0, DIVE_TOP_LEANS);
  const lead = top[0];
  const second = top[1];
  const dominant = lead ? { trait: lead.axis, tier: tierForDiveLean(lead) } : { trait: 'openness', tier: 'mid' as const };
  const secondary = second ? { trait: second.axis, tier: tierForDiveLean(second) } : undefined;
  const who = reader(dominant.trait, dominant.tier, secondary);
  const seed = input.seed;

  const showsUp = top.map((lean) => ({
    axis: lean.axis,
    line: say(must('dive-shows', library), reader(lean.axis, tierForDiveLean(lean)), `${seed}|shows|${lean.axis}`, library),
  }));

  const mix =
    top.length >= 2
      ? say(must('dive-mix', library), who, `${seed}|mix`, library)
      : null;
  const notice = say(must('dive-notice', library), who, `${seed}|notice`, library);
  const means = say(must('dive-means', library), who, `${seed}|means`, library);
  const title = say(must('dive-title', library), who, `${seed}|title`, library);

  return {
    categoryId: input.categoryId,
    leansKey: `storylib|${input.categoryId}`,
    title,
    showsUp,
    mix,
    othersNotice: notice,
    whatItMeansForYou: means,
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
  library: StoryLibrary = STORY_LIBRARY,
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

  const lineFor = (trait: TraitAxis, tier: Tier, slot: string) =>
    say(must('legend-won', library), reader(trait, tier), `${seed}|won|${slot}`, library, tokens);

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
    whatItMeansForYou: say(must('legend-means', library), who, `${seed}|means`, library, tokens),
    title: say(must('legend-title', library), who, `${seed}|title`, library, tokens),
    metScene: say(must('legend-scene', library), who, `${seed}|scene`, library, tokens),
    ...(input.differ
      ? {
          differ: {
            axis: input.differ.axis,
            lean: input.differ.lean,
            line: say(
              must('legend-differ', library),
              reader(input.differ.axis, input.differ.lean === 'high' ? 'high' : 'low'),
              `${seed}|differ`,
              library,
              tokens,
            ),
          },
        }
      : {}),
    source: 'library',
  };
}
