import { VOICE_CONFIG } from '@/lib/voice/config';

import { parseExploreBody } from './prompt';

export async function generateExploreBody(prompt: string): Promise<string | null> {
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
        maxOutputTokens: 512,
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
  return parseExploreBody(text);
}
