import { StyleSheet, View } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * The story-v3 script style for the daily-insights cards: an emoji context
 * line, one sentence per line, bold mini-labels. Existing tokens only.
 */

/** "A. B." → ["A.", "B."]. Keeps a closing quote with its sentence. */
export function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function ContextLine({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={styles.context}>
      <ThemedText type="code" accessible={false} importantForAccessibility="no">
        {emoji}
      </ThemedText>
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        {label}
      </ThemedText>
    </View>
  );
}

export function ScriptLines({
  text,
  type = 'default',
  themeColor,
}: {
  text: string;
  type?: ThemedTextProps['type'];
  themeColor?: ThemedTextProps['themeColor'];
}) {
  return (
    <View style={styles.lines}>
      {splitSentences(text).map((sentence, i) => (
        <ThemedText key={i} type={type} themeColor={themeColor}>
          {sentence}
        </ThemedText>
      ))}
    </View>
  );
}

/** **Label** then the line(s) under it. */
export function MiniSection({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.mini}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ScriptLines text={text} type="small" themeColor="textSecondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  context: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  kicker: { letterSpacing: 0.5 },
  lines: { gap: Spacing.half },
  mini: { gap: Spacing.half },
});
