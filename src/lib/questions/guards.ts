import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { matchingJargonTerm } from '@/lib/voice/jargon';
import { matchingPhrasePattern } from '@/lib/voice/phrase-guard';

import type { QuestionDraft } from './types';

/**
 * First guard hit on one string — framework fence, then jargon, then phrase.
 *
 * Context, not keywords (emci 2026-10-20): a question is dropped only for a real
 * problem in what it SAYS — a framework result or test claim handed to the reader
 * (fence), or a psychological verdict about the reader or another person (jargon:
 * "You are an introvert", "your boss is a narcissist"). A question that mentions a
 * term to ask about it ("Does a quiet night recharge introverts for you?") or uses an
 * everyday word (competitive, ocean) is kept. The phrase guard is its own rule.
 */
export function questionTextGuardHit(text: string): string | null {
  if (containsFrameworkTerm(text)) return 'framework-echo';
  const jargon = matchingJargonTerm(text);
  if (jargon) return jargon;
  const phrase = matchingPhrasePattern(text);
  if (phrase) return phrase;
  return null;
}

/**
 * Same two Explore guard layers on the stem AND every option.
 * A hit means skip this question (do not show the blocked line as a fallback).
 */
export function questionDraftGuardHit(draft: QuestionDraft): string | null {
  const fromPrompt = questionTextGuardHit(draft.prompt);
  if (fromPrompt) return fromPrompt;
  for (const option of draft.options) {
    const fromOption = questionTextGuardHit(option.text);
    if (fromOption) return fromOption;
  }
  return null;
}

export function keepGuardedDrafts(drafts: QuestionDraft[]): {
  kept: QuestionDraft[];
  hits: string[];
} {
  const kept: QuestionDraft[] = [];
  const hits: string[] = [];
  for (const draft of drafts) {
    const hit = questionDraftGuardHit(draft);
    if (hit) hits.push(hit);
    else kept.push(draft);
  }
  return { kept, hits };
}
