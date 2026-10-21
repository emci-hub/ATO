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

/**
 * Every row a trait has ever had, retired ones included, in id order. One
 * file per trait; edit there. Use this to look up or count what someone has
 * ANSWERED (an answer to a retired question still counts for them).
 */
export const BANK_ROWS_BY_TRAIT: Readonly<Record<TraitAxis, readonly BankQuestion[]>> = {
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

/** Each trait's 25 ACTIVE questions: the ones that are served and counted. */
export const BANK_BY_TRAIT: Readonly<Record<TraitAxis, readonly BankQuestion[]>> = (() => {
  const out = {} as Record<TraitAxis, readonly BankQuestion[]>;
  for (const axis of TRAIT_AXES) out[axis] = BANK_ROWS_BY_TRAIT[axis].filter((row) => !row.retired);
  return out;
})();

/** Every row ever, retired included: trait order then id order. */
export const QUESTION_BANK_ALL: readonly BankQuestion[] = TRAIT_AXES.flatMap((axis) => BANK_ROWS_BY_TRAIT[axis]);

/** The 400 active questions, trait order then id order. */
export const QUESTION_BANK: readonly BankQuestion[] = TRAIT_AXES.flatMap((axis) => BANK_BY_TRAIT[axis]);

/** Retired rows (kept forever, never served). */
export const RETIRED_BANK_QUESTIONS: readonly BankQuestion[] = QUESTION_BANK_ALL.filter((row) => row.retired);

const BY_ID = new Map(QUESTION_BANK_ALL.map((row) => [row.id, row]));

/** Any bank row by id, retired ones too: an old answer still shows the question it answered. */
export function bankQuestionById(id: string): BankQuestion | undefined {
  return BY_ID.get(id);
}
