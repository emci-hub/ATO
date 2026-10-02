import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { CHANGE_EMPTY, CHANGE_LABEL, CHANGE_LEDE, traitChanges, type TraitChange } from '@/lib/trait-change';
import { fetchTraitHistory } from '@/lib/trait-history-store';

/**
 * Explore: what actually moved in this person's answers lately. One plain read
 * of `trait_history`, no model call. Hidden while loading or on a failed read —
 * an error box here would be noise on a screen that works without it.
 */
export function ChangeCard({ userId }: { userId: string }) {
  const dataEpoch = useAccountDataEpoch();
  const [changes, setChanges] = useState<TraitChange[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTraitHistory(userId)
      .then((rows) => {
        if (!cancelled) setChanges(traitChanges(rows));
      })
      .catch((err) => {
        console.log('[change-card] history error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, dataEpoch]);

  if (!changes) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{CHANGE_LABEL}</ThemedText>
      {changes.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {CHANGE_EMPTY}
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {CHANGE_LEDE}
          </ThemedText>
          <View style={styles.rows}>
            {changes.map((change) => (
              <ThemedText key={change.axis}>{change.line}</ThemedText>
            ))}
          </View>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  rows: {
    gap: Spacing.one,
  },
});
