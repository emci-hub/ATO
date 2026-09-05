import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import type { AxisWeight, QuestionDraft, QuestionOption } from './types';

function clamp01(value: number): number {
  const n = Math.min(1, Math.max(0, value));
  return Math.round(n * 100) / 100;
}

function isAxis(value: unknown): value is TraitAxis {
  return typeof value === 'string' && (TRAIT_AXES as readonly string[]).includes(value);
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
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (!isAxis(row.axis)) return null;
  const prompt = typeof row.prompt === 'string' ? row.prompt.trim() : '';
  if (!prompt || prompt.length > 400) return null;
  if (!Array.isArray(row.options)) return null;
  const options = row.options.map(parseOption).filter((opt): opt is QuestionOption => opt != null);
  if (options.length < 2 || options.length > 3) return null;
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

export function parseQuestionBatch(raw: string): QuestionDraft[] {
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
    if (out.length >= 5) break;
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
  for (const item of list) {
    const draft = parseQuestionDraft(item);
    if (!draft || seen.has(draft.axis)) continue;
    seen.add(draft.axis);
    out.push(draft);
    if (out.length >= TRAIT_AXES.length) break;
  }
  return out;
}
