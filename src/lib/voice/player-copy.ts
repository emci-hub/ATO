/**
 * Mechanical half of docs/voice-guide.md (meaning first, v2). The guide is
 * the source of truth. This module refuses coach phrases and slang outside
 * the casual tier. A repeated sentence shape is not a failure.
 *
 * It does not require a scene, a flip, a joke, or a ban on ordinary object
 * words. Those checks pushed lines into imagery. Accuracy stays a writer's job.
 */
import type { TraitAxis } from '@/lib/traits';

export const SHAPE_CAP = 0.25;

export type SentenceShape = 'question' | 'quote' | 'because' | 'then' | 'compound' | 'when' | 'punch' | 'other';

/** Phrases the guide bans. Case-insensitive. Coach "journey" is banned; a sourced legend fact may still say journeys. */
export const BANNED_PHRASE_RES: readonly { re: RegExp; label: string }[] = [
  { re: /the untried option/i, label: 'The untried option' },
  { re: /gets the first look/i, label: 'Gets the first look' },
  { re: /one look is enough/i, label: 'One look is enough' },
  { re: /the rest can wait/i, label: 'The rest can wait' },
  { re: /\bshared side\b/i, label: 'Shared side' },
  { re: /\bno shared side\b/i, label: 'No shared side' },
  { re: /\bstrong match\b/i, label: 'Strong match' },
  { re: /\bno match\b/i, label: 'No match' },
  { re: /chased an unknown glow/i, label: 'Chased an unknown glow' },
  { re: /measured everything, twice/i, label: 'Measured everything, twice' },
  { re: /kept to the familiar choice/i, label: 'You kept to the familiar choice' },
  { re: /you are someone who/i, label: 'You are someone who' },
  { re: /you may find/i, label: 'You may find' },
  { re: /it['’]s important to/i, label: "It's important to" },
  { re: /\bembrace\b/i, label: 'Embrace' },
  { re: /\bnavigate\b/i, label: 'Navigate' },
  { re: /\bunlock\b/i, label: 'Unlock' },
  { re: /\bvibes?\b/i, label: 'Vibe' },
  { re: /\benergy\b/i, label: 'energy' },
  { re: /\bvibe check\b/i, label: 'Vibe check' },
];

/** Coach "journey", not a sourced travel fact. */
export const JOURNEY_RE = /\bjourney\b/i;

/**
 * Casual seasoning only. Group-specific or very new terms stay off the list
 * on purpose: they are banned by not being allowed, and legends never get them.
 * "bet" / "mid" / "fr" are ordinary words and are not on this list.
 */
export const SLANG_RES: readonly { re: RegExp; label: string }[] = [
  { re: /\blowkey\b/i, label: 'lowkey' },
  { re: /\bhighkey\b/i, label: 'highkey' },
  { re: /\bghosted\b/i, label: 'ghosted' },
  { re: /\bslay(?:ed|s)?\b/i, label: 'slay' },
  { re: /\brizz\b/i, label: 'rizz' },
  { re: /\bdelulu\b/i, label: 'delulu' },
  { re: /\bcheugy\b/i, label: 'cheugy' },
  { re: /\bperiodt\b/i, label: 'periodt' },
  { re: /\biykyk\b/i, label: 'iykyk' },
  { re: /\bno cap\b/i, label: 'no cap' },
  { re: /\brent-free\b/i, label: 'rent-free' },
  { re: /\bmain character\b/i, label: 'main character' },
];

export const CASUAL_FRAMES = new Set(['casual', 'slang']);

/**
 * Old scene phrases. v2 does not require them and does not reserve them for
 * one trait. Kept so older notes can still name what a line used.
 */
export const TRAIT_SCENES: Record<TraitAxis, readonly string[]> = {
  openness: ['group chat'],
  conscientiousness: ['packing list'],
  extraversion: ['said hi first'],
  agreeableness: ['split the bill'],
  steadiness: ['until morning'],
  attachment_anxiety: ['second text'],
  attachment_avoidance: ['went home early'],
  conflict_assertiveness: ['said it in the meeting'],
  conflict_cooperativeness: ['moved dinner'],
  autonomy: ['without a poll'],
  competence: ['hit send'],
  relatedness: ['on the couch'],
  growth_mindset: ['burned the rice'],
  locus_of_control: ['changed the reservation'],
  self_efficacy: ['started the hard part'],
  playfulness: ['side quest'],
};

/**
 * v2 dropped the word ban on ticket, kettle, fork, bag, chair, costume, and
 * the rest. The ban pushed writers to invent a substitute image. Do not use
 * an object as a code for a trait; the check no longer polices the words.
 */
export function metaphorSymbolIssues(_text: string): CopyIssue[] {
  return [];
}

export function sentenceShape(sentence: string): SentenceShape {
  const line = sentence.trim();
  if (!line) return 'other';
  if (/[?？]\s*$/.test(line) || /\?/.test(line)) return 'question';
  if (/[“”"]/.test(line)) return 'quote';
  if (/\bbecause\b/i.test(line)) return 'because';
  if (/\band then\b|,\s*then\b/i.test(line)) return 'then';
  if (/,\s*and\b/i.test(line)) return 'compound';
  if (/\bwhen\b/i.test(line)) return 'when';
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length <= 6) return 'punch';
  return 'other';
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** Share of the most common shape. A card fails when this is over SHAPE_CAP. */
export function shapeStats(sentences: readonly string[]): {
  shape: SentenceShape;
  share: number;
  sentences: number;
} {
  if (sentences.length === 0) return { shape: 'other', share: 0, sentences: 0 };
  const counts = new Map<SentenceShape, number>();
  for (const sentence of sentences) {
    const shape = sentenceShape(sentence);
    counts.set(shape, (counts.get(shape) ?? 0) + 1);
  }
  let shape: SentenceShape = 'other';
  let best = 0;
  for (const [name, count] of counts) {
    if (count > best) {
      best = count;
      shape = name;
    }
  }
  return { shape, share: best / sentences.length, sentences: sentences.length };
}

export function dominantShapeShare(text: string): { shape: SentenceShape; share: number; sentences: number } {
  return shapeStats(splitSentences(text));
}

/** One card, one field at a time, so a title with no period stays its own line. */
export function cardSentences(parts: readonly string[]): string[] {
  const sentences: string[] = [];
  for (const part of parts) {
    for (const sentence of splitSentences(part)) sentences.push(sentence);
  }
  return sentences;
}

export interface CopyIssue {
  label: string;
  detail: string;
}

export function textIssues(text: string, options: { casual?: boolean; allowJourney?: boolean } = {}): CopyIssue[] {
  const issues: CopyIssue[] = [];
  for (const row of BANNED_PHRASE_RES) {
    if (row.re.test(text)) issues.push({ label: row.label, detail: `banned phrase "${row.label}"` });
  }
  if (!options.allowJourney && JOURNEY_RE.test(text)) {
    issues.push({ label: 'Journey', detail: 'banned word "journey"' });
  }
  const slangHits = SLANG_RES.filter((row) => row.re.test(text));
  if (!options.casual && slangHits.length > 0) {
    issues.push({ label: slangHits[0]!.label, detail: `slang "${slangHits[0]!.label}" outside the casual tier` });
  }
  for (const sentence of splitSentences(text)) {
    const inSentence = SLANG_RES.filter((row) => row.re.test(sentence));
    if (inSentence.length > 1) {
      issues.push({ label: 'slang', detail: `more than one slang term in "${sentence}"` });
    }
  }
  return issues;
}

/** Tag questions ("…, right?") stay at or under this share of a line bank. */
export const TAG_QUESTION_CAP = 0.1;

/** A scene prop may show once on a card, and only a few times in that trait's bank. */
export const PROP_CAP_PER_CARD = 1;
export const PROP_CAP_PER_TRAIT = 12;

export function phraseCount(text: string, phrase: string): number {
  const hay = text.toLowerCase();
  const needle = phrase.toLowerCase();
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (from <= hay.length) {
    const at = hay.indexOf(needle, from);
    if (at < 0) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

export function tagQuestionShare(texts: readonly string[]): number {
  if (texts.length === 0) return 0;
  const hits = texts.filter((text) => /,\s*right\s*\?/i.test(text)).length;
  return hits / texts.length;
}

/** v2: a repeated scene phrase is not a failure. The cap args stay for callers. */
export function scenePropOveruse(_text: string, _cap: number): CopyIssue[] {
  return [];
}

/** Spoken lines on one card. A repeated shape is reported, not refused: plain sentences share a shape, and refusing that forced a false "when". */
export function repeatedShape(sentences: readonly string[]): SentenceShape | null {
  const seen = new Set<SentenceShape>();
  for (const sentence of sentences) {
    const shape = sentenceShape(sentence);
    if (seen.has(shape)) return shape;
    seen.add(shape);
  }
  return null;
}

/** v2: a trait does not need a private scene phrase, and phrases may overlap. */
export function sceneReuse(_byTrait: Readonly<Record<string, string>>): CopyIssue[] {
  return [];
}
