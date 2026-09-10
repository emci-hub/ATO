import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { IntakeSweep } from '@/components/intake-sweep';
import { MilestoneToast } from '@/components/milestone-toast';
import { NAV_PIXEL_HEADER_INSET, NAV_PIXEL_RIGHT, NAV_PIXEL_SLOT } from '@/components/nav-pixel';
import { OptionalIntakeFill } from '@/components/optional-intake';
import { QuestionsFold } from '@/components/questions-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { checksToHistory, fetchChecks, type Check } from '@/lib/checks';
import { crisisFlagsForWindow } from '@/lib/crisis/days';
import { useMe } from '@/hooks/use-me';
import { useSession } from '@/hooks/use-session';
import { computeStreak } from '@/lib/growth';
import { persistCelebratedMilestones } from '@/lib/me';
import { checkMilestones, type MilestoneDef } from '@/lib/milestones';
import { axisVariant, bankTotalProgress } from '@/lib/questions/local';
import { settledCount, type TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import { useAppearance } from '@/lib/theme/context';

/**
 * Every newly-crossed milestone across every metric this screen tracks:
 * bankTotalProgress (raw answers-in-the-bank count), profile_percent
 * (settled-axis ratio, same "settled" as settledCount's "N of 16" label —
 * NOT isProfileSettled, which is a strict all-16 boolean gate), one
 * axisComplete:<axis> check per TRAIT_AXES axis (that axis's own bank
 * answer count via axisVariant, reaching its own bank-size threshold), and
 * current_streak (consecutive check-in days via computeStreak — unrelated
 * to the old presence-milestone system, which counted all-time checks, not
 * a day streak). Computed at the same two call sites bankTotalProgress
 * already ran at before this change (the backfill effect and
 * refreshAfterAnswer below).
 */
function crossedMilestonesFor(
  tracks: readonly TraitTrack[],
  celebrated: readonly string[],
  checks: readonly Check[],
  timezone: string,
): MilestoneDef[] {
  const percent = (settledCount(tracks) / TRAIT_AXES.length) * 100;
  const axisCrossed = TRAIT_AXES.flatMap((axis) =>
    checkMilestones(`axisComplete:${axis}`, axisVariant(tracks, axis), celebrated),
  );
  const streak = computeStreak(checks, timezone);
  return [
    ...checkMilestones('bankTotalProgress', bankTotalProgress(tracks).answered, celebrated),
    ...checkMilestones('profile_percent', percent, celebrated),
    ...axisCrossed,
    ...checkMilestones('current_streak', streak, celebrated),
  ];
}

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
  // Every "answer questions about X" CTA in the app (Legends, Explore,
  // Categories, Sage, the Story fold, the milestone badge, Profile Fill,
  // Insight Spend) deep-links here with `?axis=`. The fold below must open
  // itself when one arrives — collapsed, it never called `routeQuestions`,
  // so the axis was silently dropped and every one of those CTAs dead-ended.
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

  // One milestone toast at a time. Two crossings CAN land in the same
  // refreshAfterAnswer pass (e.g. bankTotalProgress and profile_percent
  // both crossing on the same answer) — this queue shows them one after
  // another instead of clobbering.
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
  const insets = useSafeAreaInsets();

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
    if (!userId || !me || !tracksReady || !checksReady || backfilledRef.current) return;
    backfilledRef.current = true;
    const celebrated = me.celebrated_milestone_ids ?? [];
    const crossed = crossedMilestonesFor(tracks, celebrated, checks, me.timezone);
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
  }, [userId, me, tracksReady, checksReady, tracks, checks, refresh]);

  const refreshAfterAnswer = useCallback(async () => {
    const [, freshTracks] = await Promise.all([refresh(), loadTracks()]);
    if (!userId || !me || !freshTracks) return;
    const celebrated = me.celebrated_milestone_ids ?? [];
    const crossed = crossedMilestonesFor(freshTracks, celebrated, checks, me.timezone);
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
  }, [refresh, loadTracks, userId, me, checks, onMilestoneCrossed]);

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
        {/*
          Pinned near the avatar (NavPixel, mounted globally at the tab
          shell — src/app/(tabs)/_layout.tsx) rather than in-flow with the
          rest of the screen, so it stays visible while scrolling instead of
          being scrolled past unread. `top: insets.top + Spacing.two`
          matches NavPixel's own positioning exactly (nav-pixel.tsx) — an
          earlier draft used `top: Spacing.two` alone, reasoning SafeAreaView
          already insets its children so adding insets.top again would
          double-count it; wrong (found in review): an absolutely-positioned
          child is laid out from the containing node's BORDER box, and
          SafeAreaView applies its top inset as PADDING on itself, so an
          absolute child ignores that padding entirely and needs the inset
          added explicitly, same as NavPixel does. Same fade timing as
          before (untouched, inside MilestoneToast itself) — only the
          position changed. legends.tsx's own MilestoneToast usage is
          untouched, still full-width/in-flow.
        */}
        {activeToast ? (
          <View pointerEvents="none" style={[styles.avatarToastWrap, { top: insets.top + Spacing.two }]}>
            <MilestoneToast
              key={activeToast.id}
              title={activeToast.title}
              body={activeToast.body}
              reduceMotion={reduceMotion}
              onDone={dismissActiveToast}
              style={styles.avatarToast}
            />
          </View>
        ) : null}
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
          {me && checksReady && flagsReady && tracksReady && backfillReady ? (
            <QuestionsFold
              me={me}
              history={checksToHistory(checks)}
              crisisToday={crisisToday}
              onUpdated={refreshAfterAnswer}
              defaultOpen={!!focusAxis}
              focusAxis={focusAxis}
              tracks={tracks}
              scrollViewRef={scrollRef}
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
  avatarToastWrap: {
    position: 'absolute',
    // `top` is set inline (insets.top + Spacing.two) — needs the live safe-area inset, not a static value.
    right: NAV_PIXEL_RIGHT + NAV_PIXEL_SLOT,
    alignItems: 'flex-end',
    zIndex: 90, // stays below NavPixel's own zIndex 100, so the avatar renders on top if they ever overlap
  },
  avatarToast: {
    alignSelf: 'flex-end',
    maxWidth: 220,
  },
});
