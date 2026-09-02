import { generateText } from '@/lib/ai/generate';
import { DAILY_CARD_META, TALK_META } from '@/lib/ai/call-sites';
import type { RemoteAiProviderId } from '@/lib/ai/types';
import type { VoiceCard } from '../types';
import { buildPrompt, buildTalkPrompt, isUsableCard, parseGeminiCard, parseTalkReply } from './prompt';
import type { GenerateInput, TalkGenerateInput, VoiceProvider } from './types';
import { GeminiProviderError } from './gemini';

/**
 * Production remote provider. Transport is generateText — vendor is AI_PROVIDER
 * (plus the on-device override), not this object's id.
 */
export function createRemoteProvider(id: RemoteAiProviderId): VoiceProvider {
  return {
    id,
    label: id,
    async generate(input: GenerateInput): Promise<VoiceCard> {
      const text = await generateText({
        prompt: buildPrompt(input),
        temperature: 1.0,
        maxOutputTokens: 500,
        responseFormat: 'json',
      }, DAILY_CARD_META);
      if (!text) throw new GeminiProviderError('No usable card from the active provider');
      const card = parseGeminiCard(text);
      if (!isUsableCard(card)) {
        throw new GeminiProviderError('Response contained no usable card');
      }
      return card;
    },

    async generateTalk(input: TalkGenerateInput) {
      const text = await generateText({
        prompt: buildTalkPrompt(input),
        temperature: 0.8,
        maxOutputTokens: 1024,
        responseFormat: 'text',
      }, TALK_META);
      const reply = text ? parseTalkReply(text) : null;
      if (!reply) {
        throw new GeminiProviderError('No usable reply from the active provider');
      }
      return reply;
    },
  };
}
