import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { neonGlowColors, presenceGlowLayersForTier, PRESENCE_GLOW_LAYERS } from '@/lib/growth';

/**
 * Small all-time Check count chip on Home. Glow grows with presence tier
 * (same 0 / 3 / 7 / 21 steps as the Sage pixel), using the current
 * appearance accent so it stays in-palette across all five modes.
 */
export function CheckMilestoneBadge({
  checkCount,
  presence,
}: {
  checkCount: number;
  presence: number;
}) {
  const theme = useTheme();
  const glow = neonGlowColors(theme.accent);
  const layers = presenceGlowLayersForTier(presence);
  const label = checkCount === 1 ? '1 check' : `${checkCount} checks`;

  return (
    <View
      style={styles.wrap}
      accessibilityRole="text"
      accessibilityLabel={`All-time checks: ${label}`}>
      {layers > 0
        ? PRESENCE_GLOW_LAYERS.slice(0, layers).map((layer, i) => (
            <View
              key={layer.key}
              pointerEvents="none"
              style={[
                styles.glow,
                {
                  backgroundColor: glow[layer.key],
                  transform: [{ scale: 1 + (layer.scale - 1) * 0.35 }],
                  zIndex: PRESENCE_GLOW_LAYERS.length - i,
                },
              ]}
            />
          ))
        : null}
      <View
        style={[
          styles.chip,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border === 'transparent' ? theme.backgroundSelected : theme.border,
          },
          chipShadow(theme.accent, presence),
        ]}>
        <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
          checks
        </ThemedText>
        <ThemedText type="smallBold">{checkCount}</ThemedText>
      </View>
    </View>
  );
}

function chipShadow(accent: string, presence: number) {
  if (presence <= 0) return null;
  const glow = neonGlowColors(accent);
  const radius = 4 + presence * 3;
  return Platform.select({
    ios: {
      shadowColor: accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.18 + presence * 0.1,
      shadowRadius: radius,
    },
    android: { elevation: presence },
    default: {
      boxShadow: `0 0 ${radius}px ${glow.halo}`,
    },
  });
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    padding: 8,
  },
  glow: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 4,
    bottom: 4,
    borderRadius: 999,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: Spacing.two,
    zIndex: 4,
  },
  kicker: {
    textTransform: 'uppercase',
    fontSize: 10,
    lineHeight: 14,
  },
});
