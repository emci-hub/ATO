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
import { LEGEND_LIBRARY, legendBucketKey } from '@/lib/ai-library/legend';
import { writeLibraryCard, type LibraryServed } from '@/lib/ai-library/client';
import type { CardJokeStyle } from '@/lib/voice/card-joke';
import { rankStoryAxes } from '@/lib/story-thread';
import type { TraitTrack } from '@/lib/trait-stability';

import { chooseAngle, type AngleCounts } from './pick';

import { claimLegendStory } from './museum-store';
import {
  buildLegendPrompt,
  fallbackLegendStory,
  legendDiffer,
  legendPairs,
  parseLegendStoryResult,
  type LegendDiffer,
  type LegendPair,
  type LegendStory,
} from './story';
import type { LegendAngle, LegendFigure } from './types';

/**
 * What one reveal is about: the angle and moment (least-told first), the
 * reader's matched sides and the side the legend doesn't share. Pure, so the
 * reveal and the look-ahead (wave94: the server writes the day's frames ahead
 * of time) always build the same library bucket.
 */
export function planLegendReveal(input: {
  legend: LegendFigure;
  frameAngleId: string | null;
  userId: string;
  counts: AngleCounts | null;
  told: ReadonlySet<string> | undefined;
  tracks: readonly TraitTrack[];
}): { angle: LegendAngle; momentId: string; pairs: LegendPair[]; differ: LegendDiffer | null } {
  const chosen = chooseAngle(input.legend, input.userId, input.counts, { onlyAngle: input.frameAngleId, skipAngles: input.told });
  const angle = input.legend.angles.find((a) => a.id === chosen.angleId) ?? input.legend.angles[0]!;
  const leans = rankStoryAxes(input.tracks).map((row) => ({ axis: row.axis, lean: row.lean, strength: row.strength }));
  const pairs = legendPairs(input.legend, leans);
  const differ = legendDiffer(input.legend, leans, new Set(pairs.map((p) => p.axis)));
  return { angle, momentId: chosen.momentId, pairs, differ };
}

/**
 * Library first (wave93, emci 2026-10-09). The phone sends only the bucket key:
 *   free reveal  the server claims the free reveal (its own small cap, never
 *                charged), then gives an unseen library card or writes a new one;
 *                else the hand-written card
 *   paid reveal  the server claims 5 tokens, then the same; a failed write is
 *                refunded on the server
 * 'missing' (wave93 not live yet) = the old one-person path below.
 */
export async function revealLegendStory(input: {
  legend: LegendFigure;
  angle: LegendAngle;
  momentId: string;
  pairs: readonly LegendPair[];
  differ: LegendDiffer | null;
  jokeStyle: CardJokeStyle | null;
  consentGranted: boolean;
  /** The day's free reveal (or the bonus): never charged. */
  free: boolean;
}): Promise<LegendStory> {
  const fallback = () => fallbackLegendStory(input);
  if (!input.consentGranted || input.pairs.length === 0) return fallback();
  const bucket = legendBucketKey(input);
  const take = (served: LibraryServed<LegendStory>): LegendStory => ({
    ...served.card,
    // "Where you match" is the reader's own pairing, always (same sides as the bucket).
    whereYouMatch: input.pairs.map((p) => ({ axis: p.axis, lean: p.lean, them: p.tag.them })),
    libraryId: served.id,
    others: served.others,
  });
  // One server call: the reveal is claimed (free cap or 5 tokens), then an
  // unseen library card is given, or a new one is written.
  const res = await writeLibraryCard('legend', bucket, input.free ? 'free_legend' : 'paid', LEGEND_LIBRARY.readCard);
  if (res.ok && res.served) return take(res.served);
  if (!res.ok && res.reason === 'missing') return writeLegendStory(input);
  return fallback();
}

/** Before wave93 is live: the old one-person path (always a paid claim). */
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
