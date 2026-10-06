import type { TraitAxis } from '@/lib/traits';

import type { QuestionOption } from '../types';

/**
 * The fixed question bank (2026-10-06, emci): 25 questions per trait, 16
 * traits, 400 in all. Written once, stored as plain data, never generated at
 * runtime. The server copy (`question_bank`, wave85 seed) is generated from
 * these files by scripts/gen-wave85-bank.ts, and `check:question-bank` fails
 * if the two drift.
 *
 * Editing a question: change its prompt or options here, regenerate the seed,
 * ship a migration that updates that row. Never reuse or renumber an id —
 * answers point at the id, so a reworded question keeps its answers.
 *
 * FUTURE (not built, emci 2026-10-06): a possible split of each trait into 20
 * main + 5 bonus questions, scored as two separate tracks with both sent to
 * the AI insights. If that happens, add a `tier: 'main' | 'bonus'` field here
 * and let the server score by tier; ids stay as they are.
 */

/** Where the moment happens. Each trait spreads its 25 across all eight. */
export type BankSetting = 'work' | 'friends' | 'dating' | 'family' | 'solo' | 'online' | 'money' | 'stress';

export const BANK_SETTINGS: readonly BankSetting[] = [
  'work',
  'friends',
  'dating',
  'family',
  'solo',
  'online',
  'money',
  'stress',
];

/**
 * Which end of the trait the LESS flattering answer sits on. 'high' means the
 * high-value answer is the one people would rather not admit to. Each trait
 * keeps both sides represented so the scale never rewards the nice answer.
 */
export type BankUnflattering = 'high' | 'low' | 'neither';

export interface BankQuestion {
  /** Stable forever: `<trait>_<nn>`. Answers reference this. */
  id: string;
  axis: TraitAxis;
  setting: BankSetting;
  unflattering: BankUnflattering;
  /**
   * 1-3 on the three questions that ARE today's intake question N for this
   * trait (same wording as src/lib/questions/bank.ts). An answer an account
   * already gave to that intake question counts as an answer to this one.
   */
  intakeSlot?: 1 | 2 | 3;
  prompt: string;
  /** 2 or 3 options. Value 0.8 is the high end, 0.2 the low end, 0.5 between. */
  options: QuestionOption[];
}

export const BANK_PER_TRAIT = 25;

type Opt = readonly [text: string, value: number];

export function q(
  id: string,
  setting: BankSetting,
  unflattering: BankUnflattering,
  prompt: string,
  ...options: Opt[]
): Omit<BankQuestion, 'axis'> {
  return { id, setting, unflattering, prompt, options: options.map(([text, value]) => ({ text, value })) };
}

export function intake(slot: 1 | 2 | 3, question: Omit<BankQuestion, 'axis'>): Omit<BankQuestion, 'axis'> {
  return { ...question, intakeSlot: slot };
}

export function traitBank(axis: TraitAxis, rows: readonly Omit<BankQuestion, 'axis'>[]): readonly BankQuestion[] {
  return rows.map((row) => ({ ...row, axis }));
}
