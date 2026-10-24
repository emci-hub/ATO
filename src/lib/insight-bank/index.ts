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

/**
 * Focus wordings changed by the 2026-10-19 copy review: old wording → current
 * wording. Stored rows are matched by title, so the old text still maps to its
 * idea and variant (today's saved insight and the no-repeat history keep
 * working). Add a line here whenever a focus text is reworded.
 */
export const RETIRED_FOCUS_TEXT: Readonly<Record<string, string>> = {
  'At a restaurant, you usually pick a dish you have never ordered, even when you already know a favorite.':
    'Your answers suggest you like trying new things, even when a favorite is right there.',
  'Choosing where to eat, you can skip the usual place for one you have not tried.':
    'A new option can pull you in while a favorite is still available.',
  'The new item on the menu sometimes gets your order before the dish you already like.':
    'You can want the new thing and still have a favorite sitting there.',
  'Your answers suggest you like trying something new, even when a familiar option is already there.':
    'Your answers suggest you like trying new things, even when a favorite is right there.',
  'You like a new option even when you already know one you enjoy.':
    'A new option can pull you in while a favorite is still available.',
  'Choosing something new can appeal to you even when a familiar choice is right there.':
    'You can want the new thing and still have a favorite sitting there.',
  'After a busy week, a quiet night at home usually sounds better to you than a night out.':
    'You recharge with time to yourself, especially after a stretch around other people.',
  'A calendar full of social plans can leave you tired before the week is over.':
    'Time to yourself is how you come back after being around other people.',
  'You sometimes come back to yourself in time alone, especially after a long day around people.':
    'A stretch around other people can leave you wanting time to yourself afterward.',
  'You usually keep every promise you make, even the ones you said yes to too fast.':
    'A promise you made too fast on Tuesday can still own your Thursday night.',
  'You usually keep your promises, even the ones you said yes to too fast.':
    'A promise you made too fast on Tuesday can still own your Thursday night.',
  'You adapt to new plans easily, but small tasks tend to stack up when there’s no deadline.':
    'You handle a shifted meeting fine, and small errands can wait when the calendar does not force them.',
  'You handle changing plans well, but small tasks can pile up when there’s no deadline.':
    'You handle a shifted meeting fine, and small errands can wait when the calendar does not force them.',
  'You usually see problems as smaller than others do, which can feel like you’re not taking them seriously.':
    'A worry that looks small to you can have you calming the person down before you have heard the whole story.',
  'You usually see problems as smaller than others do, so people may feel you’re not taking them seriously.':
    'A worry that looks small to you can have you calming the person down before you have heard the whole story.',
  'When something goes wrong, you tend to sleep fine and feel better by morning.':
    'When something goes wrong, you sometimes feel more settled by the next morning.',
  'When something goes wrong, you tend to feel more settled by the next day.':
    'When something goes wrong, you sometimes feel more settled by the next morning.',
  'You’re usually the person people call when something goes wrong.':
    'A crisis in the group chat can land in your messages first.',
  'People tend to call you first when something goes wrong.':
    'A crisis in the group chat can land in your messages first.',
};
for (const [oldText, currentText] of Object.entries(RETIRED_FOCUS_TEXT)) {
  const match = BY_TITLE.get(currentText);
  if (match) BY_TITLE.set(oldText, match);
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
