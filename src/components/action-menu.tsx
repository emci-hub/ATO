import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ActionMenuOption {
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

interface ActionMenuProps {
  visible: boolean;
  /** Optional context line above the options, e.g. the message text. */
  title?: string;
  options: ActionMenuOption[];
  onClose: () => void;
}

/**
 * A small themed bottom-sheet-style option list (Modal). Used for the Circle
 * card overflow menu, the chat header menu, message long-press actions, and
 * anything else that needs a pick-one-of-N prompt.
 */
export function ActionMenu({ visible, title, options, onClose }: ActionMenuProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows taps so tapping the card itself never dismisses it. */}
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <ThemedView type="backgroundElement" style={styles.card}>
            {title ? (
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
                {title}
              </ThemedText>
            ) : null}
            <View style={styles.list}>
              {options.map((option) => (
                <Pressable
                  key={option.label}
                  disabled={option.disabled}
                  onPress={() => {
                    onClose();
                    option.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && styles.pressed,
                    option.disabled && styles.disabled,
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={option.destructive ? { color: '#E5484D' } : undefined}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.option,
                  { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  cardWrap: {
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth - Spacing.five,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  title: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    lineHeight: 18,
  },
  list: {
    gap: Spacing.half,
  },
  option: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
