import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fetchChecks, type Check } from '@/lib/checks';
import { fireTestPush, notificationsAreGranted } from '@/lib/push';
import type { PushKind } from '@/lib/push-copy';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Manual fire for the three pushes so a tester can tap each deep link without
 * waiting for 7am / 8pm / Sunday. Always on You — TestFlight needs it. A
 * decline is not nagged; the buttons just say they're off.
 */
export function PushTestCard({ timeZone }: { timeZone: string }) {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const [granted, setGranted] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);
  const [firing, setFiring] = useState<PushKind | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refreshGranted = useCallback(async () => {
    setGranted(await notificationsAreGranted());
  }, []);

  useEffect(() => {
    let active = true;
    refreshGranted().catch(() => {});
    if (userId) {
      fetchChecks(userId)
        .then((rows) => {
          if (active) setChecks(rows);
        })
        .catch(() => {});
    }
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshGranted().catch(() => {});
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [userId, refreshGranted]);

  async function fire(kind: PushKind) {
    if (firing) return;
    setFiring(kind);
    setNote(null);
    try {
      await fireTestPush(kind, checks, timeZone);
      setNote(`${kind} arrives in a few seconds. Tap it to open the right screen.`);
    } catch (err) {
      console.log('[push] test fire error:', err);
      const on = await notificationsAreGranted();
      setGranted(on);
      setNote(
        on ? "Couldn't schedule that one." : 'Notifications are off. Everything else still works.',
      );
    } finally {
      setFiring(null);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.heading}>
        Test notifications
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        {granted
          ? 'Fires the real morning, evening, and Sunday copy so you can check the deep link.'
          : 'Notifications are off. Everything else still works.'}
      </ThemedText>
      <View style={styles.row}>
        <TestButton
          label={firing === 'morning' ? '…' : 'Morning'}
          disabled={firing !== null}
          onPress={() => fire('morning')}
          borderColor={controlBorderColor(theme)}
        />
        <TestButton
          label={firing === 'evening' ? '…' : 'Evening'}
          disabled={firing !== null}
          onPress={() => fire('evening')}
          borderColor={controlBorderColor(theme)}
        />
        <TestButton
          label={firing === 'sunday' ? '…' : 'Sunday'}
          disabled={firing !== null}
          onPress={() => fire('sunday')}
          borderColor={controlBorderColor(theme)}
        />
      </View>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {note}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

function TestButton({
  label,
  disabled,
  onPress,
  borderColor,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  borderColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { borderColor },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
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
