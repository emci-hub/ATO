/**
 * Per-style voice notes, keyed by the user's chosen talk style.
 *
 * Lived in voice/providers/types.ts until 2026-09-14, when the whole provider
 * layer and Talk's backend were deleted. This constant was the one thing in
 * that file with live importers — Explore, Sage Insight and Questions all
 * ground their prompts in it, and none of them touch the provider layer — so
 * it moved here rather than dying with the lane it happened to live in.
 */
import type { TalkStyle } from './types';

export const TALK_STYLE_GUIDE: Record<TalkStyle, string> = {
  quiet: 'quiet: understated, spare word choice, short declarative sentences (under 12 words each), never an exclamation point, no filler or hype words — let the point sit without dressing it up.',
  even: 'even: plain and matter-of-fact, medium-length sentences, conversational but level — no dramatics, no coddling, describe things as they are.',
  loud: 'loud: energetic and punchy, short sentences stacked for momentum, exclamation points welcome, root for them like a friend who is genuinely fired up.',
};
