import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  dailyTeaserRoll,
  pickTeaserCategory,
  readyCategories,
  signalAxesFrom,
  type CategoryId,
} from '@/lib/categories';
import type { TraitAxis } from '@/lib/traits';
import type { TraitTrack } from '@/lib/trait-stability';

const KEY = 'ato.category-teaser.v1';

export function teaserStorageKey(userId: string, ymd: string): string {
  return `${KEY}:${userId}:${ymd}`;
}

export async function readStoredTeaser(userId: string, ymd: string): Promise<CategoryId | null> {
  try {
    const raw = await AsyncStorage.getItem(teaserStorageKey(userId, ymd));
    return raw && raw.startsWith('cat_') ? (raw as CategoryId) : null;
  } catch {
    return null;
  }
}

export async function writeStoredTeaser(userId: string, ymd: string, id: CategoryId): Promise<void> {
  try {
    await AsyncStorage.setItem(teaserStorageKey(userId, ymd), id);
  } catch {
    // Non-fatal — next open re-picks for the day.
  }
}

export function pickDailyTeaser(input: {
  userId: string;
  ymd: string;
  tracks: readonly TraitTrack[];
  touched?: Record<string, string>;
  extraAxes?: readonly string[];
  stored: CategoryId | null;
}): CategoryId | null {
  const ready = readyCategories(input.tracks);
  if (ready.length === 0) return null;
  if (input.stored && ready.some((row) => row.def.id === input.stored)) return input.stored;
  const roll = dailyTeaserRoll(`${input.userId}:${input.ymd}:teaser`);
  const signal = signalAxesFrom(input.touched, input.extraAxes ?? []);
  return pickTeaserCategory(ready, signal, roll);
}

export function exploreTraitsFromPack(pack: { entries?: Array<{ traits?: string[] }> } | null): TraitAxis[] {
  if (!pack?.entries) return [];
  const out: TraitAxis[] = [];
  const seen = new Set<string>();
  for (const entry of pack.entries) {
    for (const axis of entry.traits ?? []) {
      if (seen.has(axis)) continue;
      seen.add(axis);
      out.push(axis as TraitAxis);
    }
  }
  return out;
}
