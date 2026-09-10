import type { LegendType } from './store';

export interface LegendCandidateDraft {
  canonicalSlug: string;
  name: string;
  eraTitle: string;
  type: LegendType;
  teaser: string;
  fullStory: string;
}

const LEGEND_TYPES: readonly LegendType[] = ['historical', 'modern-deceased', 'mythical'];

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Same defensive shape as parseQuestionDraft — a malformed field drops the
 * whole candidate rather than guessing. `expectedArchetypeName` guards
 * against a genuine miss-target: a response with SOME "Energy:" line but for
 * a different archetype than the one asked for would otherwise parse clean
 * (found in review) — human review in dev-lab still has the final say, this
 * only catches the mechanical case where the model answered a different
 * archetype's prompt shape entirely.
 */
export function parseLegendCandidate(
  raw: string,
  expectedArchetypeName?: string,
): LegendCandidateDraft | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const row = parsed as Record<string, unknown>;

  const name = typeof row.name === 'string' ? row.name.trim() : '';
  const eraTitle = typeof row.era_title === 'string' ? row.era_title.trim() : '';
  const type = typeof row.type === 'string' ? row.type : '';
  const teaser = typeof row.teaser === 'string' ? row.teaser.trim() : '';
  const fullStory = typeof row.full_story === 'string' ? row.full_story.trim() : '';
  const rawSlug = typeof row.canonical_slug === 'string' ? row.canonical_slug.trim() : '';

  if (!name || name.length > 120) return null;
  if (!eraTitle || eraTitle.length > 120) return null;
  if (!(LEGEND_TYPES as readonly string[]).includes(type)) return null;
  if (!teaser || teaser.length > 200) return null;
  if (!fullStory || fullStory.length > 4000) return null;
  if (!fullStory.includes('Energy:')) return null;
  if (expectedArchetypeName && !fullStory.includes(`${expectedArchetypeName} Energy:`)) return null;

  const canonicalSlug = slugify(rawSlug || name);
  if (!canonicalSlug) return null;

  return { canonicalSlug, name, eraTitle, type: type as LegendType, teaser, fullStory };
}
