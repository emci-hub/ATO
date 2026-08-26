import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_APPEARANCE,
  isAppearanceId,
  type AppearanceId,
} from '@/constants/appearance';

export const APPEARANCE_STORAGE_KEY = 'ato.appearance.mode';

export async function loadAppearanceId(): Promise<AppearanceId> {
  try {
    const raw = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY);
    return isAppearanceId(raw) ? raw : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export async function saveAppearanceId(id: AppearanceId): Promise<void> {
  await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, id);
}
