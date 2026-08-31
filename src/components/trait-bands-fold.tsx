import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  TRAIT_BANDS_LABEL,
  filledTraitBands,
  type FilledTraitBand,
} from '@/lib/trait-bands';
import type { Me } from '@/lib/me';

export const BAND_PROVENANCE = 'This came from a question you answered. It can change.';

/**
 * Collapsed-by-default You-tab spectrum. Marker position only — no number,
 * no trait name, no midpoint label. Hidden entirely when every axis is null.
 */
export function TraitBandsFold({ me }: { me: Me }) {
  const bands = filledTraitBands(me);
  const [detail, setDetail] = useState<FilledTraitBand | null>(null);
  if (bands.length === 0) return null;

  return (
    <>
      <SettingsFold title={TRAIT_BANDS_LABEL}>
        <View style={styles.list}>
          {bands.map((band) => (
            <Pressable
              key={`${band.low}:${band.high}`}
              accessibilityRole="button"
              accessibilityLabel={`${band.low}. ${band.high}.`}
              onPress={() => setDetail(band)}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <TraitBandVisual band={band} />
            </Pressable>
          ))}
        </View>
      </SettingsFold>
      <Modal
        visible={detail != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDetail(null)}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <ThemedView type="backgroundElement" style={styles.sheet}>
              {detail ? <TraitBandDetail band={detail} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setDetail(null)}
                style={({ pressed }) => [styles.closeRow, pressed && styles.pressed]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Close
                </ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function TraitBandVisual({ band }: { band: FilledTraitBand }) {
  const theme = useTheme();
  const t = Math.min(1, Math.max(0, band.value));
  const leftFlex = Math.max(t, 0.001);
  const rightFlex = Math.max(1 - t, 0.001);

  return (
    <View style={styles.row}>
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

/** One filled band plus the fixed provenance line. No axis name, no number, no source token. */
export function TraitBandDetail({ band }: { band: FilledTraitBand }) {
  return (
    <View style={styles.detail}>
      <TraitBandVisual band={band} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.provenance}>
        {BAND_PROVENANCE}
      </ThemedText>
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
  pressed: {
    opacity: 0.8,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrap: {
    padding: Spacing.four,
  },
  sheet: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  detail: {
    gap: Spacing.three,
  },
  provenance: {
    paddingHorizontal: Spacing.half,
  },
  closeRow: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
