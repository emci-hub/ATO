import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';

export type ConsentContext = 'home';

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
// Legends cards and category deep dives come from the stored story library.
// Insights, questions, and category cards were already stored copy. No model
// writes a card when someone opens one. Copy review, outside the app, is the
// only remaining model use, and it is not disclosed here as a product feature.
export const AI_USE_DISCLOSURE =
  'ATO writes your Legends cards and your category deep dives from a stored story library. No model writes them, and they never include your name or your answers.';

const LIBRARY_BODY =
  'ATO writes the personal part of your Legends cards and the category deep dives you ask for ' +
  'from a stored story library. No model writes them. Insights, your questions and your category ' +
  'cards stay stored copy too. The cards never include your name or your answers.';

const COPY: Record<ConsentContext, { title: string; body: string }> = {
  home: {
    title: 'Can ATO write these from the story library?',
    body: LIBRARY_BODY,
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
            {busy ? 'Saving…' : 'Yes, use the library'}
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
