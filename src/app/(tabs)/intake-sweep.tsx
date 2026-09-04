import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IntakeSweep } from '@/components/intake-sweep';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { OptionalIntakeFill } from '@/components/optional-intake';
import { QuestionsFold } from '@/components/questions-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { checksToHistory, fetchChecks, type Check } from '@/lib/checks';
import { crisisFlagsForWindow } from '@/lib/crisis/days';
import { useMe } from '@/hooks/use-me';
import { useSession } from '@/hooks/use-session';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

/**
 * Questions — every question surface that feeds the trait axes lives here:
 * the rotating Infinite Questions ("Tell Sage more"), the optional scenario
 * fill ("Want to add a bit more?"), and the full sweep ("A faster pass").
 */
export default function IntakeSweepTabScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh } = useMe(userId);
  const params = useLocalSearchParams<{ axis?: string }>();
  const focusAxis = (TRAIT_AXES as readonly string[]).includes(params.axis ?? '')
    ? (params.axis as TraitAxis)
    : undefined;
  const [checks, setChecks] = useState<Check[]>([]);
  const [checksReady, setChecksReady] = useState(false);
  const [crisisToday, setCrisisToday] = useState(false);
  const [flagsReady, setFlagsReady] = useState(false);
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [tracksReady, setTracksReady] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setChecks(await fetchChecks(userId));
    } catch (err) {
      console.log('[questions] fetchChecks error:', err);
    } finally {
      setChecksReady(true);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId || !me) return;
    let cancelled = false;
    crisisFlagsForWindow(userId, me.timezone)
      .then((flags) => {
        if (cancelled) return;
        setCrisisToday(flags.crisisToday);
        setFlagsReady(true);
      })
      .catch((err) => {
        console.log('[questions] crisis flags error:', err);
        if (!cancelled) setFlagsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, me?.timezone]);

  // Tracks feed the profile-completeness gate in `routeQuestions`.
  // Deliberately NOT keyed on a `me` field: a trait write patches only trait
  // values / `trait_sources` / `trait_touched_at` (`traitPatch`, no `me`
  // UPDATE trigger touches `updated_at`), and `trait_touched_at` is an object
  // whose identity churns on every fetch. Answers refetch through `onUpdated`
  // instead. Note the refreshed tracks land one batch late: `pick()` re-runs
  // `load()` from the render closure that still holds the old prop, so the
  // answer filling the last axis regenerates one more bank pack and the AI
  // path opens on the regen after that. Bounded, and no quota is spent.
  const loadTracks = useCallback(async () => {
    if (!userId) return;
    try {
      setTracks(await fetchTraitTracks(userId));
    } catch (err) {
      console.log('[questions] fetchTraitTracks error:', err);
    } finally {
      setTracksReady(true);
    }
  }, [userId]);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  const scrollRef = useRef<ScrollView>(null);

  const refreshAfterAnswer = useCallback(async () => {
    await Promise.all([refresh(), loadTracks()]);
  }, [refresh, loadTracks]);

  /**
   * "Skip the rest" on the full sweep. Skipping defers every remaining axis
   * onto `me.question_deferred`, and QuestionsFold — the first block on this
   * same screen — front-loads those as `priorityAxes` on its next batch. So
   * the person stays in Questions and is scrolled back to the pool that just
   * inherited their skipped axes. This used to replace the route with Home,
   * where nothing would ask them again. Skipping must never be a way out of
   * the profile-completeness gate, only a way to defer.
   */
  function done() {
    void refresh();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Questions</ThemedText>
          </View>

          {/*
            `tracksReady` gates the mount for the same reason `flagsReady` gates
            the sweep below: QuestionsFold generates and SAVES a pack on open,
            and that pack is then served from cache until it is exhausted. A
            mount before tracks land would read as an incomplete profile and
            hand a complete-profile user a bank-only pack to work through first.
          */}
          {me && checksReady && flagsReady && tracksReady ? (
            <QuestionsFold
              me={me}
              history={checksToHistory(checks)}
              crisisToday={crisisToday}
              onUpdated={refreshAfterAnswer}
              focusAxis={focusAxis}
              tracks={tracks}
            />
          ) : null}

          {me ? (
            <>
              <OptionalIntakeFill me={me} onUpdated={refresh} />
              {/*
                `onUpdated` must refresh TRACKS too, not just `me`: an answer
                bumps that axis's answerCount, which is what picks the next
                bank draft. Refreshing `me` alone would leave the sweep showing
                the same question after answering it.
              */}
              {flagsReady && tracksReady ? (
                <IntakeSweep
                  me={me}
                  crisisToday={crisisToday}
                  tracks={tracks}
                  onUpdated={refreshAfterAnswer}
                  onDone={done}
                />
              ) : null}
            </>
          ) : (
            <ThemedText themeColor="textSecondary">Loading…</ThemedText>
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
    paddingBottom: BottomTabInset + Spacing.five,
  },
  header: {
    paddingRight: NAV_PIXEL_HEADER_INSET,
  },
});
