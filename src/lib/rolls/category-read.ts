/**
 * Category-read generation (trait-system redesign §7) — new, personalized
 * narrative text per category, generated as part of a roll (one of the 11
 * category items alongside the legend and the story). Mirrors
 * buildStoryPrompt's pattern (src/lib/sage-story.ts — reads a
 * readAllCategories()-shaped input) but scoped to ONE category, and
 * deliberately WITHOUT Story's "never name it" rule: Story is explicitly
 * built to never name a specific category (a hard rule in its own prompt,
 * whole-profile-scoped); a category read is the opposite — it's explicitly
 * about naming and speaking to THIS one category, Costar-app style.
 *
 * UNREVIEWED. Same discipline as Story/the bank/every other new copy this
 * redesign has introduced — not shippable without emci's direct read.
 */
import { AXIS_EDITOR_COPY } from '@/lib/sage-knows';
import type { CategoryReading } from '@/lib/categories';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { STYLE_BLOCK } from '@/lib/voice/style-checklist';
import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';

export const CATEGORY_READ_COPY_REVIEWED = false;
export const CATEGORY_READ_BODY_MAX_CHARS = 800;

export interface CategoryRead {
  body: string;
}

/**
 * `reading` must already be `ready` (readCategory's own gate) — this
 * function does not re-check readiness; callers (the roll composer) only
 * generate a read for categories that are actually ready, same as Story
 * only ever includes ready categories in its own settled-notes list.
 */
export function buildCategoryReadPrompt(reading: CategoryReading): string {
  const bits = reading.stableAxes.map((axis) => AXIS_EDITOR_COPY[axis].label).join(', ');
  const textureLine =
    reading.texture.length > 0
      ? `Texture only (never part of the read's substance, flavor at most): ${reading.texture
          .map((row) => AXIS_EDITOR_COPY[row.axis].label)
          .join(', ')}.`
      : 'No texture axes settled yet.';

  const positionLine = reading.map
    ? `Settled merge: ${bits}. Position is a mix of those two axes, not a coordinate — do not describe it as a graph or a point.`
    : `Settled merge: ${bits}. Lean ${reading.bar != null && reading.bar >= 0.5 ? 'higher' : 'lower'}.`;

  return `Write as Sage in the ATO app. Follow the voice reference. Not a doctor. This is a category read — one personalized piece of prose about "${reading.def.name}" specifically, part of a larger roll (a legend match, 11 category reads, and a story, all generated together in one pass).

VOICE REFERENCE (register only — do NOT reuse these lines):
${VOICE_REFERENCE}

Job: write a short, personalized read about how this person tends to move within "${reading.def.name}" — grounded in the settled notes below, in your own words, never a concatenation of the axis labels themselves.

${STYLE_BLOCK}

SETTLED NOTES for "${reading.def.name}" (internal — write from the meaning, never the axis label)
${positionLine}
${textureLine}

RULES
1. 2–4 sentences. Everyday language. Not a diagnosis, not a type, not a test result.
2. Never Myers-Briggs, never a four-letter code, never "you are." Reflect as maybes, not facts.
3. You MAY name "${reading.def.name}" naturally — this is the one difference from Sage's whole-profile Story, which never names a category. Only ever use the plain-language pole phrases given above (never a technical or internal-sounding trait label).
4. Hedge lives inside the sentence. No bolted-on closing after a dash or period.
5. Completeness is not an input. Do not mention leftover notes or a fuller profile.

Respond with JSON only:
{"body":"<the category read>"}`;
}

export function parseCategoryReadBody(text: string): string | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const row = JSON.parse(text.slice(start, end + 1)) as { body?: unknown };
    const body = typeof row.body === 'string' ? row.body.trim() : '';
    if (!body) return null;
    if (containsFrameworkTerm(body)) return null;
    return body.slice(0, CATEGORY_READ_BODY_MAX_CHARS);
  } catch {
    return null;
  }
}
