/**
 * Prints the wave79 intake_questions seed rows from the live bank source, so
 * the server's list of the 48 intake questions is generated, never
 * hand-transcribed. Run: npx tsx ./scripts/gen-wave79-intake.ts
 *
 * wave79 is applied and never edited, so this reads the FROZEN wording
 * (bank-v1.ts). The current wording is added by wave84 (gen-wave84-rows.ts).
 *
 * set_no is the draft's position within its trait (1, 2, 3): set N of the
 * intake is draft N-1 of every trait (bank.ts).
 */
import { QUESTIONS_BANK_V1 } from '../src/lib/questions/bank-v1';
import type { QuestionDraft } from '../src/lib/questions/types';

function sqlText(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

export function intakeRowsOf(bank: readonly QuestionDraft[]): { draft: QuestionDraft; setNo: number }[] {
  const seen = new Map<string, number>();
  return bank.map((draft) => {
    const setNo = (seen.get(draft.axis) ?? 0) + 1;
    seen.set(draft.axis, setNo);
    return { draft, setNo };
  });
}

export function wave79IntakeRows(): { draft: QuestionDraft; setNo: number }[] {
  return intakeRowsOf(QUESTIONS_BANK_V1);
}

export function wave79IntakeRowSql(row: { draft: QuestionDraft; setNo: number }): string {
  const options = JSON.stringify(row.draft.options.map((opt) => ({ text: opt.text, value: opt.value })));
  return `  (${sqlText(row.draft.prompt)}, '${row.draft.axis}', ${row.setNo}, ${sqlText(options)}::jsonb)`;
}

if (require.main === module) {
  console.log(wave79IntakeRows().map(wave79IntakeRowSql).join(',\n'));
}
