import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Appear } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { useTheme } from '@/hooks/use-theme';
import type { SpectrumRow } from '@/lib/insights-spectrum';
import { BAR_FILL, EASE_OUT } from '@/lib/motion-tokens';
import { controlBorderColor } from '@/lib/theme/chrome';

const KNOB = 20;
const TRACK = 8;

/**
 * One axis as a position between its two poles (PHASE-09). Neither end is
 * "good" or "bad": both poles use the same colour and plain labels. The soft
 * band behind the knob is how settled the axis is (wider = still settling).
 * The fill runs 0 → value over 1 s with a springy knob, staggered 150 ms per
 * row. Reduce Motion: no travel, the row is simply there (Appear cross-fades).
 * Read-only; VoiceOver speaks the position in words.
 */
export function SpectrumSlider({
  row,
  index,
  forceReduceMotion = false,
}: {
  row: SpectrumRow;
  index: number;
  forceReduceMotion?: boolean;
}) {
  const theme = useTheme();
  const rm = useMotionReduced(forceReduceMotion);
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(rm ? 1 : 0);
  const knob = useSharedValue(rm ? 1 : 0);

  useEffect(() => {
    if (rm || width === 0) {
      cancelAnimation(fill);
      cancelAnimation(knob);
      fill.value = 1;
      knob.value = 1;
      return;
    }
    const delay = index * BAR_FILL.sliderStaggerMs;
    fill.value = 0;
    knob.value = 0;
    fill.value = withDelay(delay, withTiming(1, { duration: BAR_FILL.durationMs, easing: EASE_OUT }));
    knob.value = withDelay(delay, withSpring(1, BAR_FILL.knobSpring));
    return () => {
      cancelAnimation(fill);
      cancelAnimation(knob);
    };
  }, [rm, width, index, row.value, fill, knob]);

  const fillStyle = useAnimatedStyle(() => ({ width: fill.value * row.value * width }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knob.value * row.value * width - KNOB / 2 }],
  }));
  const bandLeft = row.bandLow * width;
  const bandWidth = Math.max(0, (row.bandHigh - row.bandLow) * width);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <Appear index={index}>
      <View
        accessible
        accessibilityLabel={row.name}
        accessibilityValue={{ text: row.spoken }}
        testID={`spectrum-${row.axis}`}
        style={styles.row}>
        <ThemedText type="smallBold">{row.name}</ThemedText>
        <View style={styles.trackBox} onLayout={onLayout}>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected, borderColor: controlBorderColor(theme) }]} />
          <View
            style={[styles.band, { left: bandLeft, width: bandWidth, backgroundColor: theme.accent }]}
            importantForAccessibility="no"
          />
          <Animated.View style={[styles.fill, { backgroundColor: theme.accent }, fillStyle]} />
          <Animated.View style={[styles.knob, { backgroundColor: theme.accent, borderColor: theme.background }, knobStyle]} />
        </View>
        <View style={styles.poles}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.pole}>
            {row.lowLabel}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={[styles.pole, styles.poleRight]}>
            {row.highLabel}
          </ThemedText>
        </View>
      </View>
    </Appear>
  );
}

/** "Where you lean": the top rows in one card. Nothing when no axis leans clearly yet. */
export function SpectrumSection({ rows }: { rows: readonly SpectrumRow[] }) {
  const theme = useTheme();
  if (rows.length === 0) return null;
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: controlBorderColor(theme) }]}
      testID="spectrum-section">
      <View accessibilityRole="header">
        <ThemedText type="subheading">Where you lean</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Both ends are just different ways to be. The soft band shows how settled it is.
      </ThemedText>
      {rows.map((row, i) => (
        <SpectrumSlider key={row.axis} row={row} index={i} />
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: { gap: Spacing.one, paddingVertical: Spacing.one },
  trackBox: { height: KNOB + 4, justifyContent: 'center' },
  track: { height: TRACK, borderRadius: TRACK / 2, borderWidth: StyleSheet.hairlineWidth },
  band: { position: 'absolute', height: KNOB, borderRadius: KNOB / 2, opacity: 0.18 },
  fill: { position: 'absolute', left: 0, height: TRACK, borderRadius: TRACK / 2, opacity: 0.55 },
  knob: {
    position: 'absolute',
    left: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    borderWidth: 2,
  },
  poles: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  pole: { flex: 1 },
  poleRight: { textAlign: 'right' },
});
