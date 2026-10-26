import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConflictStyleCard } from '@/components/daily-insights/conflict-style-card';
import { SuperpowerCard } from '@/components/daily-insights/superpower-card';
import { TryTodayCard } from '@/components/daily-insights/try-today-card';
import { InsightsStoryCard } from '@/components/insights/insights-story-card';
import { TodayFocusCard } from '@/components/insights/today-focus-card';
import { Appear, SkeletonCard } from '@/components/motion';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { ThemedText } from '@/components/themed-text';
import { TokenChip } from '@/components/token-chip';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useTryToday } from '@/hooks/use-try-today';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { readyCategories } from '@/lib/categories';
import { checkWindowFor } from '@/lib/check-window';
import {
  dailyInsightsVisible,
  focusShowsTryToday,
  pickConflict,
  pickSuperpower,
  shouldShowTryToday,
} from '@/lib/daily-insights';
import { fullProfileLockedLine, fullProfileProgress, isFullProfileDone } from '@/lib/full-profile-gate';
import { useMeContext } from '@/lib/me-context';
import { FIRST_READ_STAGE, intakeStage } from '@/lib/questions/intake-stage';
import { SAGE_COACH_LABEL, SAGE_NOT_A_PERSON } from '@/lib/sage-copy';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';

/** The tab's title (replaced Sage, 2026-10-14). */
export const INSIGHTS_TITLE = SAGE_COACH_LABEL;

/**
 * Insights — the tab that replaced Sage (emci 2026-10-14). TEMPLATE-ONLY:
 * every card is stored copy picked on the phone. Nothing here imports an AI
 * client, claims quota, asks for AI consent or takes typed text
 * (`check:insights-no-ai`).
 *
 * Order, top to bottom:
 *   1. 🎯 Try this today (daily-insights bank, "Did it ✓" streak)
 *   2. Today's focus (insight bank), without its own "try today" line
 *   3. The Story (story-v3 templates, v2 bank fallback)
 *   4. ⚡ Superpower / 🪫 Kryptonite
 *   5. 🗣️ How you argue
 *
 * "Today" is the profile timezone through the shared helpers (`localYmd`,
 * `checkWindowFor`), never the device's own zone.
 */
export default function InsightsScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me } = useMeContext();
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [tracksReady, setTracksReady] = useState(false);
  const [tracksOwner, setTracksOwner] = useState<string | null>(null);
  const dataEpoch = useAccountDataEpoch();

  // Refetch on focus (tab screens stay mounted); only the newest request writes.
  const requestIdRef = useRef(0);
  const reloadTracks = useCallback(async () => {
    if (!userId) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    try {
      const rows = await fetchTraitTracks(userId);
      if (requestId !== requestIdRef.current) return;
      setTracks(rows);
      setTracksOwner(userId);
    } catch (err) {
      console.log('[insights] tracks error:', err);
    } finally {
      if (requestId === requestIdRef.current) setTracksReady(true);
    }
    // me / dataEpoch: a save, a dev jump or Reset account rewrote the account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, me, dataEpoch]);

  useEffect(() => {
    requestIdRef.current += 1;
    setTracks([]);
    setTracksOwner(null);
    setTracksReady(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void reloadTracks();
    }, [reloadTracks]),
  );

  const ownTracks = tracksOwner === userId;
  const unlocked = ownTracks && isFullProfileDone(tracks, tracksReady);
  // D22 (A6): after the first 16 answers the focus card opens with an "Early read" line.
  // Everything else on Insights stays locked until the full profile.
  const earlyRead = ownTracks && tracksReady && !unlocked && intakeStage(tracks) >= FIRST_READ_STAGE;
  const window = me ? checkWindowFor(me, []) : null;
  // Insights has no Today slot of its own; the missed-check slot lives on Home.
  const cardsVisible = unlocked && dailyInsightsVisible({ slotKind: 'none' });
  const tryTodayVisible = unlocked && shouldShowTryToday({ insightTryTodayShown: false, slotKind: 'none' });
  const tryToday = useTryToday({
    userId: userId ?? '',
    timeZone: me?.timezone,
    tracks,
    tracksReady: tracksReady && ownTracks,
    touched: me?.trait_touched_at,
    enabled: !!userId && tryTodayVisible,
  });
  const superpower = useMemo(
    () => (tracksReady && ownTracks ? pickSuperpower(readyCategories(tracks)) : null),
    [tracks, tracksReady, ownTracks],
  );
  const conflict = useMemo(
    () => (tracksReady && ownTracks ? pickConflict(tracks) : null),
    [tracks, tracksReady, ownTracks],
  );
  // 🎯 is always offered here, so the focus card never repeats a "try today".
  const focusTry = focusShowsTryToday({ tryTodayCardShown: tryTodayVisible });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never">
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <ThemedText type="subtitle" style={styles.flexText}>
                {INSIGHTS_TITLE}
              </ThemedText>
              <TokenChip />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {SAGE_NOT_A_PERSON}
            </ThemedText>
          </View>

          {!me || !tracksReady || !ownTracks ? (
            <>
              <SkeletonCard lines={3} />
              <SkeletonCard />
            </>
          ) : !unlocked ? (
            <>
              {/* After set 1: today's focus with an "Early read" line (D22). */}
              {earlyRead && userId && window ? (
                <TodayFocusCard
                  userId={userId}
                  tracks={tracks}
                  todayYmd={window.todayYmd}
                  todayDay={window.todayDay}
                  showTryToday={focusTry}
                  early
                />
              ) : null}
              {/* Not far enough yet, or the rest of Insights: one honest line and one way forward. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Answer the questions"
                onPress={() => router.push('/intake-sweep')}
                testID="insights-locked"
                style={({ pressed }) => [
                  styles.lockedRow,
                  { borderColor: controlBorderColor(theme) },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.flexText}>
                  <ThemedText type="smallBold">Answer the questions</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {fullProfileLockedLine(fullProfileProgress(tracks))}{' '}
                    {earlyRead ? 'The rest of Insights opens once you finish the questions.' : 'Insights opens once you finish the questions.'}
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              {tryTodayVisible && tryToday.pick ? (
                <Appear>
                  <TryTodayCard
                    pick={tryToday.pick}
                    streak={tryToday.streak}
                    done={tryToday.done}
                    onDone={tryToday.markDone}
                  />
                </Appear>
              ) : null}

              {userId && window ? (
                <TodayFocusCard
                  userId={userId}
                  tracks={tracks}
                  todayYmd={window.todayYmd}
                  todayDay={window.todayDay}
                  showTryToday={focusTry}
                />
              ) : null}

              <InsightsStoryCard me={me} tracks={tracks} tracksReady={tracksReady} unlocked={unlocked} />

              {cardsVisible && superpower ? <SuperpowerCard pick={superpower} /> : null}
              {cardsVisible && conflict ? <ConflictStyleCard line={conflict} /> : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    gap: Spacing.half,
    paddingBottom: Spacing.two,
    paddingRight: NAV_PIXEL_HEADER_INSET,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
  },
  flexText: {
    flex: 1,
    gap: Spacing.half,
    paddingRight: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
