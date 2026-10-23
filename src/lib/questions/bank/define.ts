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
 * A WORDING edit (same scene, everyone would pick the same option) rewords in
 * place. A SCENARIO edit (new situation, or an option that now means something
 * else) never does: wrap the old row in `retired(newId, …)` with its text
 * untouched, and add the new scene at the end of the trait file as the next
 * free id (<trait>_26, _27 …), same setting, direction and value scheme.
 * Every trait keeps exactly 25 active rows.
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
  /**
   * 2, 3, or 4 options. 0.8 is high, 0.2 is low, 0.5 is between.
   * A 4-option row is a former 2-option row: the first two options stay, in
   * order, and a middle plus a stronger end (0.95 or 0.05) are appended, so
   * an answer already stored by option index still means the same thing.
   */
  options: QuestionOption[];
  /**
   * Set when the question was retired (emci 2026-10-20): its scene changed, so
   * the old row keeps its ORIGINAL text forever (answers already given point
   * at it and keep showing it) but it is never served again, never changed
   * through Change answers, and its id is never reused. The new scene is a
   * new id (`replacedBy`) with the same trait, direction and value scheme.
   * Server: `question_bank.retired_at` (wave100), set by the migration named
   * in `wave`.
   */
  retired?: { wave: 'wave100'; replacedBy: string };
}

/**
 * ACTIVE questions per trait: what is served, and what "25 sets" counts. A
 * retired row does not count here; an answer already given to one still
 * counts for that person (capped at this number), so retiring never moves
 * anyone's progress backward or forward.
 */
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

/** Marks a row retired by wave100 (see BankQuestion.retired). Its text stays as it was. */
export function retired(replacedBy: string, question: Omit<BankQuestion, 'axis'>): Omit<BankQuestion, 'axis'> {
  return { ...question, retired: { wave: 'wave100', replacedBy } };
}

export function traitBank(axis: TraitAxis, rows: readonly Omit<BankQuestion, 'axis'>[]): readonly BankQuestion[] {
  return rows.map((row) => ({ ...row, axis }));
}
