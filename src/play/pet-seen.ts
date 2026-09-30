/**
 * The pet stage this device last showed in the room — so the pet can say
 * "I grew!" once after an evolution that happened while the app was closed.
 * A device-only key (not the save, so no save-version bump); it is an `ato.*`
 * key, so sign-out / delete wipes it with the rest of the local account data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PET_STAGES, type PetStage } from './pet';

export const PET_SEEN_STAGE_KEY = 'ato.play.petSeenStage.v1';

export async function loadSeenStage(): Promise<PetStage | null> {
  try {
    const raw = await AsyncStorage.getItem(PET_SEEN_STAGE_KEY);
    return raw && (PET_STAGES as readonly string[]).includes(raw) ? (raw as PetStage) : null;
  } catch {
    return null;
  }
}

export async function saveSeenStage(stage: PetStage): Promise<void> {
  try {
    await AsyncStorage.setItem(PET_SEEN_STAGE_KEY, stage);
  } catch {
    // Best effort — a missed "I grew!" line is harmless.
  }
}

/** Forget the last-seen stage (Reset Divecore). */
export async function saveSeenStageReset(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PET_SEEN_STAGE_KEY);
  } catch {
    // Best effort.
  }
}
