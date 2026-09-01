import { generateText } from '@/lib/ai/generate';

import { parseExploreBody } from './prompt';
import { parseStoryBody } from '@/lib/sage-story';

async function generateJson(prompt: string, maxOutputTokens: number): Promise<string | null> {
  return generateText({
    prompt,
    temperature: 0.9,
    maxOutputTokens,
    responseFormat: 'json',
  });
}

export async function generateExploreBody(prompt: string): Promise<string | null> {
  const text = await generateJson(prompt, 512);
  return text ? parseExploreBody(text) : null;
}

/** Story lane — longer output. Returns null when the model is unreachable. No fallback parse-to-prose. */
export async function generateStoryBody(prompt: string): Promise<string | null> {
  const text = await generateJson(prompt, 1024);
  return text ? parseStoryBody(text) : null;
}
