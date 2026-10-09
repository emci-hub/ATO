/**
 * Legend figures — the "you" part of a legend's story.
 *
 * The museum label (who they were, famous for, facts, moments) is hand-written
 * and shown as-is, and so is "Where you match" (the hand-written tag phrases,
 * emci 2026-10-08: the model was only rewording them). The ONE AI call writes:
 *   title              — a 2–4 word name for the reader ("the patient rebuilder")
 *   howTheTraitWon     — each trait → one REAL moment, by id, + one line linking it
 *   metScene           — "If you'd met them": a short scene built from the entry
 *   differ             — "Where you differ": one line on a side they don't share
 *   whatItMeansForYou  — a few sentences in the moment voice
 * The moment text itself is always the hand-written one, never AI.
 *
 * `parseLegendStory` is the mechanical half of "no facts that aren't in the
 * entry": unknown axes or moment ids, any number or capitalised name not in the
 * entry, any quote not in the entry, and the voice bans all reject the answer
 * (one retry, then the no-AI fallback — never a dead end).
 */
import { AXIS_POLES, AXIS_POLE_NAME } from '@/lib/axis-poles';
import { fnv1a } from '@/lib/daily-line/bank';
import { MOMENT_VOICE_BLOCK } from '@/lib/voice/moment-voice';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { CARD_JOKE_RULES, cardJokeViolation, type CardJokeStyle } from '@/lib/voice/card-joke';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';

import type { LegendAngle, LegendFact, LegendFigure, LegendTag } from './types';

export interface LegendMatchLine {
  axis: TraitAxis;
  /** The reader's side on this axis (from the pairing, never from the model). */
  lean: TraitLean;
  them: string;
}

export interface LegendWonLine {
  axis: TraitAxis;
  momentId: string;
  line: string;
}

export interface LegendStory {
  legendId: string;
  angleId: string;
  momentId: string;
  whereYouMatch: LegendMatchLine[];
  howTheTraitWon: LegendWonLine[];
  whatItMeansForYou: string;
  /** AI only: a 2–4 word name for the reader, stored lowercase ("the patient rebuilder"). */
  title?: string;
  /** AI only: "If you'd met them". */
  metScene?: string;
  /** AI only: "Where you differ" — the reader's side the legend doesn't share. */
  differ?: { axis: TraitAxis; lean: TraitLean; line: string };
  /** AI only: "The funny part" — one joke line in the app-picked style. */
  joke?: string;
  /** 'ai' = written by the model (shows the AI badge); 'fallback' = hand-written. */
  source: 'ai' | 'fallback';
  /** Shared library (wave93): the library card's id (Report) and "you and N others". */
  libraryId?: string;
  others?: number | null;
}

/** A side of the reader the legend does not share: the opposite of one of its
 * tags (`tag` set), or a trait its label never shows (`tag` null). */
export interface LegendDiffer {
  axis: TraitAxis;
  lean: TraitLean;
  tag: LegendTag | null;
}

/** One of the person's trait sides paired with a legend tag. `contrast` = the
 * legend shows a different trait (no shared side was found). */
export interface LegendPair {
  axis: TraitAxis;
  lean: TraitLean;
  strength: number;
  tag: LegendTag;
  contrast: boolean;
}

export const STORY_MAX_PAIRS = 3;
export const THEM_MAX_WORDS = 6;
export const WON_MAX_WORDS = 35;
export const MEANS_MIN_WORDS = 20;
export const MEANS_MAX_WORDS = 60;
export const TITLE_MAX_WORDS = 4;
export const SCENE_MIN_WORDS = 15;
export const SCENE_MAX_WORDS = 45;
export const DIFFER_MIN_WORDS = 8;
export const DIFFER_MAX_WORDS = 30;

/** Facts and moments the app may show or send: verified only. */
export function shownFacts(legend: LegendFigure) {
  return legend.facts.filter((fact) => fact.source.verified);
}

export function shownMoments(legend: LegendFigure) {
  return legend.moments.filter((moment) => moment.source.verified);
}

/**
 * Pair the person's clear leans with the legend's tags: same-side matches
 * first (strongest lean first), up to three. With no shared side, pair the
 * person's strongest lean with the legend's first tag as a contrast.
 */
export function legendPairs(
  legend: LegendFigure,
  leans: readonly { axis: TraitAxis; lean: TraitLean; strength: number }[],
): LegendPair[] {
  const sorted = [...leans].sort((a, b) => b.strength - a.strength || TRAIT_AXES.indexOf(a.axis) - TRAIT_AXES.indexOf(b.axis));
  const pairs: LegendPair[] = [];
  for (const lean of sorted) {
    const tag = legend.tags.find((t) => t.axis === lean.axis && t.lean === lean.lean);
    if (tag) pairs.push({ ...lean, tag, contrast: false });
    if (pairs.length >= STORY_MAX_PAIRS) break;
  }
  if (pairs.length === 0 && sorted[0] && legend.tags[0]) {
    pairs.push({ ...sorted[0], tag: legend.tags[0], contrast: true });
  }
  return pairs;
}

/** The reader's strongest side the legend does NOT share: first an outright
 * opposite of one of its tags, else a trait its label never shows. */
export function legendDiffer(
  legend: LegendFigure,
  leans: readonly { axis: TraitAxis; lean: TraitLean; strength: number }[],
  /** Axes already shown under "Where you match" (never the same trait twice). */
  skipAxes: ReadonlySet<TraitAxis> = new Set(),
): LegendDiffer | null {
  const sorted = [...leans].filter((lean) => !skipAxes.has(lean.axis)).sort((a, b) => b.strength - a.strength || TRAIT_AXES.indexOf(a.axis) - TRAIT_AXES.indexOf(b.axis));
  for (const lean of sorted) {
    const tag = legend.tags.find((t) => t.axis === lean.axis && t.lean !== lean.lean);
    if (tag) return { axis: lean.axis, lean: lean.lean, tag };
  }
  for (const lean of sorted) {
    if (!legend.tags.some((t) => t.axis === lean.axis)) return { axis: lean.axis, lean: lean.lean, tag: null };
  }
  return null;
}

/** "Did you know?" (no AI): the verified fact that shares the most words with
 * the matched tags' evidence; ties broken per person, so two people differ. */
export function didYouKnowFact(legend: LegendFigure, story: LegendStory, userId: string): LegendFact | null {
  const facts = shownFacts(legend);
  if (facts.length === 0) return null;
  const axes = new Set(story.whereYouMatch.map((row) => row.axis));
  const clue = new Set(
    legend.tags
      .filter((tag) => axes.has(tag.axis))
      .flatMap((tag) => `${tag.why} ${tag.them}`.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []),
  );
  const score = (fact: LegendFact) =>
    (fact.text.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []).filter((word) => clue.has(word)).length;
  const tie = (fact: LegendFact) => fnv1a(`${userId}|${legend.id}|${fact.id}`);
  return [...facts].sort((a, b) => score(b) - score(a) || tie(a) - tie(b))[0]!;
}

/** "Still to come" (no AI): the teaser of a story this person hasn't heard yet. */
export function nextChapterTeaser(legend: LegendFigure, told: ReadonlySet<string> | undefined): string | null {
  return legend.angles.find((angle) => !told?.has(angle.id))?.teaser ?? null;
}

/** "the patient rebuilder" → "The Patient Rebuilder". */
export function titleCase(title: string): string {
  return title.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Every word the AI may borrow: the hand-written entry, pole names, and the angle. */
export function entryText(legend: LegendFigure, angle: LegendAngle | null): string {
  return [
    legend.name,
    legend.place,
    legend.field,
    legend.essence,
    legend.whoTheyWere,
    legend.famousFor,
    ...shownFacts(legend).map((f) => f.text),
    ...shownMoments(legend).map((m) => m.text),
    ...legend.tags.flatMap((t) => [t.them, t.why]),
    ...(angle ? [angle.name, angle.teaser, angle.meaning] : []),
  ].join(' ');
}

export function buildLegendPrompt(input: {
  legend: LegendFigure;
  angle: LegendAngle;
  focusMomentId: string;
  pairs: readonly LegendPair[];
  differ?: LegendDiffer | null;
  /** The joke style for this card (seeded by the app), or none. */
  jokeStyle?: CardJokeStyle | null;
}): string {
  const { legend, angle, pairs } = input;
  const differ = input.differ ?? null;
  const isStory = legend.kind === 'story';
  const isAnimal = legend.kind === 'animal';
  const facts = shownFacts(legend).map((f) => `- ${f.text}`).join('\n');
  const moments = shownMoments(legend)
    .map((m) => `- ${m.id}${m.id === input.focusMomentId ? ' (lead with this one)' : ''}: ${m.text}`)
    .join('\n');
  const traits = pairs
    .map((p) => {
      const pole = AXIS_POLE_NAME[p.axis][p.lean];
      const sound = AXIS_POLES[p.axis][p.lean];
      const link = p.contrast
        ? `a different side of theirs: "${p.tag.them}" (${p.tag.why})`
        : `their side "${p.tag.them}" (${p.tag.why})`;
      return `- axis "${p.axis}": the reader leans ${pole} (sounds like: ${sound}). Pair it with ${link}`;
    })
    .join('\n');
  const differLine = differ
    ? `- axis "${differ.axis}": the reader leans ${AXIS_POLE_NAME[differ.axis][differ.lean]} (sounds like: ${AXIS_POLES[differ.axis][differ.lean]}). ${
        differ.tag
          ? `${legend.name} shows the other side: "${differ.tag.them}" (${differ.tag.why})`
          : `the entry says nothing about this side of ${legend.name}`
      }`
    : null;
  const kindLine = isStory
    ? 'This is a story, not history. Talk about it as "in the story" / "the tale"; never claim it really happened.'
    : isAnimal
      ? 'A real animal. Never give it human thoughts or words it could not have had; describe what it did.'
      : 'Real person.';
  // Fixed instructions FIRST, the legend and the reader LAST: providers bill a
  // repeated opening at a discount (prompt caching), so the static part must be
  // byte-identical across every call (emci, 2026-10-08: "use the most of the AI tokens").
  return `${LEGEND_PROMPT_STATIC}

THE LEGEND (the ONLY facts you may use — nothing else about them, ever):
Name: ${legend.name}
${kindLine}
Who they were: ${legend.whoTheyWere}
Famous for: ${legend.famousFor}
Facts:
${facts}
Moments (refer to them only by id):
${moments}

THE ANGLE for this card: "${angle.name}" — ${angle.teaser}

THE READER (only these trait sides, never any label, score or framework word):
${traits}

${differLine ? `DIFFERENCE (for "differ"):\n${differLine}` : 'DIFFERENCE: none — leave out "differ".'}
${input.jokeStyle ? `JOKE STYLE (for "funny"): ${input.jokeStyle}` : 'JOKE STYLE: none — leave out "funny".'}`;
}

/** The byte-identical opening of every Legends prompt (cache-friendly). */
export const LEGEND_PROMPT_STATIC = `You write the personal part of a museum card that matches a reader with a legend: a real person from history,
a real animal, or a figure from myth or folklore. THE LEGEND at the end says which, and is the only source of facts.

${MOMENT_VOICE_BLOCK}

RULES
- Use no fact, date, number, name, place or quote that is not written in THE LEGEND. No invented quotes.
- Write numbers as words, use no quotation marks, and name no apps, brands or people other than the legend.
  (Everyday moments still work: "the group chat", "a tab you keep open", "a playlist".)
- Second person ("you", "your"). Never "you are", never "always", no "!", no emoji, no advice lists.
- Do not name the reader's trait sides with any word other than the ones given in THE READER.
- Kind, specific, modern, warm. Write like a friend who just spotted the link and is a little delighted by it.
- Never leave square or angle brackets in the answer.

"whatItMeansForYou" — 2 or 3 sentences, in this order (emci, 2026-10-08):
  1. The bridge: say plainly what the legend did (in the story, for a tale), in a few words from the entry, and the side of the reader it shares.
  2. One everyday moment the reader would recognise that shows that same side. It must make physical sense
     (a voice note is recorded, not typed; a text is sent, not said) and it must clearly be the SAME trait as the bridge.
  3. A short, kind closing line on what that says about the reader. No advice, no "should".
  Never write a moment that has no link to the legend. Never stack two unrelated moments.
  Shape only (do not copy the words, and vary how you open each sentence): "[Legend] did [thing from the entry]. You do a smaller version of that when [one modern moment showing the same side]. [What that quietly says about you]."
  Reread it once: if a friend would ask "wait, what does that have to do with it?", rewrite it.

"title" — a name for the reader, two to ${TITLE_MAX_WORDS} words, all lowercase, starting with "the".
  It names ONE side they share with the legend (from THE READER) in a fresh, flattering way the reader would want to share.
  Never about worry, doubt, overthinking, loneliness, sadness or struggle, even if that side is one of them. No names, no numbers, no trait words from a test.

"metScene" — "If you'd met": ${SCENE_MIN_WORDS}–${SCENE_MAX_WORDS} words, two sentences. Imagine one ordinary hour the reader spends
  with the legend (inside the tale, for a story), built only from THE LEGEND's facts and moments: one thing you do together,
  and one thing the legend would notice about the reader's shared side. Fun and specific; no new events, places, people or facts.

"differ" — only when a DIFFERENCE is given at the end: "Where you differ", one sentence, ${DIFFER_MIN_WORDS}–${DIFFER_MAX_WORDS} words, on that
  difference. Make it sound interesting, never a flaw on either side. If the entry says nothing about that side of the legend,
  do NOT claim they lacked it; contrast the reader's side with what the legend is known for.

${CARD_JOKE_RULES}

Return JSON only, exactly this shape (leave out "differ" when DIFFERENCE is none, and "funny" when JOKE STYLE is none):
{
  "title": "<two to ${TITLE_MAX_WORDS} lowercase words starting with the>",
  "howTheTraitWon": [{"axis": "<axis id from THE READER>", "momentId": "<a moment id from THE LEGEND>", "line": "<max ${WON_MAX_WORDS} words linking that moment to the reader's side>"}],
  "metScene": "<${SCENE_MIN_WORDS}–${SCENE_MAX_WORDS} words>",
  "differ": "<${DIFFER_MIN_WORDS}–${DIFFER_MAX_WORDS} words>",
  "funny": "<one sentence>",
  "whatItMeansForYou": "<${MEANS_MIN_WORDS}–${MEANS_MAX_WORDS} words>"
}
howTheTraitWon: 1–2 items.`;

const DAY_WORDS = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** The voice + "nothing outside the entry" rules for one AI string. */
export function legendLineViolation(text: string, allowed: string, isStory: boolean): string | null {
  if (!text.trim()) return 'empty';
  if (/!/.test(text)) return 'exclamation';
  // A template placeholder left in ("[one modern moment]", "<…>").
  if (/[[\]<>]/.test(text)) return 'template left in';
  if (/\p{Extended_Pictographic}/u.test(text)) return 'emoji';
  if (/\byou(?:'|’)?re\b|\byou are\b/i.test(text)) return 'you are';
  if (/\balways\b/i.test(text)) return 'always';
  if (containsFrameworkTerm(text)) return 'framework term';
  if (isStory && /\b(historically|in history|really happened|actually happened|in real life)\b/i.test(text)) return 'story told as history';
  const entryNumbers = new Set((allowed.match(/\d[\d,.]*\d|\d/g) ?? []).map((n) => n.replace(/,/g, '')));
  for (const num of text.match(/\d[\d,.]*\d|\d/g) ?? []) {
    if (!entryNumbers.has(num.replace(/,/g, ''))) return `number not in entry: ${num}`;
  }
  for (const quoted of text.match(/[“"]([^”"]+)[”"]/g) ?? []) {
    const inner = quoted.slice(1, -1).trim();
    if (inner && !allowed.toLowerCase().includes(inner.toLowerCase())) return 'quote not in entry';
  }
  // Capitalised words that do not start a sentence must come from the entry.
  const re = /(^|[.?:;][”"’)]?\s+|\n\s*|[“"(—–-]\s*)?(?<![\p{L}’'])(\p{Lu}[\p{L}’'-]*)/gu;
  for (const m of text.matchAll(re)) {
    const word = m[2]!;
    const sentenceStart = m[1] != null || m.index === 0;
    if (sentenceStart) continue;
    if (word === 'I' || DAY_WORDS.has(word)) continue;
    if (!allowed.includes(word.replace(/[’']s$/, ''))) return `name not in entry: ${word}`;
  }
  return null;
}

/**
 * A shareable "the patient rebuilder" title (Legends and category deep dives):
 * two to four lowercase words starting with "the", nothing that reads as worry,
 * doubt or struggle on a share image, and the usual line rules.
 */
export function titleViolation(title: string, allowed: string): string | null {
  if (!/^the( [a-z][a-z'’-]*){1,3}$/.test(title) || words(title) > TITLE_MAX_WORDS) return 'title shape';
  if (
    /\b(anxi|worr|lonel|alone|sad|fear|struggl|broken|overthink|second-guess|doubt|nerv|insecur|clingy|needy|lost|fragile|timid|shy|avoidant|attach)/.test(
      title,
    )
  ) {
    return 'title tone';
  }
  return legendLineViolation(title, allowed, false);
}

/** The model's answer, checked: the story, or why it was rejected (for the
 * reason-only log — never the text itself). */
export interface LegendParseResult {
  story: LegendStory | null;
  reason: string | null;
}

/**
 * Parse + validate the model's answer. The core (title, the moment line, what
 * it means) must pass or the answer is rejected (retry, then fallback). The
 * optional parts (If you'd met, Where you differ, The funny part) are DROPPED
 * when they fail instead — the bad text is never shown, and a good card is
 * not paid for twice over one weak line (emci, 2026-10-08: token savings).
 */
export function parseLegendStoryResult(
  raw: string,
  ctx: {
    legend: LegendFigure;
    angle: LegendAngle;
    momentId: string;
    pairs: readonly LegendPair[];
    differ?: LegendDiffer | null;
    jokeStyle?: CardJokeStyle | null;
  },
): LegendParseResult {
  const reject = (reason: string): LegendParseResult => ({ story: null, reason });
  let data: unknown;
  try {
    data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return reject('not json');
  }
  if (typeof data !== 'object' || data == null) return reject('not an object');
  const obj = data as Record<string, unknown>;
  const axes = new Set(ctx.pairs.map((p) => p.axis));
  const momentIds = new Set(shownMoments(ctx.legend).map((m) => m.id));
  const allowed = `${entryText(ctx.legend, ctx.angle)} ${ctx.pairs
    .map((p) => `${AXIS_POLE_NAME[p.axis][p.lean]} ${AXIS_POLES[p.axis][p.lean]}`)
    .join(' ')}`;
  const isStory = ctx.legend.kind === 'story';

  // "Where you match" is the hand-written tag phrases, never the model's.
  const match: LegendMatchLine[] = ctx.pairs.map((p) => ({ axis: p.axis, lean: p.lean, them: p.tag.them }));

  if (typeof obj.title !== 'string') return reject('title missing');
  const title = obj.title.trim().toLowerCase();
  const titleBad = titleViolation(title, allowed);
  if (titleBad) return reject(`title: ${titleBad}`);

  if (!Array.isArray(obj.howTheTraitWon) || obj.howTheTraitWon.length < 1 || obj.howTheTraitWon.length > 2) {
    return reject('moment lines shape');
  }
  const won: LegendWonLine[] = [];
  for (const item of obj.howTheTraitWon) {
    const row = item as Record<string, unknown>;
    if (typeof row.axis !== 'string' || !axes.has(row.axis as TraitAxis)) return reject('moment line: unknown axis');
    if (typeof row.momentId !== 'string' || !momentIds.has(row.momentId)) return reject('moment line: unknown moment');
    if (typeof row.line !== 'string' || words(row.line) > WON_MAX_WORDS) return reject('moment line: length');
    const bad = legendLineViolation(row.line, allowed, isStory);
    if (bad) return reject(`moment line: ${bad}`);
    won.push({ axis: row.axis as TraitAxis, momentId: row.momentId, line: row.line.trim() });
  }

  if (typeof obj.whatItMeansForYou !== 'string') return reject('means missing');
  const means = obj.whatItMeansForYou.trim();
  const n = words(means);
  if (n < MEANS_MIN_WORDS || n > MEANS_MAX_WORDS) return reject('means: length');
  const meansBad = legendLineViolation(means, allowed, isStory);
  if (meansBad) return reject(`means: ${meansBad}`);

  // Optional parts: kept only when they pass, dropped otherwise.
  let metScene: string | undefined;
  if (typeof obj.metScene === 'string') {
    const line = obj.metScene.trim();
    if (words(line) >= SCENE_MIN_WORDS && words(line) <= SCENE_MAX_WORDS && !legendLineViolation(line, allowed, isStory)) {
      metScene = line;
    }
  }

  const differCtx = ctx.differ ?? null;
  let differ: LegendStory['differ'];
  if (differCtx && typeof obj.differ === 'string') {
    const line = obj.differ.trim();
    const differAllowed = `${allowed} ${AXIS_POLE_NAME[differCtx.axis][differCtx.lean]} ${AXIS_POLES[differCtx.axis][differCtx.lean]}`;
    if (words(line) >= DIFFER_MIN_WORDS && words(line) <= DIFFER_MAX_WORDS && !legendLineViolation(line, differAllowed, isStory)) {
      differ = { axis: differCtx.axis, lean: differCtx.lean, line };
    }
  }

  let joke: string | undefined;
  if (ctx.jokeStyle && typeof obj.funny === 'string') {
    const line = obj.funny.trim();
    if (!cardJokeViolation(line) && !legendLineViolation(line, allowed, isStory)) joke = line;
  }

  return {
    story: {
      legendId: ctx.legend.id,
      angleId: ctx.angle.id,
      momentId: ctx.momentId,
      whereYouMatch: match,
      howTheTraitWon: won,
      whatItMeansForYou: means,
      title,
      ...(metScene ? { metScene } : {}),
      ...(differ ? { differ } : {}),
      ...(joke ? { joke } : {}),
      source: 'ai',
    },
    reason: null,
  };
}

/** Parse + validate the model's answer. Null = reject (retry or fall back). */
export function parseLegendStory(raw: string, ctx: Parameters<typeof parseLegendStoryResult>[1]): LegendStory | null {
  return parseLegendStoryResult(raw, ctx).story;
}

/** The no-AI story: every word hand-written (tags, the chosen moment, the angle's meaning). */
export function fallbackLegendStory(input: {
  legend: LegendFigure;
  angle: LegendAngle;
  momentId: string;
  pairs: readonly LegendPair[];
}): LegendStory {
  const first = input.pairs[0];
  return {
    legendId: input.legend.id,
    angleId: input.angle.id,
    momentId: input.momentId,
    whereYouMatch: input.pairs.map((p) => ({ axis: p.axis, lean: p.lean, them: p.tag.them })),
    howTheTraitWon: first ? [{ axis: first.axis, momentId: input.momentId, line: first.tag.why }] : [],
    whatItMeansForYou: input.angle.meaning,
    source: 'fallback',
  };
}

/** Loose read of a stored story (server row or phone cache). */
export function parseStoredLegendStory(raw: unknown): LegendStory | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.legendId !== 'string' || typeof obj.angleId !== 'string' || typeof obj.momentId !== 'string') return null;
  if (!Array.isArray(obj.whereYouMatch) || !Array.isArray(obj.howTheTraitWon) || typeof obj.whatItMeansForYou !== 'string') {
    return null;
  }
  const isAxis = (v: unknown): v is TraitAxis => typeof v === 'string' && (TRAIT_AXES as readonly string[]).includes(v);
  const match = obj.whereYouMatch
    .map((r) => r as Record<string, unknown>)
    .filter((r) => isAxis(r.axis) && typeof r.them === 'string')
    .map((r) => ({ axis: r.axis as TraitAxis, lean: (r.lean === 'low' ? 'low' : 'high') as TraitLean, them: r.them as string }));
  const won = obj.howTheTraitWon
    .map((r) => r as Record<string, unknown>)
    .filter((r) => isAxis(r.axis) && typeof r.momentId === 'string' && typeof r.line === 'string')
    .map((r) => ({ axis: r.axis as TraitAxis, momentId: r.momentId as string, line: r.line as string }));
  return {
    legendId: obj.legendId,
    angleId: obj.angleId,
    momentId: obj.momentId,
    whereYouMatch: match,
    howTheTraitWon: won,
    whatItMeansForYou: obj.whatItMeansForYou,
    ...(typeof obj.title === 'string' ? { title: obj.title } : {}),
    ...(typeof obj.metScene === 'string' ? { metScene: obj.metScene } : {}),
    ...(storedDiffer(obj.differ) ?? {}),
    ...(typeof obj.joke === 'string' ? { joke: obj.joke } : {}),
    ...(typeof obj.libraryId === 'string' && /^[0-9a-f-]{36}$/.test(obj.libraryId) ? { libraryId: obj.libraryId } : {}),
    ...(typeof obj.others === 'number' ? { others: obj.others } : {}),
    source: obj.source === 'ai' ? 'ai' : 'fallback',
  };
}

function storedDiffer(raw: unknown): { differ: NonNullable<LegendStory['differ']> } | null {
  if (typeof raw !== 'object' || raw == null) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.axis !== 'string' || !(TRAIT_AXES as readonly string[]).includes(row.axis) || typeof row.line !== 'string') {
    return null;
  }
  return { differ: { axis: row.axis as TraitAxis, lean: row.lean === 'low' ? 'low' : 'high', line: row.line } };
}
