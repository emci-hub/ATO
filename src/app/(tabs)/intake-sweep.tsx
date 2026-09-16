import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FullProfileBanner } from '@/components/full-profile-banner';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { QuestionsFold } from '@/components/questions-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { isFullProfileDone } from '@/lib/full-profile-gate';
import { useMe } from '@/hooks/use-me';
import { useSession } from '@/hooks/use-session';
import { type TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';

/**
 * Questions — where the full profile gets built, and the only screen that can
 * add to it (ISOLATION_PLAN §7 Card D).
 *
 * One surface: `QuestionsFold` — the 50-question bank while it is unfinished,
 * then the "Next 25 questions" round once it is. Renders `alwaysOpen`
 * (2026-09-15): the bank list is expanded immediately, no collapse header
 * and no tap needed — safe, since the bank is local/no-backend. The 25-item
 * round stays behind its own explicit "Next 25 questions" press.
 *
 * REMOVED 2026-09-16 (emci): the Infinite Questions inline feed and the card
 * that wrapped it ("A few questions · N of 16 unanswered" / "Tap when you
 * feel like it. Not today's card."). It rendered below the bank/round branch
 * unconditionally, so a finished profile saw a second, unrelated question
 * under "Next 25 questions" in the same box. Three things went with it, all
 * of which existed only to serve it:
 *   - the `?axis=` deep-link hint. Callers across the app still pass it and
 *     it is now IGNORED — the bank shows every axis at once, so there is no
 *     "next batch" left to front-load. The links still land here correctly.
 *   - the crisis-day fetch. Crisis suppressed the FEED (inside
 *     `routeQuestions`); the local bank and the round were never gated on it,
 *     so nothing on this screen reads it any more.
 *   - the empty/checkpoint/skip states, which were the feed's alone.
 *
 * REMOVED 2026-09-15 (emci): the "A faster pass" full sweep (`IntakeSweep`) —
 * the 50 bank questions above already cover the same ground. Its now-unused
 * code (`src/components/intake-sweep.tsx`, `src/lib/questions/sweep.ts`, and
 * the sweep-only exports of `src/lib/questions/local.ts`) was deleted along
 * with it, not just unmounted.
 *
 * PARKED here: the `MilestoneToast` overlay (and with it every write to
 * `me.celebrated_milestone_ids`) and `OptionalIntakeFill`. The Check history
 * this screen used to fetch is gone too — the Check loop is parked, so it was
 * a read of a table nothing writes; `QuestionsFold` now gets an empty history.
 * `checkMilestones` / `computeStreak` / `persistCelebratedMilestones` are
 * untouched and simply have no caller here.
 */
export default function IntakeSweepTabScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh } = useMe(userId);
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [tracksReady, setTracksReady] = useState(false);

  // Tracks feed the unlock gate inside the fold. Deliberately NOT keyed on a
  // `me` field: a trait write patches only trait values / `trait_sources` /
  // `trait_touched_at` (no `me` UPDATE trigger touches `updated_at`), and
  // `trait_touched_at` is an object whose identity churns on every fetch.
  // Answers refetch through `onUpdated` instead.
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

  const refreshAfterAnswer = useCallback(async () => {
    await Promise.all([refresh(), loadTracks()]);
  }, [refresh, loadTracks]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Questions</ThemedText>
          </View>

          {/*
            The one-time "Full profile enabled" announcement, shown the first
            time an account finishes the bank.

            Driven by `isFullProfileDone` — the SAME signal Home's unlocked
            state reads — so the banner and the Home unlock can never disagree:
            if this shows, "Load insight" / "Load story" are already live. It
            spends no model call, and it renders nothing until `tracksReady`,
            because the gate reports false off an empty pre-fetch `tracks`.
          */}
          <FullProfileBanner userId={userId} done={isFullProfileDone(tracks, tracksReady)} />

          {/*
            `tracksReady` gates the mount: QuestionsFold generates and SAVES a
            pack on open, and that pack is then served from cache until it is
            exhausted. A mount before tracks land would read as an incomplete
            profile and hand a complete-profile user a bank-only pack to work
            through first.
          */}
          {me && tracksReady ? (
            <QuestionsFold
              me={me}
              history={[]}
              onUpdated={refreshAfterAnswer}
              tracks={tracks}
              alwaysOpen
            />
          ) : !me ? (
            <ThemedText themeColor="textSecondary">Loading…</ThemedText>
          ) : null}
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
