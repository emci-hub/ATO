import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import type { Check } from '@/lib/checks';
import {
  eveningPush,
  morningPush,
  recapFromReads,
  sundayPush,
  type PushPayload,
} from '@/lib/push-copy';
import { shouldAskNotificationPermission } from '@/lib/push-policy';
import { loadTodayCard } from '@/lib/today-card';
import { checksInRecapWeek } from '@/lib/week-window';

const ASKED_KEY = 'ato.push.asked';
const CHANNEL_ID = 'ato-default';

export const PUSH_IDS = {
  morning: 'ato.morning',
  evening: 'ato.evening',
  sunday: 'ato.sunday',
} as const;

if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Expo Go / web / missing native binary.
  }
}

export async function getAskedForNotifications(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === '1';
  } catch {
    return false;
  }
}

async function markAsked(): Promise<void> {
  await AsyncStorage.setItem(ASKED_KEY, '1');
}

export async function notificationsAreGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const settings = await Notifications.getPermissionsAsync();
    const iosStatus = settings.ios?.status;
    // iOS: trust ios.status, not the root `granted` flag (Expo docs).
    return (
      settings.granted === true ||
      iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
    );
  } catch {
    return false;
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'ATO',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Ask the system once, only after the first Check exists. Never nags. A
 * decline leaves every other screen exactly as it was.
 */
export async function maybeAskNotificationPermission(checkCount: number): Promise<void> {
  if (Platform.OS === 'web') return;
  const alreadyAsked = await getAskedForNotifications();
  if (!shouldAskNotificationPermission({ checkCount, alreadyAsked })) return;

  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'undetermined') {
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    }
    await markAsked();
  } catch (err) {
    console.log('[push] permission request skipped:', err);
  }
}

function contentFor(payload: PushPayload) {
  return {
    title: payload.title,
    body: payload.body,
    data: { url: payload.url, kind: payload.kind },
    sound: false as const,
  };
}

async function scheduleRepeating(id: string, payload: PushPayload, trigger: Notifications.NotificationTriggerInput) {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: contentFor(payload),
    trigger,
  });
}

export function sundayPayloadFor(checks: Check[], now: Date, timeZone: string): PushPayload {
  const week = checksInRecapWeek(checks, now, timeZone);
  return sundayPush({
    showedUp: week.length,
    recap: recapFromReads(week.map((check) => check.read_text)),
  });
}

/** Rebuild morning / evening / Sunday local schedules from current card + week. */
export async function syncPushSchedule(input: {
  checks: Check[];
  timeZone: string;
}): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.morning).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.evening).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.sunday).catch(() => {});

    if (!(await notificationsAreGranted())) return;

    await ensureAndroidChannel();
    const card = await loadTodayCard();
    const now = new Date();

    if (card?.read.trim()) {
      await scheduleRepeating(PUSH_IDS.morning, morningPush(card.read), {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: CHANNEL_ID,
        hour: 7,
        minute: 0,
      });
      await scheduleRepeating(PUSH_IDS.evening, eveningPush(), {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: CHANNEL_ID,
        hour: 20,
        minute: 0,
      });
    }

    await scheduleRepeating(PUSH_IDS.sunday, sundayPayloadFor(input.checks, now, input.timeZone), {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      channelId: CHANNEL_ID,
      weekday: 1,
      hour: 10,
      minute: 0,
    });
  } catch (err) {
    console.log('[push] schedule sync skipped:', err);
  }
}

/** Fire one of the three pushes in a few seconds so a tester can tap the deep link. */
export async function fireTestPush(
  kind: PushPayload['kind'],
  checks: Check[],
  timeZone: string,
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await notificationsAreGranted())) {
    throw new Error('Notifications are off.');
  }
  await ensureAndroidChannel();
  const card = await loadTodayCard();
  const payload =
    kind === 'morning'
      ? morningPush(card?.read ?? 'No card yet — open Dawn when you are ready.')
      : kind === 'evening'
        ? eveningPush()
        : sundayPayloadFor(checks, new Date(), timeZone);

  const id = `ato.test.${kind}`;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: contentFor(payload),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      channelId: CHANNEL_ID,
      seconds: 3,
      repeats: false,
    },
  });
}
