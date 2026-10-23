/**
 * Divecore notices — the scheduler (v20 hunger reminder → v24 four notices).
 *
 * What to send and when is planned purely in `play-notices.ts` (hunger, egg
 * hatched / hero revealed, expedition back, dive charges full — one toggle
 * each in Divecore Settings, quiet hours respected). This file only talks to
 * expo-notifications: one pending notice per kind, each with its own id, so
 * the app's own push schedule (`src/lib/push.ts`, which cancels only its own
 * ids) never touches them; sign-out cancels these ids there too.
 *
 * Everything is best-effort: web, Expo Go without the native module, or a
 * denied permission simply means no notice — never an error on screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { petReminderLastFired, type PetReminderLog } from '@/play/pet';
import { planPlayNotices, type NoticeInput } from '@/play/play-notices';
import type { NotifKind } from '@/play/play-settings';

/** Same literals as the sign-out cancel in `src/lib/push.ts`. */
export const PET_HUNGER_PUSH_ID = 'ato.play.pet.hunger';
export const PET_EGG_PUSH_ID = 'ato.play.pet.egg';
export const PET_EXPEDITION_PUSH_ID = 'ato.play.pet.expedition';
export const DIVE_CHARGES_PUSH_ID = 'ato.play.dive.charges';
export const TIDE_PASS_PUSH_ID = 'ato.play.pet.tide';
export const FREE_EGGS_PUSH_ID = 'ato.play.pet.eggs';
export const HIDEOUT_BUILD_PUSH_ID = 'ato.play.pet.build';

const BUILD_PUSH_IDS = ['loft', 'garage', 'rooftop'].map((id) => `${HIDEOUT_BUILD_PUSH_ID}.${id}`);

const PUSH_ID: Record<NotifKind, string> = {
  hunger: PET_HUNGER_PUSH_ID,
  egg: PET_EGG_PUSH_ID,
  expedition: PET_EXPEDITION_PUSH_ID,
  charges: DIVE_CHARGES_PUSH_ID,
  tide: TIDE_PASS_PUSH_ID,
  eggs_ready: FREE_EGGS_PUSH_ID,
  build: HIDEOUT_BUILD_PUSH_ID,
};

/** Fired / pending logs for the notices with a minimum gap. */
const LOG_KEY: Partial<Record<NotifKind, string>> = {
  hunger: 'ato.play.pet.reminder.v1',
  charges: 'ato.play.dive.charges.v1',
};
/** The app's Android channel (created the same way `push.ts` does). */
const CHANNEL_ID = 'ato-default';

async function readLog(kind: NotifKind): Promise<PetReminderLog> {
  const key = LOG_KEY[kind];
  if (!key) return { lastFiredAt: null, scheduledAt: null };
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Partial<PetReminderLog>) : null;
    return {
      lastFiredAt: typeof parsed?.lastFiredAt === 'number' ? parsed.lastFiredAt : null,
      scheduledAt: typeof parsed?.scheduledAt === 'number' ? parsed.scheduledAt : null,
    };
  } catch {
    return { lastFiredAt: null, scheduledAt: null };
  }
}

async function writeLog(kind: NotifKind, next: PetReminderLog): Promise<void> {
  const key = LOG_KEY[kind];
  if (!key) return;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Best-effort; the worst case is one notice sooner than its gap.
  }
}

/**
 * The app's own one-time notification ask (`src/lib/push.ts` ASKED_KEY, the "Want a nudge now and
 * then?" sheet). Its "Not now" is stored only on the phone, so the OS still reads "undetermined";
 * an automatic Divecore ask must not override that answer (roadmap v2 step A1).
 */
export const APP_PUSH_ASKED_KEY = 'ato.push.asked';

/**
 * Ask for notification permission. `auto` = Divecore asks on its own (e.g. after the first Build):
 * skipped once the app's sheet has been answered. A tap on a notice switch in Divecore Settings is
 * the person asking, so it is never skipped.
 */
export async function askPetReminderPermission(opts: { auto?: boolean } = {}): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.status !== 'undetermined') return false;
    if (opts.auto) {
      let appAsked = false;
      try {
        appAsked = (await AsyncStorage.getItem(APP_PUSH_ASKED_KEY)) === '1';
      } catch {
        appAsked = false;
      }
      if (appAsked) return false;
    }
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
    return asked.granted;
  } catch {
    return false;
  }
}

/** Whether notifications are allowed for the app right now. */
export async function petNoticesAllowed(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Cancel every Divecore notice (reset, or nothing to send). */
export async function cancelPlayNotices(): Promise<void> {
  if (Platform.OS === 'web') return;
  for (const id of [...Object.values(PUSH_ID), ...BUILD_PUSH_IDS]) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Nothing scheduled / no native module.
    }
  }
}

/** Kept for callers from before v24 (sign-out uses push.ts's own literal). */
export async function cancelPetReminder(): Promise<void> {
  await cancelPlayNotices();
}

/** When the hunger / charges push last fired (or would have), for the away card. Never throws. */
export async function lastPushFiredAt(kind: 'hunger' | 'charges', now: number): Promise<number | null> {
  try {
    // With notifications off nothing was sent (the log still holds the planned time).
    if (!(await petNoticesAllowed())) return null;
    return petReminderLastFired(await readLog(kind), now);
  } catch {
    return null;
  }
}

/** Re-plan and re-schedule every Divecore notice for this state. */
export async function syncPlayNotices(input: Omit<NoticeInput, 'hungerLastFiredAt' | 'chargesLastFiredAt'>): Promise<void> {
  if (Platform.OS === 'web') return;
  const now = input.now;
  // A pending notice whose time has passed has fired: it becomes the "last
  // one" its gap counts from, kept apart from the next pending one.
  const hungerLog = await readLog('hunger');
  const chargesLog = await readLog('charges');
  const hungerLast = petReminderLastFired(hungerLog, now);
  const chargesLast = petReminderLastFired(chargesLog, now);
  await cancelPlayNotices();
  const plan = planPlayNotices({ ...input, hungerLastFiredAt: hungerLast, chargesLastFiredAt: chargesLast });
  const at = (kind: NotifKind) => plan.find((n) => n.kind === kind)?.at ?? null;
  await writeLog('hunger', { lastFiredAt: hungerLast, scheduledAt: at('hunger') });
  await writeLog('charges', { lastFiredAt: chargesLast, scheduledAt: at('charges') });
  if (plan.length === 0) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'ATO',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    for (const n of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: n.kind === 'build' && n.room ? `${HIDEOUT_BUILD_PUSH_ID}.${n.room}` : PUSH_ID[n.kind],
        content: { title: n.title, body: n.body, sound: false },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          channelId: CHANNEL_ID,
          date: new Date(n.at),
        },
      });
    }
  } catch {
    // No native module (Expo Go / tests) — no notice, no error.
  }
}
