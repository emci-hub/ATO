/**
 * The Story — longer-form Sage prose from currently settled categories.
 * Own generation call and quota lane. No offline fallback.
 *
 * UNREVIEWED. Diagnosis-adjacent. Nothing here is shippable without emci's
 * direct read — same bar as the Crisis spec.
 */
import {
  CATEGORY_DEFS,
  categoriesFingerprint,
  readAllCategories,
  type CategoryId,
} from '@/lib/categories';
import { AXIS_EDITOR_COPY } from '@/lib/sage-knows';
import { isThinProfile, settledCount, type TraitTrack } from '@/lib/trait-stability';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';

export const STORY_COPY_REVIEWED = false;
export const STORY_LABEL = 'The Story';
export const STORY_LEDE = 'How this sits together right now.';

export interface SageStory {
  body: string;
  fingerprint: string;
  generatedOn: string;
  categoryIds: CategoryId[];
}

export interface StorySample {
  shape: string;
  body: string;
}

/**
 * Drafts for emci's direct read. NOT shown in the app. NOT few-shots.
 * Flag every line. Do not treat as shippable.
 */
export const STORY_SAMPLES: readonly StorySample[] = [
  {
    shape: 'settled follow-through + own path',
    body:
      'The week tends to hold when a plan is on the table, even if the room stays small. Picking the path still matters more than taking the one already laid out. A real check-in with someone can be part of that, or the day can land without it — both have shown up. None of this is a type. It is just how the last stretch has been sitting.',
  },
  {
    shape: 'thin — must not generate',
    body: '',
  },
];

/**
 * Told-vs-played tension. Soft, hedged, not an accusation, not smoothed over.
 * Drafts for emci's direct read. NOT shown in the app. NOT pasted into the
 * live prompt as templates. Flag every line. Do not treat as shippable.
 */
export const STORY_TENSION_SAMPLES: readonly string[] = [
  'What they say about how a hard day lands, and what shows up when they play it out, don\'t quite sit in the same place — maybe both can be true for now.',
  'The version they told us and the version that came out in a gut-call pull in slightly different directions. Not a verdict — just a gap worth leaving visible.',
  'On paper they reach for one way of moving; when it is just a snap choice, another way shows up. Might be a real split, not a mistake in either reading.',
];

export function storyFingerprint(
  tracks: readonly TraitTrack[],
  divergenceNote: string | null,
  now: Date = new Date(),
): string {
  return `${categoriesFingerprint(tracks, now)}#div:${divergenceNote ?? ''}`;
}

export function storyReady(tracks: readonly TraitTrack[], now: Date = new Date()): boolean {
  if (isThinProfile(settledCount(tracks, now))) return false;
  return readAllCategories(tracks, now).some((row) => row.ready);
}

export function parseSageStory(raw: unknown): SageStory | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const body = typeof row.body === 'string' ? row.body.trim() : '';
  const fingerprint = typeof row.fingerprint === 'string' ? row.fingerprint : '';
  const generatedOn = typeof row.generatedOn === 'string' ? row.generatedOn : '';
  if (!body || !fingerprint || !generatedOn) return null;
  if (containsFrameworkTerm(body)) return null;
  if (storyNamesACategory(body)) return null;
  const categoryIds: CategoryId[] = [];
  if (Array.isArray(row.categoryIds)) {
    for (const item of row.categoryIds) {
      if (typeof item === 'string' && CATEGORY_DEFS.some((def) => def.id === item)) {
        categoryIds.push(item as CategoryId);
      }
    }
  }
  return { body, fingerprint, generatedOn, categoryIds };
}

export function parseStoryBody(text: string): string | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const row = JSON.parse(text.slice(start, end + 1)) as { body?: unknown };
    const body = typeof row.body === 'string' ? row.body.trim() : '';
    if (!body) return null;
    if (containsFrameworkTerm(body)) return null;
    if (storyNamesACategory(body)) return null;
    return body.slice(0, 1600);
  } catch {
    return null;
  }
}

/** Distinctive multi-word category labels only — short English words stay allowed. */
export function storyNamesACategory(body: string): boolean {
  const lower = body.toLowerCase();
  for (const def of CATEGORY_DEFS) {
    const name = def.name.toLowerCase();
    if (name.includes(' ') || name.includes('/')) {
      if (lower.includes(name)) return true;
    }
  }
  return false;
}

export function buildStoryPrompt(input: {
  tracks: readonly TraitTrack[];
  divergenceNote: string | null;
}): string {
  const lines: string[] = [];
  for (const reading of readAllCategories(input.tracks)) {
    if (!reading.ready) continue;
    const bits = reading.stableAxes.map((axis) => AXIS_EDITOR_COPY[axis].label).join(', ');
    if (reading.map) {
      lines.push(
        `- Settled merge (do not name this): ${bits}. Position is a mix of those two, not a coordinate. Texture only: ${
          reading.texture.map((row) => AXIS_EDITOR_COPY[row.axis].label).join(', ') || 'none'
        }.`,
      );
    } else {
      lines.push(
        `- Settled merge (do not name this): ${bits}. Lean ${
          reading.bar != null && reading.bar >= 0.5 ? 'higher' : 'lower'
        }.`,
      );
    }
  }

  const tension = input.divergenceNote
    ? `TOLD-VS-PLAYED (present — name it honestly, hedged, inside the prose. Not an accusation. Do not pick a winner. Do not smooth it away.)\n- ${input.divergenceNote}`
    : 'TOLD-VS-PLAYED: none on the current tracks. Do not invent a split.';

  return `Write as Sage in the ATO app. Follow the voice reference. Not a doctor. This is The Story — one cohesive narrative, not a stitched list of summaries.

VOICE REFERENCE (register only — do NOT reuse these lines):
${VOICE_REFERENCE}

Job: rewrite the settled notes below into one holistic piece of prose. Same discipline as a title: generated, not looked up, not a concatenation of category lines. Fully prose. Never put a category name in the text.

SETTLED NOTES (internal — write from the meaning, never the label)
${lines.join('\n') || '- none'}

${tension}

RULES
1. 2–3 short paragraphs, or 5–8 sentences. Everyday language. Not a diagnosis, not a type, not a test result.
2. Never Myers-Briggs, never a four-letter code, never "you are." Reflect as maybes, not facts.
3. Do not name categories (not Steadiness, not Agency, not Drive, not the others). Do not name axes.
4. Do not stitch the category summaries. Rewrite as one picture of how they tend to move.
5. If told-vs-played tension is present, leave it visible with soft language. If it is not present, do not invent it.
6. Hedge lives inside the sentence. No bolted-on closing after a dash or period.
7. Completeness is not an input. Do not mention leftover notes or a fuller picture.

Respond with JSON only:
{"body":"<the story>"}`;
}

export function storyCopyClean(): boolean {
  const lines = [
    STORY_LABEL,
    STORY_LEDE,
    ...STORY_SAMPLES.map((row) => row.body),
    ...STORY_TENSION_SAMPLES,
  ];
  return lines.every((line) => !line || !containsFrameworkTerm(line));
}
