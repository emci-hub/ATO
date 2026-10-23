/**
 * Category summary copy kept from the old "Sage title".
 *
 * The AI title writer (prompt, parser, samples, `TITLE_COPY_REVIEWED`) was removed in
 * roadmap A5 (2026-10-23): no model writes a title any more. What stays is the saved
 * shape the app still reads back: `CategoryCopy` (category-bands, category-compare) and
 * `parseSageTitle` for the cached title on the category teaser.
 */
import { getCategoryDefs, type CategoryId } from '@/lib/categories';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

export interface CategoryCopy {
  line: string;
  full: string;
}

export interface SageTitle {
  title: string;
  lede: string;
  fingerprint: string;
  generatedOn: string;
  axes: TraitAxis[];
  categories: Partial<Record<CategoryId, CategoryCopy>>;
}

function categoryIds(): CategoryId[] {
  return getCategoryDefs().map((row) => row.id);
}

function parseCategoryCopy(raw: unknown): CategoryCopy | null {
  if (typeof raw === 'string') {
    const line = raw.trim().slice(0, 160);
    if (!line || containsFrameworkTerm(line)) return null;
    return { line, full: line };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const line = typeof row.line === 'string' ? row.line.trim().slice(0, 120) : '';
  const full = typeof row.full === 'string' ? row.full.trim().slice(0, 280) : line;
  if (!line || containsFrameworkTerm(line) || containsFrameworkTerm(full)) return null;
  if (/\b(mbti|intj|infj|entp|isfp|diagnosis|disorder|clinical)\b/i.test(`${line} ${full}`)) {
    return null;
  }
  return { line, full: full || line };
}

export function parseSageTitle(raw: unknown): SageTitle | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  const lede = typeof row.lede === 'string' ? row.lede.trim() : '';
  const fingerprint = typeof row.fingerprint === 'string' ? row.fingerprint : '';
  const generatedOn = typeof row.generatedOn === 'string' ? row.generatedOn : '';
  if (!title || !lede || !fingerprint) return null;
  const axes: TraitAxis[] = [];
  if (Array.isArray(row.axes)) {
    for (const item of row.axes) {
      if (typeof item === 'string' && (TRAIT_AXES as readonly string[]).includes(item)) {
        axes.push(item as TraitAxis);
      }
    }
  }
  const categories: Partial<Record<CategoryId, CategoryCopy>> = {};
  if (row.categories && typeof row.categories === 'object' && !Array.isArray(row.categories)) {
    const bag = row.categories as Record<string, unknown>;
    for (const id of categoryIds()) {
      const copy = parseCategoryCopy(bag[id]);
      if (copy) categories[id] = copy;
    }
  }
  return { title, lede, fingerprint, generatedOn, axes, categories };
}
