/**
 * Declared AI call-site metadata.
 *
 * Every product call site that reaches generateText declares how its output
 * may be shared / batched through one of the consts below, so batching
 * decisions (cohort generation, per-profile-bucket generation, scheduled
 * runs) can be made without re-reading each prompt. Values track the audit
 * in PROJECT_CONTEXT.md / docs/DATA_AI_MAP.md. scripts/ai-provider-check.ts
 * fails when any generateText call site is missing this declaration.
 */
import type { AiCallMetadata } from './types';

/** Daily Read/Do card — Dawn, Home, catch-up. Prompt carries name, talk style,
 * yesterday's tone, the last 7 checks, and Library lines, so output is per-user. */
export const DAILY_CARD_META: AiCallMetadata = {
  personalized: true,
  cohortShareable: false,
  bucketShareable: false,
  latencySensitive: true,
};

/** Talk reply — Sage chat, one reply per user message. Fully per-message. */
export const TALK_META: AiCallMetadata = {
  personalized: true,
  cohortShareable: false,
  bucketShareable: false,
  latencySensitive: true,
};

/** Infinite Questions 5-item batch — Home fold / "Tell Sage more". Stems are
 * generic; only axis rotation + trait grounding are per-user, so one cohort
 * generation could be sliced per user. */
export const QUESTIONS_META: AiCallMetadata = {
  personalized: false,
  cohortShareable: true,
  bucketShareable: false,
  latencySensitive: true,
};

/** Full 16-axis sweep — "A faster pass". Same generic axis questions for every
 * user; near-fully cohort-shareable. */
export const SWEEP_META: AiCallMetadata = {
  personalized: false,
  cohortShareable: true,
  bucketShareable: false,
  latencySensitive: true,
};

/** Explore Observations — periodic per-user pack grounded on this user's
 * traits, signals, reaction miss-notes, and pinned categories. */
export const EXPLORE_OBSERVATIONS_META: AiCallMetadata = {
  personalized: true,
  cohortShareable: false,
  bucketShareable: false,
  latencySensitive: true,
};

/** Sage Title "Today's Read" — pure function of the stable report-track
 * profile, so one generation per trait-profile bucket covers the bucket. */
export const SAGE_TITLE_META: AiCallMetadata = {
  personalized: false,
  cohortShareable: false,
  bucketShareable: true,
  latencySensitive: true,
};

/** The Story — pure function of settled categories + told-vs-played tension,
 * so bucket-shareable; runs on tab mount with no waiting UI. */
export const SAGE_STORY_META: AiCallMetadata = {
  personalized: false,
  cohortShareable: false,
  bucketShareable: true,
  latencySensitive: false,
};

/** Sage insight spend — token-paid, on-demand observation drawn from this
 * user's name, talk style, and trait depth. */
export const SAGE_INSIGHT_META: AiCallMetadata = {
  personalized: true,
  cohortShareable: false,
  bucketShareable: false,
  latencySensitive: true,
};

export interface AiCallSite {
  feature: string;
  location: string;
  meta: AiCallMetadata;
}

/** Display registry for the report command and the ai-provider check. */
export const AI_CALL_SITES: readonly AiCallSite[] = [
  {
    feature: 'Daily card',
    location: 'src/lib/voice/providers/remote.ts → generate()',
    meta: DAILY_CARD_META,
  },
  {
    feature: 'Talk reply',
    location: 'src/lib/voice/providers/remote.ts → generateTalk()',
    meta: TALK_META,
  },
  {
    feature: 'Infinite Questions',
    location: 'src/lib/questions/generate.ts → generateQuestionBatch()',
    meta: QUESTIONS_META,
  },
  {
    feature: 'Faster-pass sweep',
    location: 'src/lib/questions/sweep.ts → generateQuestionSweep()',
    meta: SWEEP_META,
  },
  {
    feature: 'Explore observations',
    location: 'src/app/(tabs)/explore.tsx → routeExplore()',
    meta: EXPLORE_OBSERVATIONS_META,
  },
  {
    feature: 'Sage title',
    location: 'src/components/sage-title-card.tsx',
    meta: SAGE_TITLE_META,
  },
  {
    feature: 'Sage story',
    location: 'src/components/sage-story-fold.tsx',
    meta: SAGE_STORY_META,
  },
  {
    feature: 'Sage insight spend',
    location: 'src/lib/sage-insight.ts',
    meta: SAGE_INSIGHT_META,
  },
];
