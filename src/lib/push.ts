import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { checkLoggedOnYmd, fetchChecks, type Check } from '@/lib/checks';
import { loadDailyLineState } from '@/lib/daily-line/state';
import { pickForYmd } from '@/lib/daily-pick/bank';
import { addDaysYmd, hoursSinceLocalMidnight, localYmd, weekdayInZone } from '@/lib/local-date';
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
import { loadCachedInsight, lockScreenInsight } from '@/lib/insight/today-insight';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import type { TraitTrack } from '@/lib/trait-stability';
import { checksInRecapWeek } from '@/lib/week-window';

const ASKED_KEY = 'ato.push.asked';

/**
 * The morning push carries the written daily line (lib/daily-line), and it is
 * scheduled as one notification per morning for the next week rather than one
 * repeating notification. A repeating one can only repeat a single sentence,
 * so someone who did not open the app got the same text every morning; this
 * way each morning has its own line, and it is the same line Home shows that
 * day. Needs no loaded insight and no AI consent — the line is not AI-written.
 * A line that is not for other eyes is sent as a plain "ready" (`lockScreenText`).
 */
export const MORNING_AHEAD_DAYS = 7;
/**
 * The evening push asks people to log the day's Check. The Check loop is parked
 * (nothing can be logged), so the reminder is off until it has something to
 * point at (emci 2026-10-02). The pref and the copy are kept for when it returns.
 */
export const EVENING_PUSH_ENABLED = false;
const SUNDAY_PUSH_HOUR = 10;
export function morningAheadId(index: number): string {
  return `ato.morning.d${index}`;
}

async function cancelMorningAhead(): Promise<void> {
  for (let i = 0; i < MORNING_AHEAD_DAYS; i += 1) {
    await Notifications.cancelScheduledNotificationAsync(morningAheadId(i)).catch(() => {});
  }
}
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
/**
 * Cancel every schedule this app owns, without rescheduling anything.
 *
 * Split out of `syncPushSchedule`'s opening block (which cancels only to
 * immediately re-add) because account deletion needs the cancel WITHOUT the
 * resync: the morning/evening/insight/sunday payloads are built from the
 * signed-in account's insight and checks, and `morningPush(insight.title)` is a
 * DAILY REPEATING notification carrying AI-written text about that person.
 * Those schedules live in the OS, not AsyncStorage, so wiping local storage
 * does not touch them — without this they keep firing the deleted account's
 * content until some later account finishes onboarding, or forever if nobody
 * signs up on this device again (found in review, 2026-09-15).
 */
export async function cancelAllScheduledPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.morning).catch(() => {});
    await cancelMorningAhead();
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.evening).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.insight).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.sunday).catch(() => {});
    // Play's opt-in pet hunger reminder (same literal as PET_HUNGER_PUSH_ID in
    // src/play/pet-reminder.ts — kept as a string so app code never imports Play).
    await Notifications.cancelScheduledNotificationAsync('ato.play.pet.hunger').catch(() => {});
    // …and its egg hatch / reveal notice (PET_EGG_PUSH_ID).
    await Notifications.cancelScheduledNotificationAsync('ato.play.pet.egg').catch(() => {});
    // …and the expedition-back and dive-charges-full notices (v24).
    await Notifications.cancelScheduledNotificationAsync('ato.play.pet.expedition').catch(() => {});
    await Notifications.cancelScheduledNotificationAsync('ato.play.dive.charges').catch(() => {});
    // …and Tide Pass + free-eggs-ready notices (Part E; same literals as play-notices).
    await Notifications.cancelScheduledNotificationAsync('ato.play.pet.tide').catch(() => {});
    await Notifications.cancelScheduledNotificationAsync('ato.play.pet.eggs').catch(() => {});
  } catch (err) {
    console.log('[push] cancelAllScheduledPush failed:', err);
  }
}

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
    // PUSH_IDS.morning is the old single repeating notification; it is still
    // cancelled here so a phone that had one scheduled stops repeating it.
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.morning).catch(() => {});
    await cancelMorningAhead();
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.evening).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.insight).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(PUSH_IDS.sunday).catch(() => {});

    if (!(await notificationsAreGranted())) return;

    const prefs = await getPushPrefs();
    await ensureAndroidChannel();
    const insight = await loadCachedInsight();
    const now = new Date();
    const window = pushWindowForEnergy(input.energyPattern);

    if (prefs.morning) {
      const hoursNow = hoursSinceLocalMidnight(now, input.timeZone);
      // Today's morning if it has not happened yet, otherwise start tomorrow.
      const firstOffset = hoursNow < window.morningHour ? 0 : 1;
      const todayYmd = localYmd(now, input.timeZone);
      const offsets = Array.from({ length: MORNING_AHEAD_DAYS }, (_, i) => firstOffset + i);
      // Each morning asks that day's Today's Pick (emci, 2026-10-05): the same
      // question everyone gets that day, chosen by date, so it is known ahead.
      for (let i = 0; i < offsets.length; i += 1) {
        const hoursUntil = offsets[i]! * 24 + (window.morningHour - hoursNow);
        const pick = pickForYmd(addDaysYmd(todayYmd, offsets[i]!));
        await scheduleAtOrCancel(
          morningAheadId(i),
          morningPush(pick.prompt),
          new Date(now.getTime() + hoursUntil * 3_600_000),
        );
      }
    }

    const loggedToday = checkLoggedToday(input.checks, now, input.timeZone);

    // Evening keeps the original "only if there's a card" gate (re-evaluated
    // on every sync, same as before) — this pass only changed frequency and
    // the skip-if-logged condition, not whether a card is required at all.
    const eveningTarget = EVENING_PUSH_ENABLED && prefs.evening && insight?.title.trim()
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

    // Sunday: how many days the app was opened this week, from the daily-line
    // history. It used to count Checks, which nothing writes any more, so it
    // told everyone "nothing logged". One-shot for the coming Sunday and rebuilt
    // on every sync, so the number is right as of the last time the app was
    // open — and a week with no opens sends nothing.
    let sundayPayload: PushPayload | null = null;
    let sundayTarget: Date | null = null;
    if (prefs.sunday) {
      const hours = hoursSinceLocalMidnight(now, input.timeZone);
      const weekday = weekdayInZone(now, input.timeZone); // 0 = Sunday
      let daysUntil = (7 - weekday) % 7;
      if (daysUntil === 0 && hours >= SUNDAY_PUSH_HOUR) daysUntil = 7;
      const sundayYmd = addDaysYmd(localYmd(now, input.timeZone), daysUntil);
      const weekStart = addDaysYmd(sundayYmd, -6);
      const state = await loadDailyLineState(input.me.id);
      const opened = new Set(
        state.days.map((day) => day.ymd).filter((ymd) => ymd >= weekStart && ymd <= sundayYmd),
      ).size;
      if (opened > 0) {
        sundayPayload = sundayPush({ showedUp: opened, recap: '' });
        sundayTarget = new Date(now.getTime() + (daysUntil * 24 + SUNDAY_PUSH_HOUR - hours) * 3_600_000);
      }
    }
    await scheduleAtOrCancel(PUSH_IDS.sunday, sundayPayload, sundayTarget);
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
  insightInput?: { me: Me; tracks: readonly TraitTrack[] },
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await notificationsAreGranted())) {
    throw new Error('Notifications are off.');
  }
  await ensureAndroidChannel();
  const cached = await loadCachedInsight();
  const payload =
    kind === 'morning'
      ? morningPush(cached ? lockScreenInsight(cached).text : 'No insight yet — open ATO when you are ready.')
      : kind === 'evening'
        ? eveningPush()
        : kind === 'insight'
          ? insightInput
            ? (await pickInsightPayload(insightInput.me, insightInput.tracks)) ??
              insightPush('Categories', 'No current statement yet — generate one on /explore first.')
            : insightPush('Categories', 'No current statement yet — generate one on /explore first.')
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
