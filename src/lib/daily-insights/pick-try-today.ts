/**
 * 🎯 Try this today — deterministic pick. Same user + app day + trait state
 * always gives the same line: the seed is `dailyTeaserRoll`, there is no
 * Math.random and no clock read in here (dateKey is passed in).
 */
import {
  dailyTeaserRoll,
  pickTeaserCategory,
  type CategoryId,
  type CategoryReading,
} from '@/lib/categories';
import { categoryCatalogName, leanPhraseFor } from '@/lib/story-v3/lean-phrases';
import { leanHighLow, type TraitAxis, type TraitLean } from '@/lib/traits';

import { DAILY_INSIGHTS_PROVISIONAL_CATEGORIES } from './constants';
import { tryTodayLineById } from './try-today-bank';
import type { DailyInsightsStore, InsightMode, TryTodayLine, TryTodayPick } from './types';

/** Categories picked on the last N days are skipped (unless nothing is left). */
export const TRY_TODAY_NO_REPEAT = 3;
export const PICK_HISTORY_CAP = 14;

/** 0 = Sunday … 6 = Saturday, from the YYYY-MM-DD itself (never the device clock). */
export function weekdayOfYmd(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/**
 * Mon/Wed/Fri/Sun = strength, Tue/Thu/Sat = stretch. Safety override: low
 * Resilience or low Steadiness always gets strength.
 */
export function tryTodayMode(dateKey: string, categoryId: CategoryId, lean: TraitLean): InsightMode {
  if (lean === 'low' && (categoryId === 'cat_resilience' || categoryId === 'cat_steadiness')) return 'strength';
  const day = weekdayOfYmd(dateKey);
  return day === 2 || day === 4 || day === 6 ? 'stretch' : 'strength';
}

/**
 * TODO(emci): provisional — map categories have no signed-off high/low.
 * Love: high (lean in close) when avoidance (map.y) < 0.5.
 * Independence: high (own way) when autonomy (x) > relatedness (y).
 * Structure: high (planner) when conscientiousness (y) > openness (x).
 */
export function provisionalMapLean(id: CategoryId, map: { x: number; y: number }): TraitLean | null {
  if (id === 'cat_love') return map.y < 0.5 ? 'high' : 'low';
  if (id === 'cat_independence') return map.x > map.y ? 'high' : 'low';
  if (id === 'cat_structure') return map.y > map.x ? 'high' : 'low';
  return null;
}

export function leanForReading(reading: CategoryReading): TraitLean | null {
  if (reading.map) return provisionalMapLean(reading.def.id, reading.map);
  if (reading.bar == null) return null;
  return leanHighLow(reading.bar);
}

export function whyLineFor(id: CategoryId, lean: TraitLean): string {
  return `This is your ${categoryCatalogName(id)}: ${leanPhraseFor(id, lean)}.`;
}

function categoryOfLineId(id: string): string {
  return id.split('.')[0] ?? '';
}

export function lineHidden(line: TryTodayLine, showProvisional: boolean): boolean {
  return !!line.provisional && !showProvisional;
}

export interface PickTryTodayInput {
  userId: string;
  dateKey: string;
  ready: readonly CategoryReading[];
  signalAxes: readonly TraitAxis[];
  history: readonly { dateKey: string; id: string }[];
  showProvisional: boolean;
}

export function pickTryToday(input: PickTryTodayInput): TryTodayPick | null {
  try {
    const { userId, dateKey, ready, signalAxes, history, showProvisional } = input;
    const roll = dailyTeaserRoll(`try:${userId}:${dateKey}`);
    const allowed = ready.filter(
      (row) =>
        row.ready &&
        (showProvisional || !DAILY_INSIGHTS_PROVISIONAL_CATEGORIES.includes(row.def.id)) &&
        leanForReading(row) != null,
    );
    if (allowed.length === 0) return null;
    const recent = new Set(
      history
        .filter((row) => row.dateKey !== dateKey)
        .slice(-TRY_TODAY_NO_REPEAT)
        .map((row) => categoryOfLineId(row.id)),
    );
    const fresh = allowed.filter((row) => !recent.has(row.def.id));
    const candidates = fresh.length > 0 ? fresh : allowed;
    const categoryId = pickTeaserCategory(candidates, signalAxes, roll);
    const reading = candidates.find((row) => row.def.id === categoryId);
    if (!categoryId || !reading) return null;
    const lean = leanForReading(reading);
    if (!lean) return null;
    const mode = tryTodayMode(dateKey, categoryId, lean);
    const line = tryTodayLineById(`${categoryId}.${lean}.${mode}`);
    if (!line || lineHidden(line, showProvisional)) return null;
    return { dateKey, line, whyLine: whyLineFor(categoryId, lean) };
  } catch {
    return null;
  }
}

/**
 * Today's pick with the stored day winning: a line already persisted for this
 * dateKey stays put (more data arriving mid-day doesn't move it), unless that
 * line no longer exists or is now hidden. Returns the next store to save;
 * history only grows when a pick is first persisted for a new dateKey.
 */
export function resolveTryToday(
  store: DailyInsightsStore,
  input: Omit<PickTryTodayInput, 'history' | 'userId'>,
): { pick: TryTodayPick | null; store: DailyInsightsStore; changed: boolean } {
  const storedId = store.picks[input.dateKey];
  const stored = storedId ? tryTodayLineById(storedId) : null;
  if (stored && !lineHidden(stored, input.showProvisional)) {
    return {
      pick: { dateKey: input.dateKey, line: stored, whyLine: whyLineFor(stored.categoryId, stored.lean) },
      store,
      changed: false,
    };
  }
  const pick = pickTryToday({ ...input, userId: store.userId, history: store.history });
  if (!pick) return { pick: null, store, changed: false };

  const picks: Record<string, string> = { ...store.picks, [input.dateKey]: pick.line.id };
  const keptKeys = Object.keys(picks).sort().slice(-PICK_HISTORY_CAP);
  const trimmed: Record<string, string> = {};
  for (const key of keptKeys) trimmed[key] = picks[key]!;
  const history = [
    ...store.history.filter((row) => row.dateKey !== input.dateKey),
    { dateKey: input.dateKey, id: pick.line.id },
  ]
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0))
    .slice(-PICK_HISTORY_CAP);
  return { pick, store: { ...store, picks: trimmed, history }, changed: true };
}
