/**
 * ai-generate — every remote vendor: Gemini, NVIDIA, Perplexity, Claude, Grok,
 * DeepSeek. ALL keys live in Edge Function secrets (GEMINI_API_KEY,
 * NVIDIA_API_KEY, PERPLEXITY_API_KEY, ANTHROPIC_API_KEY, XAI_API_KEY,
 * DEEPSEEK_API_KEY), never in the client bundle. Optional *_MODEL secrets
 * override the defaults below.
 *
 * JWT required and VERIFIED (auth.getUser on the caller's token — a bare
 * Authorization header is not enough). Every real generation claims one unit
 * of the caller's cap via claim_ai_call before any vendor is called; a refused
 * claim returns 429 { error: 'quota' } and costs nothing.
 *
 * Body: { provider, prompt, temperature, maxOutputTokens, responseFormat,
 *         callType?, ping? }.
 *   maxOutputTokens is clamped server-side to MAX_OUTPUT_TOKENS.
 *   callType tags ai_usage.by_type ('sage' | 'explore'); defaults to 'sage'.
 *   ping: true is a connectivity probe — the prompt is replaced with a fixed
 *   16-token request and NO quota is claimed, so the dev provider-status dots
 *   can poll without draining a user's day.
 * Returns { text } — the same raw string the client parsers already expect.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Hard ceiling on output tokens per request, regardless of what the client asks for. */
const MAX_OUTPUT_TOKENS = 1024;
const DEFAULT_OUTPUT_TOKENS = 1024;
const PING_PROMPT = 'Reply with the word ready.';
const PING_OUTPUT_TOKENS = 16;

const PROVIDERS = ['gemini', 'nvidia', 'perplexity', 'claude', 'grok', 'deepseek'] as const;
type ProviderId = (typeof PROVIDERS)[number];

/** Mirror of DEFAULT_MODELS in src/lib/ai/config.ts. Keep in sync. */
const DEFAULT_MODELS: Record<ProviderId, string> = {
  gemini: 'gemini-3.7-flash',
  nvidia: 'meta/llama-3.1-8b-instruct',
  perplexity: 'sonar',
  claude: 'claude-sonnet-4-5',
  grok: 'grok-3-mini',
  deepseek: 'deepseek-v4-flash',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GenerateInput {
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  responseFormat: 'json' | 'text';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

function keyFor(provider: ProviderId): string {
  const name = {
    gemini: 'GEMINI_API_KEY',
    nvidia: 'NVIDIA_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
    claude: 'ANTHROPIC_API_KEY',
    grok: 'XAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
  }[provider];
  const key = Deno.env.get(name) ?? '';
  if (!key) throw new Error(`${provider}_key_missing`);
  return key;
}

function modelFor(provider: ProviderId): string {
  const name = {
    gemini: 'GEMINI_MODEL',
    nvidia: 'NVIDIA_MODEL',
    perplexity: 'PERPLEXITY_MODEL',
    claude: 'ANTHROPIC_MODEL',
    grok: 'XAI_MODEL',
    deepseek: 'DEEPSEEK_MODEL',
  }[provider];
  return Deno.env.get(name) || DEFAULT_MODELS[provider];
}

function extractOpenAiText(data: unknown): string {
  const row = data as { choices?: { message?: { content?: unknown } }[] };
  const content = row.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }
  return '';
}

function extractClaudeText(data: unknown): string {
  const row = data as { content?: { type?: string; text?: string }[] };
  return (row.content ?? [])
    .filter((part) => part.type === 'text' || typeof part.text === 'string')
    .map((part) => part.text ?? '')
    .join('');
}

function extractGeminiText(data: unknown): string {
  const row = data as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return row.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
}

async function completeGemini(input: GenerateInput): Promise<string> {
  const apiKey = keyFor('gemini');
  const model = modelFor('gemini');
  const generationConfig: Record<string, unknown> = {
    temperature: input.temperature,
    maxOutputTokens: input.maxOutputTokens,
    thinkingConfig: { thinkingLevel: 'low' },
  };
  if (input.responseFormat === 'json') generationConfig.responseMimeType = 'application/json';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
        generationConfig,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  const text = extractGeminiText(await res.json());
  if (!text.trim()) throw new Error('Gemini response contained no text');
  return text;
}

/** OpenAI-compatible chat completions (NVIDIA, Perplexity, Grok, DeepSeek). */
async function completeOpenAiChat(opts: {
  url: string;
  apiKey: string;
  model: string;
  input: GenerateInput;
  label: string;
  extraBody?: Record<string, unknown>;
  skipJsonMode?: boolean;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [{ role: 'user', content: opts.input.prompt }],
    temperature: opts.input.temperature,
    max_tokens: opts.input.maxOutputTokens,
    stream: false,
    ...opts.extraBody,
  };
  if (opts.input.responseFormat === 'json' && !opts.skipJsonMode) {
    body.response_format = { type: 'json_object' };
  }
  const res = await fetch(opts.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`${opts.label} ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const text = extractOpenAiText(await res.json());
  if (!text.trim()) throw new Error(`${opts.label} response contained no text`);
  return text;
}

async function completeClaude(input: GenerateInput): Promise<string> {
  const apiKey = keyFor('claude');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelFor('claude'),
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

function complete(provider: ProviderId, input: GenerateInput): Promise<string> {
  switch (provider) {
    case 'gemini':
      return completeGemini(input);
    case 'claude':
      return completeClaude(input);
    case 'nvidia':
      return completeOpenAiChat({
        url: 'https://integrate.api.nvidia.com/v1/chat/completions',
        apiKey: keyFor('nvidia'),
        model: modelFor('nvidia'),
        input,
        label: 'NVIDIA',
        skipJsonMode: true,
      });
    case 'perplexity':
      return completeOpenAiChat({
        url: 'https://api.perplexity.ai/chat/completions',
        apiKey: keyFor('perplexity'),
        model: modelFor('perplexity'),
        input,
        label: 'Perplexity',
        extraBody: { disable_search: true },
      });
    case 'grok':
      return completeOpenAiChat({
        url: 'https://api.x.ai/v1/chat/completions',
        apiKey: keyFor('grok'),
        model: modelFor('grok'),
        input,
        label: 'Grok',
      });
    case 'deepseek':
      return completeOpenAiChat({
        url: 'https://api.deepseek.com/chat/completions',
        apiKey: keyFor('deepseek'),
        model: modelFor('deepseek'),
        input,
        label: 'DeepSeek',
      });
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing_authorization' }, 401);

  // Caller-scoped client: proves the JWT is real and lets claim_ai_call run
  // as the caller (it keys on auth.uid()).
  const caller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const {
    data: { user },
    error: userError,
  } = await caller.auth.getUser();
  if (userError || !user) return json({ error: 'not_authenticated' }, 401);

  let payload: {
    provider?: unknown;
    prompt?: unknown;
    temperature?: unknown;
    maxOutputTokens?: unknown;
    responseFormat?: unknown;
    callType?: unknown;
    ping?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const provider = payload.provider;
  if (typeof provider !== 'string' || !(PROVIDERS as readonly string[]).includes(provider)) {
    return json({ error: 'unsupported_provider' }, 400);
  }

  const ping = payload.ping === true;
  const prompt = ping ? PING_PROMPT : typeof payload.prompt === 'string' ? payload.prompt : '';
  if (!prompt.trim()) return json({ error: 'missing_prompt' }, 400);

  const temperature = typeof payload.temperature === 'number' ? payload.temperature : 0.8;
  const requested =
    typeof payload.maxOutputTokens === 'number' && Number.isFinite(payload.maxOutputTokens)
      ? Math.floor(payload.maxOutputTokens)
      : DEFAULT_OUTPUT_TOKENS;
  const maxOutputTokens = ping
    ? PING_OUTPUT_TOKENS
    : Math.min(MAX_OUTPUT_TOKENS, Math.max(1, requested));
  const responseFormat: 'json' | 'text' = payload.responseFormat === 'json' ? 'json' : 'text';
  const callType = payload.callType === 'explore' ? 'explore' : 'sage';

  // Claim one unit of the caller's daily/monthly cap BEFORE touching a paid
  // key. Pings are exempt (fixed tiny prompt, no user content).
  if (!ping) {
    const { data: claim, error: claimError } = await caller.rpc('claim_ai_call', {
      p_call_type: callType,
    });
    if (claimError) return json({ error: `claim_failed: ${claimError.message}` }, 500);
    const ok = claim && typeof claim === 'object' && (claim as { ok?: unknown }).ok === true;
    if (!ok) return json({ error: 'quota' }, 429);
  }

  try {
    const text = await complete(provider as ProviderId, {
      prompt,
      temperature,
      maxOutputTokens,
      responseFormat,
    });
    return json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'generate_failed';
    const status = /key_missing/.test(message) ? 503 : 502;
    return json({ error: message }, status);
  }
});
