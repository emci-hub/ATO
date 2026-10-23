/**
 * Renders every template × trait × tier × pronoun. Shipping checks pass
 * `requireApproved`. The admin save does not, so a draft can become validated.
 */
import { TRAIT_AXES } from '@/lib/traits';
import {
  DIVE_MEANS_MAX_WORDS,
  DIVE_MEANS_MIN_WORDS,
  MIX_MAX_WORDS,
  MIX_MIN_WORDS,
  NOTICE_MAX_WORDS,
  NOTICE_MIN_WORDS,
  SHOWS_MAX_WORDS,
  SHOWS_MIN_WORDS,
  diveLineViolation,
} from '@/lib/category-deep-dive/dive';
import {
  DIFFER_MAX_WORDS,
  DIFFER_MIN_WORDS,
  MEANS_MAX_WORDS,
  MEANS_MIN_WORDS,
  SCENE_MAX_WORDS,
  SCENE_MIN_WORDS,
  WON_MAX_WORDS,
  legendLineViolation,
  titleViolation,
} from '@/lib/legend-figures/story';
import { fill, PRONOUNS } from '@/lib/story-v3/tracery';
import { cardJokeViolation } from '@/lib/voice/card-joke';

import type { PronounSet, Reader, StoryLibrary, Template, Tier } from './types';
import { PRONOUN_TOKENS } from './types';

const TIERS: readonly Tier[] = ['low', 'mid', 'high'];
const PRONOUN_IDS = ['you', 'they', 'she', 'he'] as const;

const BANDS: Record<string, readonly [number, number]> = {
  'dive-shows': [SHOWS_MIN_WORDS, SHOWS_MAX_WORDS],
  'dive-mix': [MIX_MIN_WORDS, MIX_MAX_WORDS],
  'dive-notice': [NOTICE_MIN_WORDS, NOTICE_MAX_WORDS],
  'dive-means': [DIVE_MEANS_MIN_WORDS, DIVE_MEANS_MAX_WORDS],
  'legend-won': [8, WON_MAX_WORDS],
  'legend-scene': [SCENE_MIN_WORDS, SCENE_MAX_WORDS],
  'legend-differ': [DIFFER_MIN_WORDS, DIFFER_MAX_WORDS],
  'legend-means': [MEANS_MIN_WORDS, MEANS_MAX_WORDS],
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Product rules on top of the filler: voice, joke shape, and the bands the card shows. */
function productIssue(template: Template, text: string): string | null {
  const allowed = template.kind === 'legend' ? 'Marie Curie' : '';
  if (template.id.endsWith('-joke')) {
    return cardJokeViolation(text) ?? (template.kind === 'legend' ? legendLineViolation(text, allowed, false) : diveLineViolation(text, allowed));
  }
  if (template.id.endsWith('-title')) return titleViolation(text, allowed);
  const line = template.kind === 'legend' ? legendLineViolation(text, allowed, false) : diveLineViolation(text, allowed);
  if (line) return line;
  const band = BANDS[template.id];
  if (!band) return null;
  const n = wordCount(text);
  if (n < band[0] || n > band[1]) return `length ${n}, want ${band[0]}–${band[1]}`;
  return null;
}

export interface MatrixFailure {
  templateId: string;
  trait: string;
  tier: string;
  pronoun: string;
  detail: string;
}

export interface MatrixReport {
  renders: number;
  failures: MatrixFailure[];
}

function readerFor(trait: string, tier: Tier, pronoun: PronounSet, secondary?: Reader['secondary']): Reader {
  return {
    name: 'Alex',
    pronoun,
    dominant: { trait, tier },
    ...(secondary ? { secondary } : {}),
  };
}

export function validateLibrary(library: StoryLibrary, options: { requireApproved?: boolean } = {}): MatrixReport {
  const failures: MatrixFailure[] = [];
  let renders = 0;
  const requireApproved = options.requireApproved ?? false;
  const reserved = new Set<string>(PRONOUN_TOKENS);

  for (const template of library.templates) {
    for (const spec of template.slots) {
      if (reserved.has(spec.id)) {
        failures.push({
          templateId: template.id,
          trait: '-',
          tier: '-',
          pronoun: '-',
          detail: `slot id ${spec.id} collides with a pronoun token`,
        });
      }
      const corpus = `${template.body}\n${template.endings.map((ending) => ending.text).join('\n')}`;
      if (!corpus.includes(`{${spec.id}}`)) {
        failures.push({
          templateId: template.id,
          trait: '-',
          tier: '-',
          pronoun: '-',
          detail: `body is missing {${spec.id}}`,
        });
      }
    }
  }

  for (const template of library.templates) {
    const usesSecondary = template.slots.some((spec) => spec.trait === 'secondary') || template.endings.some((ending) => ending.when.alsoTrait);
    for (const trait of TRAIT_AXES) {
      for (const tier of TIERS) {
        for (const pronounId of PRONOUN_IDS) {
          const secondary = usesSecondary
            ? { trait: trait === 'playfulness' ? 'openness' : 'playfulness', tier: 'high' as const }
            : undefined;
          const result = fill(template, readerFor(trait, tier, PRONOUNS[pronounId], secondary), library.entries, `${template.id}|${trait}|${tier}|${pronounId}`, {
            requireApproved,
            tokens: template.kind === 'legend' ? { legend: 'Marie Curie' } : undefined,
          });
          renders += 1;
          for (const issue of result.issues) {
            failures.push({
              templateId: template.id,
              trait,
              tier,
              pronoun: pronounId,
              detail: `${issue.code}: ${issue.detail}`,
            });
          }
          const product = productIssue(template, result.text);
          if (product) {
            failures.push({
              templateId: template.id,
              trait,
              tier,
              pronoun: pronounId,
              detail: product,
            });
          }
          if (Object.values(result.picks).includes('openness-high-screech')) {
            failures.push({
              templateId: template.id,
              trait,
              tier,
              pronoun: pronounId,
              detail: 'sharp decoy was picked',
            });
          }
        }
      }
    }
  }

  return { renders, failures };
}
