/**
 * Writes docs/proposals/question-rewrite.md — the before/after table emci
 * reviews before QUESTION_VOICE_COPY_REVIEWED flips to true.
 * Run: npx tsx scripts/gen-question-rewrite-doc.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { QUESTIONS_BANK, ROUND_ONLY_BANK } from '../src/lib/questions/bank';
import { QUESTIONS_BANK_V1, ROUND_ONLY_BANK_V1 } from '../src/lib/questions/bank-v1';
import type { QuestionDraft } from '../src/lib/questions/types';
import { AXIS_SHORT_NAME } from '../src/lib/axis-poles';

const cell = (s: string) => s.replace(/\|/g, '/');
const opts = (q: QuestionDraft) => q.options.map((o) => `${cell(o.text)} (${o.value})`).join(' / ');

function table(before: readonly QuestionDraft[], after: readonly QuestionDraft[], setOf: (i: number) => string): string {
  const rows = ['| # | Trait | Set | Before | After |', '|---|---|---|---|---|'];
  before.forEach((old, i) => {
    const now = after[i]!;
    const same = old.prompt === now.prompt && opts(old) === opts(now);
    rows.push(
      `| ${i + 1} | ${AXIS_SHORT_NAME[now.axis]} | ${setOf(i)} | ${same ? '_unchanged_ ' : ''}**${cell(old.prompt)}**<br>${opts(old)} | ${same ? '—' : `**${cell(now.prompt)}**<br>${opts(now)}`} |`,
    );
  });
  return rows.join('\n');
}

const seen = new Map<string, number>();
const intakeSet = QUESTIONS_BANK.map((q) => {
  const n = (seen.get(q.axis) ?? 0) + 1;
  seen.set(q.axis, n);
  return n;
});
const changed = (b: readonly QuestionDraft[], a: readonly QuestionDraft[]) =>
  b.filter((q, i) => q.prompt !== a[i]!.prompt || opts(q) !== opts(a[i]!)).length;

const doc = `# Question bank in the moment voice — before / after (2026-10-05)

Draft behind \`QUESTION_VOICE_COPY_REVIEWED = false\`. Every row keeps its trait,
its set and the value at every option position — only words changed, so no
score moves (\`check:question-voice\`). Old wording: \`src/lib/questions/bank-v1.ts\`.
The server accepts both wordings (wave84), so phones on an older update are fine.

**Changed:** ${changed(QUESTIONS_BANK_V1, QUESTIONS_BANK)} of 48 intake, ${changed(ROUND_ONLY_BANK_V1, ROUND_ONLY_BANK)} of 22 round questions.

## Ones that did not make sense (fixed)

- **"Your Do today was writing down one thing you're walking into…"** — pointed at the
  Read + Do card, which no longer exists. Now: a new place opened next to your usual spot.
- **"Everyone at the table already knows their order. You don't."** — "I ask what
  everyone else got" scored as the MOST self-belief. The question stays; the top
  answer is now "I pick something and own it" (same value).
- **"Someone asks how next year's looking."** / **"How next year goes is mostly up to you."** —
  two near-copies; one is now "New year, blank calendar", the other a job email.
- **"Someone sends a short reply that could be read two ways."** — a near-copy of an
  intake question; now a manager's "can we talk tomorrow?".
- **Statements, not moments:** "You need reassurance more often…", "Winning the point
  matters more…", "You can get noticeably better at almost anything…", "People would say
  you are one of the sillier people…" — each is now a scene with reactions.
- **"you are" / "you're" in the question** (9) and **"same as always"** in an option.
- **Options that read as the right answer:** "New one. Obviously", "Yes, easily".

## How the options were balanced (research)

- Options are reactions in the same shape and length, every one easy to admit to
  out loud. How flattering an option is and how plausible it sounds explain about a third
  of how people answer (Kaminski et al. 2019, *Int. J. Selection & Assessment*,
  https://onlinelibrary.wiley.com/doi/10.1111/ijsa.12233; item-writing guide:
  https://support.testgorilla.com/hc/en-us/articles/9028585383707-Writing-situational-judgement-questions).
- Forced choices only work when the choices are equally desirable
  (https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2017.00806/full).
- On screens people lean to the first option (primacy), so order is mixed per person;
  for a scale, reversing is safer than a full shuffle — the middle stays in the middle
  (https://academic.oup.com/poq/article/72/5/914/1832496,
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9619315/).

## New ideas from the research (not built — your call)

1. **Light "who would you text first" pairs** for Connection / Personal space — fast,
   modern, very low social pressure.
2. **A "skip, not me" tap** on a round question that does not fit someone's life (no
   coworkers, no roommate) — today they must pick something that is not true.
3. **Retire round questions people skip or reroll a lot** — the pool already counts
   \`times_served\`; adding a reroll count per row would show which ones miss.

## Intake (48)

${table(QUESTIONS_BANK_V1, QUESTIONS_BANK, (i) => String(intakeSet[i]))}

## Round-only (22)

${table(ROUND_ONLY_BANK_V1, ROUND_ONLY_BANK, () => 'round')}
`;

writeFileSync(resolve(__dirname, '../docs/proposals/question-rewrite.md'), doc);
console.log('wrote docs/proposals/question-rewrite.md');
