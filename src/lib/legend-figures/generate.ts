/**
 * Legend figures — one reveal, no client model call.
 *
 * The phone sends only the bucket key to the `ai-library` Edge Function, which
 * claims the reveal on the server first (no claim = no call, hand-written
 * fallback), serves an unseen library card or writes a new one. The old
 * one-person path (`generateText` → `ai-generate`) was removed in roadmap A5.
 * While `STORY_LIBRARY_RUNTIME` is on, the phone assembles approved Story
 * Library copy and does not call the server. The flag ships off.
 * Never throws to the screen.
 */
import { LEGEND_LIBRARY, legendBucketKey } from '@/lib/ai-library/legend';
import { writeLibraryCard, type LibraryServed } from '@/lib/ai-library/client';
import { STORY_LIBRARY_RUNTIME } from '@/lib/story-library/flags';
import { renderLibraryLegend } from '@/lib/story-library/render';
import type { CardJokeStyle } from '@/lib/voice/card-joke';
import { rankStoryAxes } from '@/lib/story-thread';
import type { TraitTrack } from '@/lib/trait-stability';

import { chooseAngle, type AngleCounts } from './pick';

import {
  fallbackLegendStory,
  legendDiffer,
  legendPairs,
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
 * Any other answer (including 'missing') gives the hand-written card.
 * Story Library on = approved copy on the phone, no server call and no charge.
 * The flag ships off, so this build still uses the server library.
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
  if (STORY_LIBRARY_RUNTIME) {
    if (input.pairs.length === 0) return fallback();
    const { getShownIds, rememberShown } = await import('@/lib/story-library/shown');
    const { persistShownDevice } = await import('@/lib/story-library/device-store');
    const { hydrateStoryLibraryDevice } = await import('@/lib/story-library/device-store');
    await hydrateStoryLibraryDevice();
    const story = renderLibraryLegend({ ...input, shown: getShownIds() });
    rememberShown(story.lineIds ?? []);
    void persistShownDevice();
    return story;
  }
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
  return fallback();
}
