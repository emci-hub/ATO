import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { archetypeName, type LegendSkin } from '@/lib/legends64/archetypes';
import { fetchGenerationHistory, LEGEND_HISTORY_VISIBLE_COUNT, type LegendGeneration } from '@/lib/legends64/store';

type LoadState = { status: 'idle' } | { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Legends archive (core loop redesign §6) — same collapsed-by-default,
 * lazy-load-on-open pattern as RollHistoryFold (roll-history-fold.tsx),
 * duplicated rather than generalized since legend_generations has its own
 * row shape (archetype_code + story, no roll item type/category). Latest
 * LEGEND_HISTORY_VISIBLE_COUNT rows always visible; the rest behind
 * "Show earlier."
 *
 * `excludeId` drops the currently-shown generation from this list — without
 * it, the story already visible on the LegendCard above would also appear
 * as the first archive row, since the archive is the same table's full
 * history including the newest write. `refreshSignal` (bump it after any
 * successful generate/reroll) forces a refetch if the fold was already
 * opened before that write happened — the lazy-load-once cache would
 * otherwise show a stale list until the screen remounts.
 */
export function LegendHistoryFold({
  userId,
  excludeId,
  skin,
  refreshSignal,
  title,
  emptyCopy,
}: {
  userId: string;
  excludeId: string | null;
  skin: LegendSkin;
  refreshSignal: number;
  title: string;
  emptyCopy: string;
}) {
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [rows, setRows] = useState<LegendGeneration[]>([]);
  const [expanded, setExpanded] = useState(false);
  const lastRefreshSignal = useRef(refreshSignal);

  async function fetchHistory(force = false) {
    if (!force && load.status !== 'idle') return;
    setLoad({ status: 'loading' });
    try {
      const history = await fetchGenerationHistory(userId);
      setRows(history);
      setLoad({ status: 'ready' });
    } catch (err) {
      console.log('[legend-history] fetch error:', err);
      setLoad({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not load your history.',
      });
    }
  }

  useEffect(() => {
    if (refreshSignal === lastRefreshSignal.current) return;
    lastRefreshSignal.current = refreshSignal;
    if (load.status === 'idle') return; // never opened yet — nothing stale to refresh
    void fetchHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const withoutCurrent = excludeId ? rows.filter((row) => row.id !== excludeId) : rows;
  const visible = expanded ? withoutCurrent : withoutCurrent.slice(0, LEGEND_HISTORY_VISIBLE_COUNT);
  const hasMore = withoutCurrent.length > LEGEND_HISTORY_VISIBLE_COUNT;

  return (
    <SettingsFold title={title} onOpen={() => void fetchHistory()}>
      <View style={styles.body}>
        {load.status === 'loading' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Loading…
          </ThemedText>
        ) : null}
        {load.status === 'error' ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {load.message}
            </ThemedText>
            <Pressable onPress={() => void fetchHistory(true)} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="link">Try again</ThemedText>
            </Pressable>
          </>
        ) : null}
        {load.status === 'ready' && withoutCurrent.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {emptyCopy}
          </ThemedText>
        ) : null}
        {load.status === 'ready'
          ? visible.map((row) => (
              <View key={row.id} style={styles.item}>
                <ThemedText type="code" themeColor="textSecondary">
                  {archetypeName(row.archetypeCode, skin) ?? row.archetypeCode} ·{' '}
                  {formatGeneratedAt(row.generatedAt)}
                </ThemedText>
                <ThemedText type="small">{row.story}</ThemedText>
              </View>
            ))
          : null}
        {load.status === 'ready' && hasMore ? (
          <Pressable onPress={() => setExpanded((value) => !value)} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="link">{expanded ? 'Show fewer' : 'Show earlier'}</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </SettingsFold>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  item: {
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
