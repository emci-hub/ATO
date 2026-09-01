/**
 * ai-generate — Claude and Grok only. Keys stay in Edge Function secrets
 * (ANTHROPIC_API_KEY, XAI_API_KEY), never bundled in the client.
 *
 * JWT required. Body: { provider, prompt, temperature, maxOutputTokens, responseFormat }.
 * Returns { text } — the same raw string the client parsers already expect.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

function extractOpenAiText(data: unknown): string {
  const row = data as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = row.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  return '';
}

function extractClaudeText(data: unknown): string {
  const row = data as { content?: Array<{ type?: string; text?: string }> };
  return (row.content ?? []).map((part) => part.text ?? '').join('');
}

async function completeClaude(input: {
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
}): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  if (!apiKey) throw new Error('claude_key_missing');
  const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-5';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: input.maxOutputTokens,
      temperature: input.temperature,
      messages: [{ role: 'user', content: input.prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Claude ${res.status}: ${body.slice(0, 300)}`);
  }
  const text = extractClaudeText(await res.json());
  if (!text.trim()) throw new Error('Claude response contained no text');
  return text;
}

async function completeGrok(input: {
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  responseFormat: 'json' | 'text';
}): Promise<string> {
  const apiKey = Deno.env.get('XAI_API_KEY') ?? '';
  if (!apiKey) throw new Error('grok_key_missing');
  const model = Deno.env.get('XAI_MODEL') || 'grok-3-mini';

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: input.prompt }],
    temperature: input.temperature,
    max_tokens: input.maxOutputTokens,
    stream: false,
  };
  if (input.responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Grok ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const text = extractOpenAiText(await res.json());
  if (!text.trim()) throw new Error('Grok response contained no text');
  return text;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing_authorization' }, 401);

  let payload: {
    provider?: unknown;
    prompt?: unknown;
    temperature?: unknown;
    maxOutputTokens?: unknown;
    responseFormat?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const provider = payload.provider;
  if (provider !== 'claude' && provider !== 'grok') {
    return json({ error: 'unsupported_provider' }, 400);
  }
  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
  if (!prompt.trim()) return json({ error: 'missing_prompt' }, 400);

  const temperature = typeof payload.temperature === 'number' ? payload.temperature : 0.8;
  const maxOutputTokens =
    typeof payload.maxOutputTokens === 'number' ? payload.maxOutputTokens : 1024;
  const responseFormat = payload.responseFormat === 'json' ? 'json' : 'text';

  try {
    const text =
      provider === 'claude'
        ? await completeClaude({ prompt, temperature, maxOutputTokens })
        : await completeGrok({ prompt, temperature, maxOutputTokens, responseFormat });
    return json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'generate_failed';
    const status = /key_missing/.test(message) ? 503 : 502;
    return json({ error: message }, status);
  }
});
