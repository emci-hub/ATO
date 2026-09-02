import { generateText } from '@/lib/ai/generate';
import { QUESTIONS_META } from '@/lib/ai/call-sites';

import { parseQuestionBatch } from './parse';
import type { QuestionDraft } from './types';

export async function generateQuestionBatch(prompt: string): Promise<QuestionDraft[] | null> {
  const text = await generateText({
    prompt,
    temperature: 0.9,
    maxOutputTokens: 2048,
    responseFormat: 'json',
  }, QUESTIONS_META);
  if (!text) return null;
  const drafts = parseQuestionBatch(text);
  return drafts.length >= 5 ? drafts.slice(0, 5) : drafts.length > 0 ? drafts : null;
}
