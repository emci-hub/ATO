import { detectCrisis as defaultDetectCrisis, type CrisisDetection } from '@/lib/crisis/detect';

import { VOICE_CONFIG, type VoiceConfig } from './config';
import { buildProviders } from './providers';
import type { VoiceProvider } from './providers/types';
import type { CheckHistory, DevTrace, ProviderId, VoiceCard, VoiceMe } from './types';

const IS_DEV = typeof __DEV__ === 'boolean' ? __DEV__ : false;

export interface TalkReplyInput {
  me: VoiceMe;
  /** The user's message to Sage. */
  message: string;
  /** Number of checks logged so far. Day = checkCount + 1. */
  checkCount: number;
  history: CheckHistory[];
  /** Today's card (read/do) for context; may be null. */
  todayCard?: VoiceCard | null;
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
  /** Injectable for tests; defaults to classifier + keyword net. */
  detectCrisis?: (message: string) => Promise<CrisisDetection>;  /** Injectable for tests; defaults to a no-op (screen wires the real logger). */
  logCrisisFlag?: (userId: string) => Promise<void>;
}

export type TalkReplyKind = 'consent-pending' | 'consent-denied' | 'crisis' | 'reply';

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
 * 2. Crisis check runs BEFORE any main router call — classifier first, keyword
 *    net on classifier failure. Flagged → static crisis result, zero main
 *    router calls, flag logged (never the message).
 * 3. Otherwise generate the reply via the configured provider in sage.txt's
 *    register, differentiated by talk_style.
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

  // ---- Crisis check (classifier → keyword net) --------------------------
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

  // ---- Main router reply call -------------------------------------------
  const config = deps.config ?? VOICE_CONFIG;
  const providers = deps.providers ?? buildProviders(config);
  let provider = providers[config.provider];

  const noGeminiKey = config.provider === 'gemini' && !config.geminiApiKey;
  const providerLabel = noGeminiKey ? 'local (no gemini key configured)' : provider.label;
  if (noGeminiKey) provider = providers.local;

  const { reply } = await provider.generateTalk({
    me: input.me,
    message: input.message,
    day: input.checkCount + 1,
    history: input.history,
    todayCard: input.todayCard,
  });

  return { kind: 'reply', reply, provider: provider.id, dev: trace(true, providerLabel) };
}
