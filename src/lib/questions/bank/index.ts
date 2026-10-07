import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import { AGREEABLENESS_BANK } from './agreeableness';
import { ATTACHMENT_ANXIETY_BANK } from './attachment_anxiety';
import { ATTACHMENT_AVOIDANCE_BANK } from './attachment_avoidance';
import { AUTONOMY_BANK } from './autonomy';
import { COMPETENCE_BANK } from './competence';
import { CONFLICT_ASSERTIVENESS_BANK } from './conflict_assertiveness';
import { CONFLICT_COOPERATIVENESS_BANK } from './conflict_cooperativeness';
import { CONSCIENTIOUSNESS_BANK } from './conscientiousness';
import type { BankQuestion } from './define';
import { EXTRAVERSION_BANK } from './extraversion';
import { GROWTH_MINDSET_BANK } from './growth_mindset';
import { LOCUS_OF_CONTROL_BANK } from './locus_of_control';
import { OPENNESS_BANK } from './openness';
import { PLAYFULNESS_BANK } from './playfulness';
import { RELATEDNESS_BANK } from './relatedness';
import { SELF_EFFICACY_BANK } from './self_efficacy';
import { STEADINESS_BANK } from './steadiness';

export * from './define';

/** Every trait's 25, keyed by trait. One file per trait; edit there. */
export const BANK_BY_TRAIT: Readonly<Record<TraitAxis, readonly BankQuestion[]>> = {
  openness: OPENNESS_BANK,
  conscientiousness: CONSCIENTIOUSNESS_BANK,
  extraversion: EXTRAVERSION_BANK,
  agreeableness: AGREEABLENESS_BANK,
  steadiness: STEADINESS_BANK,
  attachment_anxiety: ATTACHMENT_ANXIETY_BANK,
  attachment_avoidance: ATTACHMENT_AVOIDANCE_BANK,
  conflict_assertiveness: CONFLICT_ASSERTIVENESS_BANK,
  conflict_cooperativeness: CONFLICT_COOPERATIVENESS_BANK,
  autonomy: AUTONOMY_BANK,
  competence: COMPETENCE_BANK,
  relatedness: RELATEDNESS_BANK,
  growth_mindset: GROWTH_MINDSET_BANK,
  locus_of_control: LOCUS_OF_CONTROL_BANK,
  self_efficacy: SELF_EFFICACY_BANK,
  playfulness: PLAYFULNESS_BANK,
};

/** All 400, trait order then id order. */
export const QUESTION_BANK: readonly BankQuestion[] = TRAIT_AXES.flatMap((axis) => BANK_BY_TRAIT[axis]);

const BY_ID = new Map(QUESTION_BANK.map((row) => [row.id, row]));

export function bankQuestionById(id: string): BankQuestion | undefined {
  return BY_ID.get(id);
}
