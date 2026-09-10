import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { CategoryId } from '@/lib/categories';
import { fetchStatementHistory, type CategoryStatement } from '@/lib/category-statements/store';

type LoadState = { status: 'idle' } | { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * One category's own archive fold (core loop redesign §6 — 11 separate
 * folds, not a combined view; `fetchStatementHistory` is called once per
 * fold, not once for all 11 combined). Same collapsed-by-default,
 * lazy-load-on-open pattern as RollHistoryFold/LegendHistoryFold, excludes
 * the currently-shown statement (the "superseded_at is null" row, already
 * displayed above this fold). `refreshSignal` (bump it after a successful
 * regenerate) forces a refetch if the fold was already opened before that
 * write happened — otherwise the lazy-load-once cache shows a stale list
 * until the screen remounts.
 */
export function CategoryStatementArchiveFold({
  userId,
  categoryId,
  refreshSignal,
  title,
  emptyCopy,
}: {
  userId: string;
  categoryId: CategoryId;
  refreshSignal: number;
  title: string;
  emptyCopy: string;
}) {
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [rows, setRows] = useState<CategoryStatement[]>([]);
  const lastRefreshSignal = useRef(refreshSignal);

  async function fetchHistory(force = false) {
    if (!force && load.status !== 'idle') return;
    setLoad({ status: 'loading' });
    try {
      const history = await fetchStatementHistory(userId, categoryId);
      setRows(history.filter((row) => row.supersededAt != null));
      setLoad({ status: 'ready' });
    } catch (err) {
      console.log('[category-statement-archive] fetch error:', err);
      setLoad({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not load past statements.',
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
        {load.status === 'ready' && rows.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {emptyCopy}
          </ThemedText>
        ) : null}
        {load.status === 'ready'
          ? rows.map((row) => (
              <View key={row.id} style={styles.item}>
                <ThemedText type="code" themeColor="textSecondary">
                  {formatCreatedAt(row.createdAt)}
                </ThemedText>
                <ThemedText type="small">{row.statement}</ThemedText>
              </View>
            ))
          : null}
      </View>
    </SettingsFold>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  item: {
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.8,
  },
});
