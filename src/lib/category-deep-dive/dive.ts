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
import { effectiveStability, trackFor, type TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';
import { CARD_JOKE_RULES, cardJokeViolation, type CardJokeStyle } from '@/lib/voice/card-joke';
import { MOMENT_VOICE_BLOCK } from '@/lib/voice/moment-voice';

export interface DiveLean {
  axis: TraitAxis;
  lean: TraitLean;
  /** How far toward that side, 50–100 ("Adventurous 78%"). */
  pct: number;
  /** How much the category's own formula counts this trait (default 1). */
  weight?: number;
  /** How sure we are of this answer, 0–1 (`effectiveStability`: answers + agreement, aged). */
  confidence?: number;
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
  /** Optional: dropped (null) when it failed the checks. */
  othersNotice: string | null;
  whatItMeansForYou: string;
  /** "The funny part", in the app-picked style; absent when none passed. */
  joke?: string;
  /** A bundled extra card opens on this UTC day (YYYY-MM-DD); absent = open now. */
  opensOn?: string;
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
      const row = trackFor(tracks, axis, 'report');
      const value = row?.value ?? 0.5;
      return {
        axis,
        lean: (value >= 0.5 ? 'high' : 'low') as TraitLean,
        pct: leanPct(value),
        weight: def.weights[axis] ?? 1,
        confidence: effectiveStability(row, now),
      };
    })
    .sort((a, b) => b.pct - a.pct || TRAIT_AXES.indexOf(a.axis) - TRAIT_AXES.indexOf(b.axis));
}

/**
 * ONE number per category (emci, 2026-10-08: "1 total number and the most
 * accurate"), 50–100: how strongly the person leans overall in this part of
 * them. Each trait's lean counts by the category's own weight for it TIMES how
 * sure we are of that answer (`confidence`), so a well-answered trait drives
 * the number and a shaky one barely moves it. High = clearly defined; near 50
 * = they sit in the middle here. Sorts the list, strongest first. Null when
 * the category isn't open yet.
 */
export function categoryScore(leans: readonly DiveLean[]): number | null {
  if (leans.length === 0) return null;
  let num = 0;
  let den = 0;
  for (const row of leans) {
    // Clamped: a zero/negative catalog weight can never push the number outside 50–100.
    const w = Math.max(row.weight ?? 1, 0) * Math.max(row.confidence ?? 1, 0.05);
    num += row.pct * w;
    den += w;
  }
  return den > 0 ? Math.round(num / den) : null;
}

/** Bumped when the prompt changes enough that old cards should offer a rewrite. */
export const DIVE_PROMPT_VERSION = 'v2';

/** A new card only when a side flips or a leaning moves by about ten points. */
export function leansKey(leans: readonly DiveLean[]): string {
  return `${DIVE_PROMPT_VERSION}|` + [...leans]
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

/** One card asked for in a call: its category, the leanings, and its joke style. */
export interface DiveSpec {
  def: CategoryDef;
  leans: readonly DiveLean[];
  jokeStyle: CardJokeStyle | null;
}

/** Cards per AI call (emci, 2026-10-08: bundle). Two fit safely under the
 * 1024 output-token cap; a third would risk a cut-off (wasted) answer. */
export const DIVE_CARDS_PER_CALL = 2;

/** Output budget: one card ~450 tokens; two ~900, safely under the server's 1024 cap. */
export function diveOutputTokens(cards: number): number {
  return cards >= 2 ? 1000 : 600;
}

/** The byte-identical opening of every deep-dive prompt (cache-friendly). */
export const DIVE_PROMPT_STATIC = `You write short "deep dive" cards about ONE reader, each inside ONE category of their personality, for a self-discovery app.
The CARD sections at the end give, for each card, the category and the reader's leanings in it.

${MOMENT_VOICE_BLOCK}

RULES
- Second person ("you", "your"). Never "you are", never "always", no "!", no emoji, no advice, no "should".
- Use no quotation marks, and name no people, apps or brands.
  (Everyday things still work: "the group chat", "a tab you keep open", "a playlist".)
- No counting and no exaggeration: never a number or a number word above two ("three towns", "twelve
  checklists", "eleven ways" all read as made up). Say "a few", "a couple" or nothing. Never repeat a percentage.
- Name the reader's sides only with the words given in that card's LEANINGS. No test, score or framework words.
- Every moment must make physical sense (a voice note is recorded, not typed) and clearly show the leaning it is for.
- Kind, specific, modern, warm, a little delighted. Never a diagnosis, never a flaw.
- A card marked GENTLE is about closeness: describe habits with close people warmly and plainly. Never diagnose, never
  use words like anxious, insecure, avoidant, attachment, needy or clingy, never suggest anything is wrong.
- Never leave square or angle brackets in the answer.

STYLE — CLEAR FIRST, MOMENT SECOND (emci, 2026-10-08; this overrides "Describe the moment and stop" above, and the
counts in the register examples there — "eleven ways", "47 tabs" — are exactly what NOT to do here):
- Every part opens with a plain, true sentence about the reader that a friend would nod at.
  Only THEN, if it helps, add one short, realistic everyday example (the kind that happens every week,
  not a strange one-off scene). Nobody should have to reread it to get the point.
- A low or "quiet" side is a style with an upside, never a weakness: say what it gives the reader.
- Modern and natural, like a smart friend texting you an observation. No riddles, no stacked details.

FOR EACH CARD:
"title" — a name for the reader in this category, two to four lowercase words, starting with "the".
  Fresh and flattering, something they'd want to share. Never about worry, doubt, loneliness or struggle.
"showsUp" — one item for each axis the card lists under SHOWS UP, ${SHOWS_MIN_WORDS}–${SHOWS_MAX_WORDS} words: first what this side looks
  like in the reader's life in plain words, then optionally one short realistic example ("..., like when you ...").
"mix" — only when the card says MIX: yes. ${MIX_MIN_WORDS}–${MIX_MAX_WORDS} words, in plain words, on how the two strongest leanings
  work TOGETHER (a blend or a fun tension), then optionally one quick example.
"othersNotice" — ${NOTICE_MIN_WORDS}–${NOTICE_MAX_WORDS} words: what the people around the reader probably notice about them here. Kind, specific.
"whatItMeansForYou" — ${DIVE_MEANS_MIN_WORDS}–${DIVE_MEANS_MAX_WORDS} words, 2 or 3 sentences, in this order:
  1. Name the overall pattern in plain words (what these leanings add up to in this part of the reader's life).
  2. One realistic everyday moment that shows it.
  3. A short, kind closing line on what that quietly says about the reader. No advice.
  Shape only (do not copy the words): "[Plain pattern]. You see it when [one realistic moment]. [What that quietly says about you]."
  Reread it once: if a friend would ask "wait, what?", rewrite it.
${CARD_JOKE_RULES}

Return JSON only: one object per CARD, in the same order, exactly this shape
(leave out "mix" when MIX: no, and "funny" when JOKE STYLE: none):
{"cards": [{
  "title": "<two to four lowercase words starting with the>",
  "showsUp": [{"axis": "<axis id>", "line": "<${SHOWS_MIN_WORDS}–${SHOWS_MAX_WORDS} words>"}],
  "mix": "<${MIX_MIN_WORDS}–${MIX_MAX_WORDS} words>",
  "othersNotice": "<${NOTICE_MIN_WORDS}–${NOTICE_MAX_WORDS} words>",
  "funny": "<one sentence>",
  "whatItMeansForYou": "<${DIVE_MEANS_MIN_WORDS}–${DIVE_MEANS_MAX_WORDS} words>"
}]}`;

function cardBlock(spec: DiveSpec, index: number): string {
  const top = spec.leans.slice(0, DIVE_TOP_LEANS);
  const rows = spec.leans
    .map(
      (row) =>
        `- axis "${row.axis}": leans ${AXIS_POLE_NAME[row.axis][row.lean]} (${row.pct >= 75 ? 'strongly' : row.pct >= 60 ? 'clearly' : 'slightly'}; sounds like: ${AXIS_POLES[row.axis][row.lean]})`,
    )
    .join('\n');
  return `CARD ${index + 1} — THE CATEGORY: ${spec.def.name}${spec.def.id === 'cat_love' ? ' (GENTLE)' : ''}
LEANINGS (strongest first):
${rows}
SHOWS UP: ${top.map((row) => row.axis).join(', ')}
MIX: ${top.length >= 2 ? 'yes' : 'no'}
JOKE STYLE: ${spec.jokeStyle ?? 'none'}`;
}

/** Fixed instructions FIRST, the cards LAST (prompt caching bills a repeated opening at a discount). */
export function buildDiveBundlePrompt(specs: readonly DiveSpec[]): string {
  return `${DIVE_PROMPT_STATIC}\n\n${specs.map((spec, i) => cardBlock(spec, i)).join('\n\n')}`;
}

/** One card, no joke (the review doc and older callers). */
export function buildDivePrompt(def: CategoryDef, leans: readonly DiveLean[], jokeStyle: CardJokeStyle | null = null): string {
  return buildDiveBundlePrompt([{ def, leans, jokeStyle }]);
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** One AI line: the Legends line rules, no digits at all, no clinical words. */
const COUNT_WORDS =
  /\b(three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|hundred|thousand|dozen|dozens)\b/i;

export function diveLineViolation(text: string, allowed: string): string | null {
  if (/\d/.test(text)) return 'digit';
  if (COUNT_WORDS.test(text)) return 'count word';
  if (CLINICAL.test(text)) return 'clinical word';
  if (/\bshould\b/i.test(text)) return 'advice';
  return legendLineViolation(text, allowed, false);
}

function optionalLine(text: unknown, min: number, max: number, allowed: string): string | null {
  if (typeof text !== 'string') return null;
  const n = words(text);
  return n >= min && n <= max && diveLineViolation(text, allowed) == null ? text.trim() : null;
}

/** One card checked: the dive, or why it was rejected (reason only, for the log). */
export interface DiveCardResult {
  dive: CategoryDive | null;
  reason: string | null;
}

/**
 * One card. The core (title, where it shows up, what it means) must pass; the
 * optional parts (how they mix, what others notice, the funny part) are
 * DROPPED when they fail — never shown, and never worth a second paid call.
 */
export function parseDiveCard(obj: unknown, spec: DiveSpec): DiveCardResult {
  const reject = (reason: string): DiveCardResult => ({ dive: null, reason });
  if (typeof obj !== 'object' || obj == null) return reject('card not an object');
  const card = obj as Record<string, unknown>;
  const allowed = allowedText(spec.def, spec.leans);
  const top = spec.leans.slice(0, DIVE_TOP_LEANS);

  if (typeof card.title !== 'string') return reject('title missing');
  const title = card.title.trim().toLowerCase();
  const titleBad = titleViolation(title, allowed) ?? (CLINICAL.test(title) ? 'clinical word' : null);
  if (titleBad) return reject(`title: ${titleBad}`);

  if (!Array.isArray(card.showsUp)) return reject('shows up missing');
  const showsUp: DiveLine[] = [];
  for (const item of card.showsUp) {
    const row = item as Record<string, unknown>;
    const axis = top.find((lean) => lean.axis === row.axis)?.axis;
    if (!axis || showsUp.some((line) => line.axis === axis)) return reject('shows up: axis');
    if (typeof row.line !== 'string') return reject('shows up: line missing');
    const n = words(row.line);
    if (n < SHOWS_MIN_WORDS || n > SHOWS_MAX_WORDS) return reject('shows up: length');
    const bad = diveLineViolation(row.line, allowed);
    if (bad) return reject(`shows up: ${bad}`);
    showsUp.push({ axis, line: row.line.trim() });
  }
  if (showsUp.length !== top.length) return reject('shows up: count');

  if (typeof card.whatItMeansForYou !== 'string') return reject('means missing');
  const means = card.whatItMeansForYou.trim();
  if (words(means) < DIVE_MEANS_MIN_WORDS || words(means) > DIVE_MEANS_MAX_WORDS) return reject('means: length');
  const meansBad = diveLineViolation(means, allowed);
  if (meansBad) return reject(`means: ${meansBad}`);

  const mix = top.length >= 2 ? optionalLine(card.mix, MIX_MIN_WORDS, MIX_MAX_WORDS, allowed) : null;
  const othersNotice = optionalLine(card.othersNotice, NOTICE_MIN_WORDS, NOTICE_MAX_WORDS, allowed);
  let joke: string | null = null;
  if (spec.jokeStyle && typeof card.funny === 'string') {
    const line = card.funny.trim();
    if (!cardJokeViolation(line) && !diveLineViolation(line, allowed)) joke = line;
  }

  return {
    dive: {
      categoryId: spec.def.id,
      leansKey: leansKey(spec.leans),
      title,
      showsUp,
      mix,
      othersNotice,
      whatItMeansForYou: means,
      ...(joke ? { joke } : {}),
      source: 'ai',
    },
    reason: null,
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return undefined;
  }
}

/**
 * A bundle answer: `{"cards": [...]}` in the order asked. The FIRST card (the
 * one the person tapped) must pass or the whole answer is rejected; a failed
 * extra card is simply left out.
 */
export function parseDiveBundle(
  raw: string,
  specs: readonly DiveSpec[],
): { dives: (CategoryDive | null)[]; reason: string | null } {
  const data = parseJson(raw);
  if (data === undefined) return { dives: [], reason: 'not json' };
  const cards = (data as { cards?: unknown } | null)?.cards;
  const list: unknown[] = Array.isArray(cards) ? cards : [data];
  const results = specs.map((spec, i) => parseDiveCard(list[i], spec));
  const first = results[0];
  if (!first?.dive) return { dives: [], reason: first?.reason ?? 'no card' };
  return { dives: results.map((r) => r.dive), reason: null };
}

/** One card from a raw answer (older callers and the check). Null = reject. */
export function parseDive(raw: string, def: CategoryDef, leans: readonly DiveLean[]): CategoryDive | null {
  return parseDiveBundle(raw, [{ def, leans, jokeStyle: null }]).dives[0] ?? null;
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
    othersNotice: typeof obj.othersNotice === 'string' ? obj.othersNotice : null,
    whatItMeansForYou: obj.whatItMeansForYou,
    ...(typeof obj.joke === 'string' ? { joke: obj.joke } : {}),
    ...(typeof obj.opensOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.opensOn) ? { opensOn: obj.opensOn } : {}),
    source: 'ai',
  };
}
