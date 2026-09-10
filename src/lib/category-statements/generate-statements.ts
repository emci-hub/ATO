/**
 * Category statements (core loop redesign §3) — one AI call producing a
 * read-only statement for every READY category at once, replacing the old
 * category_question_items Q&A entirely. Mirrors buildCategoryReadPrompt's
 * pattern (src/lib/rolls/category-read.ts — reads a readAllCategories()
 * reading, names the category, 2-4 sentences, plain-language pole phrases
 * only) but batches all categories into one JSON array instead of one
 * category per call, since the plan calls for "one AI call producing all 11
 * CATEGORY_DEFS statements together."
 *
 * UNREVIEWED. Same discipline as Story/category-read/every other new copy
 * this redesign has introduced — not shippable without emci's direct read.
 */
import { generateText } from '@/lib/ai/generate';
import { CATEGORY_STATEMENTS_META } from '@/lib/ai/call-sites';
import { AXIS_EDITOR_COPY } from '@/lib/sage-knows';
import type { CategoryReading } from '@/lib/categories';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { STYLE_BLOCK } from '@/lib/voice/style-checklist';
import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';

export const CATEGORY_STATEMENTS_COPY_REVIEWED = false;
export const CATEGORY_STATEMENT_MAX_CHARS = 600;

export interface CategoryStatementDraft {
  categoryId: string;
  statement: string;
}

function groundingLine(reading: CategoryReading): string {
  const bits = reading.stableAxes.map((axis) => AXIS_EDITOR_COPY[axis].label).join(', ');
  const textureLine =
    reading.texture.length > 0
      ? ` Texture only (never part of the substance, flavor at most): ${reading.texture
          .map((row) => AXIS_EDITOR_COPY[row.axis].label)
          .join(', ')}.`
      : '';
  const positionLine = reading.map
    ? `Settled merge: ${bits}. Position is a mix of those two axes, not a coordinate — do not describe it as a graph or a point.`
    : `Settled merge: ${bits}. Lean ${reading.bar != null && reading.bar >= 0.5 ? 'higher' : 'lower'}.`;
  return `- "${reading.def.name}" (id: ${reading.def.id}): ${positionLine}${textureLine}`;
}

/**
 * `readings` should already be filtered to `ready` ones (categories-fold.tsx
 * owns that gate, same as it already does for the existing readings.map
 * loop) — this function does not re-check readiness, it just refuses an
 * empty list.
 */
export function buildCategoryStatementsPrompt(readings: readonly CategoryReading[]): string {
  const lines = readings.map(groundingLine).join('\n');
  return `Write as Sage in the ATO app. Follow the voice reference. Not a doctor. These are category statements — one short personalized piece of prose per category, each read-only (no follow-up questions), shown together on the Categorize screen.

VOICE REFERENCE (register only — do NOT reuse these lines):
${VOICE_REFERENCE}

Job: write one statement per category below, grounded in that category's settled notes, in your own words, never a concatenation of the axis labels themselves.

${STYLE_BLOCK}

CATEGORIES (internal — write from the meaning, never the axis label)
${lines}

RULES
1. One statement per category listed above, same order. Keep every statement tight: 1–2 sentences, roughly 25 words. This is a batch of up to ${readings.length} statements in one response — verbose entries risk the whole response getting cut off, so brevity matters here more than in a single-category read.
2. Everyday language. Not a diagnosis, not a type, not a test result.
3. Never Myers-Briggs, never a four-letter code, never "you are." Reflect as maybes, not facts.
4. You MAY name the category naturally — only ever use the plain-language pole phrases given above (never a technical or internal-sounding trait label).
5. Hedge lives inside the sentence. No bolted-on closing after a dash or period.
6. Every statement is independent — do not reference another category or compare between them.

Respond with JSON only:
{"statements":[{"category_id":"<id>","statement":"<the statement>"}, ...]}`;
}

/** Validates against the real category ids passed in (the live catalog, not a hardcoded list) so a malformed or hallucinated id never reaches the DB. */
export function parseCategoryStatements(
  text: string,
  validIds: ReadonlySet<string>,
): CategoryStatementDraft[] | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1)) as { statements?: unknown };
    if (!Array.isArray(parsed.statements)) return null;

    // A duplicate category_id in one response is deduped to its first
    // occurrence — without this, insert_category_statements' own supersede
    // loop would supersede the row it just inserted a moment earlier,
    // leaving a spurious "superseded within the same second" history entry.
    const seen = new Set<string>();
    const drafts: CategoryStatementDraft[] = [];
    for (const row of parsed.statements) {
      if (!row || typeof row !== 'object') continue;
      const categoryId = typeof (row as Record<string, unknown>).category_id === 'string'
        ? ((row as Record<string, unknown>).category_id as string)
        : '';
      const rawStatement = typeof (row as Record<string, unknown>).statement === 'string'
        ? ((row as Record<string, unknown>).statement as string).trim()
        : '';
      if (!categoryId || !validIds.has(categoryId) || seen.has(categoryId)) continue;
      if (!rawStatement || containsFrameworkTerm(rawStatement)) continue;
      seen.add(categoryId);
      drafts.push({ categoryId, statement: rawStatement.slice(0, CATEGORY_STATEMENT_MAX_CHARS) });
    }
    return drafts.length > 0 ? drafts : null;
  } catch {
    return null;
  }
}

/**
 * One AI call for every ready category at once. Returns null on any failure
 * (no response, unparseable, or every row filtered out) — never throws, so
 * the caller (categories-fold.tsx) can degrade to "try again" without a
 * crash, matching every other generation call site's contract in this repo.
 */
export async function generateCategoryStatements(
  readyReadings: readonly CategoryReading[],
  validIds: ReadonlySet<string>,
): Promise<CategoryStatementDraft[] | null> {
  if (readyReadings.length === 0) return null;
  const text = await generateText({
    prompt: buildCategoryStatementsPrompt(readyReadings),
    temperature: 0.9,
    maxOutputTokens: 1024,
    responseFormat: 'json',
  }, CATEGORY_STATEMENTS_META);
  if (!text) return null;
  return parseCategoryStatements(text, validIds);
}
