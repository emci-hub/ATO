/**
 * Legend figures — one reveal, assembled from the story library.
 *
 * The phone does not call a model and does not ask the server to write a card.
 * If the library cannot pair a side, the museum's own words are used.
 * Never throws to the screen.
 */
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
 * Story library only. No server write, no token charge. The museum words are
 * the last resort when there is no pair to render.
 */
export async function revealLegendStory(input: {
  legend: LegendFigure;
  angle: LegendAngle;
  momentId: string;
  pairs: readonly LegendPair[];
  differ: LegendDiffer | null;
  jokeStyle: CardJokeStyle | null;
  consentGranted: boolean;
  /** Kept so a reveal tap can still pass the day's free flag. The library does not charge. */
  free: boolean;
}): Promise<LegendStory> {
  const fallback = () => fallbackLegendStory(input);
  if (input.pairs.length === 0) return fallback();
  const { getShownIds, rememberShown } = await import('@/lib/story-library/shown');
  const { persistShownDevice, hydrateStoryLibraryDevice } = await import('@/lib/story-library/device-store');
  await hydrateStoryLibraryDevice();
  const story = renderLibraryLegend({ ...input, shown: getShownIds() });
  rememberShown(story.lineIds ?? []);
  void persistShownDevice();
  return story;
}
