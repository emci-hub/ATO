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
      {/* Each theme as a little preview tile in its own colours (polish pass,
          2026-10-05): its background, a card, and its accent. */}
      <View style={styles.grid}>
      {APPEARANCE_IDS.map((option: AppearanceId) => {
        const selected = id === option;
        const unlocked = isAppearanceUnlocked(option, subscriptionActive);
        const look = APPEARANCES[option];
        return (
          <View key={option} style={styles.cell}>
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
                styles.tile,
                {
                  borderColor: selected ? theme.accent : theme.border,
                  borderWidth: selected ? 2 : 1,
                  backgroundColor: selected ? theme.backgroundSelected : 'transparent',
                },
              ]}>
              <View
                style={[
                  styles.preview,
                  { backgroundColor: look.background, borderRadius: Math.min(look.radius, 10) },
                  !unlocked && styles.lockedSwatches,
                ]}>
                <View
                  style={[
                    styles.previewCard,
                    {
                      backgroundColor: look.backgroundElement,
                      borderColor: look.border,
                      borderRadius: Math.min(look.radius, 6),
                    },
                  ]}>
                  <View style={[styles.previewLine, { backgroundColor: look.text }]} />
                  <View style={[styles.previewLine, styles.previewShort, { backgroundColor: look.textSecondary }]} />
                  <View style={[styles.previewDot, { backgroundColor: look.accent }]} />
                </View>
              </View>
              <ThemedText type="smallBold" themeColor={unlocked ? undefined : 'textSecondary'}>
                {APPEARANCE_LABELS[option]}
              </ThemedText>
              {unlocked ? null : (
                <ThemedText type="code" themeColor="textSecondary">
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
      </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
  },
  cell: {
    width: '30%',
    flexGrow: 1,
  },
  tile: {
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.one,
    alignItems: 'center',
  },
  preview: {
    width: '100%',
    height: 56,
    padding: Spacing.two,
    justifyContent: 'center',
  },
  previewCard: {
    borderWidth: 1,
    padding: Spacing.one + 2,
    gap: 3,
  },
  previewLine: {
    height: 4,
    borderRadius: 2,
    width: '80%',
  },
  previewShort: {
    width: '50%',
  },
  previewDot: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lockedSwatches: {
    opacity: 0.45,
  },
  note: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
});
