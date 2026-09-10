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
import { CORE_AXES, MODIFIER_AXES, type Pole } from '@/lib/legends64/classify';
import { AXIS_EDITOR_COPY } from '@/lib/sage-knows';
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { STYLE_BLOCK } from '@/lib/voice/style-checklist';
import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';

import { claimLegendStoryGeneration } from './store';

export const LEGEND_STORY_BODY_MAX_CHARS = 900;

function poleLine(axes: readonly (typeof CORE_AXES)[number][], code: string): string {
  return axes
    .map((axis, i) => {
      const pole = code[i] as Pole;
      const phrases = TRAIT_BAND_PHRASES[axis];
      return `${AXIS_EDITOR_COPY[axis].label}: ${pole === 'H' ? phrases.high : phrases.low}`;
    })
    .join('; ');
}

/**
 * `coreCode`/`modifierCode` are the two 3-letter halves of `archetypeCode`
 * (classify.ts) — passed separately so this function never needs to parse
 * the combined 'HHH-LHL' string back apart.
 */
export function buildLegendStoryPrompt(coreCode: string, modifierCode: string): string {
  return `Write as Sage in the ATO app. Follow the voice reference. Not a doctor. This is a Legend story — one personalized piece of prose for the archetype this person's traits land on, generated fresh (never reused from a library).

VOICE REFERENCE (register only — do NOT reuse these lines):
${VOICE_REFERENCE}

Job: write a short, personalized story about how this person tends to move, grounded in the settled notes below, in your own words, never a concatenation of the axis labels themselves. This is flavor/story text, not a category read — do not name any category or axis explicitly.

${STYLE_BLOCK}

SETTLED NOTES (internal — write from the meaning, never the axis label)
${poleLine(CORE_AXES, coreCode)}
${poleLine(MODIFIER_AXES, modifierCode)}

RULES
1. 2–5 sentences. Everyday language. Not a diagnosis, not a type, not a test result.
2. Never Myers-Briggs, never a four-letter code, never "you are." Reflect as maybes, not facts.
3. Never name an archetype, a category, or an axis label directly — write the feel of it instead.
4. Hedge lives inside the sentence. No bolted-on closing after a dash or period.

Respond with JSON only:
{"story":"<the legend story>"}`;
}

export function parseLegendStoryBody(text: string): string | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const row = JSON.parse(text.slice(start, end + 1)) as { story?: unknown };
    const story = typeof row.story === 'string' ? row.story.trim() : '';
    if (!story) return null;
    if (containsFrameworkTerm(story)) return null;
    return story.slice(0, LEGEND_STORY_BODY_MAX_CHARS);
  } catch {
    return null;
  }
}

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
