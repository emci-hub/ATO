import type { GenerateRequest } from './types';

export class AiProviderError extends Error {}

export function extractGeminiText(data: unknown): string {
  const row = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return row.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
}

export function extractOpenAiText(data: unknown): string {
  const row = data as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = row.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return typeof (part as { text?: unknown }).text === 'string'
            ? (part as { text: string }).text
            : '';
        }
        return '';
      })
      .join('');
  }
  return '';
}

export function extractClaudeText(data: unknown): string {
  const row = data as { content?: Array<{ type?: string; text?: string }> };
  return (row.content ?? [])
    .filter((part) => part.type === 'text' || typeof part.text === 'string')
    .map((part) => part.text ?? '')
    .join('');
}

export async function completeOpenAiChat(input: {
  url: string;
  apiKey: string;
  model: string;
  request: GenerateRequest;
  extraBody?: Record<string, unknown>;
  skipJsonMode?: boolean;
  label: string;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: [{ role: 'user', content: input.request.prompt }],
    temperature: input.request.temperature,
    max_tokens: input.request.maxOutputTokens,
    stream: false,
    ...input.extraBody,
  };
  if (input.request.responseFormat === 'json' && !input.skipJsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(input.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new AiProviderError(`${input.label} ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const text = extractOpenAiText(await res.json());
  if (!text.trim()) throw new AiProviderError(`${input.label} response contained no text`);
  return text;
}
