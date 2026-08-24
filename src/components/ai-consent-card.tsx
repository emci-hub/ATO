import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ConsentContext = 'dawn' | 'talk';

const COPY: Record<ConsentContext, { title: string; body: string }> = {
  dawn: {
    title: 'Can Sage use AI to write your card?',
    body:
      'Once you\u2019ve logged three days, Sage writes your daily read and do using AI, ' +
      'based on what you\u2019ve logged and told us. You\u2019ll only be asked once. Say no and ' +
      'you keep the starter cards, and Sage\u2019s Talk stays off.',
  },
  talk: {
    title: 'Can Sage use AI to talk with you?',
    body:
      'Sage replies to you using AI, in your talk style, based on what you\u2019ve logged and ' +
      'told us. You\u2019ll only be asked once. Say no and Talk stays off — your daily cards ' +
      'keep working.',
  },
};

export function AiConsentCard({
  context,
  busy,
  onGrant,
  onDeny,
}: {
  context: ConsentContext;
  busy?: boolean;
  onGrant: () => void;
  onDeny: () => void;
}) {
  const theme = useTheme();
  const copy = COPY[context];

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.centerText}>
        {copy.title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centerText}>
        {copy.body}
      </ThemedText>
      <View style={styles.consentRow}>
        <Pressable
          onPress={onGrant}
          disabled={busy}
          style={({ pressed }) => [
            styles.consentButton,
            { backgroundColor: '#3c87f7' },
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}>
          <ThemedText type="smallBold" style={styles.primaryText}>
            {busy ? 'Saving…' : 'Yes, use AI'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={onDeny}
          disabled={busy}
          style={({ pressed }) => [
            styles.consentButton,
            { borderColor: theme.backgroundSelected, borderWidth: 1 },
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            No, keep it simple
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  consentRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignSelf: 'stretch',
    paddingTop: Spacing.two,
  },
  consentButton: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
