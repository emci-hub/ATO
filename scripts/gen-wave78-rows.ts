/**
 * Prints the wave78 question_bank_pool insert rows from the live bank source,
 * so the SQL is generated, not hand-transcribed (same rule as wave49's seed).
 * Run: npx tsx ./scripts/gen-wave78-rows.ts
 *
 * Rows: the ten restored third intake questions (QUESTIONS_BANK, third entry of
 * each trait that had 2) and the ten original wordings (the tail of
 * ROUND_ONLY_BANK). The twelve moved extras are already in the pool (wave49).
 */
// wave78 is applied and never edited: its rows are the frozen wording (bank-v1.ts).
import { QUESTIONS_BANK_V1 as QUESTIONS_BANK, ROUND_ONLY_BANK_V1 as ROUND_ONLY_BANK } from '../src/lib/questions/bank-v1';
import type { QuestionDraft } from '../src/lib/questions/types';

export const RESTORED_AXES = [
  'steadiness',
  'attachment_anxiety',
  'attachment_avoidance',
  'conflict_cooperativeness',
  'autonomy',
  'competence',
  'growth_mindset',
  'locus_of_control',
  'self_efficacy',
  'playfulness',
] as const;

function sqlText(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

function row(draft: QuestionDraft): string {
  const options = JSON.stringify(draft.options.map((opt) => ({ text: opt.text, value: opt.value })));
  return `  ('${draft.axis}', '${draft.category}', ${sqlText(draft.prompt)}, ${sqlText(options)}::jsonb, 'authored')`;
}

export function wave78Drafts(): QuestionDraft[] {
  const restored = RESTORED_AXES.map((axis) => QUESTIONS_BANK.filter((d) => d.axis === axis)[2]!);
  const originals = ROUND_ONLY_BANK.slice(-RESTORED_AXES.length);
  return [...restored, ...originals];
}

if (require.main === module) {
  console.log(wave78Drafts().map(row).join(',\n'));
}

export { row as wave78Row };
