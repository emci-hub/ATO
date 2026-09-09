import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegendCard } from '@/components/legend-card';
import { MilestoneToast } from '@/components/milestone-toast';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMeContext } from '@/lib/me-context';
import {
  applyDevArchetypePreset,
  applyDevThinProfilePreset,
  DEV_ARCHETYPE_PRESETS,
  DEV_TEST_USER_ID,
  devPresetById,
  type DevArchetypePresetId,
} from '@/lib/dev-test-user';
import { fetchLegendCatalog, fetchSeenVariantIds, logShownVariants } from '@/lib/legends/store';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { buildLegendView, type LegendView } from '@/lib/legends/match';
import { persistCelebratedMilestones } from '@/lib/me';
import { checkMilestones, type MilestoneDef } from '@/lib/milestones';
import { bankTotalProgress } from '@/lib/questions/local';
import { legendsUnlocked } from '@/lib/questions/progressive-unlock';
import { claimFullProfileComplete } from '@/lib/ato-tokens-server';
import { supabase } from '@/lib/supabase';
import { useAppearance } from '@/lib/theme/context';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import {
  isThinProfile,
  missingAxis,
  PROFILE_LOCKED_COPY,
  PROFILE_LOCKED_CTA,
  settledCount,
  type TraitTrack,
} from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { traitStateFromRow } from '@/lib/traits';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; view: LegendView }
  | { status: 'error'; message: string };

function emptyCopy(view: LegendView): string {
  if (!view.hasCatalog) {
    return 'No legends here yet. More stories are being gathered.';
  }
  if (view.anyMatchedArchetype) {
    return 'You have seen every legend that fits you so far. New ones appear as your matches shift.';
  }
  return 'Nothing here yet. New legends appear as your matches shift.';
}

/**
 * Dev-testing strip for the fixed dev-test user (@atodev), __DEV__ only.
 * Applies one of the 4 legend-archetype trait presets and clears the user's
 * seen-legend history so the matching card re-appears immediately. Never
 * renders for a real account — their traits cannot be overwritten from here.
 */
function DevTestPresetStrip({ onApplied }: { onApplied: () => void }) {
  const theme = useTheme();
  const { refresh } = useMeContext();
  const [isDevUser, setIsDevUser] = useState(false);
  const [busyId, setBusyId] = useState<DevArchetypePresetId | 'thin' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!PRE_LAUNCH_DEV) return;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setIsDevUser(data.user?.id === DEV_TEST_USER_ID);
      })
      .catch(() => {
        // Signed out or network error — keep the strip hidden.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!PRE_LAUNCH_DEV || !isDevUser) return null;

  async function applyPreset(id: DevArchetypePresetId) {
    if (busyId) return;
    setBusyId(id);
    setNote(null);
    try {
      await applyDevArchetypePreset(id);
      await refresh();
      onApplied();
      const preset = devPresetById(id);
      setNote(preset ? `Preset applied — now matching ${preset.legendName}.` : 'Preset applied.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not apply the preset.');
    } finally {
      setBusyId(null);
    }
  }

  async function applyThin() {
    if (busyId) return;
    setBusyId('thin');
    setNote(null);
    try {
      await applyDevThinProfilePreset();
      await refresh();
      onApplied();
      setNote('Thin profile applied — no archetype should match now.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not apply the thin profile.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.presetCard}>
      <ThemedText type="smallBold">Dev · test persona</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Set traits to match a legend&apos;s archetype. Seen history is cleared, so the
        card reloads here.
      </ThemedText>
      <View style={styles.presetRow}>
        {DEV_ARCHETYPE_PRESETS.map((preset) => {
          return (
            <Pressable
              key={preset.id}
              accessibilityRole="button"
              onPress={() => void applyPreset(preset.id)}
              disabled={busyId !== null}
              style={({ pressed }) => [
                styles.presetChip,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{preset.legendName}</ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Or clear the profile entirely — no axis answered, no settled tracks — to
        reach the thin-profile gate below.
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={() => void applyThin()}
        disabled={busyId !== null}
        style={({ pressed }) => [
          styles.presetChip,
          styles.thinChip,
          { backgroundColor: theme.backgroundSelected },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold">Thin profile</ThemedText>
      </Pressable>
      {busyId ? (
        <ThemedText type="small" themeColor="textSecondary">
          Applying…
        </ThemedText>
      ) : note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

/**
 * Legends — stories from history and myth, matched to the archetype(s) the
 * user's trait profile leans toward. Teaser visible, tap to expand the full
 * story. Every story variant shown is logged to user_legend_history; a figure
 * can resurface later through a different variant (never the same one twice).
 */
export default function LegendsScreen() {
  const { me, refresh } = useMeContext();
  const { reduceMotion } = useAppearance();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [retryTick, setRetryTick] = useState(0);
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [tracksReady, setTracksReady] = useState(false);

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
        console.log('[legends] tracks error:', err);
        // Ready with zero tracks reads as a thin profile, which is the honest
        // state when we cannot prove otherwise — better than the bare empty copy.
        if (!cancelled) setTracksReady(true);
      });
    return () => {
      cancelled = true;
    };
    // retryTick so a dev preset (which writes tracks directly, without moving
    // me.updated_at) refetches instead of leaving stale tracks for the mount.
  }, [me?.id, me?.updated_at, retryTick]);

  useEffect(() => {
    if (!me?.id) {
      setLoad({ status: 'loading' });
      return;
    }
    let cancelled = false;
    setLoad({ status: 'loading' });
    (async () => {
      try {
        const catalog = await fetchLegendCatalog();
        const seen = await fetchSeenVariantIds(me.id);
        const view = buildLegendView(catalog, me, seen);
        if (cancelled) return;
        setLoad({ status: 'ready', view });
        if (view.cards.length > 0) {
          void logShownVariants(
            me.id,
            view.cards.map((card) => card.variant.id),
            me.timezone || 'UTC',
          ).catch((err) => console.log('[legends] log shown error:', err));
        }
      } catch (err) {
        console.log('[legends] load error:', err);
        if (!cancelled) {
          setLoad({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load legends.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me, retryTick]);

  const ready = load.status === 'ready' ? load.view : null;
  const settled = settledCount(tracks);
  const thin = isThinProfile(settled);
  const focusAxis = me ? missingAxis(traitStateFromRow(me).values, tracks) : null;
  /**
   * Both "answer questions" CTAs on this screen. `focusAxis` is a nice-to-have
   * (it front-loads that axis in the next batch), never a precondition — the
   * thin-profile CTA below used to be `disabled={!focusAxis}`, which rendered
   * an enabled-looking button that did nothing for exactly the people it was
   * written for. One handler so the two copies cannot drift again.
   */
  function goToQuestions() {
    if (focusAxis) {
      router.push({ pathname: '/intake-sweep', params: { axis: focusAxis } });
    } else {
      router.push({ pathname: '/intake-sweep' });
    }
  }
  // Progressive unlock (§6, retargeted per emci's explicit call): Legends
  // unlocks at question 50 of the frozen intake, REPLACING the prior
  // isProfileSettled gate — the tiered intake alone doesn't satisfy
  // isProfileSettled for every axis (10 of 16 axes only reach 2 intake
  // answers, below the 3-answer stability floor), so that gate would have
  // kept Legends locked past question 50 for most users. Checked only once
  // tracks have loaded, so the screen doesn't flash locked before it knows
  // better. Matching itself stays untouched (static pool, no spend) — this
  // only decides what renders.
  const locked = tracksReady && !legendsUnlocked(tracks);

  // One-time "Legends unlocked!" celebration, on top of `locked` above —
  // now keyed to the SAME bankTotalProgress/50 crossing as `locked` itself,
  // so the toast and the actual tab unlock always fire together. `locked`
  // can genuinely flip false while this screen stays mounted (its
  // tracks-loading effect is keyed on me.updated_at, not just first mount),
  // so this checks on every re-evaluation, not just mount; the persisted
  // celebrated_milestone_ids id (same mechanism every other milestone in
  // this feature uses) is what actually guarantees it never fires twice —
  // the ref only guards the narrow window while that persist request is
  // still in flight.
  const [unlockToast, setUnlockToast] = useState<MilestoneDef | null>(null);
  const celebratingUnlockRef = useRef(false);

  useEffect(() => {
    // tracksReady must gate this too, not just `locked` — `locked` is
    // `tracksReady && !legendsUnlocked(tracks)`, which reads `false` both
    // when genuinely unlocked AND while tracks are still loading (tracksReady
    // starts false). Without this, the celebration would fire — and
    // permanently persist — for every brand-new, unsettled profile during
    // the loading window before the first real tracks fetch resolves.
    if (!me || !tracksReady || locked || celebratingUnlockRef.current) return;
    const celebrated = me.celebrated_milestone_ids ?? [];
    const crossed = checkMilestones('bankTotalProgress', bankTotalProgress(tracks).answered, celebrated)
      .filter((def) => def.id === 'legends_unlocked');
    if (crossed.length === 0) return;
    celebratingUnlockRef.current = true;
    setUnlockToast(crossed[0]!);
    // ATO tokens T-04: award the Full Profile (50-question) completion bonus
    // at the exact same crossing as this celebration. Fire-and-forget — the
    // RPC's own once-ever unique index makes a double-fire harmless, so this
    // never needs to gate on (or retry with) the milestone-persist result.
    claimFullProfileComplete().catch((err) => {
      console.log('[legends] claimFullProfileComplete error:', err);
    });
    persistCelebratedMilestones(me.id, [...celebrated, ...crossed.map((def) => def.id)])
      .then(() => refresh())
      .catch((err) => {
        // Mirror intake-sweep.tsx's backfill effect: if the write failed,
        // celebrated_milestone_ids is still stale server-side, so reset the
        // guard rather than leave this session permanently unable to retry.
        console.log('[legends] persistCelebratedMilestones error:', err);
        celebratingUnlockRef.current = false;
      });
  }, [me, tracksReady, locked, refresh, tracks]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView {...NO_PINCH_ZOOM} contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Legends</ThemedText>
            <ThemedText themeColor="textSecondary">
              Stories of the archetype you match — chosen from how your traits
              actually sit, not a label that sticks.
            </ThemedText>
          </View>

          {ready && tracksReady && !locked ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Roll a fresh read across your legend, categories, and story"
              onPress={() => router.push('/roll')}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
              <ThemedText type="link">Roll</ThemedText>
            </Pressable>
          ) : null}

          {unlockToast ? (
            <MilestoneToast
              key={unlockToast.id}
              title={unlockToast.title}
              body={unlockToast.body}
              reduceMotion={reduceMotion}
              onDone={() => setUnlockToast(null)}
            />
          ) : null}

          {load.status === 'loading' ? (
            <ThemedText themeColor="textSecondary">Loading legends…</ThemedText>
          ) : null}

          {load.status === 'error' ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText>Could not load legends right now.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {load.message}
              </ThemedText>
              <Pressable
                onPress={() => setRetryTick((tick) => tick + 1)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="link">Try again</ThemedText>
              </Pressable>
            </ThemedView>
          ) : null}

          {ready && locked ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{PROFILE_LOCKED_COPY}</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${PROFILE_LOCKED_COPY}. ${PROFILE_LOCKED_CTA}.`}
                onPress={goToQuestions}
                style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                <ThemedText type="link">{PROFILE_LOCKED_CTA}</ThemedText>
              </Pressable>
            </ThemedView>
          ) : ready ? (
            ready.cards.length > 0 ? (
              ready.cards.map((card) => (
                <LegendCard
                  key={card.variant.id}
                  legend={card.variant}
                  archetype={card.archetype}
                />
              ))
            ) : ready.hasCatalog && !ready.anyMatchedArchetype && tracksReady && thin ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">Your profile is still taking shape.</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Answer a few questions so your traits settle, and a legend that fits you
                  will show up here.
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={goToQuestions}
                  style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                  <ThemedText type="link">Answer questions</ThemedText>
                </Pressable>
              </ThemedView>
            ) : (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText>{emptyCopy(ready)}</ThemedText>
              </ThemedView>
            )
          ) : null}

          <DevTestPresetStrip onApplied={() => setRetryTick((tick) => tick + 1)} />

          <ThemedText type="small" themeColor="textSecondary" style={styles.attr}>
            Matched to your traits, never a diagnosis. A story never repeats —
            the same figure can return later with a different one.
          </ThemedText>
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
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  thinChip: {
    alignSelf: 'flex-start',
  },
  presetCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  presetChip: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  attr: {
    paddingBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
});
