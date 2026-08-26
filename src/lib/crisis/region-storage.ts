import AsyncStorage from '@react-native-async-storage/async-storage';

import { isCrisisRegion, type CrisisRegion } from '@/lib/crisis/region';

export const CRISIS_REGION_AUTO_KEY = 'ato.crisis.region.auto';
export const CRISIS_REGION_OVERRIDE_KEY = 'ato.crisis.region.override';

export async function loadCrisisRegionAuto(): Promise<CrisisRegion | null> {
  const raw = await AsyncStorage.getItem(CRISIS_REGION_AUTO_KEY);
  return isCrisisRegion(raw) ? raw : null;
}

export async function saveCrisisRegionAuto(region: CrisisRegion): Promise<void> {
  await AsyncStorage.setItem(CRISIS_REGION_AUTO_KEY, region);
}

export async function loadCrisisRegionOverride(): Promise<CrisisRegion | null> {
  const raw = await AsyncStorage.getItem(CRISIS_REGION_OVERRIDE_KEY);
  return isCrisisRegion(raw) ? raw : null;
}

export async function saveCrisisRegionOverride(
  region: CrisisRegion | null,
): Promise<void> {
  if (region == null) {
    await AsyncStorage.removeItem(CRISIS_REGION_OVERRIDE_KEY);
    return;
  }
  await AsyncStorage.setItem(CRISIS_REGION_OVERRIDE_KEY, region);
}
