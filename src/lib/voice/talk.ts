import { detectCrisis as defaultDetectCrisis, type CrisisDetection } from '@/lib/crisis/detect';
import { isProfileSettled, type TraitTrack } from '@/lib/trait-stability';
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

import { VOICE_CONFIG, type VoiceConfig } from './config';
import { containsFrameworkTerm } from './framework-fence';
import { JARGON_FALLBACK_TALK, matchingJargonTerm } from './jargon';
import { buildProviders } from './providers';
import type { QuotaDecision } from './quota';
import type { VoiceProvider } from './providers/types';
import { pickVoiceProvider } from './select-provider';
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
  answeredCount?: number;
  divergenceNote?: string | null;
  /**
   * Report/game tracks. Drives the profile-completeness gate: until every axis
   * is settled Sage replies from the deterministic local provider — no network
   * call, no tokens, no quota claim, no lock screen.
   *
   * Omitted (undefined) means the caller supplied no track state — tests and
   * labs — and leaves the gate off. An empty array is a real answer ("nothing
   * settled") and gates. The production caller (`sage.tsx`) always passes it.
   */
  tracks?: readonly TraitTrack[];
}

export interface TalkReplyDeps {
  config?: VoiceConfig;
  providers?: Partial<Record<ProviderId, VoiceProvider>>;
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
  recordTrace?: (input: DevTraceRecordInput) => Promise<void>;
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

  // ---- Profile-completeness gate ----------------------------------------
  // Placed AFTER the crisis return above, so a flagged line is never touched
  // by this gate. When the profile is not settled Sage still answers — from
  // the deterministic local provider — so no quota is claimed and no tokens
  // are spent, and there is no lock screen in the thread.
  const settledGate = input.tracks !== undefined && !isProfileSettled(input.tracks);

  // ---- Per-user cap (server-side; floor requirement) ---------------------
  // Skipped when gated: a local reply is free, so it must not consume a claim.
  const claim =
    deps.claimAiCall && !settledGate ? await deps.claimAiCall() : { ok: true as const };
  if (!claim.ok) {
    return { kind: 'quota', provider: null, dev: trace(false, 'quota') };
  }

  // ---- Main router reply call -------------------------------------------
  const config = deps.config ?? VOICE_CONFIG;
  const providers = { ...buildProviders(config), ...deps.providers };
  const picked = await pickVoiceProvider(config, providers, !deps.config);
  const provider = settledGate ? providers.local : picked.provider;
  const providerLabel = settledGate
    ? `${providers.local.label} — profile not settled`
    : picked.label;

  const library = libraryLinesFor(input.me, {
    day: input.checkCount + 1,
    surface: 'talk',
    message: input.message,
  });
  const steps: DevTraceStep[] = [];
  const cardSummary = input.todayCard
    ? `Read: ${clipTraceText(input.todayCard.read, 80)} · Do: ${clipTraceText(input.todayCard.do, 80)}`
    : 'no today card';
  appendTraceStep(steps, {
    step_type: 'context_gather',
    label: 'ME + card + sage.txt',
    input_summary: `${summarizeMe(input.me)} · message="${clipTraceText(input.message, 120)}"`,
    output_summary: `${cardSummary} · sage.txt register · ${summarizeLibrary(library)}`,
    status: 'ok',
  });

  const talkInput = {
    me: input.me,
    message: input.message,
    day: input.checkCount + 1,
    history: input.history,
    todayCard: input.todayCard,
    recentTurns: input.recentTurns,
    answeredCount: input.answeredCount,
    divergenceNote: input.divergenceNote,
  };

  let lastRaw: string | null = null;
  let lastGuard: string | null = 'framework-echo';

  for (let attempt = 1; attempt <= TALK_FENCE_ATTEMPTS; attempt += 1) {
    const { reply } = await provider.generateTalk({
      ...talkInput,
      retryHint: attempt > 1,
    });
    lastRaw = reply;
    if (!containsFrameworkTerm(reply)) {
      const flag = matchingJargonTerm(reply);
      if (flag) {
        await deps.logJargonHit?.(flag).catch(() => {});
        const result: TalkReplyResult = {
          kind: 'reply',
          reply: JARGON_FALLBACK_TALK,
          provider: provider.id,
          dev: trace(true, `${providerLabel} (jargon)`),
        };
        await emitTalkTrace(deps, input, library, steps, providerLabel, lastRaw, JARGON_FALLBACK_TALK, flag);
        return result;
      }
      const result: TalkReplyResult = {
        kind: 'reply',
        reply,
        provider: provider.id,
        dev: trace(true, providerLabel),
      };
      await emitTalkTrace(deps, input, library, steps, providerLabel, lastRaw, reply, null);
      return result;
    }
    lastGuard = 'framework-echo';
  }

  // Both drafts named a type/label — show nothing rather than a blocked line.
  await emitTalkTrace(deps, input, library, steps, providerLabel, lastRaw, null, lastGuard);
  return {
    kind: 'empty',
    provider: provider.id,
    dev: trace(true, `${providerLabel} (fence)`),
  };
}

async function emitTalkTrace(
  deps: TalkReplyDeps,
  input: TalkReplyInput,
  library: ReturnType<typeof libraryLinesFor>,
  steps: DevTraceStep[],
  providerLabel: string,
  rawBefore: string | null,
  rawAfter: string | null,
  guardFired: string | null,
): Promise<void> {
  if (!deps.recordTrace) return;
  appendTraceStep(steps, {
    step_type: 'model_call',
    label: `Talk · ${providerLabel}`,
    input_summary: `message="${clipTraceText(input.message, 120)}" · sage.txt`,
    output_summary: rawBefore ?? 'empty draft',
    status: rawBefore ? 'ok' : 'failed',
  });
  const guard = traceGuardResult([guardFired]);
  appendTraceStep(steps, {
    step_type: 'guard_check',
    label: 'Fence / jargon',
    input_summary: rawBefore ?? '—',
    output_summary: guard.output_summary,
    status: guard.status,
  });
  appendTraceStep(steps, {
    step_type: 'output',
    label: 'Talk reply',
    input_summary: rawBefore ?? '—',
    output_summary: rawAfter ?? 'nothing shown',
    status: rawAfter ? 'ok' : 'failed',
  });
  await deps
    .recordTrace({
      surface: 'talk',
      libraryLines: library,
      traitSignals: traitSignalsFromMe(input.me),
      rawBefore,
      rawAfter,
      guardFired: guard.guardFired,
      steps,
    })
    .catch(() => {});
}
