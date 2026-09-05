import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IntakeSweep } from '@/components/intake-sweep';
import { MilestoneToast } from '@/components/milestone-toast';
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
import { persistCelebratedMilestones } from '@/lib/me';
import { checkMilestones, type MilestoneDef } from '@/lib/milestones';
import { bankTotalProgress } from '@/lib/questions/local';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import { useAppearance } from '@/lib/theme/context';

/**
 * Questions — every question surface that feeds the trait axes lives here:
 * the rotating Infinite Questions ("Tell Sage more"), the optional scenario
 * fill ("Want to add a bit more?"), and the full sweep ("A faster pass").
 */
export default function IntakeSweepTabScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh } = useMe(userId);
  const { reduceMotion } = useAppearance();
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

  // One milestone toast at a time. Two crossings landing in the same
  // refreshAfterAnswer pass is not possible today (bankTotalProgress moves
  // by at most 1 per answer and MILESTONE_DEFS thresholds are 12 apart) but
  // this queue keeps that true even if a future metric changes that.
  const [toastQueue, setToastQueue] = useState<MilestoneDef[]>([]);
  const activeToast = toastQueue[0] ?? null;

  const onMilestoneCrossed = useCallback((def: MilestoneDef) => {
    setToastQueue((queue) => [...queue, def]);
  }, []);

  const dismissActiveToast = useCallback(() => {
    setToastQueue((queue) => queue.slice(1));
  }, []);

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
    if (!userId) return undefined;
    try {
      const fresh = await fetchTraitTracks(userId);
      setTracks(fresh);
      return fresh;
    } catch (err) {
      console.log('[questions] fetchTraitTracks error:', err);
      return undefined;
    } finally {
      setTracksReady(true);
    }
  }, [userId]);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  const scrollRef = useRef<ScrollView>(null);

  /**
   * One-time, silent catch-up for existing users: mark any bank-progress
   * milestone already crossed as celebrated with no toast, before the
   * post-answer check below (which fires the placeholder) can ever run.
   * Idempotent (checkMilestones returns [] once caught up), guarded to run
   * at most once per mount so it never fights the post-answer check.
   */
  const [backfillReady, setBackfillReady] = useState(false);
  const backfilledRef = useRef(false);

  useEffect(() => {
    if (!userId || !me || !tracksReady || backfilledRef.current) return;
    backfilledRef.current = true;
    const celebrated = me.celebrated_milestone_ids ?? [];
    const crossed = checkMilestones('bankTotalProgress', bankTotalProgress(tracks).answered, celebrated);
    if (crossed.length === 0) {
      setBackfillReady(true);
      return;
    }
    persistCelebratedMilestones(userId, [...celebrated, ...crossed.map((def) => def.id)])
      .then(() => refresh())
      .catch((err) => {
        // If the write failed, celebrated_milestone_ids is still stale — a
        // real answer's refreshAfterAnswer would then wrongly treat these
        // already-crossed defs as new. Reset the guard so the next mount
        // (or a later dependency change this session) retries the backfill
        // before that can happen, rather than marking it done.
        console.log('[questions] celebrated-milestone backfill error:', err);
        backfilledRef.current = false;
      })
      .finally(() => setBackfillReady(true));
  }, [userId, me, tracksReady, tracks, refresh]);

  const refreshAfterAnswer = useCallback(async () => {
    const [, freshTracks] = await Promise.all([refresh(), loadTracks()]);
    if (!userId || !me || !freshTracks) return;
    const celebrated = me.celebrated_milestone_ids ?? [];
    const crossed = checkMilestones('bankTotalProgress', bankTotalProgress(freshTracks).answered, celebrated);
    if (crossed.length === 0) return;
    for (const def of crossed) {
      onMilestoneCrossed(def);
    }
    try {
      await persistCelebratedMilestones(userId, [...celebrated, ...crossed.map((def) => def.id)]);
      await refresh();
    } catch (err) {
      console.log('[questions] persistCelebratedMilestones error:', err);
    }
  }, [refresh, loadTracks, userId, me, onMilestoneCrossed]);

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

          {activeToast ? (
            <MilestoneToast
              key={activeToast.id}
              title={activeToast.title}
              body={activeToast.body}
              reduceMotion={reduceMotion}
              onDone={dismissActiveToast}
            />
          ) : null}

          {/*
            `tracksReady` gates the mount for the same reason `flagsReady` gates
            the sweep below: QuestionsFold generates and SAVES a pack on open,
            and that pack is then served from cache until it is exhausted. A
            mount before tracks land would read as an incomplete profile and
            hand a complete-profile user a bank-only pack to work through first.
          */}
          {me && checksReady && flagsReady && tracksReady && backfillReady ? (
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
              {flagsReady && tracksReady && backfillReady ? (
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
