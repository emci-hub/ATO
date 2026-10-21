import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  NOTIFICATION_ASK_BODY,
  NOTIFICATION_ASK_NO,
  NOTIFICATION_ASK_TITLE,
  NOTIFICATION_ASK_YES,
} from '@/lib/push-policy';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * The one-time notification ask. Shown after the first insight loads; "Turn on"
 * then asks the system, "Not now" just closes it. The caller remembers the
 * answer so it is never shown twice.
 */
export function NotificationAskSheet({
  visible,
  onTurnOn,
  onNotNow,
}: {
  visible: boolean;
  onTurnOn: () => void;
  onNotNow: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNotNow}>
      <View style={styles.backdrop}>
        <ThemedView type="backgroundElement" style={styles.card} testID="notification-ask-sheet">
          <ThemedText type="subtitle">{NOTIFICATION_ASK_TITLE}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.body}>
            {NOTIFICATION_ASK_BODY}
          </ThemedText>
          <Pressable
            onPress={onTurnOn}
            accessibilityRole="button"
            accessibilityLabel={NOTIFICATION_ASK_YES}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.accentFill },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {NOTIFICATION_ASK_YES}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={onNotNow}
            accessibilityRole="button"
            accessibilityLabel={NOTIFICATION_ASK_NO}
            style={({ pressed }) => [
              styles.button,
              styles.secondary,
              { borderColor: controlBorderColor(theme) },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">{NOTIFICATION_ASK_NO}</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  body: {
    lineHeight: 24,
  },
  button: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  secondary: {
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
