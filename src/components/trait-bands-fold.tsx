import { StyleSheet, View } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  TRAIT_BANDS_LABEL,
  filledTraitBands,
  type FilledTraitBand,
} from '@/lib/trait-bands';
import type { Me } from '@/lib/me';

/**
 * Collapsed-by-default You-tab spectrum. Marker position only — no number,
 * no trait name, no midpoint label. Hidden entirely when every axis is null.
 */
export function TraitBandsFold({ me }: { me: Me }) {
  const bands = filledTraitBands(me);
  if (bands.length === 0) return null;

  return (
    <SettingsFold title={TRAIT_BANDS_LABEL}>
      <View style={styles.list}>
        {bands.map((band) => (
          <TraitBandRow key={band.axis} band={band} />
        ))}
      </View>
    </SettingsFold>
  );
}

function TraitBandRow({ band }: { band: FilledTraitBand }) {
  const theme = useTheme();
  const t = Math.min(1, Math.max(0, band.value));
  const leftFlex = Math.max(t, 0.001);
  const rightFlex = Math.max(1 - t, 0.001);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${band.low}. ${band.high}.`}>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
        <View style={{ flex: leftFlex }} />
        <View
          style={[
            styles.marker,
            { backgroundColor: theme.accentFill, borderColor: theme.backgroundElement },
          ]}
        />
        <View style={{ flex: rightFlex }} />
      </View>
      <View style={styles.ends}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.endLow}>
          {band.low}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.endHigh}>
          {band.high}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  row: {
    gap: Spacing.two,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    overflow: 'visible',
  },
  marker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    marginHorizontal: -1,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  endLow: {
    flex: 1,
    paddingRight: Spacing.two,
  },
  endHigh: {
    flex: 1,
    textAlign: 'right',
    paddingLeft: Spacing.two,
  },
});
