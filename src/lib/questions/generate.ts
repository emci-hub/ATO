import { generateText } from '@/lib/ai/generate';
import { QUESTIONS_META } from '@/lib/ai/call-sites';

import { parseQuestionBatch } from './parse';
import type { QuestionDraft } from './types';

/**
 * `count` defaults to 5 (Infinite Questions' existing batch size) so every
 * pre-existing caller is byte-identical. `maxOutputTokens: 2048` is
 * unchanged and requested regardless of `count` — `ai-generate`'s shared
 * quota config clamps actual output to 1024 server-side no matter what a
 * caller asks for (a fixed cap, not something this function controls), so
 * callers that need more than 5 questions (category-batch.ts) request them
 * across multiple calls of at most 5 each instead of raising this number.
 */
export async function generateQuestionBatch(
  prompt: string,
  count = 5,
): Promise<QuestionDraft[] | null> {
  const n = count > 0 ? Math.floor(count) : 5;
  const text = await generateText({
    prompt,
    temperature: 0.9,
    maxOutputTokens: 2048,
    responseFormat: 'json',
  }, QUESTIONS_META);
  if (!text) return null;
  const drafts = parseQuestionBatch(text, n);
  return drafts.length >= n ? drafts.slice(0, n) : drafts.length > 0 ? drafts : null;
}
