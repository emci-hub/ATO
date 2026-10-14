import type { CategoryId } from '@/lib/categories';
import type { TraitLean } from '@/lib/traits';

export type InsightMode = 'strength' | 'stretch';
export type InsightSetting = 'any' | 'work' | 'friends' | 'home';

export interface TryTodayLine {
  /** `${categoryId}.${lean}.${mode}`, e.g. 'cat_levity.high.stretch'. Forever. */
  id: string;
  categoryId: CategoryId;
  lean: TraitLean;
  mode: InsightMode;
  /** All v1 lines are 'any'; the field is reserved for setting variants. */
  setting: InsightSetting;
  /** ≤20 words. */
  text: string;
  /** Tag for the humour-mix check. */
  tone: 'light' | 'dark' | 'plain';
  /** True for cat_love / cat_independence / cat_structure (map leans not signed off). */
  provisional?: boolean;
}

export interface TryTodayPick {
  /** Local YYYY-MM-DD (the app's day). */
  dateKey: string;
  line: TryTodayLine;
  whyLine: string;
}

export interface StreakState {
  version: 1;
  /** Local YYYY-MM-DD, deduped, sorted, max 60 kept. */
  doneDates: string[];
  current: number;
  best: number;
  lastDone: string | null;
}

export interface DailyInsightsStore {
  version: 1;
  /** Payload owner; a payload for another account is ignored. */
  userId: string;
  streak: StreakState;
  /** Max 14, newest last. */
  history: { dateKey: string; id: string }[];
  /** dateKey -> line id, max 14. */
  picks: Record<string, string>;
}

export interface SuperpowerLine {
  categoryId: CategoryId;
  kind: 'superpower' | 'kryptonite';
  title: string;
  text: string;
  tip: string;
  provisional?: boolean;
}

export type ConflictStyleId = 'straight_shooter' | 'team_fixer' | 'deal_maker' | 'quiet_exit' | 'peacekeeper';

export interface ConflictLine {
  id: ConflictStyleId;
  title: string;
  text: string;
  strength: string;
  watchOut: string;
  tryLine: string;
}
