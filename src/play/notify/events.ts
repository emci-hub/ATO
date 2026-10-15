/**
 * News since the last render → notices (was `bannerEvents` in the retired play-banner-queue).
 * Pure, so `check:notify` holds it.
 *
 * The Hideout shows hatching and the reveal itself, so those two only notify when you're
 * elsewhere in Play; a newly ready milestone notifies everywhere and taps through to the
 * Journal. No previous snapshot (first load) = no notices.
 */
import type { NoticeInput } from '@/play/notify/queue';
import { streakRewardLabel } from '@/play/play-settings';

/** What the Play screen compares between two renders to spot news. */
export type NoticeWatch = {
  stage: string;
  /** Egg/Baby with the grade still hidden. */
  oddsOpen: boolean;
  /** Milestones done but not yet claimed. */
  milestonesReady: number;
  /** v28 — local day the Tide calendar last advanced, and the day it awarded. */
  streakYmd?: string | null;
  streakDay?: number | null;
};

export function noticeEvents(prev: NoticeWatch | null, next: NoticeWatch, onPetScreen: boolean): NoticeInput[] {
  if (!prev) return [];
  const out: NoticeInput[] = [];
  if (!onPetScreen && prev.stage === 'egg' && next.stage !== 'egg') {
    out.push({ kind: 'celebrate', title: 'Egg hatched', body: 'Say hi to your Baby. Tap to visit.', target: 'pet' });
  }
  if (!onPetScreen && prev.oddsOpen && !next.oddsOpen && next.stage !== 'egg' && next.stage !== 'baby') {
    out.push({ kind: 'celebrate', title: 'Grade revealed', body: 'Your pet grew up. Tap to see it.', target: 'pet' });
  }
  if (next.milestonesReady > prev.milestonesReady) {
    out.push({ kind: 'notify', title: 'Milestone ready', body: 'Claim it in the Journal.', target: 'journal', dedupeKey: 'milestone' });
  }
  if (next.streakYmd && next.streakYmd !== prev.streakYmd && next.streakDay != null) {
    const reward = streakRewardLabel(next.streakDay);
    out.push({
      kind: 'notify',
      title: 'Tide calendar',
      body: reward ? `Day ${next.streakDay}: ${reward}.` : `Day ${next.streakDay}. A missed day pauses here.`,
      target: 'journal',
    });
  }
  return out;
}
