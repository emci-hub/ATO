import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { recordScenario, recordScenarioDismiss, type Me } from '@/lib/me';
import { parseSageKnowsState } from '@/lib/sage-knows';
import { RANKING_SKIP, SCENARIO_LABEL, SCENARIO_LEDE } from '@/lib/sage-copy';
import {
  resolveScenario,
  type ScenarioPole,
  type ScenarioPrompt,
} from '@/lib/scenario';
import { traitStateFromRow } from '@/lib/traits';
import { useAppearance } from '@/lib/theme/context';
import { controlBorderColor } from '@/lib/theme/chrome';

const SWIPE_COMMIT = 72;

/**
 * Optional-depth scenario. One extra axis, two forced choices.
 * Swipe or tap. Inferred `self_game` on pick. Same for every axis.
 */
export function ScenarioCard({
  me,
  onUpdated,
  forcePick,
}: {
  me?: Me;
  onUpdated?: () => Promise<void>;
  forcePick?: ScenarioPrompt;
}) {
  const traits = me ? traitStateFromRow(me) : null;
  const prompt = forcePick
    ? forcePick
    : me && traits
      ? resolveScenario({
          values: traits.values,
          knows: parseSageKnowsState(me.sage_knows),
          timeZone: me.timezone || 'UTC',
        })
      : null;

  if (!prompt) return null;

  return (
    <ScenarioCardInner prompt={prompt} userId={forcePick ? undefined : me?.id} onUpdated={onUpdated} />
  );
}

function ScenarioCardInner({
  prompt,
  userId,
  onUpdated,
}: {
  prompt: ScenarioPrompt;
  userId?: string;
  onUpdated?: () => Promise<void>;
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const [busy, setBusy] = useState<'high' | 'low' | 'skip' | null>(null);
  const dragX = useSharedValue(0);

  async function pick(pole: ScenarioPole) {
    if (busy) return;
    if (!userId) return;
    setBusy(pole);
    try {
      await recordScenario(userId, prompt.axis, pole);
      if (onUpdated) await onUpdated();
    } catch (err) {
      console.log('[scenario] save error:', err);
    } finally {
      setBusy(null);
    }
  }

  async function skip() {
    if (busy || !userId) return;
    setBusy('skip');
    try {
      await recordScenarioDismiss(userId, prompt.axis);
      if (onUpdated) await onUpdated();
    } catch (err) {
      console.log('[scenario] skip error:', err);
    } finally {
      setBusy(null);
    }
  }

  const commit = (pole: ScenarioPole) => {
    void pick(pole);
  };

  const gesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      if (reduceMotion) return;
      dragX.value = event.translationX;
    })
    .onEnd((event) => {
      const x = event.translationX;
      dragX.value = withTiming(0, { duration: reduceMotion ? 0 : 160 });
      if (x > SWIPE_COMMIT) runOnJS(commit)('high');
      else if (x < -SWIPE_COMMIT) runOnJS(commit)('low');
    });

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  }));

  return (
    <ThemedView type="backgroundElement" style={styles.card} testID="scenario-card">
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        {SCENARIO_LABEL}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{SCENARIO_LEDE}</ThemedText>
      <GestureHandlerRootView>
        <GestureDetector gesture={gesture}>
          <Animated.View style={slide} testID={`scenario-${prompt.axis}`}>
            <ThemedText style={styles.setup}>{prompt.def.setup}</ThemedText>
            <View style={styles.choices}>
              <ThemedPressable
                onPress={() => void pick('high')}
                disabled={busy !== null || !userId}
                style={[
                  styles.choice,
                  { borderColor: controlBorderColor(theme) },
                  (busy !== null || !userId) && styles.disabled,
                ]}
                testID="scenario-high">
                <ThemedText type="smallBold">{prompt.def.high.label}</ThemedText>
              </ThemedPressable>
              <ThemedPressable
                onPress={() => void pick('low')}
                disabled={busy !== null || !userId}
                style={[
                  styles.choice,
                  { borderColor: controlBorderColor(theme) },
                  (busy !== null || !userId) && styles.disabled,
                ]}
                testID="scenario-low">
                <ThemedText type="smallBold">{prompt.def.low.label}</ThemedText>
              </ThemedPressable>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
      <ThemedPressable
        onPress={() => void skip()}
        disabled={busy !== null || !userId}
        style={styles.quietButton}
        testID="scenario-skip">
        <ThemedText type="small" themeColor="textSecondary">
          {busy === 'skip' ? 'Saving\u2026' : RANKING_SKIP}
        </ThemedText>
      </ThemedPressable>
    </ThemedView>
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
  setup: {
    lineHeight: 26,
  },
  choices: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  choice: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
  },
  quietButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  disabled: {
    opacity: 0.5,
  },
});
