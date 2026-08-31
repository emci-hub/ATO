import { StyleSheet, View } from 'react-native';

import { AxisCodeLabel } from '@/components/axis-code-label';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AXIS_EDITOR_COPY } from '@/lib/sage-knows';
import type { CategoryReading } from '@/lib/categories';
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';

export function CategoryVisual({ reading }: { reading: CategoryReading }) {
  if (reading.def.shape === 'map' && reading.map) {
    const xAxis = reading.def.axes[0]!;
    const yAxis = reading.def.axes[1]!;
    return (
      <View style={styles.block}>
        <View style={styles.mapFrame}>
          <View
            style={[
              styles.dot,
              {
                left: `${Math.round(reading.map.x * 100)}%`,
                bottom: `${Math.round(reading.map.y * 100)}%`,
              },
            ]}
          />
        </View>
        <AxisCodeLabel axis={xAxis} name={AXIS_EDITOR_COPY[xAxis].label} />
        <AxisCodeLabel axis={yAxis} name={AXIS_EDITOR_COPY[yAxis].label} />
        {reading.texture.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            How disagreement goes sits under this — texture, not a score.
          </ThemedText>
        ) : null}
        {reading.texture.map((row) => (
          <AxisCodeLabel key={row.axis} axis={row.axis} name={AXIS_EDITOR_COPY[row.axis].label} />
        ))}
      </View>
    );
  }

  if (reading.bar == null) return null;
  return (
    <View style={styles.block}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round(reading.bar * 100)}%` }]} />
      </View>
      {reading.stableAxes.map((axis) => {
        const phrases = TRAIT_BAND_PHRASES[axis];
        return (
          <View key={axis} style={styles.axisRow}>
            <AxisCodeLabel axis={axis} name={AXIS_EDITOR_COPY[axis].label} />
            <ThemedText type="code" themeColor="textSecondary">
              {phrases.low} → {phrases.high}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  mapFrame: {
    height: 88,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.35)',
    borderRadius: Spacing.two,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    marginLeft: -5,
    marginBottom: -5,
    borderRadius: 5,
    backgroundColor: 'rgba(127,127,127,0.85)',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(127,127,127,0.2)',
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(127,127,127,0.7)',
  },
  axisRow: {
    gap: 2,
  },
});
