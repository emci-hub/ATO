import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FullProfileBanner } from '@/components/full-profile-banner';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { QuestionsFold } from '@/components/questions-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { crisisFlagsForWindow } from '@/lib/crisis/days';
import { isFullProfileDone } from '@/lib/full-profile-gate';
import { useMe } from '@/hooks/use-me';
import { useSession } from '@/hooks/use-session';
import { type TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

/**
 * Questions — where the full profile gets built, and the only screen that can
 * add to it (ISOLATION_PLAN §7 Card D).
 *
 * One surface: `QuestionsFold` — the 50-question bank while it is unfinished,
 * then the rotating 25-item round once it is. Renders `alwaysOpen`
 * (2026-09-15): the bank list is expanded immediately, no collapse header
 * and no tap needed — safe, since the bank is local/no-backend. Its separate
 * "Tell Sage more" 5-item rotation, which CAN reach a paid AI batch once the
 * bank is finished, keeps its own explicit "Tell Sage more" press instead of
 * loading with the rest — an always-open fold has no collapse-header tap left
 * to gate it, so it needs one of its own or it would auto-load with no press
 * behind it, exactly the bug ISOLATION_PLAN §7 Card D removed hours earlier
 * the same day (emci, after review caught the regression here). The 25-item
 * round is separately behind its own "Next 25 questions" press, unaffected.
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
  // Every "answer questions about X" CTA in the app deep-links here with
  // `?axis=`. It is a routing hint for the fold's next load, not an auto-load:
  // opening the fold is what loads (Card D).
  const params = useLocalSearchParams<{ axis?: string }>();
  const focusAxis = (TRAIT_AXES as readonly string[]).includes(params.axis ?? '')
    ? (params.axis as TraitAxis)
    : undefined;
  const [crisisToday, setCrisisToday] = useState(false);
  const [flagsReady, setFlagsReady] = useState(false);
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [tracksReady, setTracksReady] = useState(false);

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
          {me && flagsReady && tracksReady ? (
            <QuestionsFold
              me={me}
              history={[]}
              crisisToday={crisisToday}
              onUpdated={refreshAfterAnswer}
              focusAxis={focusAxis}
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
