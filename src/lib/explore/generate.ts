import { generateText } from '@/lib/ai/generate';
import type { AiCallMetadata } from '@/lib/ai/types';

import { parseExploreBody } from './prompt';
import { parseStoryAnswer, type StoryAnswer } from '@/lib/sage-story';

async function generateJson(
  prompt: string,
  maxOutputTokens: number,
  meta: AiCallMetadata,
): Promise<string | null> {
  return generateText({
    prompt,
    temperature: 0.9,
    maxOutputTokens,
    responseFormat: 'json',
  }, meta);
}

/**
 * Explore observations / Sage title / Sage insight all share this transport
 * but have different sharing rules — each caller passes its declared metadata
 * (see src/lib/ai/call-sites.ts).
 */
export async function generateExploreBody(
  prompt: string,
  meta: AiCallMetadata,
): Promise<string | null> {
  const text = await generateJson(prompt, 512, meta);
  return text ? parseExploreBody(text) : null;
}

/** Story card lane (2026-10-09): the raw JSON text; the fold parses it with
 * `parseStoryCardAnswer` so a rejection can be logged with its reason. */
export async function generateStoryCardText(prompt: string, meta: AiCallMetadata): Promise<string | null> {
  return generateJson(prompt, 900, meta);
}

/** Story lane — longer output. Returns null when the model is unreachable or the answer fails the checks. No fallback parse-to-prose. */
export async function generateStoryBody(
  prompt: string,
  meta: AiCallMetadata,
): Promise<StoryAnswer | null> {
  const text = await generateJson(prompt, 1024, meta);
  return text ? parseStoryAnswer(text) : null;
}
