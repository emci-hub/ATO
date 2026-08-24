/**
 * Crisis detection (plan: crisis spec, upgraded to classifier + keyword net).
 *
 * Detection is now ACTIVE (user approved the approach and supplied the keyword
 * list): classifier-first with a keyword-list safety net if the classifier
 * fails, times out, or errors. Never silently skips detection.
 */
import { classifyCrisis, type ClassifyOptions } from './classify';

/** Trimmed keyword safety net — user-approved list. */
export const CRISIS_KEYWORDS: readonly string[] = [
  'suicide',
  'kill myself',
  'cutting myself',
  'ending my life',
];

/** Word-boundary regex safety net — user-approved. */
export const CRISIS_KEYWORD_REGEX =
  /\b(suicid|self[- ]?harm|kill[- ]?myself|overdose|slit|hang[- ]?myself|swallow[- ]?pills)\b/i;

const NORMALIZE = /[^a-z0-9]+/g;

export function normalizeCrisis(text: string): string {
  return text.toLowerCase().replace(NORMALIZE, ' ').trim();
}

/** Pure keyword/regex check — the fallback safety net. */
export function keywordDetect(message: string): boolean {
  const normalized = normalizeCrisis(message);
  if (CRISIS_KEYWORDS.some((keyword) => normalized.includes(normalizeCrisis(keyword)))) {
    return true;
  }
  return CRISIS_KEYWORD_REGEX.test(message);
}

export interface CrisisDetection {
  flagged: boolean;
  /** How the decision was reached. */
  method: 'classifier' | 'keyword-fallback';
  /** Present when the classifier failed and the keyword net caught it. */
  error?: string;
}

export interface DetectCrisisOptions {
  /** Injectable for tests; defaults to the real Gemini classifier call. */
  classify?: (message: string, options?: ClassifyOptions) => Promise<{ flagged: boolean }>;
  classifyOptions?: ClassifyOptions;
}

/**
 * Detects whether a message indicates real self-harm/suicide risk.
 * Classifier first (must complete before any main router call); on any
 * classifier failure/timeout it falls back to the keyword net. Never throws.
 */
export async function detectCrisis(
  message: string,
  options: DetectCrisisOptions = {},
): Promise<CrisisDetection> {
  const classify = options.classify ?? classifyCrisis;

  try {
    const { flagged } = await classify(message, options.classifyOptions);
    return { flagged, method: 'classifier' };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const flagged = keywordDetect(message);
    return { flagged, method: 'keyword-fallback', error };
  }
}
