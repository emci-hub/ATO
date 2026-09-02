import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  APPEARANCE_IDS,
  APPEARANCE_LABELS,
  APPEARANCES,
  type AppearanceId,
} from '@/constants/appearance';
import { Spacing } from '@/constants/theme';
import { useAppearance } from '@/lib/theme/context';
import {
  isAppearanceUnlocked,
  SUBSCRIPTION_LABEL,
  SUBSCRIPTION_LOCKED_NOTE,
} from '@/lib/subscription';
import { useTheme } from '@/hooks/use-theme';

/**
 * Appearance list. Soft and Quest are free; the rest are subscriber modes and
 * render locked (visible, swatches shown, not selectable) until an entitlement
 * exists — nothing is hidden, so the value of subscribing is legible.
 */
export function AppearancePicker() {
  const theme = useTheme();
  const { id, setAppearance, subscriptionActive } = useAppearance();
  const [lockedNote, setLockedNote] = useState<AppearanceId | null>(null);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.heading}>
        Appearance
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.lede}>
        Soft is the default. Saved on this device.
      </ThemedText>
      {APPEARANCE_IDS.map((option: AppearanceId) => {
        const selected = id === option;
        const unlocked = isAppearanceUnlocked(option, subscriptionActive);
        return (
          <View key={option}>
            <ThemedPressable
              accessibilityRole="button"
              accessibilityLabel={
                unlocked
                  ? APPEARANCE_LABELS[option]
                  : `${APPEARANCE_LABELS[option]}, ${SUBSCRIPTION_LABEL} only`
              }
              accessibilityState={{ selected, disabled: !unlocked }}
              onPress={() => {
                if (!unlocked) {
                  setLockedNote(option);
                  return;
                }
                setLockedNote(null);
                void setAppearance(option);
              }}
              style={[
                styles.row,
                selected && { backgroundColor: theme.backgroundSelected },
              ]}>
              <View style={[styles.swatches, !unlocked && styles.lockedSwatches]}>
                <View style={[styles.swatch, { backgroundColor: APPEARANCES[option].background }]} />
                <View style={[styles.swatch, { backgroundColor: APPEARANCES[option].accentFill }]} />
              </View>
              <ThemedText type="smallBold" themeColor={unlocked ? undefined : 'textSecondary'}>
                {APPEARANCE_LABELS[option]}
              </ThemedText>
              {unlocked ? null : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.badge}>
                  {SUBSCRIPTION_LABEL}
                </ThemedText>
              )}
            </ThemedPressable>
            {lockedNote === option ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                {SUBSCRIPTION_LOCKED_NOTE}
              </ThemedText>
            ) : null}
          </View>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.two,
  },
  heading: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  lede: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  swatches: {
    flexDirection: 'row',
    gap: 4,
  },
  lockedSwatches: {
    opacity: 0.45,
  },
  badge: {
    marginLeft: 'auto',
  },
  note: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
});
