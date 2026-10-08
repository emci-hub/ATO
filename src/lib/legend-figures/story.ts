/**
 * Legend figures — the "you" part of a legend's story.
 *
 * The museum label (who they were, famous for, facts, moments) is hand-written
 * and shown as-is. The AI writes ONLY:
 *   whereYouMatch      — each of the person's trait sides → the legend's side
 *   howTheTraitWon     — each trait → one REAL moment, by id, + one line linking it
 *   whatItMeansForYou  — a few sentences in the moment voice
 * The moment text itself is always the hand-written one, never AI.
 *
 * `parseLegendStory` is the mechanical half of "no facts that aren't in the
 * entry": unknown axes or moment ids, any number or capitalised name not in the
 * entry, any quote not in the entry, and the voice bans all reject the answer
 * (one retry, then the no-AI fallback — never a dead end).
 */
import { AXIS_POLES, AXIS_POLE_NAME } from '@/lib/axis-poles';
import { MOMENT_VOICE_BLOCK } from '@/lib/voice/moment-voice';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';

import type { LegendAngle, LegendFigure, LegendTag } from './types';

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
  /** 'ai' = written by the model (shows the AI badge); 'fallback' = hand-written. */
  source: 'ai' | 'fallback';
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
export const MEANS_MIN_WORDS = 8;
export const MEANS_MAX_WORDS = 50;

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
}): string {
  const { legend, angle, pairs } = input;
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
  const kindLine = isStory
    ? 'This is a story, not history. Talk about it as "in the story" / "the tale"; never claim it really happened.'
    : isAnimal
      ? 'A real animal. Never give it human thoughts or words it could not have had; describe what it did.'
      : 'Real person.';
  return `You write the personal part of a museum card that matches a reader with a ${isStory ? 'legend from myth or folklore' : isAnimal ? 'real animal from history' : 'real person from history'}.

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

${MOMENT_VOICE_BLOCK}

RULES
- Use no fact, date, number, name, place or quote that is not written above. No invented quotes.
- Write numbers as words, use no quotation marks, and name no apps, brands or people other than ${legend.name}.
  (Everyday moments still work: "the group chat", "a tab you keep open", "a playlist".)
- Second person ("you", "your"). Never "you are", never "always", no "!", no emoji, no advice lists.
- Kind, specific, modern. One concrete everyday moment in "whatItMeansForYou".
- Do not name the reader's trait sides with any word other than the ones given above.

Return JSON only, exactly this shape:
{
  "whereYouMatch": [{"axis": "<one axis id from THE READER>", "them": "<their side, max ${THEM_MAX_WORDS} words>"}],
  "howTheTraitWon": [{"axis": "<axis id>", "momentId": "<a moment id from above>", "line": "<max ${WON_MAX_WORDS} words linking that moment to the reader's side>"}],
  "whatItMeansForYou": "<${MEANS_MIN_WORDS}–${MEANS_MAX_WORDS} words>"
}
whereYouMatch: one item per reader axis above (${pairs.length}). howTheTraitWon: 1–2 items.`;
}

const DAY_WORDS = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** The voice + "nothing outside the entry" rules for one AI string. */
export function legendLineViolation(text: string, allowed: string, isStory: boolean): string | null {
  if (!text.trim()) return 'empty';
  if (/!/.test(text)) return 'exclamation';
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

/** Parse + validate the model's answer. Null = reject (retry or fall back). */
export function parseLegendStory(
  raw: string,
  ctx: {
    legend: LegendFigure;
    angle: LegendAngle;
    momentId: string;
    pairs: readonly LegendPair[];
  },
): LegendStory | null {
  let data: unknown;
  try {
    data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data == null) return null;
  const obj = data as Record<string, unknown>;
  const axes = new Set(ctx.pairs.map((p) => p.axis));
  const momentIds = new Set(shownMoments(ctx.legend).map((m) => m.id));
  const allowed = `${entryText(ctx.legend, ctx.angle)} ${ctx.pairs
    .map((p) => `${AXIS_POLE_NAME[p.axis][p.lean]} ${AXIS_POLES[p.axis][p.lean]}`)
    .join(' ')}`;
  const isStory = ctx.legend.kind === 'story';

  if (!Array.isArray(obj.whereYouMatch) || obj.whereYouMatch.length < 1 || obj.whereYouMatch.length > STORY_MAX_PAIRS) {
    return null;
  }
  const match: LegendMatchLine[] = [];
  const seen = new Set<string>();
  for (const item of obj.whereYouMatch) {
    const row = item as Record<string, unknown>;
    if (typeof row.axis !== 'string' || !axes.has(row.axis as TraitAxis) || seen.has(row.axis)) return null;
    if (typeof row.them !== 'string' || words(row.them) > THEM_MAX_WORDS) return null;
    if (legendLineViolation(row.them, allowed, isStory)) return null;
    seen.add(row.axis);
    const pair = ctx.pairs.find((p) => p.axis === row.axis)!;
    match.push({ axis: pair.axis, lean: pair.lean, them: row.them.trim() });
  }

  if (!Array.isArray(obj.howTheTraitWon) || obj.howTheTraitWon.length < 1 || obj.howTheTraitWon.length > 2) return null;
  const won: LegendWonLine[] = [];
  for (const item of obj.howTheTraitWon) {
    const row = item as Record<string, unknown>;
    if (typeof row.axis !== 'string' || !axes.has(row.axis as TraitAxis)) return null;
    if (typeof row.momentId !== 'string' || !momentIds.has(row.momentId)) return null;
    if (typeof row.line !== 'string' || words(row.line) > WON_MAX_WORDS) return null;
    if (legendLineViolation(row.line, allowed, isStory)) return null;
    won.push({ axis: row.axis as TraitAxis, momentId: row.momentId, line: row.line.trim() });
  }

  if (typeof obj.whatItMeansForYou !== 'string') return null;
  const means = obj.whatItMeansForYou.trim();
  const n = words(means);
  if (n < MEANS_MIN_WORDS || n > MEANS_MAX_WORDS) return null;
  if (legendLineViolation(means, allowed, isStory)) return null;

  return {
    legendId: ctx.legend.id,
    angleId: ctx.angle.id,
    momentId: ctx.momentId,
    whereYouMatch: match,
    howTheTraitWon: won,
    whatItMeansForYou: means,
    source: 'ai',
  };
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
    source: obj.source === 'ai' ? 'ai' : 'fallback',
  };
}
