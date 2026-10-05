/**
 * LIVE forever-loop check (2026-10-05). Excluded from the gate; run by hand:
 *   npm run check:question-live            (5 questions, one call)
 *   npm run check:question-live -- 3 2     (3 questions per call, 2 calls)
 *
 * Signs in (scripts/live-ai.ts: ATO_LIVE_EMAIL / ATO_LIVE_PASSWORD from
 * .env.local), sends the exact round prompt for N traits through the real
 * path (ai-generate, server key, server quota), runs every question through
 * the voice gate and prints it with its options, values and per-rule result.
 * Costs one quota unit per call. Nothing is saved.
 *
 * Fails (exit 1) if the reply never parses, or if fewer than half of the
 * questions would be shown — that is the signal the prompt needs work.
 */
import { QUESTIONS_BANK } from '../src/lib/questions/bank';
import { buildLabPrompt, judgeLabOutput, labAxes } from '../src/lib/questions/question-lab';

import { completeViaEdgeLive, signInForLiveAi } from './live-ai';

async function main() {
  const size = Math.max(1, Math.min(8, Number(process.argv[2]) || 5));
  const calls = Math.max(1, Math.min(4, Number(process.argv[3]) || 1));
  const session = await signInForLiveAi();
  console.log(`signed in as ${session.email}; ${calls} call(s) of ${size}\n`);

  const recent = QUESTIONS_BANK.map((q) => q.prompt);
  let shown = 0;
  let total = 0;
  let parsedAny = false;
  for (let turn = 0; turn < calls; turn += 1) {
    const axes = labAxes(size, turn + Math.floor(Date.now() / 86_400_000));
    const text = await completeViaEdgeLive(session, 'gemini', {
      prompt: buildLabPrompt(axes, recent),
      temperature: 0.9,
      maxOutputTokens: 2048,
      responseFormat: 'json',
    });
    const result = judgeLabOutput(text, size, recent);
    if (result.parseFailed) {
      console.log(`call ${turn + 1}: reply did not parse\n${text.slice(0, 400)}\n`);
      continue;
    }
    parsedAny = true;
    for (const v of result.verdicts) {
      total += 1;
      if (!v.failure) shown += 1;
      console.log(`${v.failure ? '✗ DROPPED' : '✓ shown  '}  [${v.draft.axis}]  ${v.draft.prompt}`);
      for (const o of v.draft.options) console.log(`      · ${o.text}  (${o.value})`);
      for (const issue of v.issues) console.log(`      ${issue.kind === 'hard' || issue.rule === 'balance' ? '✗' : '~'} ${issue.rule}: ${issue.detail}`);
      recent.push(v.draft.prompt);
    }
    console.log('');
  }
  console.log(`${shown} of ${total} would be shown.`);
  if (!parsedAny || shown * 2 < total) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
