import { StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fallbackCatchUpCard, offsetLabel, type OpenLogDay } from '@/lib/check-window';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * A still-open day from the last two. Always shows the static catch-up copy.
 *
 * This used to call routeVoiceCard to generate a card for the missed day. It
 * no longer generates anything: the daily insight is written once for today,
 * and back-filling a personalized one for a day that has already passed would
 * mean paying for a model call to describe a day the person can no longer act
 * on. The static line is honest about what this is — a way to close the day,
 * not a second insight.
 */
export function MissedCheckCard({
  slot,
  busy,
  onLog,
}: {
  slot: OpenLogDay;
  busy: boolean;
  onLog: (status: 'done' | 'skipped') => void;
}) {
  const theme = useTheme();
  const card = fallbackCatchUpCard(slot.day);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        Day {slot.day} · {offsetLabel(slot.offset)}
      </ThemedText>
      <ThemedText type="small">{card.read}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {card.do}
      </ThemedText>
      <View style={styles.row}>
        <ThemedPressable
          onPress={() => onLog('done')}
          disabled={busy}
          filled
          style={[styles.button, busy && styles.disabled]}>
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            Logged it
          </ThemedText>
        </ThemedPressable>
        <ThemedPressable
          onPress={() => onLog('skipped')}
          disabled={busy}
          style={[
            styles.button,
            { borderWidth: 1, borderColor: controlBorderColor(theme) },
            busy && styles.disabled,
          ]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Skip
          </ThemedText>
        </ThemedPressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  kicker: {
    textTransform: 'uppercase',
  },
  row: {
    gap: Spacing.two,
  },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
});
