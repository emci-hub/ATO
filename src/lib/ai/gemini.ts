import { extractGeminiText, AiProviderError } from './http';
import type { GenerateRequest } from './types';

export async function completeGemini(
  request: GenerateRequest,
  options: { model: string; apiKey: string },
): Promise<string> {
  if (!options.apiKey) throw new AiProviderError('No Gemini API key configured');

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(options.model)}:generateContent`;

  const generationConfig: Record<string, unknown> = {
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
    thinkingConfig: { thinkingLevel: 'low' },
  };
  if (request.responseFormat === 'json') {
    generationConfig.responseMimeType = 'application/json';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': options.apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiProviderError(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }

  const text = extractGeminiText(await res.json());
  if (!text.trim()) throw new AiProviderError('Gemini response contained no text');
  return text;
}
