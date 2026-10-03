/**
 * Post-Full-Profile ongoing question loop (§3 point 4; bank-first/AI-fallback
 * wiring is T-02, core loop redesign §2). Run: npm run check:ongoing-round
 */
import assert from 'node:assert/strict';

import type { BankCandidate } from '../src/lib/questions/bank-pool';
import { composeOngoingRound, type ComposeOngoingRoundDeps } from '../src/lib/questions/ongoing-round';
import { ONGOING_ROUND_SIZE } from '../src/lib/questions/tiered-axis-plan';
import { LEGACY_INTAKE_AXIS_COUNTS, ROUND_ONLY_BANK } from '../src/lib/questions/bank';
import type { TraitTrack } from '../src/lib/trait-stability';
import type { QuestionDraft } from '../src/lib/questions/types';
import { TRAIT_AXES, type TraitAxis } from '../src/lib/traits';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

/**
 * Every axis at the 3-answer floor, consistent and answered today: the steady
 * state, where `allocateRound` gives exactly 1 per trait (16). The allocation
 * itself is pinned in tiered-axis-plan-check.ts; these blocks prove the
 * composer follows it for bank AND AI questions. `lastTouched` is now, so the
 * fixture never ages into "decaying" as the calendar moves.
 */
const settledTracks: TraitTrack[] = TRAIT_AXES.map((axis) => ({
  axis,
  track: 'report',
  value: 0.5,
  stability: 0.5,
  answerCount: 3,
  lastTouched: new Date().toISOString(),
  lastDepthAt: null,
}));

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
    const drafts = await composeOngoingRound(me, [], settledTracks, noBankDeps(generated, sawGroundingFact));

    assert.equal(drafts.length, ONGOING_ROUND_SIZE, 'an ongoing round generates the full 16-question allocation');
    for (const axis of TRAIT_AXES) {
      assert.equal(drafts.filter((d) => d.axis === axis).length, 1, `${axis}: the AI is asked for the allocation, never a skewed mix`);
    }
    assert.equal(generated.size, ONGOING_ROUND_SIZE, 'every generated draft is saved immediately, not batched at the end');
    // INVERTED 2026-10-01 (was: a stored fact reaches the prompt). Every question
    // from this prompt is saved to the SHARED question_bank_pool, so text the
    // user typed must never enter it — one user's words could reach another's.
    assert.equal(sawGroundingFact.value, false, 'a stored (user-typed) fact must NOT reach a prompt whose output is saved to the shared pool');
    assert.ok(
      drafts.every((d) => typeof d.bankItemId === 'string' && d.bankItemId.length > 0),
      'every AI-generated draft is written into the bank pool first and carries a bankItemId (§2 Q9)',
    );
    ok('composeOngoingRound: no bank candidates → full 16-question round from AI, one per trait, save-as-you-go, grounded, every draft has a bankItemId');
  }

  {
    // Bank-first: 'playfulness' needs exactly 1 (allocateRound, steady state). Supply
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

    const drafts = await composeOngoingRound(me, [], settledTracks, {
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

    assert.equal(drafts.length, ONGOING_ROUND_SIZE, 'bank-first fill still lands on the full round size');
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

    await composeOngoingRound(me, [], settledTracks, {
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
    // Partial bank coverage: conscientiousness has no answers, so allocateRound
    // gives it 3; the bank has only 1 to give — the other 2 must come from AI.
    const bankDraft: QuestionDraft = {
      axis: 'conscientiousness',
      prompt: 'bank conscientiousness q',
      options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
    };
    let conscientiousnessRequestedCount = 0;
    let seq = 0;

    const noConscientiousness = settledTracks.filter((row) => row.axis !== 'conscientiousness');
    const drafts = await composeOngoingRound(me, [], noConscientiousness, {
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

    assert.equal(drafts.length, ONGOING_ROUND_SIZE, 'partial bank coverage still lands on the full round size');
    assert.equal(
      conscientiousnessRequestedCount,
      2,
      'AI is asked for exactly the shortfall (3 needed - 1 from bank = 2), not the full axis count again',
    );
    const conscientiousnessDrafts = drafts.filter((d) => d.axis === 'conscientiousness');
    assert.equal(conscientiousnessDrafts.length, 3, 'the axis still totals its full allocation (1 bank + 2 AI)');
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
    const drafts = await composeOngoingRound(me, [], settledTracks, {
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

    assert.equal(drafts.length, ONGOING_ROUND_SIZE, 'a recordBankUsage rejection does not abort the round');
    assert.ok(
      drafts.some((d) => d.prompt === 'bank playfulness q, usage-bump fails'),
      'the bank draft is still included even though its usage bump failed',
    );
    ok('composeOngoingRound: a recordBankUsage failure is caught and logged, never fatal to the round');
  }

  {
    // AI generation persistently fails to produce a 'playfulness' draft (the
    // real chunked generator gives up after MAX_SHORTFALL_RETRIES=1 and
    // returns whatever it has, per chunked-generate.ts). The bank-fallback
    // pass added after fillAxisCountsChunked must catch this shortfall and
    // fill it from the shared bank pool instead of silently shipping the
    // round short.
    let playfulnessBankCalls = 0;
    const fallbackBankDraft: QuestionDraft = {
      axis: 'playfulness',
      prompt: 'bank playfulness, ai kept failing',
      options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }],
    };
    let seq = 0;

    const drafts = await composeOngoingRound(me, [], settledTracks, {
      fetchRecentTexts: async () => [],
      fetchBankCandidates: async (axis) => {
        if (axis !== 'playfulness') return [];
        playfulnessBankCalls += 1;
        // First call is the initial bank-first pass (nothing available yet);
        // only the second call, from the new fallback pass, finds a row.
        return playfulnessBankCalls >= 2 ? [{ id: 'bank-fallback', draft: fallbackBankDraft }] : [];
      },
      recordBankUsage: async () => {},
      addToBankPool: async (drafts) => {
        for (const draft of drafts) draft.bankItemId = `ai-${draft.prompt}`;
      },
      generateBatch: async (prompt, count) => {
        const out: QuestionDraft[] = [];
        for (const match of prompt.matchAll(/([a-z_]+) x(\d+)/g)) {
          const axis = match[1] as TraitAxis;
          const n = Number(match[2]);
          if (axis === 'playfulness') continue; // simulated persistent AI shortfall for this axis
          for (let i = 0; i < n; i += 1) {
            out.push({ axis, prompt: `ongoing ${axis} s-${seq}`, options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }] });
            seq += 1;
          }
        }
        void count;
        return out;
      },
      saveItems: async () => {},
    });

    assert.equal(
      drafts.length,
      ONGOING_ROUND_SIZE,
      'a persistent AI shortfall on one axis is still made up by the bank-fallback pass, so the round never ships short',
    );
    assert.ok(
      drafts.some((d) => d.prompt === 'bank playfulness, ai kept failing'),
      'the fallback pass actually pulls the missing axis from the bank pool',
    );
    ok('composeOngoingRound: AI persistently fails an axis → bank-fallback pass fills it, round still lands on the full size');
  }

  {
    // An account that finished the OLD 50: ten traits sit on 2 answers. The
    // round serves each of them first, one apiece (their third), and the
    // twelve moved extras it already answered in the old intake are skipped.
    const oldFifty: TraitTrack[] = settledTracks.map((row) => ({
      ...row,
      answerCount: LEGACY_INTAKE_AXIS_COUNTS[row.axis],
    }));
    const lagging = new Set(oldFifty.filter((row) => row.answerCount < 3).map((row) => row.axis));
    assert.equal(lagging.size, 10);
    const movedExtra = ROUND_ONLY_BANK.find((d) => d.axis === 'openness')!;
    let servedMovedExtra = false;
    const generated = new Map<string, number>();
    const deps = noBankDeps(generated, { value: false });
    const drafts = await composeOngoingRound(me, [], oldFifty, {
      ...deps,
      fetchBankCandidates: async (axis) =>
        axis === 'openness' ? [{ id: 'moved-extra', draft: movedExtra }] : [],
      saveItems: async (items) => {
        for (const item of items) {
          if (item.prompt === movedExtra.prompt) servedMovedExtra = true;
          generated.set(item.prompt, 1);
        }
      },
    });
    assert.equal(drafts.length, ONGOING_ROUND_SIZE, 'still 16');
    for (const axis of lagging) {
      assert.equal(drafts.filter((d) => d.axis === axis).length, 1, `${axis} gets its third question`);
    }
    assert.deepEqual(
      [...new Set(drafts.slice(0, 10).map((d) => d.axis))].sort(),
      [...lagging].sort(),
      'the short traits are served first',
    );
    assert.ok(!servedMovedExtra, 'a moved extra this account answered in the old intake is never served again');
    ok('composeOngoingRound: an old-50 account gets one third question on each short trait, first, and never a moved extra it already answered');
  }

  {
    // A trait the AI AND the bank both fail on: the round is topped up from
    // other traits under the cap, so it still lands on 16 and still pays.
    let seq = 0;
    const drafts = await composeOngoingRound(me, [], settledTracks, {
      fetchRecentTexts: async () => [],
      fetchBankCandidates: async (axis) =>
        axis === 'openness'
          ? []
          : [{ id: `bank-${axis}-${seq}`, draft: { axis, prompt: `bank top-up ${axis} ${seq++}`, options: [{ text: 'a', value: 0.2 }, { text: 'b', value: 0.8 }] } }],
      recordBankUsage: async () => {},
      addToBankPool: async () => {},
      generateBatch: async () => [],
      saveItems: async () => {},
    });
    assert.equal(drafts.length, ONGOING_ROUND_SIZE, 'topped up to 16');
    assert.equal(drafts.filter((d) => d.axis === 'openness').length, 0);
    const perAxis = new Map<string, number>();
    for (const d of drafts) perAxis.set(d.axis, (perAxis.get(d.axis) ?? 0) + 1);
    assert.ok([...perAxis.values()].every((n) => n <= 3), 'the top-up never passes the per-trait cap');
    ok('composeOngoingRound: a trait nobody can fill is replaced from other traits, under the cap — the round is still 16');
  }

  console.log(`\n${passed} ongoing-round checks passed`);
}

void run();
