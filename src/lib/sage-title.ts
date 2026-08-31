/**
 * Live Sage title + category summaries from stable report-track axes only.
 * One Gemini call. Copy is generated, not a lookup. UNREVIEWED samples live below.
 */
import {
  CATEGORY_DEFS,
  categoriesFingerprint,
  readAllCategories,
  type CategoryId,
} from '@/lib/categories';
import { AXIS_EDITOR_COPY } from '@/lib/sage-knows';
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import {
  TITLE_MIN_STABLE,
  effectiveStability,
  isStableForTitle,
  titleFingerprint,
  trackFor,
  type TraitTrack,
} from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { STYLE_BLOCK } from '@/lib/voice/style-checklist';
import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';

export const TITLE_COPY_REVIEWED = false;
export const TITLE_EMPTY = 'Not enough settled yet to name a shape.';
export const TITLE_PUSHBACK = "This doesn't feel right";
export const TITLE_PUSHBACK_SAVED = 'Noted. Sage will not change it from this.';

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

export interface TitleSample {
  shape: string;
  title: string;
  lede: string;
}

/** Drafts for emci tone review. Not shown in the app. */
export const TITLE_SAMPLES: readonly TitleSample[] = [
  {
    shape: 'quiet follow-through',
    title: 'Quiet follow-through',
    lede: 'Keeps the plan, prefers a smaller room.',
  },
  {
    shape: 'people-first tryer',
    title: 'Makes the room happen',
    lede: 'Would rather text people and try the different path.',
  },
  {
    shape: 'close but careful',
    title: 'In, with some space',
    lede: 'Wants a real check-in, and still keeps a little distance.',
  },
  {
    shape: 'own-way handler',
    title: 'Own way, then handle it',
    lede: 'Would rather pick the path, and feels they can take the hard part.',
  },
  {
    shape: 'after-a-miss looker',
    title: 'Looks at the miss',
    lede: 'When it falls apart, they start with what they might change.',
  },
  {
    shape: 'thin profile',
    title: TITLE_EMPTY,
    lede: 'Nothing named until a few things have settled.',
  },
];

const CATEGORY_IDS = CATEGORY_DEFS.map((row) => row.id);

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
    for (const id of CATEGORY_IDS) {
      const copy = parseCategoryCopy(bag[id]);
      if (copy) categories[id] = copy;
    }
  }
  return { title, lede, fingerprint, generatedOn, axes, categories };
}

export function drivingAxisLines(axes: readonly TraitAxis[], tracks: readonly TraitTrack[]): string[] {
  return axes.map((axis) => {
    const copy = AXIS_EDITOR_COPY[axis];
    const phrases = TRAIT_BAND_PHRASES[axis];
    const row = trackFor(tracks, axis, 'report');
    const toward = row && row.value >= 0.5 ? phrases.high : phrases.low;
    return `${copy.label} — leaning toward “${toward}.”`;
  });
}

export function pinnedCategoryLines(title: SageTitle | null | undefined): string[] {
  if (!title?.categories) return [];
  const out: string[] = [];
  for (const id of CATEGORY_IDS) {
    const copy = title.categories[id];
    if (!copy) continue;
    if (copy.line.trim()) out.push(copy.line.trim());
    if (copy.full.trim() && copy.full.trim() !== copy.line.trim()) out.push(copy.full.trim());
  }
  return out;
}

export function combinedFingerprint(tracks: readonly TraitTrack[], now: Date = new Date()): string {
  return `${titleFingerprint(tracks, now)}#${categoriesFingerprint(tracks, now)}`;
}

export function buildTitlePrompt(tracks: readonly TraitTrack[], _today: string): string {
  const lines: string[] = [];
  for (const axis of TRAIT_AXES) {
    const row = trackFor(tracks, axis, 'report');
    if (!isStableForTitle(row) || !row) continue;
    const phrases = TRAIT_BAND_PHRASES[axis];
    const copy = AXIS_EDITOR_COPY[axis];
    const pole = row.value >= 0.5 ? phrases.high : phrases.low;
    lines.push(
      `- ${copy.label}: leaning toward “${pole}” (settled ${effectiveStability(row).toFixed(2)})`,
    );
  }

  const categoryLines: string[] = [];
  for (const reading of readAllCategories(tracks)) {
    if (!reading.ready) continue;
    const axisBits = reading.stableAxes.map((axis) => AXIS_EDITOR_COPY[axis].label).join(', ');
    if (reading.map) {
      const x = AXIS_EDITOR_COPY[reading.def.axes[0]!].label;
      const y = AXIS_EDITOR_COPY[reading.def.axes[1]!].label;
      const texture =
        reading.texture.length > 0
          ? ` Texture only (not a score): ${reading.texture.map((row) => AXIS_EDITOR_COPY[row.axis].label).join(', ')}.`
          : '';
      categoryLines.push(
        `- ${reading.def.id} "${reading.def.name}" MAP of ${x} × ${y}. Settled axes: ${axisBits}.${texture}`,
      );
    } else {
      categoryLines.push(
        `- ${reading.def.id} "${reading.def.name}" BAR from ${axisBits}. Lean ${reading.bar != null && reading.bar >= 0.5 ? 'higher' : 'lower'}.`,
      );
    }
  }

  return `Write as Sage in the ATO app. Follow the voice reference. Not a doctor.

VOICE REFERENCE (register only — do NOT reuse these lines):
${VOICE_REFERENCE}

${STYLE_BLOCK}

Job: a short title (2–5 words), one plain line about how this person tends to move, and a short summary for each READY category, from the settled notes only. Unsettled notes and unready categories are omitted on purpose. Do not invent them.

SETTLED NOTES
${lines.join('\n') || '- none'}

READY CATEGORIES (self-report track only — never a gut-call)
${categoryLines.join('\n') || '- none'}

RULES
1. Title: 2–5 words. Everyday language. Not a type name, not a diagnosis, not a test result.
2. Never Myers-Briggs, never a four-letter code, never "you are."
3. One-line description: one sentence, same tone as the notes.
4. Categories: for each ready id, a "line" (≤12 words) and a "full" (1–2 sentences, same voice). Maps describe the position in plain language, not coordinates. Bars describe the lean, not a number. Love-map conflict style is texture, never a second score.
5. If there is not enough settled to name a shape, return the empty title exactly: "${TITLE_EMPTY}"
6. No framework names. No clinical words.

Respond with JSON only:
{"title":"<2-5 words or the empty line>","lede":"<one sentence>","categories":{"<id>":{"line":"<≤12 words>","full":"<1-2 sentences>"}}}`;
}

export function parseTitleBody(text: string): { title: string; lede: string } | null {
  const parsed = parseCombinedBody(text);
  if (!parsed) return null;
  return { title: parsed.title, lede: parsed.lede };
}

export function parseCombinedBody(text: string): {
  title: string;
  lede: string;
  categories: Partial<Record<CategoryId, CategoryCopy>>;
} | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const row = JSON.parse(text.slice(start, end + 1)) as {
      title?: unknown;
      lede?: unknown;
      categories?: unknown;
    };
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const lede = typeof row.lede === 'string' ? row.lede.trim() : '';
    if (!title || !lede) return null;
    if (containsFrameworkTerm(title) || containsFrameworkTerm(lede)) return null;
    if (/\b(mbti|intj|infj|entp|isfp|diagnosis|disorder|clinical)\b/i.test(`${title} ${lede}`)) {
      return null;
    }
    const categories: Partial<Record<CategoryId, CategoryCopy>> = {};
    if (row.categories && typeof row.categories === 'object' && !Array.isArray(row.categories)) {
      const bag = row.categories as Record<string, unknown>;
      for (const id of CATEGORY_IDS) {
        const copy = parseCategoryCopy(bag[id]);
        if (copy) categories[id] = copy;
      }
    }
    return { title: title.slice(0, 48), lede: lede.slice(0, 160), categories };
  } catch {
    return null;
  }
}

export function titleReady(tracks: readonly TraitTrack[]): boolean {
  let n = 0;
  for (const axis of TRAIT_AXES) {
    if (isStableForTitle(trackFor(tracks, axis, 'report'))) n += 1;
  }
  return n >= TITLE_MIN_STABLE;
}

export function titleCopyClean(): boolean {
  const lines = [
    TITLE_EMPTY,
    TITLE_PUSHBACK,
    TITLE_PUSHBACK_SAVED,
    ...TITLE_SAMPLES.flatMap((row) => [row.title, row.lede]),
  ];
  return lines.every((line) => !containsFrameworkTerm(line));
}

export { titleFingerprint, categoriesFingerprint };
