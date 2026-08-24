import { VOICE_CONFIG } from '@/lib/voice/config';

/**
 * A SMALL, SEPARATE classifier call — never the main Sage/router reply call.
 * Asks only "does this message indicate real self-harm/suicide risk, yes or
 * no" with structured boolean output, no conversation. Must complete and
 * return before the main router call fires.
 */

export interface ClassifyOptions {
  model?: string;
  apiKey?: string;
  /** How long to wait before treating the call as failed. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const CLASSIFIER_SYSTEM =
  'You are a crisis classifier for a wellness app. Decide whether the user message indicates ' +
  'real self-harm or suicide risk. Answer with JSON only: {"flagged": true} or {"flagged": false}. ' +
  'Flag genuine, current risk. Do not flag ordinary sadness, frustration, or venting without ' +
  'self-harm intent. When uncertain, lean toward flagging.';

const DEFAULT_TIMEOUT_MS = 4000;

export function buildClassifierUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

/** Extracts {flagged} from Gemini's JSON, tolerating fences/stray text. Returns null if unusable. */
export function parseClassified(raw: string): boolean | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  try {
    const obj = JSON.parse(cleaned) as { flagged?: unknown };
    if (typeof obj.flagged === 'boolean') return obj.flagged;
  } catch {
    // fall through to regex
  }

  const match = cleaned.match(/"flagged"\s*:\s*(true|false)/i);
  if (match) return match[1].toLowerCase() === 'true';
  return null;
}

/**
 * Runs the narrow classifier. Returns { flagged } on success, or throws on
 * failure/timeout so the caller can fall back to the keyword list. Never
 * silently skips detection.
 */
export async function classifyCrisis(
  message: string,
  options: ClassifyOptions = {},
): Promise<{ flagged: boolean }> {
  const model = options.model ?? VOICE_CONFIG.geminiModel;
  const apiKey = options.apiKey ?? VOICE_CONFIG.geminiApiKey;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!apiKey) {
    throw new Error('classifyCrisis: no Gemini API key configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(buildClassifierUrl(model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CLASSIFIER_SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 100,
          responseMimeType: 'application/json',
          // gemini-3.x are thinking models: without an explicit level, the
          // model burns its whole (tiny) output budget on thinking and returns
          // no JSON. thinkingConfig nests under generationConfig. The budget
          // must leave room for thinking + the {"flagged": ...} answer.
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`classifyCrisis: Gemini ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text =
      data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

    const flagged = parseClassified(text);
    if (flagged === null) {
      throw new Error('classifyCrisis: response contained no usable boolean');
    }
    return { flagged };
  } finally {
    clearTimeout(timer);
  }
}
