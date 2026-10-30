import { StyleSheet } from 'react-native';

import { GradientFill } from '@/components/gradient-fill';
import { IconPop } from '@/components/icon-pop';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ConflictLine } from '@/lib/daily-insights';
import { BAR_FILL } from '@/lib/motion-tokens';
import { controlBorderColor } from '@/lib/theme/chrome';

import { ContextLine, MiniSection, ScriptLines } from './script-parts';

/**
 * 🗣️ How you argue — one of five styles from the two conflict tracks.
 * Stored copy in our own words, no model call, no AI badge.
 */
export function ConflictStyleCard({ line }: { line: ConflictLine }) {
  const theme = useTheme();
  const label =
    `How you argue. ${line.title}. ${line.text} ` +
    `Strength: ${line.strength} Watch out: ${line.watchOut} Try: ${line.tryLine}`;
  return (
    <ThemedView
      type="backgroundElement"
      accessible
      accessibilityLabel={label}
      style={[styles.card, { borderColor: controlBorderColor(theme) }]}
      testID="conflict-style-card">
      <GradientFill
        colors={[theme.accentTertiary, theme.accent]}
        opacities={[0.12, 0.06]}
        borderRadius={Spacing.three}
      />
      <IconPop delayMs={2 * BAR_FILL.tileStaggerMs}>
        <ContextLine emoji="🗣️" label="How you argue" />
      </IconPop>
      <ThemedText type="subheading">{line.title}</ThemedText>
      <ScriptLines text={line.text} />
      <MiniSection label="Strength" text={line.strength} />
      <MiniSection label="Watch out" text={line.watchOut} />
      <MiniSection label="Try" text={line.tryLine} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
