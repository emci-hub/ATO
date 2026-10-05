import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PixelFace } from '@/components/pixel-face';
import { ShareCardSheet, type SharePerson } from '@/components/share-card';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DAILY_PICK_COPY_REVIEWED, pickForYmd } from '@/lib/daily-pick/bank';
import {
  fetchPickSplit,
  loadTodayAnswer,
  saveTodayAnswer,
  type PickSplit,
} from '@/lib/daily-pick/store';
import { reactionLine } from '@/lib/daily-pick/reaction';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { TAP_MOODS, type TapMood } from '@/lib/kenney/tap-moods';
import type { KenneyRecipe } from '@/lib/kenney/types';
import { controlBorderColor } from '@/lib/theme/chrome';
import { useAppearance } from '@/lib/theme/context';

export const TODAY_PICK_KICKER = 'today’s pick';
export const TODAY_PICK_SHARE_LABEL = 'Ask a friend';
export const TODAY_PICK_SPLIT_WAITING = 'The split shows once 20 people have picked today.';
export const TODAY_PICK_UNSAVED = 'Saved on this phone. It syncs once there’s a connection.';

/**
 * Home: Today's Pick (emci, 2026-10-05) — one either/or question a day, the
 * same for everyone, answered with one tap. The mini guy asks it; after the
 * tap he answers with one of the approved daily lines about the end you lean
 * to, and the card shows how everyone split (only from 20 answers). Share
 * sends the question, never your answer. No model call anywhere.
 */
export function TodayPickCard({
  userId,
  ymd,
  me,
  face,
  onAnswered,
}: {
  userId: string;
  ymd: string;
  me: SharePerson;
  face?: KenneyRecipe;
  /** After a saved answer: the trait moved, so the screen re-reads it. */
  onAnswered?: () => void;
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const pick = pickForYmd(ymd);
  const [chosen, setChosen] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [split, setSplit] = useState<PickSplit | null>(null);
  const [sharing, setSharing] = useState(false);
  // An answer kept on the phone only (no connection): it is sent again next time.
  const [unsaved, setUnsaved] = useState(false);
  const tapMoodRef = useRef<((mood: TapMood) => void) | null>(null);
  const border = controlBorderColor(theme);

  useEffect(() => {
    let cancelled = false;
    setChosen(null);
    setSplit(null);
    setLoaded(false);
    loadTodayAnswer(userId, ymd, pick)
      .then((answer) => {
        if (cancelled) return;
        setChosen(answer);
        if (answer != null) void fetchPickSplit(pick.id, ymd).then((s) => !cancelled && setSplit(s));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, ymd, pick]);

  async function choose(index: number) {
    if (chosen != null || !loaded) return;
    setChosen(index);
    tapMoodRef.current?.(TAP_MOODS.thumbsUp);
    const saved = await saveTodayAnswer(userId, ymd, pick, index);
    setUnsaved(!saved);
    if (saved) {
      onAnswered?.();
      setSplit(await fetchPickSplit(pick.id, ymd));
    }
  }

  const reaction = chosen != null ? reactionLine(pick, chosen, ymd) : null;
  const radius = theme.cutCorners ? 0 : Math.min(theme.radius, 18);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.topRow}>
        {face ? (
          <View style={styles.face}>
            <PixelFace
              recipe={face}
              size={44}
              showUp={me.show_up}
              animated={!reduceMotion}
              tapMoodRef={tapMoodRef}
              pressable={false}
            />
          </View>
        ) : null}
        <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
          {TODAY_PICK_KICKER}
        </ThemedText>
      </View>
      {!DAILY_PICK_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
        <ThemedText type="code" themeColor="textSecondary">
          Draft copy — waiting on emci review.
        </ThemedText>
      ) : null}

      {/* The question, asked by the mini guy. */}
      <View style={[styles.bubble, { backgroundColor: theme.background, borderColor: border, borderRadius: radius }]}>
        {face ? <View style={[styles.tail, { backgroundColor: theme.background, borderColor: border }]} /> : null}
        <ThemedText style={styles.prompt}>{pick.prompt}</ThemedText>
      </View>

      <View style={styles.options}>
        {pick.options.map((option, index) => {
          const picked = chosen === index;
          const other = chosen != null && !picked;
          const share = split ? split.shares[index as 0 | 1] : null;
          return (
            <ThemedPressable
              key={option.text}
              accessibilityRole="button"
              accessibilityState={{ selected: picked, disabled: chosen != null }}
              accessibilityLabel={share != null ? `${option.text}, ${Math.round(share * 100)} percent` : option.text}
              disabled={chosen != null || !loaded}
              onPress={() => void choose(index)}
              style={[
                styles.option,
                {
                  borderColor: picked ? theme.accent : border,
                  borderWidth: picked ? 2 : 1,
                  borderRadius: theme.cutCorners ? 0 : 999,
                  opacity: other ? 0.6 : 1,
                  overflow: 'hidden',
                },
              ]}>
              {/* After answering, each option fills to its share of everyone. */}
              {share != null ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.fill,
                    { width: `${Math.round(share * 100)}%`, backgroundColor: theme.backgroundSelected },
                  ]}
                />
              ) : null}
              <ThemedText type="smallBold" style={styles.optionText}>
                {option.text}
              </ThemedText>
              {share != null ? (
                <ThemedText type="codeBold" themeColor="textSecondary">
                  {Math.round(share * 100)}%
                </ThemedText>
              ) : picked ? (
                <ThemedText type="codeBold" style={{ color: theme.accent }}>
                  ✓
                </ThemedText>
              ) : null}
            </ThemedPressable>
          );
        })}
      </View>

      {chosen != null ? (
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(300)} style={styles.after}>
          {reaction ? <ThemedText style={styles.reaction}>{reaction.text}</ThemedText> : null}
          {unsaved ? (
            <ThemedText type="small" themeColor="textSecondary">
              {TODAY_PICK_UNSAVED}
            </ThemedText>
          ) : !split ? (
            <ThemedText type="small" themeColor="textSecondary">
              {TODAY_PICK_SPLIT_WAITING}
            </ThemedText>
          ) : null}
        </Animated.View>
      ) : null}

      <View style={styles.actions}>
        <ThemedPressable
          accessibilityRole="button"
          accessibilityLabel="Share today’s pick"
          onPress={() => setSharing(true)}
          style={[styles.chip, { borderColor: border, borderRadius: theme.cutCorners ? 0 : 999 }]}>
          <ThemedText type="smallBold">{TODAY_PICK_SHARE_LABEL}</ThemedText>
        </ThemedPressable>
      </View>

      {/* The question only — never the answer. */}
      <ShareCardSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        me={me}
        content={{ kind: 'line', text: pick.prompt }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  face: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  kicker: {
    textTransform: 'uppercase',
  },
  bubble: {
    borderWidth: 1,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
  tail: {
    position: 'absolute',
    top: -7,
    left: 22,
    width: 12,
    height: 12,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  prompt: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  options: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  optionText: {
    flex: 1,
  },
  after: {
    gap: Spacing.one,
  },
  reaction: {
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: Spacing.one,
  },
  chip: {
    borderWidth: 1,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
});
