import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';

export type ConsentContext = 'home' | 'talk';

/**
 * Apple 5.1.2 disclosure. Rendered UNCONDITIONALLY wherever the consent card
 * lives -- before the answer, after a yes, and after a no alike. Disclosure
 * must never be contingent on the answer; only actual generation is.
 * Deliberately NOT rendered inside this card: the card disappears the moment
 * the question is answered, and a disclosure that vanishes with the answer is
 * exactly what 5.1.2 forbids. The HOST surface renders it, unconditionally and
 * outside every consent branch -- Home does so today. Any future surface that
 * mounts this card owes the same line.
 */
export const AI_USE_DISCLOSURE = 'Sage uses AI to personalize your insights.';

// Bodies rewritten 2026-09-15 (emci correction). With no dedicated Sage-talk
// screen built yet, ai_consent gates the app's three real AI touchpoints --
// the daily insight, the "Tell Sage more" rotation, and Explore packs. A no
// means none of those generate. The copy has to say that, because this is the
// Apple 5.1.2 consent surface and one flag governs all three.
const COPY: Record<ConsentContext, { title: string; body: string }> = {
  home: {
    title: 'Can Sage use AI to personalize what you see?',
    body:
      'Sage writes your daily insight, your questions and your categories using AI, based on ' +
      'what you’ve logged and told us. Sage is a coach in the app, not a person. ' +
      'You’ll only be asked once. Say no and Sage writes none of them — everything ' +
      'else, including the questions you already answer yourself, keeps working.',
  },
  talk: {
    title: 'Can Sage use AI to talk with you?',
    body:
      'Sage replies to you using AI, in your talk style, based on what you’ve logged and ' +
      'told us. Sage is a coach in the app, not a person. You’ll only be asked once. ' +
      'Say no and Talk stays off, along with Sage’s written insights.',
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
