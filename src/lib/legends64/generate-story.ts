/**
 * Legends 64-archetype story generation (core loop redesign §4). One AI call
 * per generation (manual trigger or paid reroll) producing flavor text for
 * the archetype code alone — never named/labeled to the model as a
 * "personality type," same discipline as buildCategoryReadPrompt
 * (src/lib/rolls/category-read.ts), which this mirrors closely: short,
 * personalized prose grounded in plain-language pole phrases, never the
 * axis name or a raw number.
 *
 * UNREVIEWED — LEGENDS64_COPY_REVIEWED gates the draft-copy banner
 * (src/lib/legends64/archetypes.ts), same discipline as every other new
 * copy this redesign has introduced.
 */
import { generateText } from '@/lib/ai/generate';
import { LEGEND_STORY_META } from '@/lib/ai/call-sites';

import { claimLegendStoryGeneration } from './store';
import { buildLegendStoryPrompt, parseLegendStoryBody } from './story-prompt';

export { buildLegendStoryPrompt, parseLegendStoryBody, LEGEND_STORY_BODY_MAX_CHARS } from './story-prompt';

export type LegendStoryOutcome =
  | { kind: 'ok'; story: string }
  | { kind: 'quota'; daily: number; dailyCap: number }
  | { kind: 'error' };

/**
 * Claims legend_story_generations_daily_cap (wave58) BEFORE the generateText
 * call — mirrors generateRollItemText's (src/lib/rolls/generate.ts) "claim a
 * dedicated per-feature quota in front of the shared Sage/Explore pool"
 * pattern exactly, including MUST NEVER THROW: any failure (claim RPC error,
 * generateText returning null, an unparseable response) degrades to
 * {kind:'error'}, never an uncaught throw — callers (reroll/manual trigger)
 * decide what to show, not this function.
 */
export async function generateLegendStory(coreCode: string, modifierCode: string): Promise<LegendStoryOutcome> {
  try {
    const claim = await claimLegendStoryGeneration();
    if (!claim.ok) {
      return { kind: 'quota', daily: claim.daily ?? 0, dailyCap: claim.dailyCap ?? 0 };
    }
    const text = await generateText({
      prompt: buildLegendStoryPrompt(coreCode, modifierCode),
      temperature: 0.9,
      maxOutputTokens: 1024,
      responseFormat: 'json',
    }, LEGEND_STORY_META);
    const story = text ? parseLegendStoryBody(text) : null;
    if (!story) return { kind: 'error' };
    return { kind: 'ok', story };
  } catch (err) {
    console.log('[legends64] generateLegendStory error:', err);
    return { kind: 'error' };
  }
}
