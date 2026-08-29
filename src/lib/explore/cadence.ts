import { daysBetweenYmd, localYmd } from '@/lib/local-date';

import type { ExplorePackRow, ExploreTrigger } from './types';

export const EXPLORE_WEEK_DAYS = 7;

export function exploreToday(timeZone: string, now = new Date()): string {
  return localYmd(now, timeZone || 'UTC');
}

export function decideExploreTrigger(input: {
  pack: ExplorePackRow | null;
  today: string;
  fingerprint: string;
}): ExploreTrigger | null {
  const { pack, today, fingerprint } = input;
  if (!pack) return 'first';
  if (pack.generatedOn === today) return null;
  if (pack.fingerprint !== fingerprint) return 'signal';
  if (daysBetweenYmd(pack.generatedOn, today) >= EXPLORE_WEEK_DAYS) return 'weekly';
  return null;
}
