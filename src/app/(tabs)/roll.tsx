import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { itemTitle, RollItemBody } from '@/components/roll-item-body';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMeContext } from '@/lib/me-context';
import { useCategoryDefs } from '@/lib/category-catalog';
import { rollEligible, rollItemPrice } from '@/lib/rolls/compose';
import {
  fetchLastRollSnapshot,
  fetchLatestRollId,
  fetchRollItems,
  revealRollItem,
  type StoredRollItem,
} from '@/lib/rolls/store';
import { runRoll, type RunRollOutcome } from '@/lib/rolls/run';
import { rollItemResultIsReady } from '@/lib/rolls/results';
import { TOKEN_LABEL, tokenBalanceOf } from '@/lib/tokens';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { traitStateFromRow } from '@/lib/traits';

type ScreenState =
  | { status: 'loading' }
  | { status: 'idle' }
  | { status: 'rolling' }
  | { status: 'items'; rollId: string; items: StoredRollItem[] }
  | { status: 'outcome'; outcome: Exclude<RunRollOutcome, { kind: 'stored' }> }
  | { status: 'error'; message: string };

/**
 * Trait-system redesign §7 — the roll/reveal screen. Reached from Legends
 * once legendsUnlocked (the roll's legend item needs the same match data).
 *
 * It IS a `(tabs)` route (never a bar destination), so it needs a hidden
 * `TabTrigger` inside `TabList` to be navigable at all — see
 * `HIDDEN_TAB_ROUTES` in `components/app-tabs.tsx`. It shipped without one,
 * behind an `as Href` cast that hid the gap from typecheck. Do not "simplify"
 * that trigger away.
 */
export default function RollScreen() {
  const { me, refresh } = useMeContext();
  const categoryDefs = useCategoryDefs();
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [tracksReady, setTracksReady] = useState(false);
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [eligible, setEligible] = useState(false);
  const [eligibleReady, setEligibleReady] = useState(false);
  const [revealBusyId, setRevealBusyId] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const loadedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!me?.id) return;
    let cancelled = false;
    setTracksReady(false);
    fetchTraitTracks(me.id)
      .then((rows) => {
        if (cancelled) return;
        setTracks(rows);
        setTracksReady(true);
      })
      .catch((err) => {
        console.log('[roll] tracks error:', err);
        if (!cancelled) setTracksReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [me?.id, me?.updated_at]);

  // Recomputes eligibility whenever tracks change, but — unlike the
  // mount-once loader below — never touches `state`: a token refresh or a
  // tracks refetch while a roll's items are on screen must not silently
  // discard them back to an idle/error screen (found in review: the first
  // version's single combined effect did exactly that).
  useEffect(() => {
    if (!me?.id || !tracksReady) return;
    let cancelled = false;
    setEligibleReady(false);
    fetchLastRollSnapshot(me.id)
      .then((snapshot) => {
        if (cancelled) return;
        setEligible(rollEligible(tracks, snapshot));
        setEligibleReady(true);
      })
      .catch((err) => {
        console.log('[roll] snapshot error:', err);
        // Leave eligibleReady false rather than silently locking Roll out
        // forever on a transient failure — the "still loading" copy stays
        // up instead of falsely reading "nothing new to roll."
      });
    return () => {
      cancelled = true;
    };
  }, [me?.id, tracksReady, tracks]);

  async function loadItems(rollId: string) {
    try {
      const items = await fetchRollItems(rollId);
      setState({ status: 'items', rollId, items });
    } catch (err) {
      console.log('[roll] fetchRollItems error:', err);
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not load your roll.',
      });
    }
  }

  // Runs once per signed-in user (not on every tracks/refresh change) so a
  // reload or leaving-and-returning restores the last roll's items instead
  // of landing on an idle screen with no way back to what was already paid
  // for (found in review: runRoll's outcome was the only path that ever
  // called loadItems, so a reveal followed by a reload made that item's
  // content unreachable even though it was still sitting in trait_rolls).
  useEffect(() => {
    if (!me?.id || !tracksReady || loadedForUserRef.current === me.id) return;
    loadedForUserRef.current = me.id;
    let cancelled = false;
    fetchLatestRollId(me.id)
      .then((rollId) => {
        if (cancelled) return;
        if (rollId) {
          void loadItems(rollId);
        } else {
          setState({ status: 'idle' });
        }
      })
      .catch((err) => {
        console.log('[roll] fetchLatestRollId error:', err);
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load your roll history.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [me?.id, tracksReady]);

  async function onRoll() {
    if (!me?.id) return;
    setState({ status: 'rolling' });
    try {
      const values = traitStateFromRow(me).values;
      const outcome = await runRoll(me.id, tracks, values);
      if (outcome.kind === 'stored') {
        await loadItems(outcome.rollId);
      } else {
        setState({ status: 'outcome', outcome });
      }
    } catch (err) {
      console.log('[roll] runRoll error:', err);
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not run your roll.',
      });
    }
  }

  async function onReveal(item: StoredRollItem) {
    if (revealBusyId) return;
    setRevealBusyId(item.id);
    setRevealError(null);
    try {
      const result = await revealRollItem(item.id);
      if (!result.ok) {
        setRevealError(
          result.reason === 'not_ready'
            ? 'This one is still forming — nothing to reveal yet.'
            : result.reason === 'insufficient'
              ? `Not enough ${TOKEN_LABEL.toLowerCase()} to reveal this.`
              : `Could not reveal that (${result.reason ?? 'unknown reason'}).`,
        );
        return;
      }
      const revealedAt = result.revealedAt ?? new Date().toISOString();
      setState((prev) =>
        prev.status === 'items'
          ? {
              status: 'items',
              rollId: prev.rollId,
              items: prev.items.map((row) => (row.id === item.id ? { ...row, revealedAt } : row)),
            }
          : prev,
      );
      await refresh();
    } catch (err) {
      console.log('[roll] revealRollItem error:', err);
      setRevealError(err instanceof Error ? err.message : 'Could not reveal that.');
    } finally {
      setRevealBusyId(null);
    }
  }

  const balance = me ? tokenBalanceOf(me) : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView {...NO_PINCH_ZOOM} contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            {/*
              Roll is pushed from Legends but lives under `(tabs)`, so it keeps
              the bottom bar and no slot highlights for it. Without this row the
              only way out is tapping some other tab — every other pushed screen
              (chat/week/dawn/ai-lab) offers an explicit Back. Falls back to
              Legends when there is no history (cold-start deep link).
            */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Legends"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/legends'))}
              hitSlop={12}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                ‹ Back
              </ThemedText>
            </Pressable>
            <ThemedText type="subtitle">Roll</ThemedText>
            <ThemedText themeColor="textSecondary">
              A fresh read across your legend, every category, and your story — spend{' '}
              {TOKEN_LABEL.toLowerCase()} to reveal each one.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {balance} {TOKEN_LABEL.toLowerCase()} available
            </ThemedText>
          </View>

          {state.status === 'loading' || state.status === 'rolling' ? (
            <ThemedText themeColor="textSecondary">
              {state.status === 'rolling' ? 'Rolling…' : 'Loading…'}
            </ThemedText>
          ) : null}

          {state.status === 'error' ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText>Something went wrong.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {state.message}
              </ThemedText>
            </ThemedView>
          ) : null}

          {(state.status === 'idle' || state.status === 'items') && eligibleReady ? (
            eligible ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Roll"
                onPress={onRoll}
                style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                <ThemedText type="link">{state.status === 'items' ? 'Roll again' : 'Roll'}</ThemedText>
              </Pressable>
            ) : state.status === 'idle' ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">Nothing new to roll yet.</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Your traits haven&apos;t shifted enough since your last roll. Keep checking in and answering
                  questions — a roll unlocks again once something real changes.
                </ThemedText>
              </ThemedView>
            ) : null
          ) : null}

          {state.status === 'outcome' && state.outcome.kind === 'not_eligible' ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Nothing new to roll yet.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Your traits haven&apos;t shifted enough since your last roll.
              </ThemedText>
            </ThemedView>
          ) : null}

          {state.status === 'outcome' && state.outcome.kind === 'quota' ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Out of rolls for today.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {state.outcome.daily} of {state.outcome.dailyCap} used today. Come back tomorrow.
              </ThemedText>
            </ThemedView>
          ) : null}

          {state.status === 'outcome' && state.outcome.kind === 'error' ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Could not run that roll.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {state.outcome.message}
              </ThemedText>
            </ThemedView>
          ) : null}

          {state.status === 'items' ? (
            <>
              {revealError ? (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="small">{revealError}</ThemedText>
                </ThemedView>
              ) : null}
              {state.items.map((item) => {
                const ready = rollItemResultIsReady(item.result);
                const revealed = Boolean(item.revealedAt);
                const price = rollItemPrice(item.type);
                const title = itemTitle(item, categoryDefs);

                return (
                  <ThemedView key={item.id} type="backgroundElement" style={styles.card}>
                    <ThemedText type="code" themeColor="textSecondary">
                      {title}
                    </ThemedText>

                    {!ready ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Still forming — not enough here yet to read.
                      </ThemedText>
                    ) : revealed ? (
                      <RollItemBody item={item} />
                    ) : balance < price ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Needs {price} {TOKEN_LABEL.toLowerCase()} — check in or play to earn more.
                      </ThemedText>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Reveal ${title} for ${price} ${TOKEN_LABEL.toLowerCase()}`}
                        disabled={revealBusyId === item.id}
                        onPress={() => onReveal(item)}
                        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                        <ThemedText type="link">
                          {revealBusyId === item.id ? 'Revealing…' : `Reveal · ${price} ${TOKEN_LABEL.toLowerCase()}`}
                        </ThemedText>
                      </Pressable>
                    )}
                  </ThemedView>
                );
              })}
            </>
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
  scroll: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    gap: Spacing.half,
    paddingRight: NAV_PIXEL_HEADER_INSET,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
