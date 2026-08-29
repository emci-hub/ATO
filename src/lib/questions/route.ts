import { localYmd } from '@/lib/local-date';
import type { QuotaDecision } from '@/lib/voice/quota';

import { pickQuestionGrounding } from './context';
import { composeLocalQuestionBatch } from './local';
import { buildQuestionsPrompt } from './prompt';
import type {
  QuestionDraft,
  QuestionItemRow,
  QuestionPackRow,
  RouteQuestionsInput,
  RouteQuestionsResult,
} from './types';

export function nextUnansweredItem(pack: QuestionPackRow | null): QuestionItemRow | null {
  if (!pack) return null;
  return pack.items.find((item) => item.answeredOption == null) ?? null;
}

export interface RouteQuestionsDeps {
  loadLatestPack?: () => Promise<QuestionPackRow | null>;
  savePack?: (input: {
    generatedOn: string;
    drafts: QuestionDraft[];
  }) => Promise<QuestionPackRow>;
  claimBatch?: () => Promise<QuotaDecision>;
  generateBatch?: (prompt: string) => Promise<QuestionDraft[] | null>;
  useLocal?: boolean;
}

function packForToday(pack: QuestionPackRow | null, today: string): QuestionPackRow | null {
  if (!pack) return null;
  return pack.generatedOn === today ? pack : null;
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
  const open = nextUnansweredItem(todays);
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

  const grounding = pickQuestionGrounding(input.me, input.history);
  let drafts: QuestionDraft[] | null = null;
  if (useLocal || !deps.generateBatch) {
    drafts = composeLocalQuestionBatch();
  } else {
    drafts = await deps.generateBatch(buildQuestionsPrompt({ me: input.me, grounding }));
  }
  if (!drafts || drafts.length === 0) {
    return { kind: 'empty', pack: todays, item: null };
  }

  if (!deps.savePack) {
    const pack: QuestionPackRow = {
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
      })),
    };
    return { kind: 'item', pack, item: pack.items[0] ?? null };
  }

  const pack = await deps.savePack({ generatedOn: today, drafts });
  return { kind: 'item', pack, item: nextUnansweredItem(pack) };
}
