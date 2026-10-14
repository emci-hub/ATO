import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ConflictLine } from '@/lib/daily-insights';
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
      <ContextLine emoji="🗣️" label="How you argue" />
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
