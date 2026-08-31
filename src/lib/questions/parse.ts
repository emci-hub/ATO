import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

import type { QuestionDraft, QuestionOption } from './types';

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

export function parseQuestionDraft(raw: unknown): QuestionDraft | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (!isAxis(row.axis)) return null;
  const prompt = typeof row.prompt === 'string' ? row.prompt.trim() : '';
  if (!prompt || prompt.length > 400) return null;
  if (!Array.isArray(row.options)) return null;
  const options = row.options.map(parseOption).filter((opt): opt is QuestionOption => opt != null);
  if (options.length < 2 || options.length > 3) return null;
  return { axis: row.axis, prompt, options };
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

/** Full sweep: one per axis, up to 15. Does not change the 5-item batch parser. */
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
    if (out.length >= 15) break;
  }
  return out;
}
