/**
 * The stored Focus · try · watch bank (emci, 2026-10-07). Replaces the
 * AI-written daily insight: Home picks one idea from here, on the device, with
 * no model call, no quota and no AI consent gate, and saves it through the
 * same `insert_daily_insight` RPC the AI insight used.
 *
 * How an idea maps onto a `daily_insights` row:
 *   theme      = the trait tags (`ideaTheme`), the chip row on Home
 *   title      = the focus (one of three wordings)
 *   reflection = why
 *   try_today  = try (one of two)
 *   watch_for  = watch (one of two)
 *
 * The title is how a stored row is matched back to its idea (`ideaForTitle`),
 * which is why every focus wording in the bank must be unique. A row whose
 * title is not in the bank was written by the old AI insight; it is hidden in
 * every history surface and ignored by the picker, never deleted.
 *
 * UNREVIEWED: INSIGHT_BANK_COPY_REVIEWED stays false until emci ticks
 * docs/insight-bank-review.md. Nothing in the app renders the flag (emci,
 * 2026-10-07: no draft badge for this bank).
 */
import { AXIS_POLE_NAME, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { axisOfKey, type LineKey } from '@/lib/daily-line/bank';
import { isShareableLean } from '@/lib/legends64/identity';
import type { TraitLean } from '@/lib/traits';

import { AGREEABLENESS_IDEAS } from './agreeableness';
import { ATTACHMENT_ANXIETY_IDEAS } from './attachment-anxiety';
import { ATTACHMENT_AVOIDANCE_IDEAS } from './attachment-avoidance';
import { AUTONOMY_IDEAS } from './autonomy';
import { COMPETENCE_IDEAS } from './competence';
import { CONFLICT_ASSERTIVENESS_IDEAS } from './conflict-assertiveness';
import { CONFLICT_COOPERATIVENESS_IDEAS } from './conflict-cooperativeness';
import { CONSCIENTIOUSNESS_IDEAS } from './conscientiousness';
import type { InsightIdea } from './define';
import { EXTRAVERSION_IDEAS } from './extraversion';
import { GROWTH_MINDSET_IDEAS } from './growth-mindset';
import { LOCUS_OF_CONTROL_IDEAS } from './locus-of-control';
import { OPENNESS_IDEAS } from './openness';
import { PLAYFULNESS_IDEAS } from './playfulness';
import { RELATEDNESS_IDEAS } from './relatedness';
import { SELF_EFFICACY_IDEAS } from './self-efficacy';
import { STARTER_IDEAS } from './starters';
import { STEADINESS_IDEAS } from './steadiness';

export type { InsightIdea } from './define';

export const INSIGHT_BANK_COPY_REVIEWED = false;

/** Ideas with at least one key, in trait order. */
export const TRAIT_IDEAS: readonly InsightIdea[] = [
  ...OPENNESS_IDEAS,
  ...CONSCIENTIOUSNESS_IDEAS,
  ...EXTRAVERSION_IDEAS,
  ...AGREEABLENESS_IDEAS,
  ...STEADINESS_IDEAS,
  ...ATTACHMENT_ANXIETY_IDEAS,
  ...ATTACHMENT_AVOIDANCE_IDEAS,
  ...CONFLICT_ASSERTIVENESS_IDEAS,
  ...CONFLICT_COOPERATIVENESS_IDEAS,
  ...AUTONOMY_IDEAS,
  ...COMPETENCE_IDEAS,
  ...RELATEDNESS_IDEAS,
  ...GROWTH_MINDSET_IDEAS,
  ...LOCUS_OF_CONTROL_IDEAS,
  ...SELF_EFFICACY_IDEAS,
  ...PLAYFULNESS_IDEAS,
];

export { STARTER_IDEAS };

export const ALL_IDEAS: readonly InsightIdea[] = [...TRAIT_IDEAS, ...STARTER_IDEAS];

const BY_ID = new Map(ALL_IDEAS.map((entry) => [entry.id, entry]));

export function ideaById(id: string): InsightIdea | null {
  return BY_ID.get(id) ?? null;
}

export interface TitleMatch {
  idea: InsightIdea;
  /** Which of the three focus wordings the title is. */
  variant: number;
}

const BY_TITLE = new Map<string, TitleMatch>();
for (const entry of ALL_IDEAS) {
  entry.focus.forEach((text, variant) => BY_TITLE.set(text, { idea: entry, variant }));
}

/** The idea a stored title came from, or null for an old AI-written row. */
export function ideaForTitle(title: string | null | undefined): TitleMatch | null {
  if (!title) return null;
  return BY_TITLE.get(title.trim()) ?? null;
}

/** True when a stored insight came from this bank. Old AI rows are hidden everywhere. */
export function isBankInsightTitle(title: string | null | undefined): boolean {
  return ideaForTitle(title) != null;
}

/** What a starter's tag row says. */
export const STARTER_TAG_LABEL = 'General';
/** How the tags are joined in the stored `theme`, and split again on Home. */
export const TAG_SEPARATOR = ' · ';

/** One tag: "Reassurance: Watchful". Never the internal trait id. */
export function keyTag(key: LineKey): string {
  const axis = axisOfKey(key);
  const lean = key.slice(key.indexOf(':') + 1) as TraitLean;
  return `${AXIS_SHORT_NAME[axis]}: ${AXIS_POLE_NAME[axis][lean]}`;
}

export function ideaTags(entry: InsightIdea): string[] {
  return entry.keys.length === 0 ? [STARTER_TAG_LABEL] : entry.keys.map(keyTag);
}

/** The stored `theme`: the tags joined, which Home splits back into chips. */
export function ideaTheme(entry: InsightIdea): string {
  return ideaTags(entry).join(TAG_SEPARATOR);
}

/** Splits a stored theme back into chips. */
export function themeTags(theme: string | null | undefined): string[] {
  return (theme ?? '')
    .split(TAG_SEPARATOR)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Whether this idea's focus and tags may leave the app (widget, push, share).
 * Same list the share image uses: closeness-and-worry leans and the struggle
 * side of a trait stay inside the app. Starters have no key and are fine.
 */
export function ideaShareable(entry: InsightIdea): boolean {
  return entry.keys.every((key) => {
    const lean = key.slice(key.indexOf(':') + 1) as TraitLean;
    return isShareableLean(axisOfKey(key), lean);
  });
}
