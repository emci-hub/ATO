/**
 * The model call shared by the ai-library and ai-library-fill Edge Functions
 * (wave93/94): Gemini first, DeepSeek on any Gemini failure (same order and
 * defaults as ai-generate). Keys are Edge Function secrets, never in the app.
 */
const VENDOR_FETCH_TIMEOUT_MS = 12000;
const MAX_OUTPUT_TOKENS = 1024;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VENDOR_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Mirror of DEFAULT_MODELS in ai-generate (gemini, deepseek). */
async function completeGemini(prompt: string, maxOutputTokens: number): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY') ?? '';
  if (!key) throw new Error('gemini_key_missing');
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.7-flash';
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  if (!text.trim()) throw new Error('Gemini empty');
  return text;
}

async function completeDeepSeek(prompt: string, maxOutputTokens: number): Promise<string> {
  const key = Deno.env.get('DEEPSEEK_API_KEY') ?? '';
  if (!key) throw new Error('deepseek_key_missing');
  const res = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: maxOutputTokens,
      stream: false,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('DeepSeek empty');
  return text;
}

/** Same order as the app: Gemini first, DeepSeek on any Gemini failure. */
export async function complete(prompt: string, maxOutputTokens: number): Promise<string | null> {
  const cap = Math.min(MAX_OUTPUT_TOKENS, Math.max(1, Math.floor(maxOutputTokens)));
  try {
    return await completeGemini(prompt, cap);
  } catch {
    try {
      return await completeDeepSeek(prompt, cap);
    } catch {
      return null;
    }
  }
}

/** Same as `complete`, plus why both vendors failed (status codes only, never text). */
export async function completeDetailed(prompt: string, maxOutputTokens: number): Promise<{ text: string | null; error: string | null }> {
  const cap = Math.min(MAX_OUTPUT_TOKENS, Math.max(1, Math.floor(maxOutputTokens)));
  let first = '';
  try {
    return { text: await completeGemini(prompt, cap), error: null };
  } catch (err) {
    first = err instanceof Error ? err.message.slice(0, 60) : 'gemini failed';
  }
  try {
    return { text: await completeDeepSeek(prompt, cap), error: null };
  } catch (err) {
    return { text: null, error: `${first} / ${err instanceof Error ? err.message.slice(0, 60) : 'deepseek failed'}` };
  }
}
