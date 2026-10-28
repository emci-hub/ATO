/**
 * PHASE-11e: today's Almanac theme and engine context for a screen. One place
 * builds the calendar (zone, region, stored hemisphere, birthday) so Home,
 * Insights and You all read the same day. Pure maths lives in the lib; this only
 * gathers the phone's facts, including the seasonal preferences (PHASE-11f).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';

import { clearLeans } from '@/lib/daily-line/pick';
import type { Me } from '@/lib/me';
import type { TraitTrack } from '@/lib/trait-stability';

import type { MicroFacts } from '@/lib/almanac/arcs';
import type { Hemisphere } from '@/lib/almanac/events';
import { deviceRegion, hemisphereFromZone, loadLocale } from '@/lib/almanac/locale';
import { eventPrefsOf, loadAlmanacPrefs, subscribeAlmanacPrefs, type AlmanacPrefs } from '@/lib/almanac/prefs';
import { almanacTodayFromTheme, createCalendar, type DayTheme } from '@/lib/almanac/resolve';
import { almanacYmd } from '@/lib/almanac/seed';
import type { AlmanacContext } from '@/lib/almanac/types';

export interface AlmanacDay {
  theme: DayTheme;
  ctx: AlmanacContext;
}

export function useAlmanacDay(args: {
  userId?: string;
  me: Pick<Me, 'timezone' | 'born_on' | 'created_at'> | null;
  ymd?: string;
  tracks: readonly TraitTrack[];
  dataDays: number;
  facts?: MicroFacts;
}): AlmanacDay | null {
  const { userId, me, ymd, tracks, dataDays, facts } = args;
  const zone = me?.timezone || 'UTC';
  const [hemisphere, setHemisphere] = useState<Hemisphere | null>(null);
  const [prefs, setPrefs] = useState<AlmanacPrefs | null>(null);
  // Settings bumps this when it changes the hemisphere or a seasonal choice.
  const [prefsTick, setPrefsTick] = useState(0);

  useEffect(() => subscribeAlmanacPrefs(() => setPrefsTick((n) => n + 1)), []);

  useEffect(() => {
    let live = true;
    void loadLocale(AsyncStorage, zone)
      .then((stored) => live && setHemisphere(stored.hemisphere))
      .catch(() => live && setHemisphere(hemisphereFromZone(zone)));
    void loadAlmanacPrefs(AsyncStorage).then((next) => live && setPrefs(next));
    return () => {
      live = false;
    };
  }, [zone, userId, prefsTick]);

  const bornOn = me?.born_on ?? null;
  const createdAt = me?.created_at ?? null;
  const pickCount = facts?.pickCount;
  const glowStreak = facts?.glowStreak;
  const answeredYearAgo = facts?.answeredYearAgo;

  return useMemo(() => {
    if (!userId || !ymd || !hemisphere || !prefs) return null;
    const joinedYmd = createdAt ? almanacYmd(new Date(createdAt), zone) : null;
    const calendar = createCalendar({
      tz: zone,
      region: deviceRegion(),
      hemisphere,
      bornOn,
      joinedYmd,
      prefs: eventPrefsOf(prefs),
    });
    const theme = calendar.theme(ymd, { pickCount, glowStreak, answeredYearAgo });
    const ctx: AlmanacContext = {
      userId,
      ymd,
      leans: clearLeans(tracks),
      dataDays,
      ...almanacTodayFromTheme(theme),
    };
    return { theme, ctx };
  }, [userId, ymd, hemisphere, prefs, zone, bornOn, createdAt, tracks, dataDays, pickCount, glowStreak, answeredYearAgo]);
}
