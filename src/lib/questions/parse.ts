import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import type { AxisWeight, QuestionDraft, QuestionOption } from './types';

function clamp01(value: number): number {
  const n = Math.min(1, Math.max(0, value));
  return Math.round(n * 100) / 100;
}

function isAxis(value: unknown): value is TraitAxis {
  return typeof value === 'string' && (TRAIT_AXES as readonly string[]).includes(value);
}

const MAX_PROMPT_LENGTH = 400;

/**
 * Every reject path is logged. The parser used to return null in silence, so a
 * round that asked for 5 questions could come back with 3 and nothing said why.
 * `category` is not available here — it is only ever set by the static bank —
 * so axis is the identity we log (or `unknown` when the axis is the bad field).
 */
function logDrop(reason: string, axis: unknown, promptLength: number): void {
  const axisLabel = isAxis(axis) ? axis : 'unknown';
  console.log(`[questions] dropped draft: ${reason} (axis=${axisLabel}, promptLength=${promptLength})`);
}

/** Cut at the last word boundary so a truncated prompt never ends mid-word. */
function truncatePrompt(prompt: string): string {
  if (prompt.length <= MAX_PROMPT_LENGTH) return prompt;
  const head = prompt.slice(0, MAX_PROMPT_LENGTH - 1);
  const lastSpace = head.lastIndexOf(' ');
  const cut = lastSpace > MAX_PROMPT_LENGTH / 2 ? head.slice(0, lastSpace) : head;
  // A prompt with no space cuts by index, which can strand the lead half of a
  // surrogate pair; a lone surrogate makes PostgREST reject the whole insert.
  const lead = cut.charCodeAt(cut.length - 1);
  const whole = lead >= 0xd800 && lead <= 0xdbff ? cut.slice(0, -1) : cut;
  const body = whole.trimEnd();
  return `${body}…`;
}

function parseOption(raw: unknown): QuestionOption | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const text = typeof row.text === 'string' ? row.text.trim() : '';
  const value = typeof row.value === 'number' ? row.value : Number(row.value);
  if (!text || text.length > 120 || !Number.isFinite(value)) return null;
  return { text, value: clamp01(value) };
}

/**
 * Multi-axis question engine fields (additive, optional — a question missing
 * any/all of these is still a perfectly valid single-axis draft). Nothing
 * consumes these yet; malformed entries are just dropped, never enough to
 * reject the whole question.
 */
function parseAxisWeight(raw: unknown): AxisWeight | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (!isAxis(row.axis)) return null;
  const weight = typeof row.weight === 'number' ? row.weight : Number(row.weight);
  if (!Number.isFinite(weight)) return null;
  const reason = typeof row.reason === 'string' ? row.reason.trim().slice(0, 300) : undefined;
  return reason ? { axis: row.axis, weight: clamp01(weight), reason } : { axis: row.axis, weight: clamp01(weight) };
}

function parseAxisWeightList(raw: unknown, max: number): AxisWeight[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.map(parseAxisWeight).filter((row): row is AxisWeight => row != null).slice(0, max);
  return out.length > 0 ? out : undefined;
}

function parseExcludedAxes(raw: unknown): TraitAxis[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<TraitAxis>();
  for (const item of raw) {
    if (isAxis(item)) seen.add(item);
  }
  return seen.size > 0 ? [...seen].slice(0, 8) : undefined;
}

function parseRedundancyTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 40)
    .slice(0, 6);
  return out.length > 0 ? out : undefined;
}

export function parseQuestionDraft(raw: unknown): QuestionDraft | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    logDrop('not an object', undefined, 0);
    return null;
  }
  const row = raw as Record<string, unknown>;
  const rawPrompt = typeof row.prompt === 'string' ? row.prompt.trim() : '';
  const promptLength = rawPrompt.length;
  if (!isAxis(row.axis)) {
    logDrop(`unknown axis ${JSON.stringify(row.axis).slice(0, 40)}`, row.axis, promptLength);
    return null;
  }
  if (!rawPrompt) {
    logDrop('empty prompt', row.axis, 0);
    return null;
  }
  // Over-long prompts are trimmed, not thrown away: 400 mirrors the DB CHECK on
  // question.prompt (wave17_infinite_questions.sql), so a trimmed prompt still inserts.
  const prompt = truncatePrompt(rawPrompt);
  if (promptLength > MAX_PROMPT_LENGTH) {
    console.log(
      `[questions] truncated prompt: ${promptLength} -> ${prompt.length} chars (axis=${row.axis})`,
    );
  }
  if (!Array.isArray(row.options)) {
    logDrop('options is not an array', row.axis, promptLength);
    return null;
  }
  const options = row.options.map(parseOption).filter((opt): opt is QuestionOption => opt != null);
  if (options.length < 2 || options.length > 3) {
    logDrop(
      `${options.length} valid options of ${row.options.length} raw (need 2-3)`,
      row.axis,
      promptLength,
    );
    return null;
  }
  const primaryAxes = parseAxisWeightList(row.primaryAxes, 2);
  const secondaryAxes = parseAxisWeightList(row.secondaryAxes, 3);
  const excludedAxes = parseExcludedAxes(row.excludedAxes);
  const redundancyTags = parseRedundancyTags(row.redundancyTags);
  return {
    axis: row.axis,
    prompt,
    options,
    ...(primaryAxes ? { primaryAxes } : {}),
    ...(secondaryAxes ? { secondaryAxes } : {}),
    ...(excludedAxes ? { excludedAxes } : {}),
    ...(redundancyTags ? { redundancyTags } : {}),
  };
}

/** `count` defaults to 5 so every pre-existing caller is byte-identical. */
export function parseQuestionBatch(raw: string, count = 5): QuestionDraft[] {
  const max = count > 0 ? Math.floor(count) : 5;
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : [];
  const out: QuestionDraft[] = [];
  for (const item of list) {
    const draft = parseQuestionDraft(item);
    if (draft) out.push(draft);
    if (out.length >= max) break;
  }
  if (out.length < max) {
    console.log(`[questions] batch short: kept ${out.length} of ${list.length} drafts (wanted ${max})`);
  }
  return out;
}

/** Full sweep: one per axis, up to TRAIT_AXES.length. Does not change the 5-item batch parser. */
export function parseQuestionSweep(raw: string): QuestionDraft[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : [];
  const seen = new Set<TraitAxis>();
  const out: QuestionDraft[] = [];
  let dropped = 0;
  for (const item of list) {
    const draft = parseQuestionDraft(item);
    if (!draft) dropped += 1;
    if (!draft || seen.has(draft.axis)) continue;
    seen.add(draft.axis);
    out.push(draft);
    if (out.length >= TRAIT_AXES.length) break;
  }
  // Only malformed items count as short — the dedupe and TRAIT_AXES cap are normal.
  if (dropped > 0) {
    console.log(`[questions] sweep short: kept ${out.length} of ${list.length} drafts, ${dropped} malformed`);
  }
  return out;
}
