import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';
import {
  sendFloorTestError,
  SENTRY_DSN,
  triggerNativeTestCrash,
} from '@/lib/sentry';

/**
 * Floor-requirements Sentry probe. Dev-only — TestFlight / production
 * must not ship a Native crash button on You.
 */
export function SentryTestCard() {
  if (!__DEV__) return null;
  return <SentryTestCardInner />;
}

function SentryTestCardInner() {
  const theme = useTheme();
  const [busy, setBusy] = useState<'js' | 'native' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function sendJs() {
    if (busy) return;
    setBusy('js');
    setNote(null);
    try {
      const eventId = await sendFloorTestError();
      setNote(`JS test error sent. Event id ${eventId}`);
    } catch (err) {
      console.log('[sentry] test error failed:', err);
      setNote(
        SENTRY_DSN
          ? "Couldn't send the test error."
          : 'Sentry DSN is not set, so nothing was sent.',
      );
    } finally {
      setBusy(null);
    }
  }

  function sendNative() {
    if (busy) return;
    setBusy('native');
    setNote('Triggering a native crash. The app will close; the event should land in Sentry.');
    setTimeout(() => {
      triggerNativeTestCrash();
    }, 300);
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.heading}>
        Test crash reporting
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Sends a real event to Sentry. Native crash needs a binary that includes
        the Sentry native SDK (EAS dev/preview/production), not Expo Go.
      </ThemedText>
      <View style={styles.row}>
        <Pressable
          onPress={sendJs}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.button,
            { borderColor: controlBorderColor(theme) },
            pressed && styles.pressed,
            busy !== null && styles.disabled,
          ]}>
          <ThemedText type="smallBold">{busy === 'js' ? '…' : 'JS error'}</ThemedText>
        </Pressable>
        <Pressable
          onPress={sendNative}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.button,
            { borderColor: controlBorderColor(theme) },
            pressed && styles.pressed,
            busy !== null && styles.disabled,
          ]}>
          <ThemedText type="smallBold">{busy === 'native' ? '…' : 'Native crash'}</ThemedText>
        </Pressable>
      </View>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {note}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  heading: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  hint: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
