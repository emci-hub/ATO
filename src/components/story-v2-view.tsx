/**
 * Story v2 swipe cards (emci 2026-10-13): one beat per card, Wrapped-style,
 * no section labels, one shareable title + reveal. Motion: fade+rise by
 * default, a bigger rise when the appearance is slow (Zen), a plain
 * cross-fade under Reduce Motion — never fully static.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppearance } from '@/lib/theme/context';
import { isStoryV2, type StoryCard } from '@/lib/story-card';
import { categoryAxisCodes, categoryDisplayName } from '@/lib/category-labels';
import { categoryLeans, categoryScore } from '@/lib/category-deep-dive/dive';
import { categoryById } from '@/lib/categories';
import type { TraitTrack } from '@/lib/trait-stability';

const PLOT_B_HINT = 'The other way it could have gone';
const SHARE_LABEL = 'Share title';

type Beat = { key: string; text: string; kind: 'body' | 'punch' | 'reveal' | 'next' | 'recap' };

export function StoryV2View({
  card,
  categoryIds,
  tracks,
}: {
  card: StoryCard;
  categoryIds: readonly string[];
  tracks: readonly TraitTrack[];
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [plotOpen, setPlotOpen] = useState(false);
  const [builtOpen, setBuiltOpen] = useState(false);

  const beats: Beat[] = useMemo(() => {
    if (!isStoryV2(card)) return [];
    const rows: Beat[] = [
      { key: 'hook', text: card.hook!, kind: 'body' },
      { key: 'twist', text: card.twist!, kind: 'body' },
      { key: 'move', text: card.move!, kind: 'body' },
      { key: 'punch', text: card.punchline!, kind: 'punch' },
      { key: 'reveal', text: card.reveal!, kind: 'reveal' },
    ];
    if (card.next) rows.push({ key: 'next', text: card.next, kind: 'next' });
    rows.push({
      key: 'recap',
      text: [card.hook, card.twist, card.move, card.punchline, card.reveal, card.next].filter(Boolean).join('\n\n'),
      kind: 'recap',
    });
    return rows;
  }, [card]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  }, [width]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const i = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(Math.max(0, Math.min(beats.length - 1, i)));
    },
    [width, beats.length],
  );

  const dramatic = !reduceMotion && theme.motionMs >= 500;
  const entering = reduceMotion
    ? FadeIn.duration(180)
    : dramatic
      ? FadeInDown.duration(Math.min(theme.motionMs, 420)).springify()
      : FadeInDown.duration(Math.min(Math.max(theme.motionMs, 160), 250));

  const built = categoryIds
    .map((id) => categoryById(id))
    .filter((def): def is NonNullable<ReturnType<typeof categoryById>> => def != null)
    .map((def) => {
      const score = categoryScore(categoryLeans(def, tracks));
      return `${categoryDisplayName(def)} ${categoryAxisCodes(def)}${score != null ? ` ${score}` : ''}`;
    });

  const title = card.title ?? '';
  const current = beats[index];

  return (
    <View style={styles.wrap} onLayout={onLayout} testID="story-v2-view">
      {title ? (
        <ThemedText type="heading" style={styles.title}>
          {title}
        </ThemedText>
      ) : null}

      <View style={styles.dots} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: beats.length, now: index + 1 }}>
        {beats.map((row, i) => (
          <View
            key={row.key}
            style={[
              styles.dot,
              { backgroundColor: i === index ? theme.accent : theme.border },
            ]}
          />
        ))}
      </View>

      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          onScrollEndDrag={onScroll}
          keyboardShouldPersistTaps="handled">
          {beats.map((row) => (
            <View key={row.key} style={{ width, minHeight: 160 }}>
              <Animated.View key={`${row.key}-${index === beats.indexOf(row) ? 'on' : 'off'}`} entering={entering}>
                {row.kind === 'punch' ? (
                  <ThemedText type="subheading" style={styles.punch}>
                    {row.text}
                  </ThemedText>
                ) : row.kind === 'reveal' ? (
                  <View style={[styles.pill, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
                    <ThemedText type="smallBold">{row.text}</ThemedText>
                  </View>
                ) : row.kind === 'next' ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.next}>
                    → {row.text}
                  </ThemedText>
                ) : (
                  <ThemedText style={row.kind === 'recap' ? styles.recap : undefined}>{row.text}</ThemedText>
                )}
              </Animated.View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ThemedText>{current?.text}</ThemedText>
      )}

      {card.otherWay ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={PLOT_B_HINT}
          onPress={() => setPlotOpen((v) => !v)}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <ThemedText type="small" themeColor="textSecondary">
            {plotOpen ? card.otherWay : `${PLOT_B_HINT} →`}
          </ThemedText>
        </Pressable>
      ) : null}

      {title && card.reveal ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={SHARE_LABEL}
          onPress={() => {
            void Share.share({ message: `${title}\n${card.reveal}`, title });
          }}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <ThemedText type="link">{SHARE_LABEL}</ThemedText>
        </Pressable>
      ) : null}

      {built.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Built from"
          onPress={() => setBuiltOpen((v) => !v)}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <ThemedText type="small" themeColor="textSecondary">
            {builtOpen ? `Built from: ${built.join(' · ')}` : 'ⓘ'}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  title: { marginBottom: 4 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  punch: { fontWeight: '600' },
  pill: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth },
  next: { fontStyle: 'italic' },
  recap: { lineHeight: 22 },
  cta: { alignSelf: 'flex-start', paddingVertical: Spacing.one, minHeight: 32, justifyContent: 'center' },
  pressed: { opacity: 0.8 },
});
