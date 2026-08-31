import {
  appendTraceStep,
  libraryLinesFor,
  summarizeChecks,
  summarizeLibrary,
  summarizeMe,
  traitSignalsFromMe,
  traceGuardResult,
  type DevTraceRecordInput,
  type DevTraceStep,
  type DevTraceStepStatus,
} from '@/lib/dev-trace';

import { bankCardForMe } from './bank';
import {
  BANK_CARD_DAYS,
  GENERATED_MAX_ATTEMPTS,
  VOICE_CONFIG,
  type VoiceConfig,
} from './config';
import { filterCard, hasCut } from './filters';
import { containsFrameworkTerm } from './framework-fence';
import { applyJargonFallback, jargonInCard } from './jargon';
import { resolveNudge } from './nudge';
import { buildProviders } from './providers';
import type { VoiceProvider } from './providers/types';
import { pickDawnReadCategory } from '@/lib/dawn-category';
import type {
  CheckHistory,
  DevTrace,
  ProviderId,
  RouteVoiceCardInput,
  Tone,
  VoiceCard,
  VoiceCardResult,
} from './types';

const IS_DEV = typeof __DEV__ === 'boolean' ? __DEV__ : false;

/**
 * Reads yesterday (the last logged check) to pick today's tone:
 * skipped → cut, two done in a row → lift, otherwise even.
 */
export function deriveTone(history: CheckHistory[]): Tone {
  const last = history[history.length - 1];
  if (!last) return 'even';
  if (last.status === 'skipped') return 'cut';
  const prev = history[history.length - 2];
  return prev?.status === 'done' ? 'lift' : 'even';
}

export interface RouteVoiceCardDeps {
  config?: VoiceConfig;
  providers?: Record<ProviderId, VoiceProvider>;
  /** Overrides __DEV__ for tests. */
  isDev?: boolean;
  /** Jargon-guard log. Production screens pass logJargonGuard. Tests omit. */
  logJargonHit?: (flag: string) => Promise<void>;
  /**
   * Own-account session capture. Production Home/Dawn/catch-up pass
   * recordOwnDevTrace. Tests and the local simulator omit.
   */
  recordTrace?: (input: DevTraceRecordInput) => Promise<void>;
  /** Read/Do/Nudge pipeline is Dawn — Home, Dawn, and catch-up pass dawn. */
  traceSurface?: 'sage' | 'dawn';
}

function withNudge(result: Omit<VoiceCardResult, 'nudge'>, input: RouteVoiceCardInput): VoiceCardResult {
  if (result.kind !== 'card' || !result.card?.do?.trim()) {
    return { ...result, nudge: null };
  }
  const nudge = resolveNudge({
    knocksYouOff: input.me.knocks_you_off,
    facts: input.me.facts ?? [],
    history: input.history,
    hasDo: true,
    crisisToday: !!input.crisisToday,
    crisisDetected: !!input.crisisDetected,
    crisisYesterday: !!input.crisisYesterday,
  });
  const safe = nudge && !containsFrameworkTerm(nudge) ? nudge : null;
  result.card.nudge = safe;
  return { ...result, nudge: safe };
}

function cardBlob(card: VoiceCard | null | undefined): string | null {
  if (!card) return null;
  return JSON.stringify({ read: card.read, do: card.do, nudge: card.nudge ?? null });
}

function startCardSteps(input: RouteVoiceCardInput, day: number): {
  steps: DevTraceStep[];
  library: ReturnType<typeof libraryLinesFor>;
} {
  const library = libraryLinesFor(input.me, { day, surface: 'card' });
  const steps: DevTraceStep[] = [];
  appendTraceStep(steps, {
    step_type: 'context_gather',
    label: 'ME + last 7 checks',
    input_summary: summarizeMe(input.me),
    output_summary: `${summarizeChecks(input.history, 7)} · ${summarizeLibrary(library)}`,
    status: 'ok',
  });
  return { steps, library };
}

function finishCardSteps(
  steps: DevTraceStep[],
  model: {
    label: string;
    input_summary: string;
    output_summary: string;
    status: DevTraceStepStatus;
  },
  guardHits: Array<string | null | undefined>,
  guardInput: string,
  output: { input_summary: string; output_summary: string; status: DevTraceStepStatus },
): { steps: DevTraceStep[]; guardFired: string | null } {
  appendTraceStep(steps, { step_type: 'model_call', ...model });
  const guard = traceGuardResult(guardHits);
  appendTraceStep(steps, {
    step_type: 'guard_check',
    label: 'Jargon / phrase',
    input_summary: guardInput,
    output_summary: guard.output_summary,
    status: guard.status,
  });
  appendTraceStep(steps, {
    step_type: 'output',
    label: 'Read / Do / Nudge',
    ...output,
  });
  return { steps, guardFired: guard.guardFired };
}

async function emitCardTrace(
  deps: RouteVoiceCardDeps,
  input: RouteVoiceCardInput,
  day: number,
  result: VoiceCardResult,
  rawBefore: string | null,
  steps: DevTraceStep[],
  guardFired: string | null,
): Promise<VoiceCardResult> {
  if (!deps.recordTrace) return result;
  const library = libraryLinesFor(input.me, { day, surface: 'card' });
  await deps
    .recordTrace({
      surface: deps.traceSurface ?? 'dawn',
      libraryLines: library,
      traitSignals: traitSignalsFromMe(input.me),
      rawBefore,
      rawAfter: cardBlob(result.card),
      guardFired,
      steps,
    })
    .catch(() => {});
  return result;
}

/**
 * Routes today's card:
 * - Consent gate first: never calls a model unless aiConsent === true.
 *   null → 'pending' (caller must surface the one-time prompt); false →
 *   bank-only forever + Talk stays off.
 * - check_count < 3 → first_cards.md bank (no model call).
 * - check_count >= 3 + consent → generate via the configured provider, in
 *   sage.txt's register, then drop repeats / vague Dos / cruel cuts.
 * - Home-only Nudge is attached after a valid Read/Do card; never from talk_style.
 */
export async function routeVoiceCard(
  input: RouteVoiceCardInput,
  deps: RouteVoiceCardDeps = {},
): Promise<VoiceCardResult> {
  const config = deps.config ?? VOICE_CONFIG;
  const dev = deps.isDev ?? IS_DEV;
  const day = input.day ?? input.checkCount + 1;
  const tone = deriveTone(input.history);
  const consent = input.aiConsent ?? null;

  const trace = (fromBankFile: boolean, fromModel: boolean, providerLabel: string): DevTrace | undefined =>
    dev ? { fromBankFile, fromModel, providerLabel, checkCount: input.checkCount } : undefined;

  // ---- Crisis short-circuit (plan: crisis spec) -------------------------
  // A crisis-flagged message must never reach a model. The caller runs
  // detectCrisis() and passes the flag; this is the hard guarantee that the
  // router itself returns a static crisis result instead.
  if (input.crisisDetected) {
    return withNudge(
      {
        kind: 'crisis',
        card: null,
        day,
        tone,
        source: 'crisis',
        provider: null,
        dropped: [],
        consent: consent === true ? 'granted' : consent === false ? 'denied' : 'pending',
        dev: trace(false, false, 'crisis-card (no model call)'),
      },
      input,
    );
  }

  // ---- Consent gate (Apple 5.1.2) ---------------------------------------
  // The router never calls a model unless consent was explicitly granted.
  // null → pending (the caller must surface the one-time prompt), false →
  // bank content only, forever.
  const modelAllowed = consent === true;
  const { steps } = startCardSteps(input, day);

  // ---- Bank path: check_count < 3, OR consent not granted ---------------
  // Without consent this stays bank-only regardless of check_count — a denied
  // user never gets generated content, and Talk must stay off for them.
  if (input.checkCount < BANK_CARD_DAYS || !modelAllowed) {
    const card = bankCardForMe(day, input.me);
    const bankReason = card
      ? filterCard(card, { shownCards: [], crisisToday: !!input.crisisToday, previousHadCut: false })
      : null;
    const raw = cardBlob(card);
    const shown = !bankReason && card ? card : null;
    const result = withNudge(
      {
        kind: 'card',
        card: shown,
        day,
        tone,
        source: 'bank',
        provider: null,
        dropped: bankReason ? [bankReason] : [],
        consent: consent === false ? 'denied' : 'pending',
        dev: trace(true, false, 'first_cards.md'),
      },
      input,
    );
    const finished = finishCardSteps(
      steps,
      {
        label: 'Bank card (no model)',
        input_summary: `day ${day} · talk_style=${input.me.talk_style} · bank`,
        output_summary: raw ?? 'no bank card',
        status: card ? 'ok' : 'failed',
      },
      bankReason === 'framework-echo' ? [bankReason] : [],
      raw ?? '—',
      {
        input_summary: raw ?? '—',
        output_summary: result.card ? cardBlob(result.card) ?? '—' : 'nothing shown',
        status: result.card ? 'ok' : 'failed',
      },
    );
    return emitCardTrace(deps, input, day, result, raw, finished.steps, finished.guardFired);
  }

  // ---- Generated path: check_count >= 3 --------------------------------
  const providers = deps.providers ?? buildProviders(config);
  let provider = providers[config.provider];

  // gemini without a key is unusable; fall back to the deterministic local
  // provider so the app still works (dev stage, no secret in the bundle).
  const noGeminiKey = config.provider === 'gemini' && !config.geminiApiKey;
  const providerLabel = noGeminiKey
    ? 'local (no gemini key configured)'
    : provider.label;

  if (noGeminiKey) provider = providers.local;

  const shownCards: Array<{ read: string; do: string }> = input.history
    .filter((h) => h.read && h.do)
    .map((h) => ({ read: h.read as string, do: h.do as string }));

  // Day 4 must not be string-identical to Day 3's bank card, so the prior
  // bank day is part of the "already shown" set.
  const priorBankDay = day - 1;
  if (priorBankDay >= 1 && priorBankDay <= BANK_CARD_DAYS) {
    const prior = bankCardForMe(priorBankDay, input.me);
    if (prior) shownCards.push(prior);
  }

  const lastCheck = input.history[input.history.length - 1];
  const previousHadCut = lastCheck ? hasCut(lastCheck.read ?? '') : false;
  const crisisToday = !!input.crisisToday;
  const dawnReadCategory = pickDawnReadCategory(input.tracks, day);

  let lastDropped: VoiceCardResult['dropped'] = [];
  let lastCandidate: VoiceCard | null = null;

  for (let attempt = 1; attempt <= GENERATED_MAX_ATTEMPTS; attempt += 1) {
    const candidate = await provider.generate({
      me: input.me,
      day,
      tone,
      history: input.history,
      crisisToday,
      previousHadCut,
      retryHint: lastDropped[0] ?? null,
      dawnReadCategory,
    });
    lastCandidate = candidate;
    const reason = filterCard(candidate, { shownCards, crisisToday, previousHadCut });
    if (!reason) {
      const flag = jargonInCard(candidate);
      const card = flag ? applyJargonFallback(candidate) : candidate;
      if (flag) {
        await deps.logJargonHit?.(flag).catch(() => {});
      }
      const result = withNudge(
        {
          kind: 'card',
          card,
          day,
          tone,
          source: 'generated',
          provider: provider.id,
          dropped: [],
          consent: 'granted',
          dev: trace(false, true, providerLabel),
        },
        input,
      );
      const raw = cardBlob(candidate);
      const finished = finishCardSteps(
        steps,
        {
          label: `Router · ${providerLabel}`,
          input_summary: `day ${day} · tone=${tone} · attempt ${attempt}`,
          output_summary: raw ?? 'empty draft',
          status: candidate ? 'ok' : 'failed',
        },
        [flag],
        raw ?? '—',
        {
          input_summary: raw ?? '—',
          output_summary: result.card ? cardBlob(result.card) ?? '—' : 'nothing shown',
          status: result.card ? 'ok' : 'failed',
        },
      );
      return emitCardTrace(deps, input, day, result, raw, finished.steps, finished.guardFired);
    }
    lastDropped = [reason];
  }

  // Everything got dropped — per spec, show nothing rather than bad content.
  const result = withNudge(
    {
      kind: 'card',
      card: null,
      day,
      tone,
      source: 'generated',
      provider: provider.id,
      dropped: lastDropped,
      consent: 'granted',
      dev: trace(false, true, providerLabel),
    },
    input,
  );
  const raw = cardBlob(lastCandidate);
  const finished = finishCardSteps(
    steps,
    {
      label: `Router · ${providerLabel}`,
      input_summary: `day ${day} · tone=${tone} · ${GENERATED_MAX_ATTEMPTS} attempts`,
      output_summary: raw ?? 'no candidate',
      status: lastCandidate ? 'ok' : 'failed',
    },
    lastDropped.filter((reason) => reason === 'framework-echo'),
    raw ?? '—',
    {
      input_summary: raw ?? '—',
      output_summary: lastDropped[0] ? `dropped: ${lastDropped[0]}` : 'nothing shown',
      status: 'failed',
    },
  );
  return emitCardTrace(deps, input, day, result, raw, finished.steps, finished.guardFired);
}
