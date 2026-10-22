import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { STORY_LIBRARY_RUNTIME } from '@/lib/story-library/flags';
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
// wave93 (emci 2026-10-09): AI cards live in a shared library, so the disclosure says so.
// 2026-10-14: Sage is gone and the Story is template-only, so the real AI uses
// are Legends cards and category deep dives — exactly those two, no more.
// Story Library (flag off by default): while the flag is off the server can
// still write those two with a model, so the model sentence stays the one
// people see. When the flag is on, both surfaces are stored copy.
export const AI_USE_DISCLOSURE_MODEL =
  'ATO uses AI only to write your Legends cards and your category deep dives. These cards are shared between people with similar leanings and never include your name or your answers.';

export const AI_USE_DISCLOSURE_LIBRARY =
  'ATO writes your Legends cards and your category deep dives from a stored story library. No model writes them, and they never include your name or your answers.';

export const AI_USE_DISCLOSURE = STORY_LIBRARY_RUNTIME ? AI_USE_DISCLOSURE_LIBRARY : AI_USE_DISCLOSURE_MODEL;

const MODEL_BODY =
  'ATO uses AI, based on your answers, to write the personal part of your Legends cards ' +
  'and the category deep dives you ask for. You’ll only be asked once. Say no and those stay ' +
  'off (Legends uses the museum’s own words). Insights, your questions and your category cards ' +
  'don’t use AI, so they keep working either way. AI cards are shared between people with ' +
  'similar leanings and never include your name or your answers.';

const LIBRARY_BODY =
  'ATO writes the personal part of your Legends cards and the category deep dives you ask for ' +
  'from a stored story library. No model writes them. Insights, your questions and your category ' +
  'cards stay stored copy too. The cards never include your name or your answers.';

// The Apple 5.1.2 consent surface: it may not claim AI where there is none, or
// leave out where there is. Insights (Try this today, the focus, the Story,
// Superpower, How you argue), questions and category cards are stored copy.
const COPY: Record<ConsentContext, { title: string; body: string }> = {
  home: {
    title: STORY_LIBRARY_RUNTIME ? 'Can ATO write these from the story library?' : 'Can ATO use AI to write for you?',
    body: STORY_LIBRARY_RUNTIME ? LIBRARY_BODY : MODEL_BODY,
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
