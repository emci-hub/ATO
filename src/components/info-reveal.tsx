import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ShapedByRow } from '@/lib/shaped-by';
import { SHAPED_BY_SETTLING } from '@/lib/shaped-by';

/**
 * One quiet row that opens in place: a label and a "?" that expands to show the
 * working behind what is on screen. Same tap-to-reveal as ConceptHint, for
 * content that is more than one sentence.
 *
 * Closed by default and one per card, on purpose. The explanation is for the
 * person who goes looking; it must never sit between someone and the thing
 * they came to read.
 */
export function InfoReveal({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
        accessibilityHint={open ? 'Hide the explanation' : 'Show the explanation'}
        hitSlop={8}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {open ? '–' : '?'}
        </ThemedText>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

/** The trait rows inside a reveal: plain name, the lean, and "still settling" where true. */
export function ShapedByList({ rows }: { rows: readonly ShapedByRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <View key={row.axis} style={styles.item}>
          <ThemedText type="smallBold">
            {row.label}
            {row.lean && !row.settled ? ` · ${SHAPED_BY_SETTLING}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {row.line}
          </ThemedText>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.half,
  },
  body: {
    gap: Spacing.two,
    paddingLeft: Spacing.one,
  },
  item: {
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
