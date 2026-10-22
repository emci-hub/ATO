/**
 * Renders every template × trait × tier × pronoun. Shipping checks pass
 * `requireApproved`. The admin save does not, so a draft can become validated.
 */
import { TRAIT_AXES } from '@/lib/traits';
import { fill, PRONOUNS } from '@/lib/story-v3/tracery';

import type { PronounSet, Reader, StoryLibrary, Tier } from './types';
import { PRONOUN_TOKENS } from './types';

const TIERS: readonly Tier[] = ['low', 'mid', 'high'];
const PRONOUN_IDS = ['you', 'they', 'she', 'he'] as const;

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
      if (!template.body.includes(`{${spec.id}}`)) {
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
