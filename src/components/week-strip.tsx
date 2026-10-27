import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMotionActive } from '@/hooks/use-motion-active';
import { useTheme } from '@/hooks/use-theme';
import { loadDailyLineState } from '@/lib/daily-line/state';
import { streakWithRest } from '@/lib/home-path';
import { EASE_OUT } from '@/lib/motion-tokens';
import { WEEK_STRIP_TITLE } from '@/lib/polish-copy';
import { useAppearance } from '@/lib/theme/context';
import { weekDots, type WeekDot } from '@/lib/week-strip';

/** Cells rise one after another (§PHASE-08): 60 ms apart, 500 ms each. */
export const CELL_STAGGER_MS = 60;
export const CELL_RISE_MS = 500;
/** The pink ring around today before check-in: grows 0 → 4 px over 2.4 s. */
export const RING_LOOP_MS = 2400;
export const RING_GROW_PX = 4;
/** Reduce Motion (R19): a fixed ring whose opacity breathes, half as fast. */
export const RING_RM_BREATH_MS = RING_LOOP_MS * 2;
export const RING_COLOR = '#EC4899';
const DOT = 26;

/**
 * Home: this week as seven dots, filled for each day today's line was opened
 * (the history is already on the phone — no read, no model call). Replaces the
 * old "N days in a row" text. Cells rise in, one free rest day a week shows as
 * a moon, and today gets a soft pink ring until it is checked in (R19: under
 * Reduce Motion the ring stays the same size and only its opacity breathes).
 */
export function WeekStrip({
  userId,
  todayYmd,
  refreshKey,
  checkedIn,
}: {
  userId: string;
  todayYmd: string;
  /** Changes when today's line lands or is reacted to. */
  refreshKey?: unknown;
  /** Today's check-in: false = the ring shows. null/undefined = not known yet. */
  checkedIn?: boolean | null;
}) {
  const [dots, setDots] = useState<WeekDot[] | null>(null);
  const [rest, setRest] = useState<ReadonlySet<string>>(new Set());
  const systemReduce = useReducedMotion();
  const { reduceMotion: appReduce } = useAppearance();
  const reduceMotion = systemReduce || appReduce;

  useEffect(() => {
    let cancelled = false;
    loadDailyLineState(userId)
      .then((state) => {
        if (cancelled) return;
        setDots(weekDots(todayYmd, state.days));
        setRest(new Set(streakWithRest(state.days.map((day) => day.ymd), todayYmd).restDays));
      })
      .catch((err) => console.log('[week-strip] load error:', err));
    return () => {
      cancelled = true;
    };
  }, [userId, todayYmd, refreshKey]);

  if (!dots) return null;
  const opened = dots.filter((dot) => dot.opened).length;
  const restCount = dots.filter((dot) => rest.has(dot.ymd) && !dot.opened).length;

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.card}
      accessible
      accessibilityLabel={`${WEEK_STRIP_TITLE}: opened on ${opened} of 7 days${restCount ? `, ${restCount} rest day` : ''}`}>
      <View style={styles.head}>
        <ThemedText type="smallBold">{WEEK_STRIP_TITLE}</ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {opened} of 7
        </ThemedText>
      </View>
      <View style={styles.row}>
        {dots.map((dot, i) => (
          <Animated.View
            key={dot.ymd}
            style={styles.day}
            entering={
              reduceMotion
                ? FadeIn.duration(300)
                : FadeInDown.delay(i * CELL_STAGGER_MS).duration(CELL_RISE_MS).easing(EASE_OUT)
            }>
            <ThemedText type="code" themeColor="textSecondary" style={styles.letter}>
              {dot.letter}
            </ThemedText>
            <Dot
              dot={dot}
              reduceMotion={reduceMotion}
              rested={rest.has(dot.ymd) && !dot.opened}
              ring={dot.isToday && checkedIn === false}
            />
          </Animated.View>
        ))}
      </View>
    </ThemedView>
  );
}

function Dot({
  dot,
  reduceMotion,
  rested,
  ring,
}: {
  dot: WeekDot;
  reduceMotion: boolean;
  rested: boolean;
  ring: boolean;
}) {
  const theme = useTheme();
  const active = useMotionActive();
  const glow = useSharedValue(1);
  useEffect(() => {
    if (!dot.isToday || reduceMotion || !active) {
      cancelAnimation(glow);
      glow.value = 1;
      return;
    }
    glow.value = withRepeat(withTiming(1.12, { duration: 1100 }), -1, true);
  }, [dot.isToday, reduceMotion, active, glow]);
  const breathe = useAnimatedStyle(() => ({ transform: [{ scale: glow.value }] }));

  // The ring: 0 → 4 px growth normally; Reduce Motion keeps it a fixed 2 px
  // ring and only breathes its opacity.
  const pulse = useSharedValue(0);
  const running = ring && active;
  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 0;
    if (!running) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: reduceMotion ? RING_RM_BREATH_MS : RING_LOOP_MS }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [running, reduceMotion, pulse]);
  const ringStyle = useAnimatedStyle(() => {
    const grow = reduceMotion ? 2 : pulse.value * RING_GROW_PX;
    return {
      opacity: reduceMotion ? 0.45 + 0.55 * pulse.value : 0.9 - 0.5 * pulse.value,
      top: -grow,
      left: -grow,
      right: -grow,
      bottom: -grow,
    };
  });

  const filled = dot.opened;
  if (rested) {
    return (
      <View style={styles.dotHost} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <MaterialCommunityIcons name="weather-night" size={DOT - 4} color={theme.textSecondary} />
      </View>
    );
  }
  return (
    <View style={styles.dotHost}>
      {ring ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { borderColor: RING_COLOR, borderRadius: theme.cutCorners ? 6 : 999 },
            ringStyle,
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: filled ? theme.accent : 'transparent',
            borderColor: dot.isToday ? theme.accent : theme.border,
            borderStyle: filled || dot.isToday ? 'solid' : 'dashed',
            borderWidth: dot.isToday && !filled ? 2 : filled ? 0 : 1.5,
            opacity: dot.future ? 0.45 : 1,
            borderRadius: theme.cutCorners ? 4 : 999,
          },
          dot.isToday ? breathe : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    alignItems: 'center',
    gap: Spacing.one,
    flex: 1,
  },
  letter: {
    fontSize: 11,
  },
  dotHost: {
    width: DOT,
    height: DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  dot: {
    width: DOT,
    height: DOT,
  },
});
