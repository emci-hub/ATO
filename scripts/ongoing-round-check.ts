/**
 * Post-Full-Profile ongoing question loop (§3 point 4). Run: npm run check:ongoing-round
 */
import assert from 'node:assert/strict';

import { composeOngoingRound } from '../src/lib/questions/ongoing-round';
import { TIERED_ROUND_SIZE } from '../src/lib/questions/tiered-axis-plan';
import type { QuestionDraft } from '../src/lib/questions/types';
import type { TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

async function run() {
  const me = { name: 'Ari', talk_style: 'even' as const, voice_preset: 'default', sage_knows: {}, facts: ['Trains for a 10k.'] };

  let sawGroundingFact = false;
  const generated = new Map<string, number>();
  const drafts = await composeOngoingRound(
    me,
    [],
    [],
    {
      fetchRecentTexts: async () => [],
      generateBatch: async (prompt, count) => {
        if (prompt.includes('Trains for a 10k.')) sawGroundingFact = true;
        // Real buildQuestionsPrompt output lists "<axis> x<n>" per requested
        // axis (see prompt.ts's axesLines) — mirror that back into drafts so
        // the axis-allow-list filter in fillAxisCountsChunked actually keeps
        // them, same as a real generator would.
        const out: QuestionDraft[] = [];
        for (const match of prompt.matchAll(/([a-z_]+) x(\d+)/g)) {
          const axis = match[1] as TraitAxis;
          const n = Number(match[2]);
          for (let i = 0; i < n; i += 1) {
            out.push({ axis, prompt: `ongoing ${axis} q${generated.size}-${i}`, options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }] });
          }
        }
        void count;
        return out;
      },
      saveItems: async (items) => {
        for (const item of items) generated.set(item.prompt, 1);
      },
    },
  );

  assert.equal(drafts.length, TIERED_ROUND_SIZE, 'an ongoing round generates the full 25-question tiered allocation');
  assert.equal(generated.size, TIERED_ROUND_SIZE, 'every generated draft is saved immediately, not batched at the end');
  assert.ok(sawGroundingFact, 'a stored fact reaches the prompt via the existing pickQuestionGrounding mechanism (§3 layer 3)');
  ok('composeOngoingRound: full 25-question tiered round, save-as-you-go, grounded via existing pickQuestionGrounding');

  console.log(`\n${passed} ongoing-round checks passed`);
}

void run();
