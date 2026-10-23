/**
 * Assemble a CategoryDive or a LegendStory from whole approved lines.
 * Percents, museum facts, and "where you match" stay hand-worked.
 */
import type { CategoryDive, DiveLean } from '@/lib/category-deep-dive/dive';
import { DIVE_TOP_LEANS } from '@/lib/category-deep-dive/dive';
import type { LegendDiffer, LegendPair, LegendStory } from '@/lib/legend-figures/story';
import { STORY_MAX_PAIRS } from '@/lib/legend-figures/story';
import type { LegendAngle, LegendFigure } from '@/lib/legend-figures/types';
import { PRONOUNS } from '@/lib/story-v3/tracery';
import type { TraitAxis } from '@/lib/traits';
import { TRAIT_BAND_HIGH_CUT, TRAIT_BAND_LOW_CUT } from '@/lib/traits';
import type { SentenceShape } from '@/lib/voice/player-copy';

import { getStoryLibrary } from './persist';
import { lineShape, pickLine, preferredShape, speak, type PickContext } from './pick';
import type { LineSlot, Reader, StoryLibrary, StoryLine, Tier } from './types';

const YOU = PRONOUNS.you;

export function tierForDiveLean(lean: Pick<DiveLean, 'lean' | 'pct' | 'middle'>): Tier {
  if (lean.middle) return 'mid';
  if (lean.lean === 'high') return lean.pct >= Math.round(TRAIT_BAND_HIGH_CUT * 100) ? 'high' : 'mid';
  return lean.pct >= Math.round((1 - TRAIT_BAND_LOW_CUT) * 100) + 1 ? 'low' : 'mid';
}

/** `strength` is `abs(value - 0.5)` from the story ranker. */
export function tierForStrength(lean: 'high' | 'low', strength: number): Tier {
  if (lean === 'high') return strength >= TRAIT_BAND_HIGH_CUT - 0.5 ? 'high' : 'mid';
  return strength > 0.5 - TRAIT_BAND_LOW_CUT ? 'low' : 'mid';
}

export interface RenderFacts {
  answer?: string;
  recent?: boolean;
  shown?: ReadonlySet<string>;
  legend?: string;
  legendId?: string;
}

interface Say {
  text: (slot: LineSlot, who: { trait: string; tier: Tier }, seed: string, index?: number, also?: { trait: string; tier: Tier }) => string;
  ids: string[];
}

function sayWith(library: StoryLibrary, facts: RenderFacts, pronoun = YOU, name = 'You'): Say {
  const used = new Set<SentenceShape>();
  const ids: string[] = [];
  const shown = facts.shown ?? new Set<string>();
  const text = (slot: LineSlot, who: { trait: string; tier: Tier }, seed: string, index = 0, also?: { trait: string; tier: Tier }) => {
    const prefer = slot === 'title' || slot === 'legend-title' ? undefined : preferredShape(slot, index);
    const ctx: PickContext = {
      slot,
      trait: who.trait,
      tier: who.tier,
      pronoun,
      name,
      seed,
      shown,
      usedShapes: used,
      preferShape: prefer,
      answer: facts.answer,
      recent: facts.recent,
      legend: facts.legend,
      legendId: facts.legendId,
      alsoTrait: also?.trait,
      alsoTier: also?.tier,
      requireApproved: true,
    };
    const line = pickLine(library.lines, ctx);
    if (!line) return '';
    if (slot !== 'title' && slot !== 'legend-title') used.add(lineShape(line, ctx));
    ids.push(line.id);
    return speak(line.text, pronoun, name, { legend: facts.legend, answer: facts.answer });
  };
  return { text, ids };
}

export function renderLibraryDive(
  input: {
    categoryId: string;
    leans: readonly DiveLean[];
    seed: string;
    answer?: string;
    recent?: boolean;
    shown?: readonly string[];
  },
  library: StoryLibrary = getStoryLibrary(),
): CategoryDive & { lineIds: string[] } {
  const top = [...input.leans].sort((a, b) => b.pct - a.pct).slice(0, DIVE_TOP_LEANS);
  const lead = top[0];
  const second = top[1];
  const dominant = lead ? { trait: lead.axis, tier: tierForDiveLean(lead) } : { trait: 'openness', tier: 'mid' as const };
  const secondary = second ? { trait: second.axis, tier: tierForDiveLean(second) } : undefined;
  const say = sayWith(library, {
    answer: input.answer,
    recent: input.recent,
    shown: new Set(input.shown ?? []),
  });
  const showsUp = top.map((lean, index) => ({
    axis: lean.axis,
    line: say.text('shows', { trait: lean.axis, tier: tierForDiveLean(lean) }, `${input.seed}|shows|${lean.axis}`, index),
  }));
  const mix =
    top.length >= 2
      ? say.text('mix', dominant, `${input.seed}|mix`, 0, secondary)
      : null;
  const notice = say.text('notice', dominant, `${input.seed}|notice`);
  const means = say.text('means', dominant, `${input.seed}|means`);
  const joke = say.text('joke', dominant, `${input.seed}|joke`);
  const title = say.text('title', dominant, `${input.seed}|title`);
  return {
    categoryId: input.categoryId,
    leansKey: `storylib|${input.categoryId}`,
    title,
    showsUp,
    mix: mix || null,
    othersNotice: notice || null,
    whatItMeansForYou: means,
    joke: joke || undefined,
    source: 'library',
    lineIds: say.ids,
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
    answer?: string;
    recent?: boolean;
    shown?: readonly string[];
  },
  library: StoryLibrary = getStoryLibrary(),
): LegendStory & { lineIds: string[] } {
  const pairs = input.pairs.slice(0, STORY_MAX_PAIRS);
  const lead = pairs[0];
  const dominant = lead
    ? { trait: lead.axis, tier: tierForStrength(lead.lean, lead.strength) }
    : { trait: 'openness', tier: 'mid' as const };
  const seed = input.seed ?? `${input.legend.id}|${input.angle.id}|${input.momentId}`;
  const say = sayWith(library, {
    answer: input.answer,
    recent: input.recent,
    shown: new Set(input.shown ?? []),
    legend: input.legend.name,
    legendId: input.legend.id,
  });
  const howTheTraitWon = pairs.map((pair, index) => ({
    axis: pair.axis,
    momentId: input.momentId,
    line: say.text('legend-won', { trait: pair.axis, tier: tierForStrength(pair.lean, pair.strength) }, `${seed}|won|${index}`, index),
  }));
  const metScene = say.text('legend-scene', dominant, `${seed}|scene`);
  const means = say.text('legend-means', dominant, `${seed}|means`);
  const title = say.text('legend-title', dominant, `${seed}|title`);
  const joke = say.text('legend-joke', dominant, `${seed}|joke`);
  const differ = input.differ
    ? {
        axis: input.differ.axis,
        lean: input.differ.lean,
        line: say.text(
          'legend-differ',
          { trait: input.differ.axis, tier: input.differ.lean === 'high' ? 'high' : 'low' },
          `${seed}|differ`,
        ),
      }
    : undefined;
  return {
    legendId: input.legend.id,
    angleId: input.angle.id,
    momentId: input.momentId,
    whereYouMatch: pairs.map((pair) => ({ axis: pair.axis, lean: pair.lean, them: pair.tag.them })),
    howTheTraitWon,
    whatItMeansForYou: means,
    title,
    metScene,
    ...(differ ? { differ } : {}),
    joke: joke || undefined,
    source: 'library',
    lineIds: say.ids,
  };
}

/** A reader-shaped pick, for the admin preview and the salience check. */
export function pickForReader(library: StoryLibrary, slot: LineSlot, reader: Reader, seed: string, facts: RenderFacts = {}): StoryLine | null {
  return pickLine(library.lines, {
    slot,
    trait: reader.dominant.trait,
    tier: reader.dominant.tier,
    pronoun: reader.pronoun,
    name: reader.name,
    seed,
    shown: facts.shown ?? new Set(),
    usedShapes: new Set(),
    preferShape: preferredShape(slot, 0),
    answer: facts.answer,
    recent: facts.recent,
    legend: facts.legend,
    legendId: facts.legendId,
    alsoTrait: reader.secondary?.trait,
    alsoTier: reader.secondary?.tier,
  });
}

export type { TraitAxis };
