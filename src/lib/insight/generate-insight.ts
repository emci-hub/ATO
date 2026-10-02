/**
 * The daily insight (Home/Explore/Insight restructure, T-H1) — one AI call
 * producing the five fields that replace the Read/Do card and Dawn.
 *
 * Structurally a sibling of category-statements/generate-statements.ts: prompt
 * builder + VOICE_REFERENCE + STYLE_BLOCK, strict-JSON response, a parser that
 * refuses anything it cannot validate, and a COPY_REVIEWED flag. The grounding
 * slice is deliberately the same one the old card read — settled report-track
 * bands, current focus, and recent check tone — so personalization does not
 * regress when the card goes away.
 *
 * UNREVIEWED, and diagnosis-adjacent by nature: `reflection` and `watch_for`
 * both describe the user to themselves. DAILY_INSIGHT_COPY_REVIEWED stays
 * false until emci reads it directly.
 */
import { DAILY_INSIGHT_META } from '@/lib/ai/call-sites';
import { generateText } from '@/lib/ai/generate';
import { AXIS_EDITOR_COPY } from '@/lib/sage-knows';
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import { effectiveStability, trackFor, type TraitTrack } from '@/lib/trait-stability';
import { leanHighLow, TRAIT_AXES, type TraitAxis, type TraitLean } from '@/lib/traits';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { STYLE_BLOCK } from '@/lib/voice/style-checklist';
import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';

export const DAILY_INSIGHT_COPY_REVIEWED = false;

/**
 * Per-field character caps. These are mirrored by the CHECK constraints in
 * supabase/migrations/wave69_daily_insights.sql; scripts/insight-check.ts
 * parses both and fails if they drift apart.
 */
export const INSIGHT_FIELD_CAPS = {
  theme: 60,
  title: 80,
  reflection: 400,
  tryToday: 200,
  watchFor: 200,
} as const;

export interface DailyInsightDraft {
  theme: string;
  title: string;
  reflection: string;
  tryToday: string;
  watchFor: string;
}

export interface InsightGrounding {
  tracks: readonly TraitTrack[];
  currentFocus: string | null;
  /** Recent check outcomes, newest first — tone only, never quoted back. */
  recentTone: readonly ('did' | 'skip')[];
  /** The written daily line already on Home today (lib/daily-line), if any. */
  todayLine?: string | null;
  /** Titles of this person's last few insights, newest first. */
  recentTitles?: readonly string[];
}

/**
 * Settled axes only (`effectiveStability > 0`), as qualitative pole phrases —
 * never a raw trait value. Same convention as questions/prompt.ts and
 * sage-title.ts's settled notes.
 */
export interface GroundedLean {
  axis: TraitAxis;
  lean: TraitLean;
  /** The plain-words pole the prompt shows for this lean. */
  phrase: string;
}

/** The settled axes the prompt is grounded in, in the order they are listed. */
export function groundedLeans(tracks: readonly TraitTrack[]): GroundedLean[] {
  const out: GroundedLean[] = [];
  for (const axis of TRAIT_AXES) {
    const row = trackFor(tracks, axis, 'report');
    if (!row) continue;
    const stability = effectiveStability(row);
    if (stability <= 0) continue;
    const pole = TRAIT_BAND_PHRASES[axis][leanHighLow(row.value)];
    out.push({ axis, lean: leanHighLow(row.value), phrase: pole });
  }
  return out;
}

/**
 * Numbered, so a daily line can say which one it is about without the model
 * ever seeing (or echoing) an internal trait name.
 */
function traitContextLines(tracks: readonly TraitTrack[]): string[] {
  return groundedLeans(tracks).map(
    ({ axis, phrase }, i) => `- [${i + 1}] ${AXIS_EDITOR_COPY[axis].label}: leans toward "${phrase}"`,
  );
}

/** How many personal daily lines one insight call asks for. */
export const INSIGHT_LINE_COUNT = 4;

/**
 * The daily-line top-up, riding on the insight call (no extra model call, no
 * extra quota). Bank first, model for the rest — the same shape as a round of
 * questions. These lines are for this one account only and are checked by
 * `lineRuleViolation` before any is kept.
 */
function dailyLinesBlock(leanCount: number): string {
  if (leanCount === 0) return 'lines: return an empty list. Nothing is settled enough to write about.';
  return `lines: ${INSIGHT_LINE_COUNT} separate one-liners for a different part of the app. These follow THEIR OWN rules, not the rules below:
  - Each is one concrete, recognizable moment this person has probably lived, told the way a friend would tease them kindly. Past tense or plain present.
  - Describe the moment and stop. No advice, no "try", no lesson, no question to reflect on.
  - Under 110 characters. Never "you are" or "you're". Never "always". No type names or psychology words.
  - Each is about exactly ONE numbered item in WHAT YOU KNOW. Put that number in "n". Use ${INSIGHT_LINE_COUNT} different numbers when there are that many.
  - Register (do not reuse): "You said 'I'm fine with anything' and had a very specific answer ready." / "The plans got cancelled and you felt it like a gift." / "You bought the tool before you had the project."`;
}

function toneLine(recentTone: readonly ('did' | 'skip')[]): string {
  if (recentTone.length === 0) return 'No checks logged yet — do not reference a streak or a history.';
  const did = recentTone.filter((t) => t === 'did').length;
  return `Recent checks: ${did} done out of the last ${recentTone.length}. Tone only — never cite the number back to them, never praise or scold the ratio.`;
}

/**
 * The written line is from our own bank, never user-typed text, so it is safe
 * to quote into the prompt. The insight goes deeper on it rather than starting
 * a second, unrelated thought on the same screen.
 */
function todayLineBlock(todayLine: string | null | undefined): string {
  const line = todayLine?.trim();
  if (!line) return 'They have not been shown a short line today.';
  return `The short line they already read today: "${line}". Go one layer deeper on that same thread. Do not repeat its wording or its advice.`;
}

function recentTitlesBlock(recentTitles: readonly string[] | undefined): string {
  const titles = (recentTitles ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 5);
  if (titles.length === 0) return 'No earlier insights to avoid.';
  const list = titles.map((t) => `- ${t}`).join('\n');
  return `Titles of their last insights — take a different angle and different wording from every one of these:\n${list}`;
}

export function buildDailyInsightPrompt(grounding: InsightGrounding): string {
  const traitLines = traitContextLines(grounding.tracks);
  const traitBlock =
    traitLines.length > 0
      ? traitLines.join('\n')
      : '- Nothing settled yet. Write something broadly useful, not a guess about them.';
  const focusLine = grounding.currentFocus
    ? `What they said they are working on right now: "${grounding.currentFocus}".`
    : 'They have not named anything they are working on right now.';

  return `Write as Sage in the ATO app. Follow the voice reference. Not a doctor. This is today's insight — the single personalized thing this person sees when they open the app.

VOICE REFERENCE (register only — do NOT reuse these lines):
${VOICE_REFERENCE}

${STYLE_BLOCK}

WHAT YOU KNOW (internal — write from the meaning, never the label)
${traitBlock}
${focusLine}
${toneLine(grounding.recentTone)}
${todayLineBlock(grounding.todayLine)}
${recentTitlesBlock(grounding.recentTitles)}

Job: produce five fields, then the lines.
- theme: 1–3 words naming today's angle. Plain, not a category name.
- title: one short line, under 10 words. The thing they will remember.
- reflection: 2–3 sentences. What might be going on, offered as a maybe.
- tryToday: one concrete, small, doable thing. A behavior, not a mindset.
- watchFor: one thing to notice in themselves today. An observation, not a warning.
- ${dailyLinesBlock(traitLines.length)}

RULES (for the five fields)
1. Everyday language. Not a diagnosis, not a type, not a test result.
2. Never Myers-Briggs, never a four-letter code, never "you are." Reflect as maybes, not facts.
3. Never name or imply a technical or internal-sounding trait label.
4. Hedge lives inside the sentence. No bolted-on closing after a dash or period.
5. tryToday must be doable today, in a few minutes, without anyone else's cooperation.
6. watchFor is neutral curiosity, never a prediction of failure.
7. Do not reference the app, the checks, streaks, or these instructions.

Respond with JSON only:
{"theme":"<theme>","title":"<title>","reflection":"<reflection>","tryToday":"<try today>","watchFor":"<watch for>","lines":[{"n":1,"text":"<line>"}]}`;
}

function cleanField(raw: unknown, cap: number): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // The fence runs on every one of the five fields, not just the prose ones —
  // a framework term in `theme` would surface on Home exactly like one in
  // `reflection`.
  if (containsFrameworkTerm(trimmed)) return null;
  return trimmed.slice(0, cap);
}

/**
 * All five fields or nothing. A partial insight would render as a broken card,
 * and there is no sensible per-field fallback — a missing `tryToday` is not
 * something the UI can invent.
 */
export function parseDailyInsight(text: string): DailyInsightDraft | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;

    const theme = cleanField(parsed.theme, INSIGHT_FIELD_CAPS.theme);
    const title = cleanField(parsed.title, INSIGHT_FIELD_CAPS.title);
    const reflection = cleanField(parsed.reflection, INSIGHT_FIELD_CAPS.reflection);
    const tryToday = cleanField(parsed.tryToday, INSIGHT_FIELD_CAPS.tryToday);
    const watchFor = cleanField(parsed.watchFor, INSIGHT_FIELD_CAPS.watchFor);

    if (!theme || !title || !reflection || !tryToday || !watchFor) return null;
    return { theme, title, reflection, tryToday, watchFor };
  } catch {
    return null;
  }
}

export interface InsightLine {
  axis: TraitAxis;
  lean: TraitLean;
  text: string;
}

/**
 * The optional `lines` list from the same response. Never fails the insight:
 * a missing or malformed list is simply no lines. `n` is mapped back to the
 * axis it numbered; a line with a number that was not offered is dropped.
 * The copy rules are NOT applied here — the caller runs `lineRuleViolation`
 * and records what it drops, so the Dev Tools Hub can show the raw output.
 */
export function parseInsightLines(text: string, leans: readonly GroundedLean[]): InsightLine[] {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return [];
    const parsed = JSON.parse(text.slice(start, end + 1)) as { lines?: unknown };
    if (!Array.isArray(parsed.lines)) return [];
    const out: InsightLine[] = [];
    for (const item of parsed.lines.slice(0, INSIGHT_LINE_COUNT * 2)) {
      if (!item || typeof item !== 'object') continue;
      const row = item as { n?: unknown; text?: unknown };
      const lean = typeof row.n === 'number' ? leans[row.n - 1] : undefined;
      if (!lean || typeof row.text !== 'string' || !row.text.trim()) continue;
      out.push({ axis: lean.axis, lean: lean.lean, text: row.text.trim() });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Returns null on any failure (no response, unparseable, or any field filtered
 * out) — never throws, matching every other generation call site's contract in
 * this repo, so the caller can degrade to a retry without a crash.
 */
export async function generateDailyInsight(
  grounding: InsightGrounding,
): Promise<DailyInsightDraft | null> {
  return (await generateDailyInsightAndLines(grounding))?.draft ?? null;
}

/** The insight plus the personal daily lines that came back with it (possibly none). */
export async function generateDailyInsightAndLines(
  grounding: InsightGrounding,
): Promise<{ draft: DailyInsightDraft; lines: InsightLine[] } | null> {
  const text = await generateText({
    prompt: buildDailyInsightPrompt(grounding),
    temperature: 0.9,
    maxOutputTokens: 1024,
    responseFormat: 'json',
  }, DAILY_INSIGHT_META);
  if (!text) return null;
  const draft = parseDailyInsight(text);
  if (!draft) return null;
  return { draft, lines: parseInsightLines(text, groundedLeans(grounding.tracks)) };
}
