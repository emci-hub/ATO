/**
 * Offline voice report for every banked question (no network).
 * Run: npx tsx scripts/question-voice-report.ts [--md out.md]
 *
 * Scores the 48 intake questions, the round-only bank and the authored pool
 * rows seeded by wave49 / wave78 with `assessQuestion` and prints a ranked
 * table: rewrite / light touch / keep.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PROMPT_REWORDS, QUESTIONS_BANK, ROUND_ONLY_BANK } from '../src/lib/questions/bank';
import { assessQuestion, verdictFor, type VoiceVerdict } from '../src/lib/questions/question-voice';
import type { QuestionDraft } from '../src/lib/questions/types';
import type { TraitAxis } from '../src/lib/traits';

interface Row {
  source: string;
  draft: QuestionDraft;
}

function poolRows(file: string, label: string): Row[] {
  const sql = readFileSync(resolve(__dirname, '../supabase/migrations', file), 'utf8');
  const out: Row[] = [];
  const re = /\('([a-z_]+)', '([a-z_]+)', '((?:[^']|'')*)', '(\[[^\n]*?\])'::jsonb, 'authored'\)/g;
  for (const m of sql.matchAll(re)) {
    out.push({
      source: label,
      draft: {
        axis: m[1] as TraitAxis,
        prompt: m[3].replace(/''/g, "'"),
        options: JSON.parse(m[4].replace(/''/g, "'")),
      },
    });
  }
  return out;
}

const setOf = new Map<QuestionDraft, number>();
const seen: Partial<Record<TraitAxis, number>> = {};
for (const q of QUESTIONS_BANK) {
  seen[q.axis] = (seen[q.axis] ?? 0) + 1;
  setOf.set(q, seen[q.axis]!);
}

const rows: Row[] = [
  ...QUESTIONS_BANK.map((d) => ({ source: `intake set ${setOf.get(d)}`, draft: d })),
  ...ROUND_ONLY_BANK.map((d) => ({ source: 'round-only', draft: d })),
];
// Pool rows that wave84 rewords are scored by their new wording above.
const known = new Set([...rows.map((r) => r.draft.prompt), ...Object.keys(PROMPT_REWORDS)]);
for (const r of [...poolRows('wave49_question_bank_pool.sql', 'pool w49'), ...poolRows('wave78_staged_intake.sql', 'pool w78')]) {
  if (!known.has(r.draft.prompt)) {
    rows.push(r);
    known.add(r.draft.prompt);
  }
}

const all = rows.map((r) => r.draft.prompt);
const order: Record<VoiceVerdict, number> = { rewrite: 0, 'light touch': 1, keep: 2 };
const scored = rows
  .map((r) => {
    const issues = assessQuestion(r.draft, { others: all });
    return { ...r, issues, verdict: verdictFor(issues), hard: issues.filter((i) => i.kind === 'hard').length };
  })
  .sort((a, b) => order[a.verdict] - order[b.verdict] || b.hard - a.hard || b.issues.length - a.issues.length);

const counts = { rewrite: 0, 'light touch': 0, keep: 0 } as Record<VoiceVerdict, number>;
for (const s of scored) counts[s.verdict] += 1;

const lines: string[] = [];
lines.push(`| # | Verdict | Source | Trait | Question | Options (value) | Why |`);
lines.push(`|---|---|---|---|---|---|---|`);
scored.forEach((s, i) => {
  const opts = s.draft.options.map((o) => `${o.text} (${o.value})`).join(' / ');
  const why = s.issues.map((x) => `${x.kind === 'hard' ? '**' : ''}${x.rule}${x.kind === 'hard' ? '**' : ''}: ${x.detail}`).join('; ') || '—';
  lines.push(`| ${i + 1} | ${s.verdict} | ${s.source} | ${s.draft.axis} | ${s.draft.prompt.replace(/\|/g, '/')} | ${opts.replace(/\|/g, '/')} | ${why.replace(/\|/g, '/')} |`);
});
const summary = `${scored.length} questions — rewrite ${counts.rewrite}, light touch ${counts['light touch']}, keep ${counts.keep}`;

const mdAt = process.argv.indexOf('--md');
if (mdAt > 0 && process.argv[mdAt + 1]) {
  writeFileSync(process.argv[mdAt + 1], `# Question voice report\n\n${summary}\n\n${lines.join('\n')}\n`);
}
console.log(summary);
for (const v of ['rewrite', 'light touch', 'keep'] as VoiceVerdict[]) {
  const bySource: Record<string, number> = {};
  for (const s of scored) if (s.verdict === v) bySource[s.source] = (bySource[s.source] ?? 0) + 1;
  console.log(`  ${v}: ${JSON.stringify(bySource)}`);
}
