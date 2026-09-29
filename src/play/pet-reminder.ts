/**
 * Pet hunger reminder — gentle and opt-in (v20, 2026-09-29).
 *
 * Off by default. When the player turns it on (Pet screen), ONE local
 * notification is scheduled for when the pet's hunger meter will run empty,
 * never sooner than 20h after the last one — so at most one a day, and it is
 * moved (or cancelled) every time the pet eats or the switch goes off. It has
 * its own identifier, so the app's own push schedule (`src/lib/push.ts`, which
 * cancels only its own ids) never touches it; sign-out cancels it by id there.
 *
 * Everything is best-effort: web, Expo Go without the native module, or a
 * denied permission simply means no reminder — never an error on screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  petReminderLastFired,
  petReminderTarget,
  type PetReminderLog,
  type PetState,
} from '@/play/pet';

/** Same literal as the sign-out cancel in `src/lib/push.ts`. */
export const PET_HUNGER_PUSH_ID = 'ato.play.pet.hunger';
const STATE_KEY = 'ato.play.pet.reminder.v1';
/** The app's Android channel (created the same way `push.ts` does). */
const CHANNEL_ID = 'ato-default';

async function readState(): Promise<PetReminderLog> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<PetReminderLog>) : null;
    return {
      lastFiredAt: typeof parsed?.lastFiredAt === 'number' ? parsed.lastFiredAt : null,
      scheduledAt: typeof parsed?.scheduledAt === 'number' ? parsed.scheduledAt : null,
    };
  } catch {
    return { lastFiredAt: null, scheduledAt: null };
  }
}

async function writeState(next: PetReminderLog): Promise<void> {
  try {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort; the worst case is one reminder sooner than a day apart.
  }
}

/** Ask for notification permission (only when the player turns the reminder
 * on). True when notifications are allowed. */
export async function askPetReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.status !== 'undetermined') return false;
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
    return asked.granted;
  } catch {
    return false;
  }
}

/** Cancel the reminder (switch off, or nothing to remind about). */
export async function cancelPetReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(PET_HUNGER_PUSH_ID);
  } catch {
    // Nothing scheduled / no native module.
  }
}

/** Re-schedule (or cancel) the one reminder for this pet state. */
export async function syncPetReminder(on: boolean, pet: PetState, now: number): Promise<void> {
  if (Platform.OS === 'web') return;
  // A pending reminder whose time has passed has fired: it becomes the
  // "last one" the 20h gap counts from, kept apart from the next pending one.
  const lastFiredAt = petReminderLastFired(await readState(), now);
  await cancelPetReminder();
  const target = on ? petReminderTarget(pet, now, lastFiredAt) : null;
  if (target == null) {
    await writeState({ lastFiredAt, scheduledAt: null });
    return;
  }
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      await writeState({ lastFiredAt, scheduledAt: null });
      return;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'ATO',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: PET_HUNGER_PUSH_ID,
      content: {
        title: 'Your pet is getting hungry',
        body: 'A cleared wave or a round of Catch the food will fill it up.',
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        channelId: CHANNEL_ID,
        date: new Date(target),
      },
    });
    await writeState({ lastFiredAt, scheduledAt: target });
  } catch {
    // No native module (Expo Go / tests) — no reminder, no error.
  }
}
