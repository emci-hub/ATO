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
  /** Time spent in the classifier attempt, whether it answered or failed. */
  latencyMs: number;
  /** The model that answered. Absent whenever the keyword net decided. */
  model?: string;
  /** Present when the classifier failed and the keyword net caught it. */
  error?: string;
}

export interface DetectCrisisOptions {
  /** Injectable for tests; defaults to the real Gemini classifier call. */
  classify?: (
    message: string,
    options?: ClassifyOptions,
  ) => Promise<{ flagged: boolean; model?: string }>;
  classifyOptions?: ClassifyOptions;
}

const IS_DEV = typeof __DEV__ === 'boolean' ? __DEV__ : false;

/**
 * Dev-only trace of which path decided. Deliberately carries no message text:
 * the crisis spec allows the flag, never the content.
 */
function traceDetection(detection: CrisisDetection): void {
  if (!IS_DEV) return;
  const where =
    detection.method === 'classifier'
      ? `classifier(${detection.model ?? 'unknown model'})`
      : `keyword-fallback after "${detection.error ?? 'unknown error'}"`;
  console.log(
    `[crisis] flagged=${detection.flagged} via ${where} in ${detection.latencyMs}ms`,
  );
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
  const startedAt = Date.now();

  try {
    const { flagged, model } = await classify(message, options.classifyOptions);
    const detection: CrisisDetection = {
      flagged,
      method: 'classifier',
      latencyMs: Date.now() - startedAt,
      model,
    };
    traceDetection(detection);
    return detection;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const detection: CrisisDetection = {
      flagged: keywordDetect(message),
      method: 'keyword-fallback',
      latencyMs: Date.now() - startedAt,
      error,
    };
    traceDetection(detection);
    return detection;
  }
}
