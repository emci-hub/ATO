import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TraitShape } from '@/components/trait-shape';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Me } from '@/lib/me';
import {
  SHAPE_CAPTION,
  SHAPE_EMPTY_BUTTON,
  SHAPE_EMPTY_LINE,
  SHAPE_EMPTY_TITLE,
  SHAPE_TAP_HINT,
  SHAPE_TITLE,
} from '@/lib/polish-copy';
import { shapedByRow, YOUR_SIDE_LEAD } from '@/lib/shaped-by';
import { shapeFilledCount, traitShapePoints } from '@/lib/trait-shape';
import type { TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';

/**
 * The Explore hero: "your shape" large, with trait names round the edge. Tap a
 * point to see which trait it is and which end you lean to (the same words as
 * the full profile). Before any answer it is the blank-shape empty state with
 * one button to Questions. No model call.
 */
export function ShapeCard({
  me,
  tracks,
  settledLabel,
  onPressSettled,
}: {
  me: Me;
  tracks: readonly TraitTrack[];
  /** "N of 16 settled", tappable through to Questions. */
  settledLabel?: string;
  onPressSettled?: () => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<TraitAxis | null>(null);
  const points = traitShapePoints(me, tracks);
  const filled = shapeFilledCount(points);
  // Screen gutter (2 × 24) + card padding (2 × 16).
  const size = Math.min(Math.min(width, MaxContentWidth) - 80, 340);

  if (filled === 0) return <ShapeEmptyCard />;

  const detail = selected ? shapedByRow(selected, tracks) : null;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.head}>
        <ThemedText type="smallBold">{SHAPE_TITLE}</ThemedText>
        {settledLabel ? (
          <ThemedPressable
            accessibilityRole="button"
            accessibilityLabel={`${settledLabel}. Tap to answer more.`}
            onPress={onPressSettled}>
            <ThemedText type="code" themeColor="textSecondary">
              {settledLabel}
            </ThemedText>
          </ThemedPressable>
        ) : null}
      </View>
      <View style={styles.center}>
        <TraitShape
          points={points}
          size={size}
          labels
          selected={selected}
          onPressAxis={(axis) => setSelected((cur) => (cur === axis ? null : axis))}
        />
      </View>
      {detail ? (
        <ThemedView type="background" style={[styles.detail, { borderRadius: Math.min(theme.radius, 14) }]}>
          <ThemedText type="smallBold">
            {detail.label}
            {detail.poleName ? ` · ${YOUR_SIDE_LEAD} ${detail.poleName}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {detail.poleName ? `“${detail.line}”` : detail.line}
          </ThemedText>
        </ThemedView>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
          {SHAPE_TAP_HINT}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
        {SHAPE_CAPTION}
      </ThemedText>
    </ThemedView>
  );
}

/** Before the first answer: a blank shape and one way forward. */
export function ShapeEmptyCard() {
  const theme = useTheme();
  const points = traitShapePoints(null, []);
  return (
    <ThemedView type="backgroundElement" style={[styles.card, styles.emptyCard]}>
      <TraitShape points={points} size={104} />
      <ThemedText type="smallBold">{SHAPE_EMPTY_TITLE}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
        {SHAPE_EMPTY_LINE}
      </ThemedText>
      <ThemedPressable
        filled
        accessibilityRole="button"
        onPress={() => router.push('/intake-sweep')}
        style={[styles.emptyButton, { borderRadius: theme.cutCorners ? 0 : 999 }]}>
        <ThemedText type="smallBold" themeColor="onAccent">
          {SHAPE_EMPTY_BUTTON}
        </ThemedText>
      </ThemedPressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
  },
  detail: {
    padding: Spacing.two + Spacing.one,
    gap: Spacing.half,
  },
  caption: {
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  emptyButton: {
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.one,
  },
});
