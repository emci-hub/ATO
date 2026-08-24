import type { VoiceCard } from '../types';
import { buildPrompt, buildTalkPrompt, isUsableCard, parseGeminiCard, parseTalkReply } from './prompt';
import type { GenerateInput, TalkGenerateInput, VoiceProvider } from './types';

export class GeminiProviderError extends Error {}

/**
 * Gemini 3.x models always think to some degree and bill thinking tokens
 * against maxOutputTokens, so these budgets carry both the reasoning and the
 * card/reply. 'low' keeps latency down for what are short, simple generations.
 * temperature is deliberately unset: 3.x is tuned for its default sampling and
 * no longer recommends pinning it.
 */
const MAX_OUTPUT_TOKENS = 1024;
const THINKING = { thinkingLevel: 'low' } as const;

export interface GeminiOptions {
  model: string;
  apiKey: string;
}

/**
 * Calls Gemini's generateContent REST endpoint with the API key sent in the
 * x-goog-api-key header. The model name is config-driven (EXPO_PUBLIC_GEMINI_MODEL).
 */
export function createGeminiProvider(options: GeminiOptions): VoiceProvider {
  return {
    id: 'gemini',
    label: 'gemini',
    async generate(input: GenerateInput): Promise<VoiceCard> {
      if (!options.apiKey) {
        throw new GeminiProviderError('No Gemini API key configured');
      }

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(options.model)}:generateContent`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': options.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
          generationConfig: {
            thinkingConfig: THINKING,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new GeminiProviderError(`Gemini ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const text =
        data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

      const card = parseGeminiCard(text);
      if (!isUsableCard(card)) {
        throw new GeminiProviderError('Gemini response contained no usable card');
      }
      return card;
    },

    async generateTalk(input: TalkGenerateInput) {
      if (!options.apiKey) {
        throw new GeminiProviderError('No Gemini API key configured');
      }

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(options.model)}:generateContent`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': options.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildTalkPrompt(input) }] }],
          generationConfig: {
            thinkingConfig: THINKING,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new GeminiProviderError(`Gemini ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const text =
        data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

      const reply = parseTalkReply(text);
      if (!reply) {
        throw new GeminiProviderError('Gemini response contained no usable reply');
      }
      return reply;
    },
  };
}
