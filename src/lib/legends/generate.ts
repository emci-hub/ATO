import { generateText } from '@/lib/ai/generate';
import { LEGEND_GENERATION_META } from '@/lib/ai/call-sites';

import { buildLegendCandidatePrompt, energyLineName, type LegendPromptArchetype } from './prompt';
import { parseLegendCandidate, type LegendCandidateDraft } from './parse';

/**
 * One figure+variant proposal for `archetype`. Caller (generate-store.ts's
 * insertLegendCandidate, via the dev-lab review screen) must already hold a
 * successful claimLegendGeneration() before calling this, same convention as
 * every other quota-gated generation in this codebase — this function itself
 * does not check or claim quota.
 */
export async function generateLegendCandidate(
  archetype: LegendPromptArchetype,
): Promise<LegendCandidateDraft | null> {
  const prompt = buildLegendCandidatePrompt(archetype);
  const text = await generateText({
    prompt,
    temperature: 0.9,
    maxOutputTokens: 1024,
    responseFormat: 'json',
  }, LEGEND_GENERATION_META);
  if (!text) return null;
  return parseLegendCandidate(text, energyLineName(archetype.formalName));
}
