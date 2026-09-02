import { generateText } from '@/lib/ai/generate';
import type { AiCallMetadata } from '@/lib/ai/types';

import { parseExploreBody } from './prompt';
import { parseStoryBody } from '@/lib/sage-story';

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

/** Story lane — longer output. Returns null when the model is unreachable. No fallback parse-to-prose. */
export async function generateStoryBody(
  prompt: string,
  meta: AiCallMetadata,
): Promise<string | null> {
  const text = await generateJson(prompt, 1024, meta);
  return text ? parseStoryBody(text) : null;
}
