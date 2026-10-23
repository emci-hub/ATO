import { useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export const UPDATE_READY_COPY = 'Update ready · Tap to restart';

/** Look again when the app comes back to the front, at most this often. */
const RECHECK_MS = 10 * 60 * 1000;

/**
 * An OTA update downloads in the background and only runs after a full restart,
 * so a fix could sit unused for days (emci 2026-10-13). When one is downloaded
 * this pill floats over every screen; one tap restarts into it. Same path the Dev
 * Hub's "Check for update" uses (check → fetch → reloadAsync). Nothing renders in
 * dev / Expo Go, where updates are off.
 */
export function UpdateReadyBanner() {
  const { isUpdatePending } = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!Updates.isEnabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || Date.now() - lastCheck.current < RECHECK_MS) return;
      lastCheck.current = Date.now();
      void (async () => {
        try {
          const check = await Updates.checkForUpdateAsync();
          if (check.isAvailable) await Updates.fetchUpdateAsync();
        } catch {
          // Offline or the server said no: try again next time the app opens.
        }
      })();
    });
    return () => sub.remove();
  }, []);

  if (!Updates.isEnabled || !isUpdatePending) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + Spacing.one }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="An update is ready. Tap to restart the app with it."
        onPress={() => void Updates.reloadAsync().catch(() => {})}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
        <ThemedText type="smallBold" style={styles.text}>
          {UPDATE_READY_COPY}
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
    zIndex: 999,
    elevation: 999,
  },
  banner: {
    backgroundColor: '#1F6FEB',
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
