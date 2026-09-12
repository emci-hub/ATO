import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { checkLoggedOnYmd, fetchChecks, type Check } from '@/lib/checks';
import { hoursSinceLocalMidnight, localYmd, weekdayInZone } from '@/lib/local-date';
import type { Me } from '@/lib/me';
import {
  eveningPush,
  insightPush,
  morningPush,
  recapFromReads,
  sundayPush,
  type PushPayload,
} from '@/lib/push-copy';
import { getPushPrefs } from '@/lib/push-prefs';
import {
  EVENING_WEEKDAYS,
  INSIGHT_WEEKDAYS,
  shouldAskNotificationPermission,
  pushWindowForEnergy,
} from '@/lib/push-policy';
import { pickInsightPayload } from '@/lib/push-insight';
import { loadTodayCard } from '@/lib/today-card';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import type { TraitTrack } from '@/lib/trait-stability';
import { checksInRecapWeek } from '@/lib/week-window';

const ASKED_KEY = 'ato.push.asked';
const CHANNEL_ID = 'ato-default';

export const PUSH_IDS = {
  morning: 'ato.morning',
  evening: 'ato.evening',
  insight: 'ato.insight',
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

/**
 * Evening/insight are recomputed fresh on every sync (checks change, card
 * change, app-foreground — see push-runtime.tsx) rather than a recurring
 * weekly trigger, so "skip today if already logged" can be decided at sync
 * time instead of baked into the trigger. Unlike a single "tonight or
 * nothing" check, this finds the NEXT matching weekday up to a week out —
 * scheduling it as a one-shot DATE trigger — so the push exists even if the
 * app is never foregrounded again before it fires (a foreground-gated
 * "tonight only" schedule would silently go dead for anyone who doesn't
 * open the app that exact day).
 */
function nextWeekdayHour(opts: {
  now: Date;
  timeZone: string;
  weekdays: readonly number[]; // Expo numbering: 1 = Sunday ... 7 = Saturday
  hour: number;
  skipToday: boolean;
}): Date | null {
  const todayWeekday0 = weekdayInZone(opts.now, opts.timeZone); // 0 = Sunday ... 6 = Saturday
  const hoursNow = hoursSinceLocalMidnight(opts.now, opts.timeZone);
  for (let offset = 0; offset <= 6; offset += 1) {
    const candidateExpoWeekday = ((todayWeekday0 + offset) % 7) + 1;
    if (!opts.weekdays.includes(candidateExpoWeekday)) continue;
    if (offset === 0 && (hoursNow >= opts.hour || opts.skipToday)) continue;
    const hoursUntilTarget = offset * 24 + (opts.hour - hoursNow);
    return new Date(opts.now.getTime() + hoursUntilTarget * 3_600_000);
  }
  return null;
}

async function scheduleAtOrCancel(id: string, payload: PushPayload | null, target: Date | null) {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  if (!payload || !target) return;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: contentFor(payload),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      channelId: CHANNEL_ID,
      date: target,
    },
  });
}

export function sundayPayloadFor(checks: Check[], now: Date, timeZone: string): PushPayload {
  const week = checksInRecapWeek(checks, now, timeZone);
  return sundayPush({
    showedUp: week.length,
    recap: recapFromReads(week.map((check) => check.read_text)),
  });
}

function checkLoggedToday(checks: Check[], now: Date, timeZone: string): boolean {
  const todayYmd = localYmd(now, timeZone);
  return checks.some((check) => checkLoggedOnYmd(check, timeZone) === todayYmd);
}

/** Rebuild morning / evening / insight / Sunday local schedules from current state. */
export async function syncPushSchedule(input: {
  checks: Check[];
  timeZone: string;
  energyPattern?: string | null;
  eveningWindDown?: string | null;
  me: Me;
  tracks: readonly TraitTrack[];
}): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.morning).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.evening).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.insight).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.sunday).catch(() => {});

    if (!(await notificationsAreGranted())) return;

    const prefs = await getPushPrefs();
    await ensureAndroidChannel();
    const card = await loadTodayCard();
    const now = new Date();
    const window = pushWindowForEnergy(input.energyPattern);

    if (prefs.morning && card?.read.trim()) {
      await scheduleRepeating(PUSH_IDS.morning, morningPush(card.read), {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: CHANNEL_ID,
        hour: window.morningHour,
        minute: 0,
      });
    }

    const loggedToday = checkLoggedToday(input.checks, now, input.timeZone);

    // Evening keeps the original "only if there's a card" gate (re-evaluated
    // on every sync, same as before) — this pass only changed frequency and
    // the skip-if-logged condition, not whether a card is required at all.
    const eveningTarget = prefs.evening && card?.read.trim()
      ? nextWeekdayHour({
          now,
          timeZone: input.timeZone,
          weekdays: EVENING_WEEKDAYS,
          hour: window.eveningHour,
          skipToday: loggedToday,
        })
      : null;
    await scheduleAtOrCancel(
      PUSH_IDS.evening,
      eveningTarget ? eveningPush(input.eveningWindDown) : null,
      eveningTarget,
    );

    const insightTarget = prefs.insight
      ? nextWeekdayHour({
          now,
          timeZone: input.timeZone,
          weekdays: INSIGHT_WEEKDAYS,
          hour: window.eveningHour,
          skipToday: false,
        })
      : null;
    const insightPayload = insightTarget
      ? await pickInsightPayload(input.me, input.tracks).catch(() => null)
      : null;
    await scheduleAtOrCancel(PUSH_IDS.insight, insightPayload, insightTarget);

    if (prefs.sunday) {
      await scheduleRepeating(PUSH_IDS.sunday, sundayPayloadFor(input.checks, now, input.timeZone), {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        channelId: CHANNEL_ID,
        weekday: 1,
        hour: 10,
        minute: 0,
      });
    }
  } catch (err) {
    console.log('[push] schedule sync skipped:', err);
  }
}

/**
 * Refetches checks/tracks and resyncs — used right after a pref toggle
 * (`notification-prefs-fold.tsx`) so turning a kind off actually cancels it
 * immediately, instead of waiting for the next unrelated sync trigger
 * (check logged, card change, app-foreground).
 */
export async function resyncPushForUser(me: Me): Promise<void> {
  if (Platform.OS === 'web') return;
  const [checks, tracks] = await Promise.all([fetchChecks(me.id), fetchTraitTracks(me.id)]);
  await syncPushSchedule({
    checks,
    timeZone: me.timezone || 'UTC',
    energyPattern: me.energy_pattern,
    eveningWindDown: me.evening_wind_down,
    me,
    tracks,
  });
}

/** Fire one of the four pushes in a few seconds so a tester can tap the deep link. */
export async function fireTestPush(
  kind: PushPayload['kind'],
  checks: Check[],
  timeZone: string,
  insight?: { me: Me; tracks: readonly TraitTrack[] },
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
        : kind === 'insight'
          ? insight
            ? (await pickInsightPayload(insight.me, insight.tracks)) ??
              insightPush('Categories', 'No current statement yet — generate one on /categories first.')
            : insightPush('Categories', 'No current statement yet — generate one on /categories first.')
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
