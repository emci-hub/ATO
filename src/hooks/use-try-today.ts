import { useCallback, useEffect, useRef, useState } from 'react';

import { readyCategories, signalAxesFrom } from '@/lib/categories';
import {
  DAILY_INSIGHTS_SHOW_PROVISIONAL,
  currentStreak,
  isDoneToday,
  resolveShowProvisional,
  type TryTodayPick,
} from '@/lib/daily-insights';
import { loadTryToday, markTryTodayDone } from '@/lib/daily-insights/store';
import { DEV_TOOLS_AVAILABLE } from '@/lib/dev-mode';
import { writeWidgetTryToday } from '@/lib/insight/today-insight';
import { localYmd } from '@/lib/local-date';
import type { TraitTrack } from '@/lib/trait-stability';

/**
 * 🎯 Try this today for one account on the app's day (the profile timezone,
 * `localYmd`, never the device's own zone). The pick is stored for the day, so
 * a refresh or more answers mid-day never move it. Local only.
 *
 * Home and Insights both run this, reading and writing the same stored day, so
 * the widget gets today's 🎯 line whichever screen opens first.
 */
export function useTryToday(input: {
  userId: string;
  timeZone: string | null | undefined;
  tracks: readonly TraitTrack[];
  tracksReady: boolean;
  touched: Record<string, string> | undefined;
  enabled: boolean;
}) {
  const { userId, timeZone, tracks, tracksReady, touched, enabled } = input;
  const [pick, setPick] = useState<TryTodayPick | null>(null);
  const [streak, setStreak] = useState(0);
  const [done, setDone] = useState(false);
  const [dateKey, setDateKey] = useState(() => localYmd(new Date(), timeZone || 'UTC'));
  const [nonce, setNonce] = useState(0);
  const marking = useRef(false);

  useEffect(() => {
    // A new account starts from nothing — never the last account's card.
    setPick(null);
    setStreak(0);
    setDone(false);
  }, [userId]);

  useEffect(() => {
    if (!enabled || !tracksReady) return;
    let cancelled = false;
    const today = localYmd(new Date(), timeZone || 'UTC');
    const showProvisional = resolveShowProvisional({
      base: DAILY_INSIGHTS_SHOW_PROVISIONAL,
      devOverride: null,
      devToolsActive: DEV_TOOLS_AVAILABLE,
    });
    loadTryToday(userId, {
      dateKey: today,
      ready: readyCategories(tracks),
      signalAxes: signalAxesFrom(touched),
      showProvisional,
    })
      .then(({ pick: next, store }) => {
        if (cancelled) return;
        setDateKey(today);
        setPick(next);
        if (next) writeWidgetTryToday(next.line.text, today);
        setStreak(currentStreak(store.streak, today));
        setDone(isDoneToday(store.streak, today));
      })
      .catch((err) => console.log('[try-today] load error:', err));
    return () => {
      cancelled = true;
    };
  }, [userId, timeZone, tracks, tracksReady, touched, enabled, nonce]);

  const markDone = useCallback(async (): Promise<number | null> => {
    // A ref, not state: two taps inside one frame both see `done === false`.
    if (done || marking.current) return null;
    // Past midnight with the screen still up: load the new day, never mark yesterday.
    if (localYmd(new Date(), timeZone || 'UTC') !== dateKey) {
      setNonce((n) => n + 1);
      return null;
    }
    marking.current = true;
    setDone(true); // the button disables on the first tap
    try {
      const store = await markTryTodayDone(userId, dateKey);
      const next = currentStreak(store.streak, dateKey);
      setStreak(next);
      setDone(isDoneToday(store.streak, dateKey));
      return next;
    } catch (err) {
      console.log('[try-today] mark error:', err);
      return null;
    } finally {
      marking.current = false;
    }
  }, [done, userId, dateKey, timeZone]);

  return { pick, streak, done, markDone };
}
