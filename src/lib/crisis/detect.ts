/**
 * Crisis detection — keyword/phrase-list only, per the plan's original spec:
 * "static keyword/phrase list (starter list, expand over time) checked against
 * the user's message before it reaches the router. No sentiment model in v1 —
 * keyword match is auditable and fails safe."
 *
 * v2 approved set: matcher fixes + high-intent phrases. No AI classifier —
 * detectCrisis never reaches out to a model.
 */

/**
 * Approved phrase list — user-reviewed, do not regenerate.
 * "want to die", "off myself", and "kms" are listed here for audit but are
 * not naive substring matches; see keywordDetect.
 */
export const CRISIS_KEYWORDS: readonly string[] = [
  'suicide',
  'kill myself',
  'killing myself',
  'kill my self',
  'cutting myself',
  'cut myself',
  'ending my life',
  'end my life',
  'ended my life',
  'overdosed',
  'overdosing',
  'hanging myself',
  'swallowed pills',
  'self-harmed',
  'self harming',
  'want to die',
  'wish i was dead',
  'wish i were dead',
  "don't want to be alive",
  'dont want to be alive',
  'take my own life',
  'taking my own life',
  'end it all',
  'not worth living',
  'nothing to live for',
  'hurt myself',
  'harm myself',
  'hurting myself',
  'kms',
  'unalive myself',
  'off myself',
  'offing myself',
  'better off dead',
];

/** Phrases that must not use naive includes() — they have dedicated matchers. */
const SUBSTRING_SKIP = new Set(['want to die', 'off myself', 'kms']);

/**
 * Stem/token regex. "suicid" is a prefix (leading \b, no trailing \b) so
 * suicide / suicidal / suicidality all hit. "kms" is a whole token.
 * Remaining stems keep both boundaries, same as v1.
 */
export const CRISIS_KEYWORD_REGEX =
  /\bsuicid|\bkms\b|\b(?:self[- ]?harm|kill[- ]?myself|overdose|slit|hang[- ]?myself|swallow[- ]?pills)\b/i;

const NORMALIZE = /[^a-z0-9]+/g;

export function normalizeCrisis(text: string): string {
  return text.toLowerCase().replace(NORMALIZE, ' ').trim();
}

/**
 * "want to die" skips only when don't / do not / doesn't / never immediately
 * precede the phrase (apostrophes become spaces in normalizeCrisis).
 *
 * This deliberately accepts a real miss case like "I don't want to die but I
 * have a plan" — that's a known tradeoff, not a bug to silently fix later.
 * Any other shape, or a later un-negated "want to die" in the same message,
 * still flags (fail toward showing the card).
 */
const WANT_TO_DIE = 'want to die';
const WANT_TO_DIE_NEGATION = /(?:^|\s)(?:never|do not|dont|don t|doesnt|doesn t)$/;

function matchesWantToDie(normalized: string): boolean {
  let from = 0;
  while (from < normalized.length) {
    const idx = normalized.indexOf(WANT_TO_DIE, from);
    if (idx === -1) return false;
    const before = normalized.slice(0, idx).trimEnd();
    if (!WANT_TO_DIE_NEGATION.test(before)) return true;
    from = idx + WANT_TO_DIE.length;
  }
  return false;
}

/**
 * "off myself" as a bounded phrase, not a loose substring. Skip when the
 * immediately preceding word is a particle object (it/this/that/them/these/
 * those) so "get it off myself" / "take this off myself" do not flag.
 * Ambiguous leftovers still flag. "offing myself" is a separate inflection
 * and is matched as a normal substring.
 */
const OFF_MYSELF = 'off myself';
const PARTICLE_BEFORE_OFF = new Set(['it', 'this', 'that', 'them', 'these', 'those']);

function isBoundedAt(normalized: string, idx: number, len: number): boolean {
  const beforeOk = idx === 0 || normalized[idx - 1] === ' ';
  const end = idx + len;
  const afterOk = end >= normalized.length || normalized[end] === ' ';
  return beforeOk && afterOk;
}

function matchesOffMyself(normalized: string): boolean {
  let from = 0;
  while (from < normalized.length) {
    const idx = normalized.indexOf(OFF_MYSELF, from);
    if (idx === -1) return false;
    if (isBoundedAt(normalized, idx, OFF_MYSELF.length)) {
      const before = normalized.slice(0, idx).trimEnd();
      const prev = before.split(/\s+/).filter(Boolean).pop() ?? '';
      if (!PARTICLE_BEFORE_OFF.has(prev)) return true;
    }
    from = idx + 1;
  }
  return false;
}

/** The sole detection mechanism: a pure keyword/regex check. Auditable, fails safe. */
export function keywordDetect(message: string): boolean {
  const normalized = normalizeCrisis(message);
  if (
    CRISIS_KEYWORDS.some((keyword) => {
      if (SUBSTRING_SKIP.has(keyword)) return false;
      return normalized.includes(normalizeCrisis(keyword));
    })
  ) {
    return true;
  }
  if (matchesWantToDie(normalized)) return true;
  if (matchesOffMyself(normalized)) return true;
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
