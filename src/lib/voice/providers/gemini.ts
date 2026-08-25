import type { VoiceCard } from '../types';
import { buildPrompt, buildTalkPrompt, isUsableCard, parseGeminiCard, parseTalkReply } from './prompt';
import type { GenerateInput, TalkGenerateInput, VoiceProvider } from './types';

export class GeminiProviderError extends Error {}

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
            temperature: 0.9,
            maxOutputTokens: 500,
            responseMimeType: 'application/json',
            // gemini-3.x are thinking models: without an explicit level the
            // model spends output budget on thinking before any visible text.
            thinkingConfig: { thinkingLevel: 'low' },
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
            temperature: 0.8,
            maxOutputTokens: 1024,
            // Thinking models burn output budget on thinking first. Live-probed:
            // `low` still spends ~490-560 thoughts tokens, so a 4-sentence reply
            // (~200 visible tokens) needs 1024 to never be starved mid-sentence.
            thinkingConfig: { thinkingLevel: 'low' },
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
