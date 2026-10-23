import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SuperpowerLine, SuperpowerPick } from '@/lib/daily-insights';
import { controlBorderColor } from '@/lib/theme/chrome';

import { ContextLine, MiniSection, ScriptLines } from './script-parts';

function Half({
  emoji,
  heading,
  tipLabel,
  line,
}: {
  emoji: string;
  heading: string;
  tipLabel: string;
  line: SuperpowerLine;
}) {
  // The visible "→" stays out of what VoiceOver reads.
  const label = `${heading}. ${line.title}. ${line.text} ${tipLabel.replace(' →', '')}: ${line.tip}`;
  return (
    <View accessible accessibilityLabel={label} style={styles.half}>
      <ContextLine emoji={emoji} label={heading} />
      <ThemedText type="subheading">{line.title}</ThemedText>
      <ScriptLines text={line.text} />
      <MiniSection label={tipLabel} text={line.tip} />
    </View>
  );
}

/**
 * ⚡ Your superpower / 🪫 Your kryptonite — highest and lowest ready bar.
 * Stored copy, no model call, no AI badge.
 */
export function SuperpowerCard({ pick }: { pick: SuperpowerPick }) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: controlBorderColor(theme) }]}
      testID="superpower-card">
      {pick.superpower ? (
        <Half emoji="⚡" heading="Your superpower" tipLabel="Tip" line={pick.superpower} />
      ) : null}
      {pick.superpower && pick.kryptonite ? (
        <View style={[styles.divider, { backgroundColor: controlBorderColor(theme) }]} />
      ) : null}
      {pick.kryptonite ? (
        <Half emoji="🪫" heading="Your kryptonite" tipLabel="Watch out →" line={pick.kryptonite} />
      ) : null}
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
  half: { gap: Spacing.one },
  divider: { height: StyleSheet.hairlineWidth },
});
