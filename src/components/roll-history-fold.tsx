import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { itemTitle, RollItemBody } from '@/components/roll-item-body';
import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCategoryDefs } from '@/lib/category-catalog';
import { fetchRevealedRollItems, type StoredRollItem } from '@/lib/rolls/store';
import { rollItemResultIsReady } from '@/lib/rolls/results';
import type { RollItemType } from '@/lib/rolls/compose';

type LoadState = { status: 'idle' } | { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

function formatRevealedAt(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Trait-system redesign §8 — history/archive views. A collapsed-by-default
 * fold (same SettingsFold every other Explore/Home section already uses)
 * listing every past-revealed roll item of the given type(s), across all
 * rolls. Loads lazily on first open (onOpen), not on mount — most visits to
 * Explore/Home never open this, so there is no reason to query it eagerly.
 */
export function RollHistoryFold({
  userId,
  types,
  title,
  emptyCopy,
}: {
  userId: string;
  types: readonly RollItemType[];
  title: string;
  emptyCopy: string;
}) {
  const categoryDefs = useCategoryDefs();
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [items, setItems] = useState<StoredRollItem[]>([]);

  async function fetchHistory(force = false) {
    if (!force && load.status !== 'idle') return;
    setLoad({ status: 'loading' });
    try {
      const rows = await fetchRevealedRollItems(userId, types);
      // Defensive against a row revealed before wave47's ready-gate existed
      // (a dev-only path today, but a crash here shouldn't be possible for
      // any row) — RollItemBody assumes a ready legend result always has
      // archetypeCode/story attached (core loop redesign §4, T-15), which
      // only holds for rows that were actually ready when revealed.
      setItems(rows.filter((row) => rollItemResultIsReady(row.result)));
      setLoad({ status: 'ready' });
    } catch (err) {
      console.log('[roll-history] fetch error:', err);
      setLoad({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not load your history.',
      });
    }
  }

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
        {load.status === 'ready' && items.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {emptyCopy}
          </ThemedText>
        ) : null}
        {load.status === 'ready'
          ? items.map((item) => (
              <View key={item.id} style={styles.item}>
                <ThemedText type="code" themeColor="textSecondary">
                  {itemTitle(item, categoryDefs)} · {formatRevealedAt(item.revealedAt)}
                </ThemedText>
                <RollItemBody item={item} />
              </View>
            ))
          : null}
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
