/**
 * Category deep dive — one AI card about the person inside ONE category they
 * pick on Home (emci, 2026-10-08). Same shape as the Legends story card: the
 * numbers are worked out here (no AI), the ONE model call writes only the
 * words, every line is checked, one retry, then no card (never a dead end:
 * the leanings still show).
 *
 *   leanings          — no AI: each stable axis in the category, the side the
 *                       person leans and how far ("Adventurous 78%": 50% is the
 *                       middle, 100% all the way to that side)
 *   title             — AI: "the calm planner" (shared rules with Legends)
 *   showsUp           — AI: one everyday moment per top leaning
 *   mix               — AI: how the two strongest leanings work together
 *   othersNotice      — AI: what people around them might notice
 *   whatItMeansForYou — AI: the closing, in the moment voice
 *
 * Separate from the daily insight and the Explore category cards, which stay
 * stored copy and never call a model.
 */
import { AXIS_POLES, AXIS_POLE_NAME, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import type { CategoryDef } from '@/lib/categories';
import { readCategory } from '@/lib/categories';
import { legendLineViolation, titleViolation } from '@/lib/legend-figures/story';
import { trackFor, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';
import { MOMENT_VOICE_BLOCK } from '@/lib/voice/moment-voice';

export interface DiveLean {
  axis: TraitAxis;
  lean: TraitLean;
  /** How far toward that side, 50–100 ("Adventurous 78%"). */
  pct: number;
}

export interface DiveLine {
  axis: TraitAxis;
  line: string;
}

export interface CategoryDive {
  categoryId: string;
  /** The leanings this card was written for (fingerprint: a new card when they move). */
  leansKey: string;
  title: string;
  showsUp: DiveLine[];
  mix: string | null;
  othersNotice: string;
  whatItMeansForYou: string;
  source: 'ai';
}

export const SHOWS_MIN_WORDS = 10;
export const SHOWS_MAX_WORDS = 35;
export const MIX_MIN_WORDS = 12;
export const MIX_MAX_WORDS = 40;
export const NOTICE_MIN_WORDS = 10;
export const NOTICE_MAX_WORDS = 35;
export const DIVE_MEANS_MIN_WORDS = 20;
export const DIVE_MEANS_MAX_WORDS = 60;
/** At most this many leanings get their own "shows up" moment. */
export const DIVE_TOP_LEANS = 3;

/** Words that turn a description into a diagnosis — never in a deep dive (the
 * Love / closeness category included, emci 2026-10-08: gentle wording). */
const CLINICAL = /\b(anxious|anxiety|insecure|insecurity|avoidant|attachment|disorder|trauma|toxic|needy|clingy|codependent|diagnos|therapy|therapist|symptom|red flag)/i;

/** "Adventurous 78%": the side and how far toward it, never a score. */
export function leanPct(value: number): number {
  return Math.round(Math.max(value, 1 - value) * 100);
}

/**
 * The person's leanings in one category: every stable report-track axis it
 * reads (a map's two axes, a bar's listed axes), strongest first.
 */
export function categoryLeans(def: CategoryDef, tracks: readonly TraitTrack[], now: Date = new Date()): DiveLean[] {
  const reading = readCategory(def, tracks, now);
  if (!reading.ready) return [];
  return reading.stableAxes
    .map((axis) => {
      const value = trackFor(tracks, axis, 'report')?.value ?? 0.5;
      return { axis, lean: (value >= 0.5 ? 'high' : 'low') as TraitLean, pct: leanPct(value) };
    })
    .sort((a, b) => b.pct - a.pct || TRAIT_AXES.indexOf(a.axis) - TRAIT_AXES.indexOf(b.axis));
}

/** A new card only when a side flips or a leaning moves by about ten points. */
export function leansKey(leans: readonly DiveLean[]): string {
  return [...leans]
    .sort((a, b) => TRAIT_AXES.indexOf(a.axis) - TRAIT_AXES.indexOf(b.axis))
    .map((row) => `${row.axis}:${row.lean}:${Math.round(row.pct / 10)}`)
    .join(',');
}

/** "Curiosity: Adventurous" — how a leaning is named on the card. */
export function leanLabel(row: Pick<DiveLean, 'axis' | 'lean'>): string {
  return AXIS_POLE_NAME[row.axis][row.lean];
}

/** Every word the AI may borrow: the category, its pole names and their "sounds like". */
function allowedText(def: CategoryDef, leans: readonly DiveLean[]): string {
  return [
    def.name,
    ...leans.flatMap((row) => [
      AXIS_POLE_NAME[row.axis][row.lean],
      AXIS_SHORT_NAME[row.axis],
      AXIS_POLES[row.axis][row.lean],
    ]),
  ].join(' ');
}

export function buildDivePrompt(def: CategoryDef, leans: readonly DiveLean[]): string {
  const top = leans.slice(0, DIVE_TOP_LEANS);
  const rows = leans
    .map(
      (row) =>
        `- axis "${row.axis}": leans ${AXIS_POLE_NAME[row.axis][row.lean]} (${row.pct >= 75 ? 'strongly' : row.pct >= 60 ? 'clearly' : 'slightly'}; sounds like: ${AXIS_POLES[row.axis][row.lean]})`,
    )
    .join('\n');
  const gentle =
    def.id === 'cat_love'
      ? `
THIS CATEGORY IS ABOUT CLOSENESS. Be extra gentle: describe habits with people the reader is close to warmly and
plainly. Never diagnose, never use words like anxious, insecure, avoidant, attachment, needy or clingy, and never
suggest anything is wrong with the reader or their relationships.
`
      : '';
  return `You write a short "deep dive" card about ONE reader inside ONE category of their personality, for a self-discovery app.

THE CATEGORY: ${def.name}
THE READER'S LEANINGS IN IT (strongest first; never repeat any number):
${rows}
${gentle}
${MOMENT_VOICE_BLOCK}

RULES
- Second person ("you", "your"). Never "you are", never "always", no "!", no emoji, no advice, no "should".
- Write numbers as words, use no quotation marks, and name no people, apps or brands.
  (Everyday moments still work: "the group chat", "a tab you keep open", "a playlist".)
- Name the reader's sides only with the words given above. No test, score or framework words.
- Every moment must make physical sense (a voice note is recorded, not typed) and clearly show the leaning it is for.
- Kind, specific, modern, warm, a little delighted. Never a diagnosis, never a flaw.

"title" — a name for the reader in this category, two to four lowercase words, starting with "the".
  Fresh and flattering, something they'd want to share. Never about worry, doubt, loneliness or struggle.
"showsUp" — one item for each of the top ${top.length} axes above (${top.map((row) => row.axis).join(', ')}):
  one everyday moment where that leaning shows, ${SHOWS_MIN_WORDS}–${SHOWS_MAX_WORDS} words.${
    top.length >= 2
      ? `
"mix" — ${MIX_MIN_WORDS}–${MIX_MAX_WORDS} words on how the two strongest leanings work TOGETHER in the reader's day (a blend or a fun tension).`
      : ''
  }
"othersNotice" — ${NOTICE_MIN_WORDS}–${NOTICE_MAX_WORDS} words: what the people around the reader probably notice about them here. Kind, specific.
"whatItMeansForYou" — ${DIVE_MEANS_MIN_WORDS}–${DIVE_MEANS_MAX_WORDS} words, 2 or 3 sentences: one everyday moment that ties the leanings together,
  then a short, kind line on what that quietly says about the reader. No advice.
Never leave square or angle brackets in the answer.

Return JSON only, exactly this shape:
{
  "title": "<two to four lowercase words starting with the>",
  "showsUp": [{"axis": "<axis id>", "line": "<${SHOWS_MIN_WORDS}–${SHOWS_MAX_WORDS} words>"}],${
    top.length >= 2 ? `\n  "mix": "<${MIX_MIN_WORDS}–${MIX_MAX_WORDS} words>",` : ''
  }
  "othersNotice": "<${NOTICE_MIN_WORDS}–${NOTICE_MAX_WORDS} words>",
  "whatItMeansForYou": "<${DIVE_MEANS_MIN_WORDS}–${DIVE_MEANS_MAX_WORDS} words>"
}`;
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** One AI line: the Legends line rules, no digits at all, no clinical words. */
export function diveLineViolation(text: string, allowed: string): string | null {
  if (/\d/.test(text)) return 'digit';
  if (CLINICAL.test(text)) return 'clinical word';
  if (/\bshould\b/i.test(text)) return 'advice';
  return legendLineViolation(text, allowed, false);
}

function lineOk(text: unknown, min: number, max: number, allowed: string): text is string {
  if (typeof text !== 'string') return false;
  const n = words(text);
  return n >= min && n <= max && diveLineViolation(text, allowed) == null;
}

/** Parse + validate the model's answer. Null = reject (retry, then no card). */
export function parseDive(raw: string, def: CategoryDef, leans: readonly DiveLean[]): CategoryDive | null {
  let data: unknown;
  try {
    data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data == null) return null;
  const obj = data as Record<string, unknown>;
  const allowed = allowedText(def, leans);
  const top = leans.slice(0, DIVE_TOP_LEANS);

  if (typeof obj.title !== 'string') return null;
  const title = obj.title.trim().toLowerCase();
  if (titleViolation(title, allowed) || CLINICAL.test(title)) return null;

  if (!Array.isArray(obj.showsUp)) return null;
  const showsUp: DiveLine[] = [];
  for (const item of obj.showsUp) {
    const row = item as Record<string, unknown>;
    const axis = top.find((lean) => lean.axis === row.axis)?.axis;
    if (!axis || showsUp.some((line) => line.axis === axis)) return null;
    if (!lineOk(row.line, SHOWS_MIN_WORDS, SHOWS_MAX_WORDS, allowed)) return null;
    showsUp.push({ axis, line: row.line.trim() });
  }
  if (showsUp.length !== top.length) return null;

  let mix: string | null = null;
  if (top.length >= 2) {
    if (!lineOk(obj.mix, MIX_MIN_WORDS, MIX_MAX_WORDS, allowed)) return null;
    mix = obj.mix.trim();
  }
  if (!lineOk(obj.othersNotice, NOTICE_MIN_WORDS, NOTICE_MAX_WORDS, allowed)) return null;
  if (!lineOk(obj.whatItMeansForYou, DIVE_MEANS_MIN_WORDS, DIVE_MEANS_MAX_WORDS, allowed)) return null;

  return {
    categoryId: def.id,
    leansKey: leansKey(leans),
    title,
    showsUp,
    mix,
    othersNotice: obj.othersNotice.trim(),
    whatItMeansForYou: obj.whatItMeansForYou.trim(),
    source: 'ai',
  };
}

/** Loose read of a saved card (server row or phone cache). */
export function parseStoredDive(raw: unknown): CategoryDive | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const obj = raw as Record<string, unknown>;
  const isAxis = (v: unknown): v is TraitAxis => typeof v === 'string' && (TRAIT_AXES as readonly string[]).includes(v);
  if (
    typeof obj.categoryId !== 'string' ||
    typeof obj.leansKey !== 'string' ||
    typeof obj.title !== 'string' ||
    typeof obj.othersNotice !== 'string' ||
    typeof obj.whatItMeansForYou !== 'string' ||
    !Array.isArray(obj.showsUp)
  ) {
    return null;
  }
  return {
    categoryId: obj.categoryId,
    leansKey: obj.leansKey,
    title: obj.title,
    showsUp: obj.showsUp
      .map((r) => r as Record<string, unknown>)
      .filter((r) => isAxis(r.axis) && typeof r.line === 'string')
      .map((r) => ({ axis: r.axis as TraitAxis, line: r.line as string })),
    mix: typeof obj.mix === 'string' ? obj.mix : null,
    othersNotice: obj.othersNotice,
    whatItMeansForYou: obj.whatItMeansForYou,
    source: 'ai',
  };
}
