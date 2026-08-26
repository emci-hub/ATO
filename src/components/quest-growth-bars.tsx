import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PRESENCE_TIERS, DEPTH_TIERS } from '@/lib/growth';

/**
 * Quest-mode HP/MP bars tied to live growth axes (presence / depth), not decoration.
 */
export function QuestGrowthBars({
  presence,
  depth,
}: {
  presence: number;
  depth: number;
}) {
  const theme = useTheme();
  if (!theme.hpMpBars) return null;

  const hpMax = PRESENCE_TIERS[PRESENCE_TIERS.length - 1].level;
  const mpMax = DEPTH_TIERS[DEPTH_TIERS.length - 1].level;
  const hp = Math.max(0, Math.min(presence, hpMax)) / hpMax;
  const mp = Math.max(0, Math.min(depth, mpMax)) / mpMax;

  return (
    <View style={styles.wrap}>
      <Meter label="HP" fill={theme.accentTertiary} value={hp} track={theme.backgroundSelected} />
      <Meter label="MP" fill={theme.accent} value={mp} track={theme.backgroundSelected} />
    </View>
  );
}

function Meter({
  label,
  fill,
  value,
  track,
}: {
  label: string;
  fill: string;
  value: number;
  track: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <ThemedText type="code" style={[styles.label, { color: theme.emphasis }]}>
        {label}
      </ThemedText>
      <View style={[styles.track, { backgroundColor: track, borderColor: theme.border }]}>
        <View style={[styles.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: fill }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    width: 28,
  },
  track: {
    flex: 1,
    height: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
