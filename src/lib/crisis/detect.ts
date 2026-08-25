/**
 * Crisis detection — keyword/phrase-list only, per the plan's original spec:
 * "static keyword/phrase list (starter list, expand over time) checked against
 * the user's message before it reaches the router. No sentiment model in v1 —
 * keyword match is auditable and fails safe."
 *
 * The Gemini classifier that used to run first was removed: it burned 487–561
 * invisible thinking tokens on every Talk message before the reply generated,
 * for a catch-rate benefit that no longer justified the recurring cost/latency.
 * The keyword list below is the same user-reviewed list as before — only what
 * triggers off it changed, not the list itself.
 */

/** Trimmed keyword list — user-reviewed/approved, do not regenerate. */
export const CRISIS_KEYWORDS: readonly string[] = [
  'suicide',
  'kill myself',
  'cutting myself',
  'ending my life',
];

/** Word-boundary regex safety net — user-reviewed/approved. */
export const CRISIS_KEYWORD_REGEX =
  /\b(suicid|self[- ]?harm|kill[- ]?myself|overdose|slit|hang[- ]?myself|swallow[- ]?pills)\b/i;

const NORMALIZE = /[^a-z0-9]+/g;

export function normalizeCrisis(text: string): string {
  return text.toLowerCase().replace(NORMALIZE, ' ').trim();
}

/** The sole detection mechanism: a pure keyword/regex check. Auditable, fails safe. */
export function keywordDetect(message: string): boolean {
  const normalized = normalizeCrisis(message);
  if (CRISIS_KEYWORDS.some((keyword) => normalized.includes(normalizeCrisis(keyword)))) {
    return true;
  }
  return CRISIS_KEYWORD_REGEX.test(message);
}

export interface CrisisDetection {
  flagged: boolean;
  /** How the decision was reached — always 'keyword' now. */
  method: 'keyword';
}

/**
 * Detects whether a message indicates real self-harm/suicide risk. Runs before
 * any main router call; a flagged message short-circuits to the static crisis
 * card with zero model calls. Never throws, never reaches out to a model.
 */
export async function detectCrisis(message: string): Promise<CrisisDetection> {
  return { flagged: keywordDetect(message), method: 'keyword' };
}
