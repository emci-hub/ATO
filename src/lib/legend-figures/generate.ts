/**
 * Legend figures — the one AI call (manual tap only).
 *
 * claim on the server first (no claim = no call, hand-written fallback) →
 * `generateText` → `ai-generate` (keys stay server-side; the shared AI quota
 * is claimed there too) → `parseLegendStory`. One retry on a rejected answer,
 * then the fallback. Never throws to the screen.
 */
import { LEGEND_FIGURE_META } from '@/lib/ai/call-sites';
import { generateText } from '@/lib/ai/generate';
import { shouldUseLocalAi } from '@/lib/ai/override';
import { logAiReject } from '@/lib/ai/reject-log';
import { refundAiTokens } from '@/lib/ato-tokens-server';
import type { CardJokeStyle } from '@/lib/voice/card-joke';

import { claimLegendStory } from './museum-store';
import {
  buildLegendPrompt,
  fallbackLegendStory,
  parseLegendStoryResult,
  type LegendDiffer,
  type LegendPair,
  type LegendStory,
} from './story';
import type { LegendAngle, LegendFigure } from './types';

export async function writeLegendStory(input: {
  legend: LegendFigure;
  angle: LegendAngle;
  momentId: string;
  pairs: readonly LegendPair[];
  /** The reader's side the legend doesn't share ("Where you differ"). */
  differ: LegendDiffer | null;
  /** The joke style for this card (seeded by the screen), or none. */
  jokeStyle: CardJokeStyle | null;
  /** The person said yes to AI (the server refuses without it anyway). */
  consentGranted: boolean;
}): Promise<LegendStory> {
  const fallback = () => fallbackLegendStory(input);
  if (!input.consentGranted || input.pairs.length === 0) return fallback();
  if (await shouldUseLocalAi()) return fallback();
  if (!(await claimLegendStory())) return fallback();
  const prompt = buildLegendPrompt({
    legend: input.legend,
    angle: input.angle,
    focusMomentId: input.momentId,
    pairs: input.pairs,
    differ: input.differ,
    jokeStyle: input.jokeStyle,
  });
  for (let pass = 1; pass <= 2; pass += 1) {
    try {
      const request = { prompt, temperature: 0.9, maxOutputTokens: 600, responseFormat: 'json' as const };
      const text = await generateText({ ...request }, LEGEND_FIGURE_META);
      if (!text) break;
      const { story, reason } = parseLegendStoryResult(text, input);
      if (story) return story;
      logAiReject('legend_figure', reason ?? 'unknown', pass);
    } catch (err) {
      console.log('[legend-figures] generate error:', err);
      break;
    }
  }
  // Charged at the claim but no AI card came back: give the tokens back (wave92).
  await refundAiTokens('legend');
  return fallback();
}
