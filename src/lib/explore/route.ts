import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { matchingJargonTerm } from '@/lib/voice/jargon';
import { matchingPhrasePattern } from '@/lib/voice/phrase-guard';
import type { QuotaDecision } from '@/lib/voice/quota';
import {
  appendTraceStep,
  clipTraceText,
  libraryLinesFor,
  summarizeLibrary,
  summarizeMe,
  traitSignalsFromMe,
  traceGuardResult,
  type DevTraceRecordInput,
  type DevTraceStep,
} from '@/lib/dev-trace';

import { decideExploreTrigger, exploreToday } from './cadence';
import { exploreFingerprint, pickExplorePackFocuses } from './combine';
import { EXPLORE_GUARD_FALLBACK } from './copy';
import { composeLocalExplore } from './local';
import { buildExplorePrompt } from './prompt';
import type {
  ExploreDraft,
  ExploreFocus,
  ExplorePackRow,
  RouteExploreInput,
  RouteExploreResult,
} from './types';

const FENCE_ATTEMPTS = 2;

export interface RouteExploreDeps {
  loadLatestPack?: () => Promise<ExplorePackRow | null>;
  savePack?: (input: {
    generatedOn: string;
    trigger: NonNullable<RouteExploreResult['trigger']>;
    fingerprint: string;
    drafts: ExploreDraft[];
  }) => Promise<ExplorePackRow>;
  loadMissNotes?: () => Promise<string[]>;
  claimAiCall?: () => Promise<QuotaDecision>;
  logJargonHit?: (flag: string) => Promise<void>;
  logPhraseHit?: (flag: string) => Promise<void>;
  generateBody?: (prompt: string) => Promise<string | null>;
  /** Tests / no-key: skip the model. */
  useLocal?: boolean;
  recordTrace?: (input: DevTraceRecordInput) => Promise<void>;
}

function applyOutputGuards(body: string): {
  body: string;
  jargon: string | null;
  phrase: string | null;
} {
  const jargon = matchingJargonTerm(body);
  const phrase = matchingPhrasePattern(body);
  if (jargon || phrase) {
    return { body: EXPLORE_GUARD_FALLBACK, jargon, phrase };
  }
  return { body, jargon: null, phrase: null };
}

/**
 * Periodic Explore pack. Cached between regenerations. 1 regen / local day.
 * Does not write traits. Does not call Read/Do/Talk routers.
 */
export async function routeExplore(
  input: RouteExploreInput,
  deps: RouteExploreDeps = {},
): Promise<RouteExploreResult> {
  const consent = input.aiConsent ?? null;
  if (consent === false) {
    return { kind: 'consent-denied', pack: null };
  }
  if (consent !== true) {
    return { kind: 'consent-pending', pack: null };
  }
  if (input.crisisToday) {
    return { kind: 'crisis', pack: null };
  }

  const today = exploreToday(input.me.timezone, input.now);
  const fingerprint = exploreFingerprint(
    input.me,
    input.history,
    input.me.traitTouchedAt,
  );
  const existing = deps.loadLatestPack ? await deps.loadLatestPack() : null;
  const trigger = decideExploreTrigger({ pack: existing, today, fingerprint });

  if (!trigger) {
    return { kind: 'cached', pack: existing };
  }

  const focuses = pickExplorePackFocuses(input.me, input.history);
  const notes = deps.loadMissNotes ? await deps.loadMissNotes() : [];
  const useLocal = deps.useLocal === true;

  if (!useLocal && deps.claimAiCall && deps.generateBody) {
    const claim = await deps.claimAiCall();
    if (!claim.ok) {
      return existing
        ? { kind: 'cached', pack: existing }
        : { kind: 'quota', pack: null };
    }
  }

  const drafts: ExploreDraft[] = [];
  for (const focus of focuses) {
    if (useLocal || !deps.generateBody) {
      const local = composeLocalExplore(input.me, focus);
      drafts.push(local);
      await emitExploreTrace(deps, input, focus, {
        modelLabel: 'Local compose (no model)',
        rawBefore: local.body,
        rawAfter: local.body,
        guardHits: [],
      });
      continue;
    }

    let body: string | null = null;
    let rawBefore: string | null = null;
    let fenceHit: string | null = null;
    let jargonHit: string | null = null;
    let phraseHit: string | null = null;
    for (let attempt = 1; attempt <= FENCE_ATTEMPTS; attempt += 1) {
      const prompt = buildExplorePrompt({
        me: input.me,
        focus,
        reactionNotes: notes,
        retryHint: attempt > 1,
      });
      const candidate = await deps.generateBody(prompt);
      if (!candidate) break;
      rawBefore = candidate;
      if (containsFrameworkTerm(candidate)) {
        fenceHit = 'framework-echo';
        continue;
      }
      fenceHit = null;
      const guarded = applyOutputGuards(candidate);
      jargonHit = guarded.jargon;
      phraseHit = guarded.phrase;
      if (guarded.jargon) {
        await deps.logJargonHit?.(guarded.jargon).catch(() => {});
      }
      if (guarded.phrase) {
        await deps.logPhraseHit?.(guarded.phrase).catch(() => {});
      }
      body = guarded.body;
      break;
    }
    if (body) {
      drafts.push({
        body,
        traits: focus.traits,
        chips: focus.chips,
        signalKind: focus.signal?.kind ?? null,
      });
    }
    await emitExploreTrace(deps, input, focus, {
      modelLabel: 'Explore generate',
      rawBefore,
      rawAfter: body,
      guardHits: [fenceHit, jargonHit, phraseHit],
    });
  }

  if (drafts.length === 0) {
    return { kind: 'empty', pack: existing, trigger };
  }

  if (!deps.savePack) {
    return {
      kind: 'pack',
      trigger,
      pack: {
        id: 'local',
        generatedOn: today,
        trigger,
        fingerprint,
        createdAt: new Date().toISOString(),
        entries: drafts.map((draft, index) => ({
          id: `local-${index}`,
          packId: 'local',
          sortIndex: index,
          body: draft.body,
          traits: draft.traits,
          chips: draft.chips,
          signalKind: draft.signalKind,
          landed: null,
        })),
      },
    };
  }

  const pack = await deps.savePack({
    generatedOn: today,
    trigger,
    fingerprint,
    drafts,
  });
  return { kind: 'pack', pack, trigger };
}

async function emitExploreTrace(
  deps: RouteExploreDeps,
  input: RouteExploreInput,
  focus: ExploreFocus,
  payload: {
    modelLabel: string;
    rawBefore: string | null;
    rawAfter: string | null;
    guardHits: Array<string | null | undefined>;
  },
): Promise<void> {
  if (!deps.recordTrace) return;
  const library = libraryLinesFor(input.me, { day: 1, surface: 'card' });
  const signal = focus.signal
    ? `${focus.signal.kind}: ${clipTraceText(focus.signal.detail, 80)}`
    : 'no signal';
  const traitLine = focus.traits.length ? focus.traits.join(',') : 'none';
  const chipLine = focus.chips.length ? focus.chips.join(',') : 'none';
  const steps: DevTraceStep[] = [];
  appendTraceStep(steps, {
    step_type: 'context_gather',
    label: 'Traits + signal + Library',
    input_summary: summarizeMe(input.me),
    output_summary: `traits=${traitLine} · chips=${chipLine} · ${signal} · ${summarizeLibrary(library)}`,
    status: 'ok',
  });
  appendTraceStep(steps, {
    step_type: 'model_call',
    label: payload.modelLabel,
    input_summary: `traits=${traitLine} · ${signal}`,
    output_summary: payload.rawBefore ?? 'empty draft',
    status: payload.rawBefore ? 'ok' : 'failed',
  });
  const guard = traceGuardResult(payload.guardHits);
  appendTraceStep(steps, {
    step_type: 'guard_check',
    label: 'Fence / jargon / phrase',
    input_summary: payload.rawBefore ?? '—',
    output_summary: guard.output_summary,
    status: guard.status,
  });
  appendTraceStep(steps, {
    step_type: 'output',
    label: 'Explore observation',
    input_summary: payload.rawBefore ?? '—',
    output_summary: payload.rawAfter ?? 'nothing shown',
    status: payload.rawAfter ? 'ok' : 'failed',
  });
  await deps
    .recordTrace({
      surface: 'explore',
      libraryLines: library,
      traitSignals: {
        axes: traitSignalsFromMe(input.me),
        focusTraits: focus.traits,
        chips: focus.chips,
        signal: focus.signal,
      },
      rawBefore: payload.rawBefore,
      rawAfter: payload.rawAfter,
      guardFired: guard.guardFired,
      steps,
    })
    .catch(() => {});
}
