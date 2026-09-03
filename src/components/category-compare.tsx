import { StyleSheet, View } from 'react-native';

import { ConceptHint } from '@/components/concept-hint';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getCategoryDefs, type CategoryId } from '@/lib/categories';
import { categoryConcept, CONCEPT_COPY_REVIEWED } from '@/lib/concept-explainers';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import type { CategoryCopy } from '@/lib/sage-title';

export function CategoryCompactCard({
  id,
  copy,
  empty,
}: {
  id: CategoryId;
  copy: CategoryCopy | undefined;
  empty?: string;
}) {
  const def = getCategoryDefs().find((row) => row.id === id);
  if (!def) return null;
  return (
    <View style={styles.card}>
      <ConceptHint explainer={categoryConcept(id)} label={def.name}>
        <ThemedText type="smallBold">{def.name}</ThemedText>
      </ConceptHint>
      <ThemedText type="small" themeColor="textSecondary">
        {copy?.line ?? empty ?? 'Not showing yet.'}
      </ThemedText>
      {!CONCEPT_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
        <ThemedText type="code" themeColor="textSecondary">
          Draft copy — waiting on emci review.
        </ThemedText>
      ) : null}
    </View>
  );
}

export function CategoryCompareRow({
  id,
  mine,
  theirs,
}: {
  id: CategoryId;
  mine: CategoryCopy | undefined;
  theirs: CategoryCopy | undefined;
}) {
  return (
    <View style={styles.compare}>
      <View style={styles.col}>
        <ThemedText type="code" themeColor="textSecondary">
          You
        </ThemedText>
        <CategoryCompactCard id={id} copy={mine} />
      </View>
      <View style={styles.col}>
        <ThemedText type="code" themeColor="textSecondary">
          Them
        </ThemedText>
        <CategoryCompactCard id={id} copy={theirs} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.half,
  },
  compare: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  col: {
    flex: 1,
    gap: Spacing.half,
  },
});
