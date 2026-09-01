/**
 * Calls Gemini's generateContent REST endpoint with the API key sent in the
 * x-goog-api-key header. Live checks inject this provider with an explicit key
 * so they always hit Gemini, not the runtime AI_PROVIDER override.
 */
import { completeGemini } from '@/lib/ai/gemini';
import { AiProviderError } from '@/lib/ai/http';
import type { VoiceCard } from '../types';
import { buildPrompt, buildTalkPrompt, isUsableCard, parseGeminiCard, parseTalkReply } from './prompt';
import type { GenerateInput, TalkGenerateInput, VoiceProvider } from './types';

export class GeminiProviderError extends Error {}

export interface GeminiOptions {
  model: string;
  apiKey: string;
}

export function createGeminiProvider(options: GeminiOptions): VoiceProvider {
  return {
    id: 'gemini',
    label: 'gemini',
    async generate(input: GenerateInput): Promise<VoiceCard> {
      if (!options.apiKey) {
        throw new GeminiProviderError('No Gemini API key configured');
      }
      try {
        const text = await completeGemini(
          {
            prompt: buildPrompt(input),
            temperature: 1.0,
            maxOutputTokens: 500,
            responseFormat: 'json',
          },
          options,
        );
        const card = parseGeminiCard(text);
        if (!isUsableCard(card)) {
          throw new GeminiProviderError('Gemini response contained no usable card');
        }
        return card;
      } catch (err) {
        if (err instanceof GeminiProviderError) throw err;
        const message = err instanceof AiProviderError ? err.message : 'Gemini generate failed';
        throw new GeminiProviderError(message);
      }
    },

    async generateTalk(input: TalkGenerateInput) {
      if (!options.apiKey) {
        throw new GeminiProviderError('No Gemini API key configured');
      }
      try {
        const text = await completeGemini(
          {
            prompt: buildTalkPrompt(input),
            temperature: 0.8,
            maxOutputTokens: 1024,
            responseFormat: 'text',
          },
          options,
        );
        const reply = parseTalkReply(text);
        if (!reply) {
          throw new GeminiProviderError('Gemini response contained no usable reply');
        }
        return reply;
      } catch (err) {
        if (err instanceof GeminiProviderError) throw err;
        const message = err instanceof AiProviderError ? err.message : 'Gemini talk failed';
        throw new GeminiProviderError(message);
      }
    },
  };
}
