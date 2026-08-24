import type { CheckHistory, TalkStyle, Tone, VoiceCard, VoiceMe } from '../types';

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
}

/** Input for the Talk reply generator (the main Sage reply call). */
export interface TalkGenerateInput {
  me: VoiceMe;
  message: string;
  day: number;
  history: CheckHistory[];
  /** Today's card (read/do) for context; may be null. */
  todayCard?: VoiceCard | null;
}

export interface TalkGenerateResult {
  reply: string;
}

export interface VoiceProvider {
  id: 'gemini' | 'local';
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
