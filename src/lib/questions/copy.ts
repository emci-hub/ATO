/** Infinite Questions UI copy. Not a daily card. */

export const QUESTIONS_LABEL = 'A few questions';

export const QUESTIONS_LEDE = 'Tap when you feel like it. Not today\u2019s card.';

export const QUESTIONS_EMPTY_CONSENT =
  'Sage stays off until you turn it on in You.';

export const QUESTIONS_EMPTY_DENIED =
  'Sage stays off for this account.';

export const QUESTIONS_EMPTY_CRISIS = 'Not the moment for this.';

export const QUESTIONS_EMPTY_QUOTA =
  'That\u2019s all the fresh questions for today. Cached ones are still free tomorrow.';

export const QUESTIONS_EMPTY_TRY =
  "Couldn't land a batch. Try again later.";

export const QUESTIONS_SKIP_THIS = 'Skip this one';

export const QUESTIONS_SKIP_REST = 'Skip the rest';

export const QUESTIONS_CHECKPOINT =
  "That's plenty for now — come back anytime";

export const QUESTIONS_KEEP_GOING = 'Keep going';

/**
 * Tap-to-load affordance for the "Tell Sage more" rotation when the fold
 * renders always-expanded (Questions tab, 2026-09-15) instead of behind a
 * collapse header — the header tap used to be what gated `handleOpen()`, so
 * an always-open fold needs its own explicit press, or this section would
 * either sit on "Loading…" forever or auto-load with no tap behind it.
 */
export const QUESTIONS_LOAD_MORE = 'Tell Sage more';

/** Soft sitting pause — not a hard stop. */
export const QUESTIONS_CHECKPOINT_AFTER = 8;
