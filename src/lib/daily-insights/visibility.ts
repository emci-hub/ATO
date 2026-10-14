/**
 * When the daily-insights cards may show. Pure.
 * A missed-check day stays alone (`canShowCategoryTeaser`), and Insights never
 * carries two "try today" actions on one day.
 */
import { canShowCategoryTeaser, type TodaySlot } from '@/lib/today-slot';

export function dailyInsightsVisible(input: { slotKind: TodaySlot['kind'] | string }): boolean {
  return canShowCategoryTeaser(input.slotKind);
}

/**
 * 🎯 Try this today. Hidden when another "try today" action is on screen
 * alongside it. (Insights, 2026-10-14: Today's focus drops its own "try today"
 * line instead, so on Insights this flag is false.)
 */
export function shouldShowTryToday(input: {
  insightTryTodayShown: boolean;
  slotKind: TodaySlot['kind'] | string;
}): boolean {
  if (input.insightTryTodayShown) return false;
  return dailyInsightsVisible(input);
}

/**
 * Today's focus shows its own "try today" line only where 🎯 Try this today is
 * NOT on screen. Insights always offers 🎯, so the focus card never repeats it.
 */
export function focusShowsTryToday(input: { tryTodayCardShown: boolean }): boolean {
  return !input.tryTodayCardShown;
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
