import { localYmd } from '@/lib/local-date';
import { isFullProfileDone } from '@/lib/full-profile-gate';
import { isProfileComplete, unfilledAxes } from '@/lib/trait-stability';
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

/**
 * First open item in today's pack matching one of the wanted axes (a
 * category pick or a focusAxis deep-link). Lets an explicit priority survive
 * the cached-pack short-circuit below instead of always serving whatever
 * happens to be first in item order.
 */
function openItemForAxes(
  pack: QuestionPackRow | null,
  axes: readonly TraitAxis[],
): QuestionItemRow | null {
  if (!pack || axes.length === 0) return null;
  const wanted = new Set(axes);
  return (
    pack.items.find(
      (item) =>
        wanted.has(item.axis) && isOpenQuestionItem(item) && questionDraftGuardHit(item) == null,
    ) ?? null
  );
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
  priorityAxes: readonly TraitAxis[] = [],
  forceLocal = false,
): Promise<QuestionDraft[] | null> {
  const grounding = pickQuestionGrounding(input.me, input.history);
  const promptArgs = {
    me: input.me,
    grounding,
    recentAxes,
    priorityAxes,
    tracks: input.tracks ?? [],
  };

  if (forceLocal || deps.useLocal === true || !deps.generateBatch) {
    // `input.tracks` chooses each axis's draft by its own answer count, so a
    // person served the bank on consecutive days does not see one frozen
    // question per axis forever.
    const local = composeLocalQuestionBatch(recentAxes, priorityAxes, input.tracks ?? []);
    return preferFreshAxes(
      keepGuardedDrafts(local).kept,
      recentAxes,
      priorityAxes,
      input.tracks ?? [],
      input.now ?? new Date(),
    );
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

  const rotated = preferFreshAxes(
    kept,
    recentAxes,
    priorityAxes,
    input.tracks ?? [],
    input.now ?? new Date(),
  );
  return rotated.length > 0 ? rotated : null;
}

/**
 * On-demand batch of 5. Serve unanswered cache; regen when exhausted or
 * a new local day. Answering does not claim quota.
 *
 * AI-consent gated (restored 2026-09-15, emci correction). Regenerating a
 * pack calls a model, and with no dedicated Sage-talk screen built yet this
 * IS one of the app's three real AI touchpoints -- so it requires consent,
 * exactly as it did before the gate was briefly removed earlier the same day.
 * Callers render QUESTIONS_EMPTY_CONSENT / _DENIED for the two consent kinds.
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
  // Phase 6: contradicted axes must lead a cached-item lookup exactly like
  // priorityAxes already does — omitted here would be a landmine the moment
  // a real caller sets contradictedAxes, since it would silently fall through
  // to nextPlayableItem below and never actually get served sooner.
  const wantedAxes = [...(input.contradictedAxes ?? []), ...(input.priorityAxes ?? [])];
  // An explicit priority (category pick, focusAxis deep-link, deferred axes)
  // must not silently fall back to an unrelated open item — that is the bug
  // this branch exists to avoid. No match in today's pack falls through to
  // the regeneration path below instead, which already honors priorityAxes
  // and the existing local/quota gating.
  const open = wantedAxes.length > 0 ? openItemForAxes(todays, wantedAxes) : nextPlayableItem(todays);
  if (todays && open) {
    return { kind: 'cached', pack: todays, item: open };
  }

  // Profile-completeness gate. Until every axis has at least one answer, the
  // batch is served from the static bank: no model call, and no quota claim
  // either — a thin profile must never spend a paid call. Sits after
  // consent/crisis so those keep their existing precedence and messaging.
  // Sage chat was a separate path; its backend was retired 2026-09-14.
  //
  // TIGHTENED (ISOLATION_PLAN §7, 2026-09-15, reviewer catch): the gate is now
  // BOTH the old completeness rule AND the one shared unlock signal
  // (`isFullProfileDone` — every bank question answered). They disagreed:
  // `isProfileComplete` passes once each of the 16 axes has a single answer,
  // which a user reaches roughly 20 questions in — long before Load insight,
  // Load story or Load categories unlock. Expanding the Questions fold out of
  // curiosity at that point would claim quota and generate a batch, which is
  // the only way left to spend a paid call while every visible unlock is still
  // locked. Below the shared gate, the batch comes from the static bank.
  const profileComplete =
    isProfileComplete(input.tracks ?? []) && isFullProfileDone(input.tracks ?? [], true);
  const useLocal = deps.useLocal === true || !profileComplete;
  if (!useLocal && deps.claimBatch && deps.generateBatch) {
    const claim = await deps.claimBatch();
    if (!claim.ok) {
      return { kind: 'quota', pack: todays, item: null };
    }
  }

  const recent = recentAskedAxes(existing);
  // The caller's priority list can be stale for one render right after an
  // answer lands server-side. Never force a just-answered axis to the front
  // of the regenerated batch — it has a trait value now.
  const answeredInPack = new Set(
    (existing?.items ?? [])
      .filter((item) => item.answeredOption != null)
      .map((item) => item.axis),
  );
  // An incomplete profile covers its unfilled axes first; contradicted axes
  // (Phase 6 — caller-computed, unused by any caller yet) follow, ahead of
  // the caller's own deferred-axis priorities. Duplicates collapse, and a
  // just-answered axis is still never forced to the front. Contradiction can
  // exist regardless of completeness (an axis needs >=2 answers to
  // contradict, so it never overlaps unfilledAxes), hence it's included in
  // both branches.
  const wanted = profileComplete
    ? [...(input.contradictedAxes ?? []), ...(input.priorityAxes ?? [])]
    : [
        ...unfilledAxes(input.tracks ?? []),
        ...(input.contradictedAxes ?? []),
        ...(input.priorityAxes ?? []),
      ];
  const priorityAxes = [...new Set(wanted)].filter((axis) => !answeredInPack.has(axis));
  const drafts = await guardedBatch(input, deps, recent, priorityAxes, useLocal);
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
