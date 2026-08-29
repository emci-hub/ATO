import { VOICE_CONFIG } from '@/lib/voice/config';

import { parseQuestionBatch } from './parse';
import type { QuestionDraft } from './types';

export async function generateQuestionBatch(prompt: string): Promise<QuestionDraft[] | null> {
  const key = VOICE_CONFIG.geminiApiKey;
  if (!key || VOICE_CONFIG.provider === 'local') return null;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(VOICE_CONFIG.geminiModel)}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: 'low' },
      },
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  const drafts = parseQuestionBatch(text);
  return drafts.length >= 5 ? drafts.slice(0, 5) : drafts.length > 0 ? drafts : null;
}
