import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CATEGORY_COPY_REVIEWED, readAllCategories, type CategoryId } from '@/lib/categories';
import { parseSageTitle, type CategoryCopy } from '@/lib/sage-title';
import type { Me } from '@/lib/me';
import type { TraitTrack } from '@/lib/trait-stability';

/**
 * Compact pinned summary of today's category copy on Explore.
 * Story and generated observations sit below this and must not restate it.
 */
export function ExplorePinnedCategories({
  me,
  tracks,
}: {
  me: Me;
  tracks: readonly TraitTrack[];
}) {
  const cached = parseSageTitle(me.sage_title);
  const ready = readAllCategories(tracks).filter((row) => row.ready);
  if (ready.length === 0) return null;

  const rows: Array<{ id: CategoryId; name: string; line: string }> = [];
  for (const reading of ready) {
    const copy: CategoryCopy | undefined = cached?.categories[reading.def.id];
    const line = copy?.line?.trim();
    if (!line) continue;
    rows.push({ id: reading.def.id, name: reading.def.name, line });
  }
  if (rows.length === 0) return null;

  return (
    <View style={styles.block} testID="explore-pinned-categories">
      <ThemedText type="smallBold">Categories</ThemedText>
      {!CATEGORY_COPY_REVIEWED ? (
        <ThemedText type="code" themeColor="textSecondary">
          Draft copy — waiting on emci review.
        </ThemedText>
      ) : null}
      {rows.map((row) => (
        <View key={row.id} style={styles.row}>
          <ThemedText type="smallBold">{row.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {row.line}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.one,
    paddingBottom: Spacing.two,
  },
  row: {
    gap: Spacing.half,
  },
});
