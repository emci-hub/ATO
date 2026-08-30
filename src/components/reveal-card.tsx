import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Vibration } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAppearance } from '@/lib/theme/context';
import { localYmd } from '@/lib/local-date';
import {
  REVEAL_EMPTY,
  REVEAL_LABEL,
  REVEAL_SEALED_PROMPT,
  REVEAL_UNFOLD_MS,
  revealOpenedStorageKey,
  type RevealPick,
} from '@/lib/reveal';

function oneShortHaptic() {
  if (Platform.OS === 'web') return;
  Vibration.vibrate(10);
}

export async function isRevealOpenedToday(
  userId: string,
  timeZone: string,
  now?: Date,
): Promise<boolean> {
  const todayYmd = localYmd(now ?? new Date(), timeZone || 'UTC');
  try {
    const raw = await AsyncStorage.getItem(revealOpenedStorageKey(userId));
    return raw === todayYmd;
  } catch {
    return false;
  }
}

/**
 * Home reveal surface. Content is passed in already picked. One unfold
 * for every pool item — no worth-signaling chrome. Empty days are a plain line.
 */
export function RevealCard({
  pick,
  userId,
  timeZone,
  now,
  forceReduceMotion,
}: {
  pick: RevealPick | null;
  userId?: string;
  timeZone?: string;
  now?: Date;
  /** Theme-lab: skip the sealed state the same way Reduce Motion does. */
  forceReduceMotion?: boolean;
}) {
  const { reduceMotion } = useAppearance();
  const skipMotion = reduceMotion || Boolean(forceReduceMotion);
  const todayYmd = localYmd(now ?? new Date(), timeZone || 'UTC');
  const [opened, setOpened] = useState(skipMotion);
  const [playMotion, setPlayMotion] = useState(false);
  const progress = useSharedValue(skipMotion ? 1 : 0);

  useEffect(() => {
    if (skipMotion) {
      setOpened(true);
      progress.value = 1;
      return;
    }
    if (!userId || !pick) return;
    let cancelled = false;
    isRevealOpenedToday(userId, timeZone || 'UTC', now)
      .then((openedToday) => {
        if (cancelled) return;
        if (openedToday) {
          setOpened(true);
          progress.value = 1;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pick, userId, todayYmd, skipMotion, progress]);

  useEffect(() => {
    if (skipMotion) {
      progress.value = 1;
      return;
    }
    if (playMotion) return;
    progress.value = opened ? 1 : 0;
  }, [opened, playMotion, skipMotion, progress]);

  const open = useCallback(() => {
    if (opened || !pick) return;
    oneShortHaptic();
    if (!skipMotion) {
      progress.value = withTiming(1, {
        duration: REVEAL_UNFOLD_MS,
        easing: Easing.out(Easing.cubic),
      });
      setPlayMotion(true);
    }
    setOpened(true);
    if (userId) {
      AsyncStorage.setItem(revealOpenedStorageKey(userId), todayYmd).catch(() => {});
    }
  }, [opened, pick, skipMotion, userId, todayYmd, progress]);

  const unfold = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));

  if (!pick) {
    return (
      <ThemedText type="small" themeColor="textSecondary" testID="reveal-empty">
        {REVEAL_EMPTY}
      </ThemedText>
    );
  }

  const body =
    opened || skipMotion ? (
      <Animated.View style={unfold} testID="reveal-content">
        <ThemedText style={styles.text}>{pick.text}</ThemedText>
      </Animated.View>
    ) : (
      <ThemedText type="smallBold" testID="reveal-sealed">
        {REVEAL_SEALED_PROMPT}
      </ThemedText>
    );

  const card = (
    <ThemedView type="backgroundElement" style={styles.card} testID="reveal-card">
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        {REVEAL_LABEL}
      </ThemedText>
      {body}
    </ThemedView>
  );

  if (opened || skipMotion) {
    return card;
  }

  return (
    <ThemedPressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel="Open today's note">
      {card}
    </ThemedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  kicker: {
    textTransform: 'none',
  },
  text: {
    lineHeight: 26,
  },
});
