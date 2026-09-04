import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegendCard } from '@/components/legend-card';
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
import { supabase } from '@/lib/supabase';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import {
  isProfileSettled,
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
  const { me } = useMeContext();
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
  // Profile-completeness gate, same rule as Explore observations / Sage Title /
  // Sage insight: every axis must be settled before a matched legend shows.
  // Checked only once tracks have loaded, so the screen doesn't flash locked
  // before it knows better. Matching itself stays untouched (static pool, no
  // spend) — this only decides what renders.
  const locked = tracksReady && !isProfileSettled(tracks);

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
                onPress={() => {
                  if (focusAxis) {
                    router.push({ pathname: '/intake-sweep', params: { axis: focusAxis } });
                  } else {
                    router.push({ pathname: '/intake-sweep' });
                  }
                }}
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
                  disabled={!focusAxis}
                  onPress={() => {
                    if (focusAxis) {
                      router.push({ pathname: '/intake-sweep', params: { axis: focusAxis } });
                    }
                  }}
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
