/**
 * Dev-only growth-tier preview, stored on the device.
 *
 * MOVED here from `src/app/(tabs)/you.tsx` when You was parked (ISOLATION_PLAN
 * §7 Card F). These three helpers were exported from that screen and imported
 * by `dev-lab.tsx`, which is why parking the screen broke the dev lab — a
 * parked screen must not be anyone's module. The behaviour is unchanged,
 * including the `PRE_LAUNCH_DEV` guard on every call: with it false, reads
 * return null and writes are no-ops, so a public build cannot fake a tier.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';

const GROWTH_PREVIEW_KEY = 'ato.dev.growth-preview.v1';

export type GrowthPreview = { checkCount: number; factCount: number };

export async function readGrowthPreview(): Promise<GrowthPreview | null> {
  if (!PRE_LAUNCH_DEV) return null;
  const raw = await AsyncStorage.getItem(GROWTH_PREVIEW_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GrowthPreview;
    if (typeof parsed.checkCount !== 'number' || typeof parsed.factCount !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeGrowthPreview(next: GrowthPreview): Promise<void> {
  if (!PRE_LAUNCH_DEV) return;
  await AsyncStorage.setItem(GROWTH_PREVIEW_KEY, JSON.stringify(next));
}

export async function clearGrowthPreview(): Promise<void> {
  if (!PRE_LAUNCH_DEV) return;
  await AsyncStorage.removeItem(GROWTH_PREVIEW_KEY);
}
