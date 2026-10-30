import { StyleSheet, View } from 'react-native';

import { GradientFill } from '@/components/gradient-fill';
import { IconPop } from '@/components/icon-pop';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SuperpowerLine, SuperpowerPick } from '@/lib/daily-insights';
import { BAR_FILL } from '@/lib/motion-tokens';
import { controlBorderColor } from '@/lib/theme/chrome';

import { ContextLine, MiniSection, ScriptLines } from './script-parts';

function Half({
  emoji,
  heading,
  tipLabel,
  line,
  order,
}: {
  emoji: string;
  heading: string;
  tipLabel: string;
  line: SuperpowerLine;
  /** 0 or 1: the icon pops 120 ms after the one before it. */
  order: number;
}) {
  // The visible "→" stays out of what VoiceOver reads.
  const label = `${heading}. ${line.title}. ${line.text} ${tipLabel.replace(' →', '')}: ${line.tip}`;
  return (
    <View accessible accessibilityLabel={label} style={styles.half}>
      <IconPop delayMs={order * BAR_FILL.tileStaggerMs}>
        <ContextLine emoji={emoji} label={heading} />
      </IconPop>
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
      {/* A soft wash from the theme's own colours (decorative, hidden from VoiceOver). */}
      <GradientFill
        colors={[theme.accent, theme.accentSecondary]}
        opacities={[0.14, 0.06]}
        borderRadius={Spacing.three}
      />
      {pick.superpower ? (
        <Half emoji="⚡" heading="Your superpower" tipLabel="Tip" line={pick.superpower} order={0} />
      ) : null}
      {pick.superpower && pick.kryptonite ? (
        <View style={[styles.divider, { backgroundColor: controlBorderColor(theme) }]} />
      ) : null}
      {pick.kryptonite ? (
        <Half emoji="🪫" heading="Your kryptonite" tipLabel="Watch out →" line={pick.kryptonite} order={1} />
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
