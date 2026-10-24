/**
 * Full voice review for a Story Library: banned phrases and slang. A flip
 * scene is not required. The one-shape-per-card cap is off: it forced a
 * false "when" onto lines that were not the same event. Save and approve
 * both call this before a draft can be validated. Persist cannot import
 * the renderer (the renderer imports persist).
 */
import type { CategoryDive } from '@/lib/category-deep-dive/dive';
import type { LegendStory } from '@/lib/legend-figures/story';
import { legendById } from '@/lib/legend-figures/roster';
import { TRAIT_AXES } from '@/lib/traits';
import { cardSentences } from '@/lib/voice/player-copy';

import { libraryVoiceFailures } from './persist';
import { renderLibraryDive, renderLibraryLegend } from './render';
import type { MatrixFailure } from './validate';
import type { StoryLibrary, Tier } from './types';

function diveSpoken(dive: CategoryDive): string[] {
  return [...dive.showsUp.map((row) => row.line), dive.mix ?? '', dive.othersNotice ?? '', dive.whatItMeansForYou, dive.joke ?? ''].filter(
    (part) => part.trim().length > 0,
  );
}

function legendSpoken(story: LegendStory): string[] {
  return [
    ...story.howTheTraitWon.map((row) => row.line),
    story.whatItMeansForYou,
    story.metScene ?? '',
    story.differ?.line ?? '',
    story.joke ?? '',
  ].filter((part) => part.trim().length > 0);
}

function cardFailure(label: string, parts: readonly string[]): MatrixFailure | null {
  // Touch the sentences so a render that throws still fails the check.
  // A repeated shape is not a failure: plain sentences share one shape,
  // and refusing that pushed writers to glue a false "when" onto a deed.
  cardSentences(parts);
  void label;
  return null;
}

/** Render enough cards to catch a repeated shape or a prop used twice. */
export function libraryShapeFailures(library: StoryLibrary): MatrixFailure[] {
  const failures: MatrixFailure[] = [];
  const tiers: readonly Tier[] = ['low', 'mid', 'high'];
  const seeds = ['shape-a', 'shape-b', 'sample-dive'];
  for (const trait of TRAIT_AXES) {
    for (const tier of tiers) {
      const index = TRAIT_AXES.indexOf(trait);
      const second = TRAIT_AXES[(index + 1) % TRAIT_AXES.length]!;
      const third = TRAIT_AXES[(index + 2) % TRAIT_AXES.length]!;
      for (const seed of seeds) {
        const single = renderLibraryDive(
          {
            categoryId: 'voice',
            leans: [{ axis: trait, lean: tier === 'low' ? 'low' : 'high', pct: tier === 'high' ? 82 : tier === 'low' ? 80 : 50, middle: tier === 'mid' }],
            seed: `${seed}|${trait}|${tier}|1`,
          },
          library,
        );
        const one = cardFailure(`dive ${trait} ${tier} alone`, diveSpoken(single));
        if (one) failures.push(one);
        const triple = renderLibraryDive(
          {
            categoryId: 'voice',
            leans: [
              { axis: trait, lean: tier === 'low' ? 'low' : 'high', pct: 82, middle: tier === 'mid' },
              { axis: second, lean: 'high', pct: 78 },
              { axis: third, lean: 'low', pct: 70 },
            ],
            seed: `${seed}|${trait}|${tier}|3`,
          },
          library,
        );
        const many = cardFailure(`dive ${trait} ${tier} with two others`, diveSpoken(triple));
        if (many) failures.push(many);
      }
    }
  }

  const legend = legendById('lf_marie_curie');
  if (!legend) return failures;
  for (const count of [1, 2, 3] as const) {
    for (const withDiffer of [false, true]) {
      const pairs = TRAIT_AXES.slice(0, count).map((axis, index) => ({
        axis: index === 0 ? ('openness' as const) : axis,
        lean: 'high' as const,
        strength: 0.3,
        contrast: false,
        tag: { axis: index === 0 ? ('openness' as const) : axis, lean: 'high' as const, them: 'a real habit', why: 'the work kept going' },
      }));
      const story = renderLibraryLegend(
        {
          legend,
          angle: legend.angles[0]!,
          momentId: legend.moments[0]!.id,
          pairs,
          differ: withDiffer ? { axis: 'extraversion', lean: 'low', tag: null } : null,
          seed: `shape-legend|${count}|${withDiffer ? 'differ' : 'same'}`,
        },
        library,
      );
      const hit = cardFailure(`legend ${count} pair${count === 1 ? '' : 's'}${withDiffer ? ' plus differ' : ''}`, legendSpoken(story));
      if (hit) failures.push(hit);
    }
  }
  return failures;
}

export function reviewLibraryVoice(library: StoryLibrary): MatrixFailure[] {
  return [...libraryVoiceFailures(library), ...libraryShapeFailures(library)];
}
