import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';

export type ConsentContext = 'home' | 'talk';

// Both bodies rewritten 2026-09-15 (emci explicit): AI consent now governs
// ONE thing — the conversational exchange with Sage. It no longer gates the
// daily insight, the question bank, the daily question rotation, Explore
// packs, or anything else. The previous copy said a no meant no daily
// insight; that is no longer true, and this is the Apple 5.1.2 surface, so
// it has to state what actually happens. One ai_consent flag, one meaning.
const COPY: Record<ConsentContext, { title: string; body: string }> = {
  home: {
    title: 'Can Sage use AI to talk with you?',
    body:
      'Talking with Sage uses AI, in your talk style, based on what you’ve logged and ' +
      'told us. Sage is a coach in the app, not a person. You’ll only be asked once. ' +
      'Say no and Sage’s Talk stays off — the rest of the app works exactly the same either way.',
  },
  talk: {
    title: 'Can Sage use AI to talk with you?',
    body:
      'Sage replies to you using AI, in your talk style, based on what you’ve logged and ' +
      'told us. Sage is a coach in the app, not a person. You’ll only be asked once. ' +
      'Say no and Talk stays off — nothing else in the app changes.',
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
            { borderColor: controlBorderColor(theme), borderWidth: 1 },
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
