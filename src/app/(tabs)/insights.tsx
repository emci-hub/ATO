import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlmanacDeckCard, AlmanacTryCard, eventNameFor, useAlmanacTry } from '@/components/almanac/event-cards';
import { ConflictStyleCard } from '@/components/daily-insights/conflict-style-card';
import { SuperpowerCard } from '@/components/daily-insights/superpower-card';
import { TryTodayCard } from '@/components/daily-insights/try-today-card';
import { InsightsStoryCard } from '@/components/insights/insights-story-card';
import { GlowPulse } from '@/components/glow-pulse';
import { TodayFocusCard } from '@/components/insights/today-focus-card';
import { FlipCard } from '@/components/flip-card';
import { InsightCollection } from '@/components/insight-collection';
import { Appear, SkeletonCard } from '@/components/motion';
import { QuestsEntryCard } from '@/components/quests/entry-card';
import { SpectrumSection } from '@/components/spectrum-slider';
import { ThemedPressable } from '@/components/themed-pressable';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { ThemedText } from '@/components/themed-text';
import { TokenChip } from '@/components/token-chip';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useTryToday } from '@/hooks/use-try-today';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { useAlmanacDay } from '@/hooks/use-almanac-day';
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
import { markInsightsSeen } from '@/lib/home-path-store';
import { spectrumRows } from '@/lib/insights-spectrum';
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
 * Order, top to bottom (PHASE-09 gamified it):
 *   1. One flip card: front = Today's focus (insight bank, without its own
 *      "try today" line), back = 🎯 Try this today (daily-insights bank,
 *      "Did it ✓" streak). Without a try pick the focus card stands alone.
 *   2. The Story (story-v3 templates, v2 bank fallback)
 *   3. Where you lean (spectrum sliders, top 3 clear leans)
 *   4. ⚡ Superpower / 🪫 Kryptonite
 *   5. 🗣️ How you argue
 *   6. Insights seen (collection, kept on the phone)
 *   7. QUESTS_CARD_SLOT (PHASE-23)
 *
 * Opening this screen with a card on it also ticks Home's "read today's
 * insight" step (`markInsightsSeen`), whichever way it was opened.
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
  const [tracksError, setTracksError] = useState(false);
  const [shownTitle, setShownTitle] = useState<string | null>(null);
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
      setTracksError(false);
    } catch (err) {
      console.log('[insights] tracks error:', err);
      if (requestId === requestIdRef.current) setTracksError(true);
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
    setTracksError(false);
    setShownTitle(null);
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
  // The Almanac's day (PHASE-11e): an event day swaps the flip card's back and adds a deck card.
  const almanacDay = useAlmanacDay({
    userId,
    me,
    ymd: window?.todayYmd,
    tracks: ownTracks ? tracks : [],
    dataDays: tryToday.streak ?? 0,
  });
  const almanacTry = useAlmanacTry(unlocked ? almanacDay : null);
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
  const spectrum = useMemo(
    () => (cardsVisible && tracksReady && ownTracks ? spectrumRows(tracks) : []),
    [cardsVisible, tracks, tracksReady, ownTracks],
  );
  const onInsightShown = useCallback((title: string) => setShownTitle(title), []);

  // Opening Insights with a card on it counts as reading today's insight on Home's path.
  const todayYmd = window?.todayYmd ?? null;
  const showsInsight = unlocked || earlyRead;
  useFocusEffect(
    useCallback(() => {
      if (userId && todayYmd && showsInsight) void markInsightsSeen(userId, todayYmd);
    }, [userId, todayYmd, showsInsight]),
  );

  const focusCard =
    userId && window ? (
      <GlowPulse>
        <TodayFocusCard
          userId={userId}
          tracks={tracks}
          todayYmd={window.todayYmd}
          todayDay={window.todayDay}
          showTryToday={focusTry}
          onInsightShown={onInsightShown}
        />
      </GlowPulse>
    ) : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never">
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <ThemedText type="subtitle" style={styles.flexText} accessibilityRole="header">
                {INSIGHTS_TITLE}
              </ThemedText>
              <TokenChip />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {SAGE_NOT_A_PERSON}
            </ThemedText>
          </View>

          {me && tracksReady && !ownTracks && tracksError ? (
            <ThemedView type="backgroundElement" style={styles.errorCard} testID="insights-error">
              <ThemedText type="smallBold">Couldn’t load your insights.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Check your connection and try again.
              </ThemedText>
              <ThemedPressable
                accessibilityRole="button"
                accessibilityLabel="Try again"
                onPress={() => {
                  setTracksReady(false);
                  void reloadTracks();
                }}
                style={styles.retry}>
                <ThemedText type="smallBold">Try again</ThemedText>
              </ThemedPressable>
            </ThemedView>
          ) : !me || !tracksReady || !ownTracks ? (
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
              {/* One stable wrapper: the focus card keeps its place (and its load state) when the Try pick arrives late. */}
              {focusCard ? (
                <FlipCard
                  front={focusCard}
                  back={
                    almanacTry ? (
                      <AlmanacTryCard text={almanacTry.text} eventName={almanacDay ? eventNameFor(almanacDay, almanacTry.event) : 'Today'} />
                    ) : tryTodayVisible && tryToday.pick ? (
                      <TryTodayCard
                        pick={tryToday.pick}
                        streak={tryToday.streak}
                        done={tryToday.done}
                        onDone={tryToday.markDone}
                      />
                    ) : null
                  }
                  toBackLabel="Try this today"
                  toFrontLabel="Today’s focus"
                />
              ) : tryTodayVisible && tryToday.pick ? (
                <Appear>
                  <TryTodayCard
                    pick={tryToday.pick}
                    streak={tryToday.streak}
                    done={tryToday.done}
                    onDone={tryToday.markDone}
                  />
                </Appear>
              ) : null}

              <InsightsStoryCard me={me} tracks={tracks} tracksReady={tracksReady} unlocked={unlocked} />

              {spectrum.length > 0 ? <SpectrumSection rows={spectrum} /> : null}

              {cardsVisible && superpower ? (
                <Appear index={2}>
                  <SuperpowerCard pick={superpower} />
                </Appear>
              ) : null}
              {cardsVisible && conflict ? (
                <Appear index={4}>
                  <ConflictStyleCard line={conflict} />
                </Appear>
              ) : null}

              {cardsVisible && userId && almanacDay ? <AlmanacDeckCard userId={userId} day={almanacDay} /> : null}

              {userId ? <InsightCollection userId={userId} shownTitle={shownTitle} /> : null}

              {/* QUESTS_CARD_SLOT */}
              <QuestsEntryCard />
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
  errorCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  retry: {
    alignSelf: 'flex-start',
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
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
