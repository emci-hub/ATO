import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { stopPreview, usePreviewing } from '@/lib/preview-session';

export const PREVIEW_BANNER_COPY = 'Previewing as a new user · nothing is saved · Tap to exit';

/**
 * Over every screen while "Preview as new user" is on (dev, root only), so it
 * can never be forgotten. One tap ends it and puts this phone's data back.
 * Renders nothing otherwise, and can never be on in a public build
 * (lib/preview-mode.ts `isPreviewing`).
 */
export function PreviewBanner() {
  const previewing = usePreviewing();
  const insets = useSafeAreaInsets();
  if (!previewing) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + Spacing.one }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previewing as a new user. Nothing is saved. Tap to exit preview."
        onPress={() => void stopPreview()}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
        <ThemedText type="smallBold" style={styles.text}>
          {PREVIEW_BANNER_COPY}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  banner: {
    backgroundColor: '#B42318',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
