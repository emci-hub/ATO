import { VOICE_CONFIG } from '@/lib/voice/config';

import { parseExploreBody } from './prompt';
import { parseStoryBody } from '@/lib/sage-story';

async function generateJson(prompt: string, maxOutputTokens: number): Promise<string | null> {
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
        maxOutputTokens,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: 'low' },
      },
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
}

export async function generateExploreBody(prompt: string): Promise<string | null> {
  const text = await generateJson(prompt, 512);
  return text ? parseExploreBody(text) : null;
}

/** Story lane — longer output. Returns null when Gemini is unreachable. No fallback parse-to-prose. */
export async function generateStoryBody(prompt: string): Promise<string | null> {
  const text = await generateJson(prompt, 1024);
  return text ? parseStoryBody(text) : null;
}
