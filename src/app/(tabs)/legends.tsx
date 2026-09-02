import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegendCard } from '@/components/legend-card';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMeContext } from '@/lib/me-context';
import { fetchLegendCatalog, fetchSeenLegendIds, logShownLegends } from '@/lib/legends/store';
import { buildLegendView, type LegendView } from '@/lib/legends/match';
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
  attr: {
    paddingBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
});
