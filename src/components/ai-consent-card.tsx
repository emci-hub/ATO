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
export const AI_USE_DISCLOSURE = 'Sage uses AI only to write your Story, your Legends cards and your category deep dives.';

// Bodies rewritten 2026-10-07 (emci), widened 2026-10-08: the daily focus, the
// questions and the Explore category cards are stored copy, so ai_consent gates
// the Story, the Legends cards' "you" part and the Home category deep dive. The copy has to say exactly that, because this is the Apple
// 5.1.2 consent surface: it may not claim AI where there is none, or leave
// out where there is.
const COPY: Record<ConsentContext, { title: string; body: string }> = {
  home: {
    title: 'Can Sage use AI to write for you?',
    body:
      'Sage uses AI, based on your answers, to write your Story, the personal part of your ' +
      'Legends cards and the category deep dives you ask for. Sage is a coach in the app, not a ' +
      'person. You’ll only be asked once. Say no and those stay off (Legends uses the museum’s own ' +
      'words). Your daily focus, your questions and your category cards don’t use AI, so they ' +
      'keep working either way.',
  },
  talk: {
    title: 'Can Sage use AI to talk with you?',
    body:
      'Sage replies to you using AI, in your talk style, based on what you’ve logged and ' +
      'told us. Sage is a coach in the app, not a person. You’ll only be asked once. ' +
      'Say no and Talk stays off, along with your Story.',
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
