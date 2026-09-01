import type { DawnReadCategory } from '@/lib/dawn-category';
import type { CheckHistory, DropReason, ProviderId, TalkStyle, Tone, VoiceCard, VoiceMe } from '../types';

export interface GenerateInput {
  me: VoiceMe;
  /** 1-based day the card is for. */
  day: number;
  tone: Tone;
  history: CheckHistory[];
  /** true when today is a crisis day — provider must not emit a cut. */
  crisisToday: boolean;
  /** true when the last shown card was a cut — provider must not cut again. */
  previousHadCut: boolean;
  /** Why the previous generate attempt was dropped, if any. */
  retryHint?: DropReason | null;
  /**
   * At most one settled Dawn Read category (Steadiness / Agency / Drive).
   * Null/absent = existing knock/fact/focus behavior. Never other categories.
   */
  dawnReadCategory?: DawnReadCategory | null;
}

/** Input for the Talk reply generator (the main Sage reply call). */
export interface TalkGenerateInput {
  me: VoiceMe;
  message: string;
  day: number;
  history: CheckHistory[];
  /** Today's Home card — light background only, never the reply itself. */
  todayCard?: VoiceCard | null;
  /** Prior Sage thread turns (oldest first). Current user line is `message`. */
  recentTurns?: Array<{ role: 'user' | 'sage'; text: string }>;
  /** True when the previous draft was dropped by the framework fence. */
  retryHint?: boolean;
  /** Stability-weighted N of currently-defined axes. Thin when below THIN_PROFILE_RATIO of that live total. */
  answeredCount?: number;
  /**
   * Plain-language note when a self-report and a gut-call on the same axis
   * don't match. Never a score. Prompt-only.
   */
  divergenceNote?: string | null;
}

export interface TalkGenerateResult {
  reply: string;
}

export interface VoiceProvider {
  id: ProviderId;
  label: string;
  generate(input: GenerateInput): Promise<VoiceCard>;
  generateTalk(input: TalkGenerateInput): Promise<TalkGenerateResult>;
}

/** Shared per-style voice notes used by both providers. */
export const TALK_STYLE_GUIDE: Record<TalkStyle, string> = {
  quiet: 'quiet: understated, 1–3 short sentences, no exclamation.',
  even: 'even: plain, measured, matter-of-fact.',
  loud: 'loud: short, punchy, a little energy, exclamation allowed.',
};
