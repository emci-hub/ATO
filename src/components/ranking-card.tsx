import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { recordRanking, recordRankingDismiss, type Me } from '@/lib/me';
import { moveItem, resolveRanking, type RankingItem, type RankingPrompt } from '@/lib/ranking';
import { AXIS_EDITOR_COPY, parseSageKnowsState } from '@/lib/sage-knows';
import { RANKING_LABEL, RANKING_LEDE, RANKING_SAVE, RANKING_SKIP } from '@/lib/sage-copy';
import { traitStateFromRow } from '@/lib/traits';
import { useAppearance } from '@/lib/theme/context';

const ROW = 72;

/**
 * Optional-depth ranking. Content is picked before render. One unfold of
 * statements — drag is the same for every axis. Direct `self_tap` on save.
 */
export function RankingCard({
  me,
  onUpdated,
  forcePick,
}: {
  me?: Me;
  onUpdated?: () => Promise<void>;
  /** Theme-lab: skip resolve and persist. */
  forcePick?: RankingPrompt;
}) {
  const traits = useMemo(() => (me ? traitStateFromRow(me) : null), [me]);
  const prompt = useMemo(() => {
    if (forcePick) return forcePick;
    if (!me || !traits) return null;
    return resolveRanking({
      values: traits.values,
      knows: parseSageKnowsState(me.sage_knows),
      timeZone: me.timezone || 'UTC',
    });
  }, [me, traits, forcePick]);

  if (!prompt) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.card} testID="ranking-card">
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        {RANKING_LABEL}
      </ThemedText>
      <RankingBody
        prompt={prompt}
        userId={forcePick ? undefined : me?.id}
        onUpdated={onUpdated}
      />
    </ThemedView>
  );
}

/** Drag-to-order interaction. Frame and mechanic label stay on the card. */
export function RankingBody({
  prompt,
  userId,
  onUpdated,
}: {
  prompt: RankingPrompt;
  userId?: string;
  onUpdated?: () => Promise<void>;
}) {
  const theme = useTheme();
  const [order, setOrder] = useState(prompt.order);
  const [busy, setBusy] = useState<'save' | 'skip' | null>(null);
  const copy = AXIS_EDITOR_COPY[prompt.axis];

  useEffect(() => {
    setOrder(prompt.order);
  }, [prompt.axis, prompt.weekKey]);

  async function run(kind: 'save' | 'skip', work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(kind);
    try {
      await work();
      if (onUpdated) await onUpdated();
    } catch (err) {
      console.log('[ranking] save error:', err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <ThemedText type="smallBold">{copy.label}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.lede}>
        {RANKING_LEDE}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Most you
      </ThemedText>
      <RankList items={prompt.items} order={order} onReorder={setOrder} />
      <ThemedText type="small" themeColor="textSecondary">
        Least you
      </ThemedText>
      <ThemedPressable
        filled
        onPress={() => {
          if (!userId) return;
          void run('save', () => recordRanking(userId, prompt.axis, order));
        }}
        disabled={busy !== null || !userId}
        style={[styles.primary, (busy !== null || !userId) && styles.disabled]}
        testID="ranking-save">
        <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
          {busy === 'save' ? 'Saving\u2026' : RANKING_SAVE}
        </ThemedText>
      </ThemedPressable>
      <ThemedPressable
        onPress={() => {
          if (!userId) return;
          void run('skip', () => recordRankingDismiss(userId, prompt.axis));
        }}
        disabled={busy !== null || !userId}
        style={styles.quietButton}
        testID="ranking-skip">
        <ThemedText type="small" themeColor="textSecondary">
          {busy === 'skip' ? 'Saving\u2026' : RANKING_SKIP}
        </ThemedText>
      </ThemedPressable>
    </>
  );
}

function RankList({
  items,
  order,
  onReorder,
}: {
  items: RankingItem[];
  order: string[];
  onReorder: (next: string[]) => void;
}) {
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const dragging = useSharedValue(-1);
  const dragY = useSharedValue(0);

  const move = useCallback(
    (from: number, to: number) => {
      onReorder(moveItem(order, from, to));
    },
    [order, onReorder],
  );

  return (
    <GestureHandlerRootView style={{ height: order.length * ROW }} testID="ranking-list">
      <View style={{ height: order.length * ROW }}>
        {order.map((id, index) => (
          <RankRow
            key={id}
            id={id}
            text={byId.get(id)?.text ?? ''}
            index={index}
            count={order.length}
            dragging={dragging}
            dragY={dragY}
            onMove={move}
          />
        ))}
      </View>
    </GestureHandlerRootView>
  );
}

function RankRow({
  id,
  text,
  index,
  count,
  dragging,
  dragY,
  onMove,
}: {
  id: string;
  text: string;
  index: number;
  count: number;
  dragging: SharedValue<number>;
  dragY: SharedValue<number>;
  onMove: (from: number, to: number) => void;
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const duration = reduceMotion ? 0 : 140;

  const gesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onStart(() => {
      dragging.value = index;
      dragY.value = 0;
    })
    .onUpdate((event) => {
      dragY.value = event.translationY;
    })
    .onEnd(() => {
      const dest = Math.max(0, Math.min(count - 1, index + Math.round(dragY.value / ROW)));
      if (dest !== index) runOnJS(onMove)(index, dest);
      dragging.value = -1;
      dragY.value = 0;
    });

  const style = useAnimatedStyle(() => {
    if (dragging.value === index) {
      return {
        zIndex: 3,
        transform: [{ translateY: dragY.value }],
      };
    }
    let shift = 0;
    if (dragging.value >= 0) {
      const from = dragging.value;
      const dest = Math.max(0, Math.min(count - 1, from + Math.round(dragY.value / ROW)));
      if (from < index && dest >= index) shift = -ROW;
      if (from > index && dest <= index) shift = ROW;
    }
    return {
      zIndex: 0,
      transform: [{ translateY: withTiming(shift, { duration }) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.rowWrap,
        { top: index * ROW, borderColor: theme.backgroundSelected },
        style,
      ]}
      testID={`ranking-row-${id}`}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[styles.handle, { backgroundColor: theme.backgroundSelected }]}
          accessibilityRole="adjustable"
          accessibilityLabel={`Move: ${text}`}
          accessibilityHint="Drag to change order, most you at the top"
          testID={`ranking-handle-${id}`}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {'\u2630'}
          </ThemedText>
        </Animated.View>
      </GestureDetector>
      <ThemedText style={styles.rowText}>{text}</ThemedText>
    </Animated.View>
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
  lede: {
    lineHeight: 22,
  },
  rowWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  handle: {
    width: 40,
    height: 44,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    lineHeight: 22,
    fontSize: 15,
  },
  primary: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  quietButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  disabled: {
    opacity: 0.5,
  },
});
