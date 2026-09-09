/**
 * Post-Full-Profile ongoing question loop (§3 point 4; bank-first/AI-fallback
 * wiring is T-02, core loop redesign §2). Run: npm run check:ongoing-round
 */
import assert from 'node:assert/strict';

import type { BankCandidate } from '../src/lib/questions/bank-pool';
import { composeOngoingRound, type ComposeOngoingRoundDeps } from '../src/lib/questions/ongoing-round';
import { TIERED_ROUND_SIZE } from '../src/lib/questions/tiered-axis-plan';
import type { QuestionDraft } from '../src/lib/questions/types';
import type { TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const me = { name: 'Ari', talk_style: 'even' as const, voice_preset: 'default', sage_knows: {}, facts: ['Trains for a 10k.'] };

/** A no-bank-candidates deps baseline — every question comes from AI, same as the pre-T-02 stub-only behavior. */
function noBankDeps(generated: Map<string, number>, sawGroundingFact: { value: boolean }): ComposeOngoingRoundDeps {
  return {
    fetchRecentTexts: async () => [],
    fetchBankCandidates: async () => [],
    recordBankUsage: async () => {},
    addToBankPool: async (drafts) => {
      for (const draft of drafts) draft.bankItemId = `ai-${draft.prompt}`;
    },
    generateBatch: async (prompt, count) => {
      if (prompt.includes('Trains for a 10k.')) sawGroundingFact.value = true;
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
  };
}

async function run() {
  {
    const sawGroundingFact = { value: false };
    const generated = new Map<string, number>();
    const drafts = await composeOngoingRound(me, [], [], noBankDeps(generated, sawGroundingFact));

    assert.equal(drafts.length, TIERED_ROUND_SIZE, 'an ongoing round generates the full 25-question tiered allocation');
    assert.equal(generated.size, TIERED_ROUND_SIZE, 'every generated draft is saved immediately, not batched at the end');
    assert.ok(sawGroundingFact.value, 'a stored fact reaches the prompt via the existing pickQuestionGrounding mechanism (§3 layer 3)');
    assert.ok(
      drafts.every((d) => typeof d.bankItemId === 'string' && d.bankItemId.length > 0),
      'every AI-generated draft is written into the bank pool first and carries a bankItemId (§2 Q9)',
    );
    ok('composeOngoingRound: no bank candidates → full 25-question tiered round from AI, save-as-you-go, grounded, every draft has a bankItemId');
  }

  {
    // Bank-first: 'playfulness' needs exactly 1 (AXIS_TIER_COUNTS). Supply
    // one bank candidate for it and confirm the AI generator is never even
    // asked for that axis, and the bank draft's own id survives unmutated.
    const bankDraft: QuestionDraft = {
      axis: 'playfulness',
      prompt: 'bank playfulness q',
      options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
    };
    const bankCandidate: BankCandidate = { id: 'bank-1', draft: bankDraft };
    const generated = new Map<string, number>();
    const recordedUsage: string[][] = [];
    let sawPlayfulnessInPrompt = false;

    const drafts = await composeOngoingRound(me, [], [], {
      fetchRecentTexts: async () => [],
      fetchBankCandidates: async (axis) => (axis === 'playfulness' ? [bankCandidate] : []),
      recordBankUsage: async (ids) => {
        recordedUsage.push([...ids]);
      },
      addToBankPool: async (drafts) => {
        for (const draft of drafts) draft.bankItemId = `ai-${draft.prompt}`;
      },
      generateBatch: async (prompt, count) => {
        if (/playfulness x/.test(prompt)) sawPlayfulnessInPrompt = true;
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
    });

    assert.equal(drafts.length, TIERED_ROUND_SIZE, 'bank-first fill still lands on the full tiered round size');
    assert.ok(!sawPlayfulnessInPrompt, 'an axis fully covered by the bank is never sent to AI generation');
    const bankDraftOut = drafts.find((d) => d.prompt === 'bank playfulness q');
    assert.ok(bankDraftOut, 'the bank-drawn draft is included in the round');
    assert.equal(bankDraftOut!.bankItemId, 'bank-1', 'a bank-drawn draft keeps its own bank row id, unmutated');
    assert.deepEqual(recordedUsage, [['bank-1']], 'recordBankUsage is called with exactly the bank ids actually used');
    assert.ok(generated.has('bank playfulness q'), 'bank-drawn drafts are saved immediately, same as AI-generated ones');
    ok('composeOngoingRound: bank-first — a fully-covered axis skips AI generation entirely and keeps its bank id');
  }

  {
    // A bank candidate whose text is already in the recent-text window must
    // be skipped (near-duplicate), falling through to AI for that slot.
    const dupDraft: QuestionDraft = {
      axis: 'playfulness',
      prompt: 'already asked this one',
      options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
    };
    const generated = new Map<string, number>();
    let sawPlayfulnessInPrompt = false;

    await composeOngoingRound(me, [], [], {
      fetchRecentTexts: async () => ['already asked this one'],
      fetchBankCandidates: async (axis) => (axis === 'playfulness' ? [{ id: 'bank-dup', draft: dupDraft }] : []),
      recordBankUsage: async () => {},
      addToBankPool: async (drafts) => {
        for (const draft of drafts) draft.bankItemId = `ai-${draft.prompt}`;
      },
      generateBatch: async (prompt, count) => {
        if (/playfulness x/.test(prompt)) sawPlayfulnessInPrompt = true;
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
    });

    assert.ok(sawPlayfulnessInPrompt, 'a near-duplicate bank candidate is rejected, so AI still gets asked to fill that slot');
    ok('composeOngoingRound: bank candidate matching recentText is skipped as a near-duplicate, AI fills the shortfall');
  }

  {
    // Partial bank coverage: conscientiousness wants 3 (AXIS_TIER_COUNTS),
    // the bank has only 1 to give — the other 2 must still come from AI.
    const bankDraft: QuestionDraft = {
      axis: 'conscientiousness',
      prompt: 'bank conscientiousness q',
      options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
    };
    let conscientiousnessRequestedCount = 0;
    let seq = 0;

    const drafts = await composeOngoingRound(me, [], [], {
      fetchRecentTexts: async () => [],
      fetchBankCandidates: async (axis) =>
        axis === 'conscientiousness' ? [{ id: 'bank-partial', draft: bankDraft }] : [],
      recordBankUsage: async () => {},
      addToBankPool: async (drafts) => {
        for (const draft of drafts) draft.bankItemId = `ai-${draft.prompt}`;
      },
      generateBatch: async (prompt, count) => {
        for (const match of prompt.matchAll(/conscientiousness x(\d+)/g)) {
          conscientiousnessRequestedCount += Number(match[1]);
        }
        const out: QuestionDraft[] = [];
        // `seq` (not a per-call-reset index) keeps every generated prompt's
        // text unique across chunks — an axis whose count spans two chunks
        // (e.g. extraversion x2 then x1) must not produce the same text
        // twice, or the real isNearDuplicate filter correctly rejects the
        // second occurrence as a duplicate and the round comes up short.
        for (const match of prompt.matchAll(/([a-z_]+) x(\d+)/g)) {
          const axis = match[1] as TraitAxis;
          const n = Number(match[2]);
          for (let i = 0; i < n; i += 1) {
            out.push({ axis, prompt: `ongoing ${axis} p-${seq}`, options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }] });
            seq += 1;
          }
        }
        void count;
        return out;
      },
      saveItems: async () => {},
    });

    assert.equal(drafts.length, TIERED_ROUND_SIZE, 'partial bank coverage still lands on the full tiered round size');
    assert.equal(
      conscientiousnessRequestedCount,
      2,
      'AI is asked for exactly the shortfall (3 needed - 1 from bank = 2), not the full axis count again',
    );
    const conscientiousnessDrafts = drafts.filter((d) => d.axis === 'conscientiousness');
    assert.equal(conscientiousnessDrafts.length, 3, 'the axis still totals its full tiered count (1 bank + 2 AI)');
    ok('composeOngoingRound: partial bank coverage — the AI fallback fills only the exact shortfall, not the whole axis');
  }

  {
    // A recordBankUsage failure must not abort the round — it's an
    // informational counter, not load-bearing for correctness.
    const bankDraft: QuestionDraft = {
      axis: 'playfulness',
      prompt: 'bank playfulness q, usage-bump fails',
      options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
    };

    let seq = 0;
    const drafts = await composeOngoingRound(me, [], [], {
      fetchRecentTexts: async () => [],
      fetchBankCandidates: async (axis) =>
        axis === 'playfulness' ? [{ id: 'bank-fails-usage', draft: bankDraft }] : [],
      recordBankUsage: async () => {
        throw new Error('simulated recordBankUsage failure');
      },
      addToBankPool: async (drafts) => {
        for (const draft of drafts) draft.bankItemId = `ai-${draft.prompt}`;
      },
      generateBatch: async (prompt) => {
        const out: QuestionDraft[] = [];
        for (const match of prompt.matchAll(/([a-z_]+) x(\d+)/g)) {
          const axis = match[1] as TraitAxis;
          const n = Number(match[2]);
          for (let i = 0; i < n; i += 1) {
            out.push({ axis, prompt: `ongoing ${axis} r-${seq}`, options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }] });
            seq += 1;
          }
        }
        return out;
      },
      saveItems: async () => {},
    });

    assert.equal(drafts.length, TIERED_ROUND_SIZE, 'a recordBankUsage rejection does not abort the round');
    assert.ok(
      drafts.some((d) => d.prompt === 'bank playfulness q, usage-bump fails'),
      'the bank draft is still included even though its usage bump failed',
    );
    ok('composeOngoingRound: a recordBankUsage failure is caught and logged, never fatal to the round');
  }

  console.log(`\n${passed} ongoing-round checks passed`);
}

void run();
