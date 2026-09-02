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
