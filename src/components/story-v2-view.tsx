/**
 * Story swipe cards (emci 2026-10-13): one beat per card, Wrapped-style.
 * v3 = script (📍 setting, one sentence per line, bold speakers, card 6).
 * v2 = six-beat prose. Reduce Motion = 180 ms cross-fade, never static.
 * Motion Full = springy fade-and-rise. VoiceOver Previous/Next + pager.
 * Dynamic Type stays on.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { isStoryV2, isStoryV3, type StoryCard, type StoryScriptLine } from '@/lib/story-card';
import { categoryAxisCodes, categoryDisplayName } from '@/lib/category-labels';
import { categoryLeans, categoryScore } from '@/lib/category-deep-dive/dive';
import { categoryById } from '@/lib/categories';
import type { TraitTrack } from '@/lib/trait-stability';

const PLOT_B_HINT = 'The other way it could have gone';
const SHARE_LABEL = 'Share title';
const PREV_BEAT = 'Previous beat';
const NEXT_BEAT = 'Next beat';

type Beat =
  | { key: string; kind: 'script'; lines: StoryScriptLine[]; settingTag?: string }
  | { key: string; kind: 'nextReveal'; next: string; reveal: string }
  | { key: string; kind: 'why' }
  | { key: string; kind: 'body' | 'punch' | 'reveal' | 'next' | 'recap'; text: string };

function parseJoinedLines(text: string): StoryScriptLine[] {
  return text
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const talk = /^\*\*([^*]+):\*\*\s*"([^"]+)"$/.exec(row);
      if (talk) return { kind: 'dialogue' as const, speaker: talk[1]!.trim(), text: talk[2]!.trim() };
      return { kind: 'narrator' as const, text: row };
    });
}

function ScriptLines({
  lines,
  settingTag,
}: {
  lines: readonly StoryScriptLine[];
  settingTag?: string;
}) {
  return (
    <View style={styles.script}>
      {settingTag ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.setting}>
          📍 {settingTag}
        </ThemedText>
      ) : null}
      {lines.map((line, i) =>
        line.kind === 'dialogue' ? (
          <ThemedText key={`${line.speaker}-${i}`}>
            <ThemedText type="smallBold">{line.speaker}:</ThemedText>
            {` "${line.text}"`}
          </ThemedText>
        ) : (
          <ThemedText key={`n-${i}`}>{line.text}</ThemedText>
        ),
      )}
    </View>
  );
}

function Card6Block({
  card,
  score,
}: {
  card: NonNullable<StoryCard['card6']>;
  score?: number | null;
}) {
  const scoreLine = card.scoreLine ?? (typeof score === 'number' ? `You scored ${score}.` : null);
  return (
    <View style={styles.script} accessibilityRole="summary">
      <ThemedText type="smallBold">Why this is you</ThemedText>
      <ThemedText>{`This is your ${card.categoryName}: ${card.leanPhrase}.`}</ThemedText>
      {scoreLine ? <ThemedText>{scoreLine}</ThemedText> : null}
      <ThemedText>{`Proof: ${card.evidence}.`}</ThemedText>
      <ThemedText>{card.tip}</ThemedText>
    </View>
  );
}

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
  const pagerRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [plotOpen, setPlotOpen] = useState(false);
  const [builtOpen, setBuiltOpen] = useState(false);

  const leadId = categoryIds[0];
  const leadDef = leadId ? categoryById(leadId) : undefined;
  const score = leadDef ? categoryScore(categoryLeans(leadDef, tracks)) : null;

  const beats: Beat[] = useMemo(() => {
    if (isStoryV3(card)) {
      const lines = card.lines ?? {
        hook: parseJoinedLines(card.hook ?? ''),
        twist: parseJoinedLines(card.twist ?? ''),
        move: parseJoinedLines(card.move ?? ''),
        punchline: parseJoinedLines(card.punchline ?? ''),
      };
      const rows: Beat[] = [
        { key: 'hook', kind: 'script', lines: lines.hook, settingTag: card.settingTag },
        { key: 'twist', kind: 'script', lines: lines.twist },
        { key: 'move', kind: 'script', lines: lines.move },
        { key: 'punch', kind: 'script', lines: lines.punchline },
        { key: 'next', kind: 'nextReveal', next: card.next ?? '', reveal: card.reveal ?? '' },
      ];
      if (card.card6) rows.push({ key: 'why', kind: 'why' });
      return rows;
    }
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

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(beats.length - 1, i));
      setIndex(next);
      if (width > 0) {
        pagerRef.current?.scrollTo({ x: next * width, animated: !reduceMotion });
      }
    },
    [beats.length, width, reduceMotion],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const i = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(Math.max(0, Math.min(beats.length - 1, i)));
    },
    [width, beats.length],
  );

  const entering = reduceMotion
    ? FadeIn.duration(180)
    : FadeInDown.duration(Math.min(Math.max(theme.motionMs, 240), 750)).springify();

  const built = categoryIds
    .map((id) => categoryById(id))
    .filter((def): def is NonNullable<ReturnType<typeof categoryById>> => def != null)
    .map((def) => {
      const builtScore = categoryScore(categoryLeans(def, tracks));
      return `${categoryDisplayName(def)} ${categoryAxisCodes(def)}${builtScore != null ? ` ${builtScore}` : ''}`;
    });

  const title = card.title ?? '';
  const beatLabel = `Story beat ${index + 1} of ${beats.length}`;

  return (
    <View style={styles.wrap} onLayout={onLayout} testID="story-v2-view">
      {title ? (
        <ThemedText type="heading" style={styles.title} accessibilityRole="header">
          {title}
        </ThemedText>
      ) : null}

      <View
        style={styles.dots}
        accessibilityRole="progressbar"
        accessibilityLabel={beatLabel}
        accessibilityValue={{ min: 1, max: beats.length, now: index + 1 }}>
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
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={beatLabel}
          accessibilityHint="Swipe or use Previous beat and Next beat"
          accessibilityValue={{ min: 1, max: beats.length, now: index + 1 }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') goTo(index + 1);
            if (e.nativeEvent.actionName === 'decrement') goTo(index - 1);
          }}>
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            onScrollEndDrag={onScroll}
            keyboardShouldPersistTaps="handled">
            {beats.map((row) => (
              <View key={row.key} style={{ width, minHeight: 220 }}>
                <Animated.View key={`${row.key}-${index === beats.indexOf(row) ? 'on' : 'off'}`} entering={entering}>
                  {row.kind === 'script' ? (
                    <ScriptLines lines={row.lines} settingTag={row.settingTag} />
                  ) : row.kind === 'nextReveal' ? (
                    <View style={styles.script}>
                      {row.next ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          Next: {row.next}
                        </ThemedText>
                      ) : null}
                      <ThemedText type="smallBold" style={styles.revealItalic}>
                        {row.reveal}
                      </ThemedText>
                    </View>
                  ) : row.kind === 'why' && card.card6 ? (
                    <Card6Block card={card.card6} score={score} />
                  ) : row.kind === 'punch' ? (
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
                  ) : row.kind === 'body' || row.kind === 'recap' ? (
                    <ThemedText style={row.kind === 'recap' ? styles.recap : undefined}>{row.text}</ThemedText>
                  ) : null}
                </Animated.View>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : (
        <ThemedText>{title}</ThemedText>
      )}

      <View style={styles.pagerNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={PREV_BEAT}
          disabled={index <= 0}
          onPress={() => goTo(index - 1)}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed, index <= 0 && styles.disabled]}>
          <ThemedText type="small" themeColor="textSecondary">
            {PREV_BEAT}
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={NEXT_BEAT}
          disabled={index >= beats.length - 1}
          onPress={() => goTo(index + 1)}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed, index >= beats.length - 1 && styles.disabled]}>
          <ThemedText type="small" themeColor="textSecondary">
            {NEXT_BEAT}
          </ThemedText>
        </Pressable>
      </View>

      {card.otherWay ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={PLOT_B_HINT}
          accessibilityHint={plotOpen ? 'Hides the other way' : 'Shows the other way it could have gone'}
          onPress={() => setPlotOpen((v) => !v)}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <ThemedText type="small" themeColor="textSecondary" style={plotOpen ? styles.revealItalic : undefined}>
            {plotOpen ? card.otherWay : `${PLOT_B_HINT} →`}
          </ThemedText>
        </Pressable>
      ) : null}

      {title && card.reveal ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={SHARE_LABEL}
          onPress={() => {
            void Share.share({ message: `${title}\n${card.reveal}`, title }).catch(() => {});
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
  script: { gap: Spacing.one },
  setting: { marginBottom: 4 },
  punch: { fontWeight: '600' },
  pill: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth },
  next: { fontStyle: 'italic' },
  revealItalic: { fontStyle: 'italic' },
  recap: { lineHeight: 22 },
  pagerNav: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  cta: { alignSelf: 'flex-start', paddingVertical: Spacing.one, minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});
