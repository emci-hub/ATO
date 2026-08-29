import { localYmd } from '@/lib/local-date';
import type { TraitAxis } from '@/lib/traits';
import type { QuotaDecision } from '@/lib/voice/quota';
import { PHRASE_FLAG_CLOSING, PHRASE_FLAG_REFRAME, PHRASE_FLAG_TYPE } from '@/lib/voice/phrase-guard';

import { pickQuestionGrounding } from './context';
import { keepGuardedDrafts, questionDraftGuardHit } from './guards';
import { composeLocalQuestionBatch } from './local';
import { buildQuestionsPrompt } from './prompt';
import { isOpenQuestionItem, preferFreshAxes, recentAskedAxes } from './rotation';
import { QUESTIONS_BATCH_SIZE } from './types';
import type {
  QuestionDraft,
  QuestionItemRow,
  QuestionPackRow,
  RouteQuestionsInput,
  RouteQuestionsResult,
} from './types';

export function nextUnansweredItem(pack: QuestionPackRow | null): QuestionItemRow | null {
  if (!pack) return null;
  return pack.items.find((item) => isOpenQuestionItem(item)) ?? null;
}

export function nextPlayableItem(pack: QuestionPackRow | null): QuestionItemRow | null {
  if (!pack) return null;
  return (
    pack.items.find(
      (item) => isOpenQuestionItem(item) && questionDraftGuardHit(item) == null,
    ) ?? null
  );
}

export interface RouteQuestionsDeps {
  loadLatestPack?: () => Promise<QuestionPackRow | null>;
  savePack?: (input: {
    generatedOn: string;
    drafts: QuestionDraft[];
  }) => Promise<QuestionPackRow>;
  claimBatch?: () => Promise<QuotaDecision>;
  generateBatch?: (prompt: string) => Promise<QuestionDraft[] | null>;
  logJargonHit?: (flag: string) => Promise<void>;
  logPhraseHit?: (flag: string) => Promise<void>;
  useLocal?: boolean;
}

function packForToday(pack: QuestionPackRow | null, today: string): QuestionPackRow | null {
  if (!pack) return null;
  return pack.generatedOn === today ? pack : null;
}

function asPack(
  today: string,
  now: Date,
  drafts: QuestionDraft[],
): QuestionPackRow {
  return {
    id: 'local',
    generatedOn: today,
    createdAt: now.toISOString(),
    items: drafts.map((draft, index) => ({
      id: `local-${index}`,
      packId: 'local',
      sortIndex: index,
      axis: draft.axis,
      prompt: draft.prompt,
      options: draft.options,
      answeredOption: null,
      skippedAt: null,
    })),
  };
}

async function logGuardHits(
  deps: RouteQuestionsDeps,
  hits: string[],
): Promise<void> {
  for (const hit of hits) {
    if (hit === 'framework-echo') continue;
    if (
      hit === PHRASE_FLAG_REFRAME ||
      hit === PHRASE_FLAG_CLOSING ||
      hit === PHRASE_FLAG_TYPE
    ) {
      await deps.logPhraseHit?.(hit).catch(() => {});
    } else {
      await deps.logJargonHit?.(hit).catch(() => {});
    }
  }
}

async function guardedBatch(
  input: RouteQuestionsInput,
  deps: RouteQuestionsDeps,
  recentAxes: TraitAxis[],
): Promise<QuestionDraft[] | null> {
  const grounding = pickQuestionGrounding(input.me, input.history);
  const promptArgs = {
    me: input.me,
    grounding,
    recentAxes,
  };

  if (deps.useLocal === true || !deps.generateBatch) {
    const local = composeLocalQuestionBatch(recentAxes);
    return preferFreshAxes(keepGuardedDrafts(local).kept, recentAxes);
  }

  const first = await deps.generateBatch(buildQuestionsPrompt(promptArgs));
  let { kept, hits } = keepGuardedDrafts(first ?? []);
  await logGuardHits(deps, hits);

  if (kept.length < QUESTIONS_BATCH_SIZE) {
    const retry = await deps.generateBatch(
      buildQuestionsPrompt({ ...promptArgs, retryHint: true }),
    );
    const again = keepGuardedDrafts(retry ?? []);
    await logGuardHits(deps, again.hits);
    const seen = new Set(kept.map((draft) => draft.axis));
    for (const draft of again.kept) {
      if (seen.has(draft.axis)) continue;
      seen.add(draft.axis);
      kept.push(draft);
    }
  }

  const rotated = preferFreshAxes(kept, recentAxes);
  return rotated.length > 0 ? rotated : null;
}

/**
 * On-demand batch of 5. Serve unanswered cache; regen when exhausted or
 * a new local day. Answering does not claim quota.
 */
export async function routeQuestions(
  input: RouteQuestionsInput,
  deps: RouteQuestionsDeps = {},
): Promise<RouteQuestionsResult> {
  const consent = input.aiConsent ?? null;
  if (consent === false) {
    return { kind: 'consent-denied', pack: null, item: null };
  }
  if (consent !== true) {
    return { kind: 'consent-pending', pack: null, item: null };
  }
  if (input.crisisToday) {
    return { kind: 'crisis', pack: null, item: null };
  }

  const now = input.now ?? new Date();
  const today = localYmd(now, input.me.timezone || 'UTC');
  const existing = deps.loadLatestPack ? await deps.loadLatestPack() : null;
  const todays = packForToday(existing, today);
  const open = nextPlayableItem(todays);
  if (todays && open) {
    return { kind: 'cached', pack: todays, item: open };
  }

  const useLocal = deps.useLocal === true;
  if (!useLocal && deps.claimBatch && deps.generateBatch) {
    const claim = await deps.claimBatch();
    if (!claim.ok) {
      return { kind: 'quota', pack: todays, item: null };
    }
  }

  const recent = recentAskedAxes(existing);
  const drafts = await guardedBatch(input, deps, recent);
  if (!drafts || drafts.length === 0) {
    return { kind: 'empty', pack: todays, item: null };
  }

  if (!deps.savePack) {
    const pack = asPack(today, now, drafts);
    return { kind: 'item', pack, item: nextPlayableItem(pack) };
  }

  const pack = await deps.savePack({ generatedOn: today, drafts });
  return { kind: 'item', pack, item: nextPlayableItem(pack) };
}
