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

/**
 * The answer itself is a handful of tokens, but Gemini 3.x models always think
 * to some degree and bill thinking tokens against this same budget. A tight cap
 * gets spent on reasoning and returns no text at all, which would look like a
 * broken classifier and silently hand every message to the keyword net.
 */
const CLASSIFIER_MAX_OUTPUT_TOKENS = 512;

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
 * Runs the narrow classifier. Returns { flagged } plus the model that answered
 * on success, or throws on failure/timeout so the caller can fall back to the
 * keyword list. Never silently skips detection.
 */
export async function classifyCrisis(
  message: string,
  options: ClassifyOptions = {},
): Promise<{ flagged: boolean; model: string }> {
  const model = options.model ?? VOICE_CONFIG.geminiModel;
  const apiKey = options.apiKey ?? VOICE_CONFIG.geminiApiKey;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!apiKey) {
    throw new Error('classifyCrisis: no Gemini API key configured');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

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
          // 'minimal' is the closest 3.x gets to thinking-off, which is what a
          // one-boolean decision needs to land inside the timeout. temperature
          // is deliberately unset: Gemini 3.x is tuned for its default
          // sampling and no longer recommends pinning it.
          thinkingConfig: { thinkingLevel: 'minimal' },
          maxOutputTokens: CLASSIFIER_MAX_OUTPUT_TOKENS,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`classifyCrisis: Gemini ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };

    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

    const flagged = parseClassified(text);
    if (flagged === null) {
      // Distinguish "spent the budget thinking" from "answered something
      // unparseable" — they need different fixes, and both end up here.
      throw new Error(
        candidate?.finishReason === 'MAX_TOKENS'
          ? `classifyCrisis: hit the ${CLASSIFIER_MAX_OUTPUT_TOKENS}-token cap before answering`
          : 'classifyCrisis: response contained no usable boolean',
      );
    }
    return { flagged, model };
  } catch (err) {
    // An abort surfaces as a bare "operation was aborted" DOMException, which
    // reads as a mystery failure in the fallback log. Name the real cause.
    if (timedOut) {
      throw new Error(`classifyCrisis: timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
