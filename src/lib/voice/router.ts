import { bankCardForMe } from './bank';
import {
  BANK_CARD_DAYS,
  GENERATED_MAX_ATTEMPTS,
  VOICE_CONFIG,
  type VoiceConfig,
} from './config';
import { filterCard, hasCut } from './filters';
import { resolveNudge } from './nudge';
import { buildProviders } from './providers';
import type { VoiceProvider } from './providers/types';
import type {
  CheckHistory,
  DevTrace,
  ProviderId,
  RouteVoiceCardInput,
  Tone,
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
  result.card.nudge = nudge;
  return { ...result, nudge };
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

  // ---- Bank path: check_count < 3, OR consent not granted ---------------
  // Without consent this stays bank-only regardless of check_count — a denied
  // user never gets generated content, and Talk must stay off for them.
  if (input.checkCount < BANK_CARD_DAYS || !modelAllowed) {
    const card = bankCardForMe(day, input.me);
    return withNudge(
      {
        kind: 'card',
        card,
        day,
        tone,
        source: 'bank',
        provider: null,
        dropped: [],
        consent: consent === false ? 'denied' : 'pending',
        dev: trace(true, false, 'first_cards.md'),
      },
      input,
    );
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

  let lastDropped: VoiceCardResult['dropped'] = [];

  for (let attempt = 1; attempt <= GENERATED_MAX_ATTEMPTS; attempt += 1) {
    const candidate = await provider.generate({
      me: input.me,
      day,
      tone,
      history: input.history,
      crisisToday,
      previousHadCut,
    });
    const reason = filterCard(candidate, { shownCards, crisisToday, previousHadCut });
    if (!reason) {
      return withNudge(
        {
          kind: 'card',
          card: candidate,
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
    }
    lastDropped = [reason];
  }

  // Everything got dropped — per spec, show nothing rather than bad content.
  return withNudge(
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
}
