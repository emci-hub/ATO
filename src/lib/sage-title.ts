/**
 * Live Sage title from stable report-track axes only.
 * Copy is generated, not a lookup. UNREVIEWED samples live below.
 */
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
import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';

export const TITLE_COPY_REVIEWED = false;
export const TITLE_EMPTY = 'Not enough settled yet to name a shape.';
export const TITLE_PUSHBACK = "This doesn't feel right";
export const TITLE_PUSHBACK_SAVED = 'Noted. Sage will not change it from this.';

export interface SageTitle {
  title: string;
  lede: string;
  fingerprint: string;
  generatedOn: string;
  axes: TraitAxis[];
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
  return { title, lede, fingerprint, generatedOn, axes };
}

export function drivingAxisLines(axes: readonly TraitAxis[], tracks: readonly TraitTrack[]): string[] {
  return axes.map((axis) => {
    const copy = AXIS_EDITOR_COPY[axis];
    const phrases = TRAIT_BAND_PHRASES[axis];
    const row = trackFor(tracks, axis, 'report');
    const toward =
      row && row.value >= 0.5 ? phrases.high : phrases.low;
    return `${copy.label} — leaning toward “${toward}.”`;
  });
}

export function buildTitlePrompt(tracks: readonly TraitTrack[], today: string): string {
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
  return `Write as Sage in the ATO app. Follow the voice reference. Not a doctor.

VOICE REFERENCE (register only — do NOT reuse these lines):
${VOICE_REFERENCE}

Job: a short title (2–5 words) and one plain line about how this person tends to move, from the settled notes only. Unsettled notes are omitted on purpose. Do not invent them.

SETTLED NOTES
${lines.join('\n') || '- none'}

RULES
1. Title: 2–5 words. Everyday language. Not a type name, not a diagnosis, not a test result.
2. Never Myers-Briggs, never a four-letter code, never "you are."
3. One-line description: one sentence, same tone as the notes.
4. If there is not enough settled to name a shape, return the empty title exactly: "${TITLE_EMPTY}"
5. No framework names.

Respond with JSON only:
{"title":"<2-5 words or the empty line>","lede":"<one sentence>"}`;
}

export function parseTitleBody(text: string): { title: string; lede: string } | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const row = JSON.parse(text.slice(start, end + 1)) as { title?: unknown; lede?: unknown };
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const lede = typeof row.lede === 'string' ? row.lede.trim() : '';
    if (!title || !lede) return null;
    if (containsFrameworkTerm(title) || containsFrameworkTerm(lede)) return null;
    if (/\b(mbti|intj|infj|entp|isfp|diagnosis|disorder|clinical)\b/i.test(`${title} ${lede}`)) {
      return null;
    }
    return { title: title.slice(0, 48), lede: lede.slice(0, 160) };
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

export { titleFingerprint };
