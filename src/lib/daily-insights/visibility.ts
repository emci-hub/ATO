/**
 * When the daily-insights cards may show. Pure.
 * Crisis and missed-check days stay alone (`canShowCategoryTeaser`), and Home
 * never carries two "try today" actions on one day.
 */
import { canShowCategoryTeaser, type TodaySlot } from '@/lib/today-slot';

export function dailyInsightsVisible(input: {
  slotKind: TodaySlot['kind'] | string;
  crisisToday: boolean;
}): boolean {
  return !input.crisisToday && canShowCategoryTeaser(input.slotKind);
}

/**
 * 🎯 Try this today. Hidden when the daily insight's own "try today" is on
 * screen alongside it. (emci 2026-10-13: the card lives on Explore, so that
 * flag is false there; Home keeps the insight's line only.)
 */
export function shouldShowTryToday(input: {
  insightTryTodayShown: boolean;
  slotKind: TodaySlot['kind'] | string;
  crisisToday: boolean;
}): boolean {
  if (input.insightTryTodayShown) return false;
  return dailyInsightsVisible(input);
}

/**
 * The provisional-lean switch. Only a dev override can turn it on, and only
 * while dev tooling is live; a production build always reads false.
 */
export function resolveShowProvisional(input: {
  base: boolean;
  devOverride: boolean | null;
  devToolsActive: boolean;
}): boolean {
  if (!input.devToolsActive) return false;
  return input.devOverride ?? input.base;
}
