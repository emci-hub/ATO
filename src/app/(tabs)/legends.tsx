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
  DEV_ARCHETYPE_PRESETS,
  DEV_TEST_USER_ID,
  devPresetById,
  type DevArchetypePresetId,
} from '@/lib/dev-test-user';
import { fetchLegendCatalog, fetchSeenLegendIds, logShownLegends } from '@/lib/legends/store';
import { buildLegendView, type LegendView } from '@/lib/legends/match';
import { supabase } from '@/lib/supabase';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';

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
  return 'Nothing here yet. Once enough of your traits have settled, a legend that matches you will show up here.';
}

/**
 * Dev-testing strip for the fixed dev-test user (@atodev), __DEV__ only.
 * Applies one of the 4 legend-archetype trait presets and clears the user's
 * seen-legend history so the matching card re-appears immediately. Never
 * renders for a real account — their traits cannot be overwritten from here.
 */
function DevTestPresetStrip() {
  const theme = useTheme();
  const { refresh } = useMeContext();
  const [isDevUser, setIsDevUser] = useState(false);
  const [busyId, setBusyId] = useState<DevArchetypePresetId | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!__DEV__) return;
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

  if (!__DEV__ || !isDevUser) return null;

  async function applyPreset(id: DevArchetypePresetId) {
    if (busyId) return;
    setBusyId(id);
    setNote(null);
    try {
      await applyDevArchetypePreset(id);
      await refresh();
      const preset = devPresetById(id);
      setNote(preset ? `Preset applied — now matching ${preset.legendName}.` : 'Preset applied.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not apply the preset.');
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
 * story. Every legend shown is logged to user_legend_history (never repeats).
 */
export default function LegendsScreen() {
  const { me } = useMeContext();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [retryTick, setRetryTick] = useState(0);

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
        const seen = await fetchSeenLegendIds(me.id);
        const view = buildLegendView(catalog, me, seen);
        if (cancelled) return;
        setLoad({ status: 'ready', view });
        if (view.cards.length > 0) {
          void logShownLegends(
            me.id,
            view.cards.map((card) => card.legend.id),
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

          {ready ? (
            ready.cards.length > 0 ? (
              ready.cards.map((card) => (
                <LegendCard
                  key={card.legend.id}
                  legend={card.legend}
                  archetype={card.archetype}
                />
              ))
            ) : (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText>{emptyCopy(ready)}</ThemedText>
              </ThemedView>
            )
          ) : null}

          <DevTestPresetStrip />

          <ThemedText type="small" themeColor="textSecondary" style={styles.attr}>
            Matched to your traits, never a diagnosis. A legend never repeats.
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
