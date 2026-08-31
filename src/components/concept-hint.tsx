import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CONCEPT_COPY_REVIEWED } from '@/lib/concept-explainers';

/**
 * Small tap-to-reveal for what a concept generally means.
 * Separate from personalized pole / band copy.
 */
export function ConceptHint({
  explainer,
  children,
  label,
}: {
  explainer: string;
  children: ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {children}
        <Pressable
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={`What ${label} means`}
          accessibilityHint={open ? 'Hide the explainer' : 'Show a plain-language explainer'}
          hitSlop={8}
          style={({ pressed }) => [styles.mark, pressed && styles.pressed]}>
          <ThemedText type="code" themeColor="textSecondary">
            ?
          </ThemedText>
        </Pressable>
      </View>
      {open ? (
        <View style={styles.body}>
          <ThemedText type="small" themeColor="textSecondary">
            {explainer}
          </ThemedText>
          {!CONCEPT_COPY_REVIEWED ? (
            <ThemedText type="code" themeColor="textSecondary">
              Draft copy — waiting on emci review.
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  mark: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  body: {
    gap: Spacing.half,
    paddingLeft: Spacing.one,
  },
});
