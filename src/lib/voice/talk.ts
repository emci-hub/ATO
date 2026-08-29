import { detectCrisis as defaultDetectCrisis, type CrisisDetection } from '@/lib/crisis/detect';

import { VOICE_CONFIG, type VoiceConfig } from './config';
import { containsFrameworkTerm } from './framework-fence';
import { JARGON_FALLBACK_TALK, matchingJargonTerm } from './jargon';
import { buildProviders } from './providers';
import type { QuotaDecision } from './quota';
import type { VoiceProvider } from './providers/types';
import type { CheckHistory, DevTrace, ProviderId, VoiceCard, VoiceMe } from './types';

const IS_DEV = typeof __DEV__ === 'boolean' ? __DEV__ : false;

/** First generate + one fence retry. Retry is a quality pass, not a second quota claim. */
const TALK_FENCE_ATTEMPTS = 2;

export interface TalkReplyInput {
  me: VoiceMe;
  /** The user's message to Sage. */
  message: string;
  /** Number of checks logged so far. Day = checkCount + 1. */
  checkCount: number;
  history: CheckHistory[];
  /** Today's card (read/do) for context; may be null. */
  todayCard?: VoiceCard | null;
  /** Prior Sage thread turns. Current line is `message`. */
  recentTurns?: Array<{ role: 'user' | 'sage'; text: string }>;
  /** AI consent gate (Apple 5.1.2). Talk stays off unless granted. */
  aiConsent?: boolean | null;
  /** Needed only for crisis flag logging. */
  userId?: string;
}

export interface TalkReplyDeps {
  config?: VoiceConfig;
  providers?: Record<ProviderId, VoiceProvider>;
  /** Overrides __DEV__ for tests. */
  isDev?: boolean;
  /** Injectable for tests; defaults to the keyword-list detector. */
  detectCrisis?: (message: string) => Promise<CrisisDetection>;
  /** Injectable for tests; defaults to a no-op (screen wires the real logger). */
  logCrisisFlag?: (userId: string) => Promise<void>;
  /**
   * Server-side per-user cap. Production Talk UI passes claimAiCall from
   * quota-server. Tests inject allow/deny. Omitted = allow so existing unit
   * checks stay provider-only.
   */
  claimAiCall?: () => Promise<QuotaDecision>;
  logJargonHit?: (flag: string) => Promise<void>;
}

export type TalkReplyKind =
  | 'consent-pending'
  | 'consent-denied'
  | 'crisis'
  | 'reply'
  | 'quota'
  | 'empty';

export interface TalkReplyResult {
  kind: TalkReplyKind;
  /** Present when kind === 'reply'. */
  reply?: string;
  /** Present when kind === 'crisis' — how the flag was reached. */
  crisis?: CrisisDetection;
  provider?: ProviderId | null;
  dev?: DevTrace;
}

const noOpLog = async () => {};

/**
 * Routes a Talk message:
 * 1. Consent gate — Talk stays off unless AI consent was granted.
 * 2. Crisis check runs BEFORE any main router call — static keyword/phrase
 *    list, no model call. Flagged → static crisis result, zero main router
 *    calls, flag logged (never the message).
 * 3. Otherwise claim quota once, then generate. A banned framework term
 *    retries generate once (same claim). Still banned → honest empty, never
 *    shown.
 */
export async function routeTalkReply(
  input: TalkReplyInput,
  deps: TalkReplyDeps = {},
): Promise<TalkReplyResult> {
  const dev = deps.isDev ?? IS_DEV;
  const consent = input.aiConsent ?? null;

  const trace = (fromModel: boolean, providerLabel: string): DevTrace | undefined =>
    dev
      ? { fromBankFile: !fromModel, fromModel, providerLabel, checkCount: input.checkCount }
      : undefined;

  // ---- Consent gate ------------------------------------------------------
  if (consent === false) {
    return { kind: 'consent-denied', provider: null, dev: trace(false, 'talk-off') };
  }
  if (consent !== true) {
    return { kind: 'consent-pending', provider: null, dev: trace(false, 'consent-pending') };
  }

  // ---- Crisis check (keyword list, no model call) ------------------------
  const detect = deps.detectCrisis ?? defaultDetectCrisis;
  const crisis = await detect(input.message);

  if (crisis.flagged) {
    const logFlag = deps.logCrisisFlag ?? noOpLog;
    if (input.userId) {
      await logFlag(input.userId).catch(() => {});
    }
    return {
      kind: 'crisis',
      crisis,
      provider: null,
      dev: trace(false, `crisis (${crisis.method})`),
    };
  }

  // ---- Per-user cap (server-side; floor requirement) ---------------------
  const claim = deps.claimAiCall ? await deps.claimAiCall() : { ok: true as const };
  if (!claim.ok) {
    return { kind: 'quota', provider: null, dev: trace(false, 'quota') };
  }

  // ---- Main router reply call -------------------------------------------
  const config = deps.config ?? VOICE_CONFIG;
  const providers = deps.providers ?? buildProviders(config);
  let provider = providers[config.provider];

  const noGeminiKey = config.provider === 'gemini' && !config.geminiApiKey;
  const providerLabel = noGeminiKey ? 'local (no gemini key configured)' : provider.label;
  if (noGeminiKey) provider = providers.local;

  const talkInput = {
    me: input.me,
    message: input.message,
    day: input.checkCount + 1,
    history: input.history,
    todayCard: input.todayCard,
    recentTurns: input.recentTurns,
  };

  for (let attempt = 1; attempt <= TALK_FENCE_ATTEMPTS; attempt += 1) {
    const { reply } = await provider.generateTalk({
      ...talkInput,
      retryHint: attempt > 1,
    });
    if (!containsFrameworkTerm(reply)) {
      const flag = matchingJargonTerm(reply);
      if (flag) {
        await deps.logJargonHit?.(flag).catch(() => {});
        return {
          kind: 'reply',
          reply: JARGON_FALLBACK_TALK,
          provider: provider.id,
          dev: trace(true, `${providerLabel} (jargon)`),
        };
      }
      return { kind: 'reply', reply, provider: provider.id, dev: trace(true, providerLabel) };
    }
  }

  // Both drafts named a type/label — show nothing rather than a blocked line.
  return {
    kind: 'empty',
    provider: provider.id,
    dev: trace(true, `${providerLabel} (fence)`),
  };
}
